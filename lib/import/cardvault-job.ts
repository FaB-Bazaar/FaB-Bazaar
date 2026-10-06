/**
 * /admin/cardvault background jobs: the in-app twin of
 * scripts/import-new-set.ts (English prints + Cloudflare images), run by a
 * superadmin from the browser instead of a terminal.
 *
 *   preview — sweep CardVault + plan, write nothing
 *   ingest  — the same, then commit the plan in one transaction
 *   images  — upload every non-Cloudflare image in the set (resumable)
 *   probe   — HEAD every image_url in the set and list the dead ones
 *
 * CardVault etiquette is the CLI's: sequential, 2s + jitter between requests,
 * identified UA, 429 Retry-After honoured, abort after 3 consecutive
 * failures, hard request budget. Payloads are cached permanently in Postgres
 * (the container FS is read-only), so a re-run costs ~1 request.
 *
 * Jobs live in process memory — like the rate limiters, genuinely global only
 * because prod runs a single `nextjs` container. One job runs at a time; a
 * restart/deploy kills a running job (re-running is always safe: every step
 * is idempotent).
 */
import { nanoid } from 'nanoid';
import { cardLookupKeys, planSetIngest, summarizePlan, type SetIngestPlan } from './plan-set-ingest';
import { planIngestImageIds, type IngestRow } from '@/lib/images/ingest-image-ids';
import type { AsyncResult, Result } from '@/lib/services/contracts/common';
import type {
  CommitPlanResult, ImageRow, IngestSet,
} from '@/lib/services/postgres/cardvault/PostgresCardVaultService';
import type { ExistingCardRow, ExistingPrintingRow } from './plan-set-ingest';

export const CARDVAULT_API = 'https://api.cardvault.fabtcg.com/carddb/api/v1';
const UA = 'FaBBazaar-Pipeline/1.0 (+https://fabbazaar.app)';
export const CF_IMAGE_BASE = 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg';
export const DEFAULT_MAX_REQUESTS = 300;

export type CardVaultJobAction = 'preview' | 'ingest' | 'images' | 'probe';
export type CardVaultJobStatus = 'running' | 'done' | 'failed' | 'cancelled';

export interface PlanReport {
  summary: string;
  newCards: string[];
  enrichCount: number;
  retroLinks: number;
  counts: SetIngestPlan['counts'];
  newPrintings: Array<{ code: string | null; collector: string; name: string | null; foiling: string; edition: string; back: boolean }>;
  log: string[];
  warnings: string[];
}

export interface ProbeProblem {
  printingId: string;
  collectorNumber: string | null;
  foiling: string | null;
  edition: string | null;
  back: boolean;
  status: number | string;
  url: string | null;
}

export interface CardVaultJob {
  id: string;
  set: string;
  action: CardVaultJobAction;
  status: CardVaultJobStatus;
  startedAt: string;
  finishedAt?: string;
  startedBy: string;
  maxRequests: number;
  skipCollectors: string[];
  log: Array<{ t: string; level: 'info' | 'warn' | 'error'; msg: string }>;
  progress: { done: number; total: number; label: string } | null;
  cancelRequested: boolean;
  error?: string;
  result?: {
    requestsUsed?: number;
    plan?: PlanReport;
    commit?: CommitPlanResult;
    /** uploaded = now on Cloudflare; alreadyOnCloudflare = of those, the id existed (5409). */
    images?: { planned: number; uploaded: number; alreadyOnCloudflare: number; failed: number; fallbacks: number };
    probe?: { probed: number; ok: number; problems: ProbeProblem[] };
  };
}

/** The DB operations a job needs (PostgresCardVaultService satisfies it). */
export interface CardVaultStore {
  getSet(code: string): AsyncResult<IngestSet | null>;
  getCachedPayloads(slugs: string[]): AsyncResult<Record<string, unknown>>;
  savePayload(slug: string, payload: unknown): AsyncResult<void>;
  loadPlanContext(set: string, keys: { lssCardIds: string[]; talisharIds: string[] }):
    AsyncResult<{ existingPrintings: ExistingPrintingRow[]; cardRows: ExistingCardRow[] }>;
  commitPlan(plan: SetIngestPlan): AsyncResult<CommitPlanResult>;
  listPendingImageRows(set: string): AsyncResult<{ pending: IngestRow[]; universe: IngestRow[] }>;
  setImageUrl(printingId: string, imageUrl: string): AsyncResult<void>;
  listImageRows(set: string): AsyncResult<ImageRow[]>;
}

export interface CardVaultJobDeps {
  store: CardVaultStore;
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  cloudflare: { accountId: string; apiToken: string } | null;
  delayMs?: number;
}

class JobStop extends Error {
  constructor(public readonly status: 'failed' | 'cancelled', message: string) { super(message); }
}

const unwrap = <T>(r: Result<T>, what: string): T => {
  if (!r.success) throw new JobStop('failed', `${what}: ${r.error}`);
  return r.data;
};

function logTo(job: CardVaultJob, msg: string, level: 'info' | 'warn' | 'error' = 'info') {
  job.log.push({ t: new Date().toISOString(), level, msg });
  if (job.log.length > 2000) job.log.splice(0, job.log.length - 2000);
}

const checkCancel = (job: CardVaultJob) => {
  if (job.cancelRequested) throw new JobStop('cancelled', 'cancelled by user');
};

/** Polite sequential CardVault client with the CLI's budget + failure rules. */
function cardVaultClient(job: CardVaultJob, deps: CardVaultJobDeps) {
  const delay = deps.delayMs ?? 2000;
  let used = 0;
  let consecutiveFailures = 0;
  const get = async (url: string): Promise<any> => {
    checkCancel(job);
    if (used >= job.maxRequests) {
      throw new JobStop('failed', `request budget exhausted (${job.maxRequests}) — raise "Max CardVault requests" deliberately`);
    }
    if (used > 0) await deps.sleep(delay + Math.floor(Math.random() * 500));
    checkCancel(job);
    used++;
    const res = await deps.fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (res.status === 429) {
      const wait = Math.min(parseInt(res.headers.get('retry-after') ?? '30', 10) || 30, 120);
      logTo(job, `429 from CardVault — backing off ${wait}s`, 'warn');
      await deps.sleep(wait * 1000);
      return get(url);
    }
    if (!res.ok) {
      consecutiveFailures++;
      if (consecutiveFailures >= 3) {
        throw new JobStop('failed', `3 consecutive CardVault failures (last: ${res.status} ${url}) — aborting run`);
      }
      throw Object.assign(new Error(`${res.status} ${url}`), { retryable: true });
    }
    consecutiveFailures = 0;
    return res.json();
  };
  return { get, used: () => used };
}

async function planJob(job: CardVaultJob, deps: CardVaultJobDeps, set: IngestSet): Promise<SetIngestPlan> {
  const { store } = deps;
  const cv = cardVaultClient(job, deps);
  const code = job.set.toUpperCase();
  job.result = { ...job.result };

  // 1. sweep
  const search: any[] = [];
  for (let page = 1; ; page++) {
    const d = await cv.get(`${CARDVAULT_API}/advanced-search/?set_code=${encodeURIComponent(code)}&page_size=250&page=${page}`);
    search.push(...(d.results ?? []));
    if (!d.next) break;
  }
  const familySlugs = [...new Set(search.map((r) => r.card_id as string))];
  logTo(job, `sweep: ${search.length} prints across ${familySlugs.length} cards`);

  // 2. delta-driven family fetch, cache-first
  const cached = unwrap(await store.getCachedPayloads(familySlugs), 'payload cache');
  const payloads = new Map<string, any>();
  let fetched = 0, fromCache = 0;
  job.progress = { done: 0, total: familySlugs.length, label: 'card families' };
  for (const slug of familySlugs) {
    const hit = cached[slug] as any;
    const cachedCodes = new Set<string>(
      hit?.results?.flatMap((r: any) => (r.card_prints ?? []).map((p: any) => p.print_id)) ?? []);
    const wanted = search.filter((r) => r.card_id === slug)
      .flatMap((r) => [r.print_id, ...Object.values(r.languages ?? {})]) as string[];
    if (!hit || wanted.some((c) => c && !cachedCodes.has(c))) {
      try {
        const fresh = await cv.get(`${CARDVAULT_API}/card_id/${encodeURIComponent(slug)}/`);
        unwrap(await store.savePayload(slug, fresh), 'payload cache');
        payloads.set(slug, fresh);
        fetched++;
      } catch (e: any) {
        if (!e.retryable) throw e;
        logTo(job, `skipping ${slug}: ${e.message}`, 'warn');
      }
    } else {
      payloads.set(slug, hit);
      fromCache++;
    }
    job.progress.done++;
  }
  job.result.requestsUsed = cv.used();
  logTo(job, `payloads: ${fetched} fetched, ${fromCache} from cache (${cv.used()}/${job.maxRequests} requests used)`);

  // 3-4. plan against the DB
  const ctx = unwrap(await store.loadPlanContext(set.code, cardLookupKeys(familySlugs, payloads)), 'plan context');
  const plan = planSetIngest({
    set: code, setHasFirstEdition: set.hasFirstEdition, familySlugs, payloads,
    existingPrintings: ctx.existingPrintings, cardRows: ctx.cardRows,
    skipCollectors: new Set(job.skipCollectors.map((c) => c.toUpperCase())),
  });
  for (const w of plan.warnings) logTo(job, w, 'warn');
  const names = new Map([...plan.newCards, ...plan.enrichCards].map((c) => [c.card_unique_id, c.display_name]));
  job.result.plan = {
    summary: summarizePlan(plan),
    newCards: plan.newCards.map((c) => c.display_name),
    enrichCount: plan.enrichCards.length,
    retroLinks: plan.retroLinks.length,
    counts: plan.counts,
    newPrintings: plan.newPrintings.map((p) => ({
      code: p.lss_print_code ?? null, collector: p.collector_number, name: names.get(p.card_unique_id) ?? null,
      foiling: p.foiling, edition: p.edition, back: p.is_front_face === false,
    })),
    log: plan.log,
    warnings: plan.warnings,
  };
  logTo(job, `plan: ${job.result.plan.summary}`);
  return plan;
}

async function imagesJob(job: CardVaultJob, deps: CardVaultJobDeps) {
  const cf = deps.cloudflare;
  if (!cf) throw new JobStop('failed', 'CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN are not configured on this server');
  const { pending, universe } = unwrap(await deps.store.listPendingImageRows(job.set), 'pending images');
  const plan = planIngestImageIds(pending, universe);
  const fallbacks = plan.filter((p) => p.fallback);
  logTo(job, `images: ${plan.length} pending upload` +
    (fallbacks.length ? ` (${fallbacks.length} keeping printing_id ids: ${fallbacks[0].reason})` : ''));
  const images = { planned: plan.length, uploaded: 0, alreadyOnCloudflare: 0, failed: 0, fallbacks: fallbacks.length };
  job.result = { ...job.result, images };
  job.progress = { done: 0, total: plan.length, label: 'images' };
  for (const p of plan) {
    checkCancel(job);
    try {
      const imgRes = await deps.fetch(p.source_url);
      if (!imgRes.ok) {
        images.failed++;
        logTo(job, `image fetch failed for ${p.image_id} (${imgRes.status})`, 'warn');
      } else {
        const form = new FormData();
        form.append('file', await imgRes.blob(), `${p.image_id}.webp`);
        form.append('id', p.image_id);
        const cfRes = await deps.fetch(`https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/images/v1`,
          { method: 'POST', headers: { Authorization: `Bearer ${cf.apiToken}` }, body: form });
        const cfJson: any = await cfRes.json().catch(() => ({}));
        const exists = (cfJson.errors ?? []).some((e: any) => e.code === 5409 || /already exists/i.test(e.message ?? ''));
        if ((cfRes.ok && cfJson.success) || exists) {
          unwrap(await deps.store.setImageUrl(p.printing_id, `${CF_IMAGE_BASE}/${p.image_id}/public`), 'record image url');
          images.uploaded++;
          if (exists && !(cfRes.ok && cfJson.success)) images.alreadyOnCloudflare++;
        } else {
          images.failed++;
          logTo(job, `Cloudflare upload failed for ${p.image_id}: ${JSON.stringify(cfJson.errors ?? cfRes.status)}`, 'warn');
        }
      }
    } catch (e: any) {
      if (e instanceof JobStop) throw e;
      images.failed++;
      logTo(job, `upload error for ${p.image_id}: ${String(e?.message).slice(0, 120)}`, 'warn');
    }
    job.progress.done++;
    await deps.sleep(500);
  }
  logTo(job, `images: ${images.uploaded} on Cloudflare (${images.uploaded - images.alreadyOnCloudflare} new, ${images.alreadyOnCloudflare} already there)` +
    (images.failed ? `, ${images.failed} FAILED — run "Upload images" again to retry` : ''));
}

async function probeJob(job: CardVaultJob, deps: CardVaultJobDeps) {
  const rows = unwrap(await deps.store.listImageRows(job.set), 'image rows');
  const withUrl = rows.filter((r) => r.imageUrl);
  const problems: ProbeProblem[] = rows.filter((r) => !r.imageUrl).map((r) => ({
    printingId: r.printingId, collectorNumber: r.collectorNumber, foiling: r.foiling, edition: r.edition,
    back: r.isFrontFace === false, status: 'no image_url', url: null,
  }));
  job.progress = { done: 0, total: withUrl.length, label: 'images probed' };
  let ok = 0;
  let next = 0;
  const worker = async () => {
    while (next < withUrl.length) {
      checkCancel(job);
      const r = withUrl[next++];
      let status: number | string;
      try {
        const res = await deps.fetch(r.imageUrl!, {
          method: 'HEAD', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000),
        });
        status = res.status;
      } catch (e: any) {
        status = e?.name === 'TimeoutError' ? 'timeout' : 'error';
      }
      // A loading image still served from CardVault is not done: upload it.
      if (status === 200 && !r.imageUrl!.includes('imagedelivery.net')) status = 'not on Cloudflare';
      if (status === 200) ok++;
      else problems.push({
        printingId: r.printingId, collectorNumber: r.collectorNumber, foiling: r.foiling, edition: r.edition,
        back: r.isFrontFace === false, status, url: r.imageUrl,
      });
      job.progress!.done++;
    }
  };
  await Promise.all(Array.from({ length: 16 }, worker));
  problems.sort((a, b) => String(a.collectorNumber).localeCompare(String(b.collectorNumber)));
  job.result = { ...job.result, probe: { probed: withUrl.length, ok, problems } };
  logTo(job, `probe: ${withUrl.length} probed, ${ok} ok, ${problems.length} problem(s)`);
}

/** Run one job to completion, recording status/log/result on it. Never throws. */
export async function runCardVaultJob(job: CardVaultJob, deps: CardVaultJobDeps): Promise<void> {
  try {
    if (job.action === 'images') await imagesJob(job, deps);
    else if (job.action === 'probe') await probeJob(job, deps);
    else {
      const set = unwrap(await deps.store.getSet(job.set), 'set lookup');
      if (!set) throw new JobStop('failed', `set '${job.set}' is not registered — add the sets row first`);
      checkCancel(job);
      logTo(job, `${job.action === 'ingest' ? 'INGEST' : 'PREVIEW'} — ${job.set.toUpperCase()} (${set.name}) | budget ${job.maxRequests} requests`);
      const plan = await planJob(job, deps, set);
      if (job.action === 'ingest') {
        checkCancel(job);
        const commit = unwrap(await deps.store.commitPlan(plan), 'commit');
        job.result = { ...job.result, commit };
        logTo(job, `committed ${commit.cardsCreated} cards + ${commit.printingsCreated} printings, ` +
          `enriched ${commit.cardsEnriched}, ${commit.retroLinksSet} retro-links`);
      }
    }
    job.status = 'done';
  } catch (e: any) {
    job.status = e instanceof JobStop ? e.status : 'failed';
    job.error = e?.message ?? String(e);
    logTo(job, job.error!, job.status === 'cancelled' ? 'warn' : 'error');
  } finally {
    job.finishedAt = new Date().toISOString();
  }
}

// ── registry (process memory, survives dev HMR via globalThis) ─────────────
const g = globalThis as unknown as { __cardVaultJobs?: CardVaultJob[] };
const jobs = (): CardVaultJob[] => (g.__cardVaultJobs ??= []);
const KEEP = 20;

export function startCardVaultJob(
  params: { set: string; action: CardVaultJobAction; startedBy: string; maxRequests?: number; skipCollectors?: string[] },
  deps: CardVaultJobDeps,
): Result<CardVaultJob> {
  const running = jobs().find((j) => j.status === 'running');
  if (running) {
    return { success: false, error: `a ${running.action} job for ${running.set.toUpperCase()} is still running` };
  }
  const job: CardVaultJob = {
    id: nanoid(10),
    set: params.set.toLowerCase(),
    action: params.action,
    status: 'running',
    startedAt: new Date().toISOString(),
    startedBy: params.startedBy,
    maxRequests: params.maxRequests ?? DEFAULT_MAX_REQUESTS,
    skipCollectors: params.skipCollectors ?? [],
    log: [],
    progress: null,
    cancelRequested: false,
  };
  jobs().unshift(job);
  jobs().splice(KEEP);
  void runCardVaultJob(job, deps);
  return { success: true, data: job };
}

export const getCardVaultJob = (id: string) => jobs().find((j) => j.id === id) ?? null;
export const listCardVaultJobs = () => [...jobs()];

export function cancelCardVaultJob(id: string): boolean {
  const job = getCardVaultJob(id);
  if (!job || job.status !== 'running') return false;
  job.cancelRequested = true;
  return true;
}

/** Tests only. */
export function resetCardVaultJobs() { g.__cardVaultJobs = []; }
