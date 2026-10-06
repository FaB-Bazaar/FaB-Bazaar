import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  runCardVaultJob, startCardVaultJob, getCardVaultJob, cancelCardVaultJob, resetCardVaultJobs,
  type CardVaultJob, type CardVaultJobDeps, type CardVaultStore,
} from './cardvault-job';
import type { SetIngestPlan } from './plan-set-ingest';

const FIXTURES = join(__dirname, '__fixtures__', 'cardvault');
const SLUGS = ['viserai-the-forsaken--viserai-usurper', 'viserai-between-worlds--viserai-usurper'];
const payloads: Record<string, any> = Object.fromEntries(
  SLUGS.map((s) => [s, JSON.parse(readFileSync(join(FIXTURES, `${s}.json`), 'utf8'))]));
const API = 'https://api.cardvault.fabtcg.com/carddb/api/v1';

// The set sweep CardVault would return for these two families.
const sweep = {
  next: null,
  results: SLUGS.flatMap((slug) => payloads[slug].results[0].card_prints
    .filter((p: any) => p.print_language === 'en')
    .map((p: any) => ({ card_id: slug, print_id: p.print_id }))),
};

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });

/** Fake network: CardVault from fixtures, plus scripted image/Cloudflare responses. */
function fakeFetch(over: { onCardVault?: (url: string, n: number) => Response | undefined; other?: (url: string, init?: RequestInit) => Response } = {}) {
  const calls: string[] = [];
  let cv = 0;
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.startsWith(API)) {
      cv++;
      const scripted = over.onCardVault?.(url, cv);
      if (scripted) return scripted;
      if (url.includes('/advanced-search/')) return json(sweep);
      const slug = decodeURIComponent(url.split('/card_id/')[1].replace(/\/$/, ''));
      return payloads[slug] ? json(payloads[slug]) : json({ detail: 'nope' }, { status: 404 });
    }
    if (over.other) return over.other(url, init);
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;
  return { fn, calls, cardVaultCalls: () => cv };
}

function memoryStore(over: Partial<CardVaultStore> = {}) {
  const cache: Record<string, unknown> = {};
  const committed: SetIngestPlan[] = [];
  const imageUrls: Record<string, string> = {};
  const store: CardVaultStore = {
    getSet: async (code) => ({ success: true, data: code.toLowerCase() === 'iar' ? { code: 'iar', name: 'Usurp', hasFirstEdition: false } : null }),
    getCachedPayloads: async (slugs) => ({ success: true, data: Object.fromEntries(slugs.filter((s) => s in cache).map((s) => [s, cache[s]])) }),
    savePayload: async (slug, p) => { cache[slug] = p; return { success: true, data: undefined }; },
    loadPlanContext: async () => ({ success: true, data: { existingPrintings: [], cardRows: [] } }),
    commitPlan: async (plan) => {
      committed.push(plan);
      return { success: true, data: { cardsCreated: plan.newCards.length, cardsEnriched: 0, printingsCreated: plan.newPrintings.length, retroLinksSet: 0 } };
    },
    listPendingImageRows: async () => ({ success: true, data: { pending: [], universe: [] } }),
    setImageUrl: async (id, url) => { imageUrls[id] = url; return { success: true, data: undefined }; },
    listImageRows: async () => ({ success: true, data: [] }),
    ...over,
  };
  return { store, cache, committed, imageUrls };
}

const sleeps: number[] = [];
function deps(store: CardVaultStore, fetchFn: typeof fetch, extra: Partial<CardVaultJobDeps> = {}): CardVaultJobDeps {
  return { store, fetch: fetchFn, sleep: async (ms) => { sleeps.push(ms); }, cloudflare: null, ...extra };
}

const newJob = (action: CardVaultJob['action'], over: Partial<CardVaultJob> = {}): CardVaultJob => ({
  id: 'j1', set: 'IAR', action, status: 'running', startedAt: new Date().toISOString(), startedBy: 'u1',
  maxRequests: 300, skipCollectors: [], log: [], progress: null, cancelRequested: false, ...over,
});

beforeEach(() => { sleeps.length = 0; resetCardVaultJobs(); });

describe('runCardVaultJob — preview', () => {
  it('sweeps, fetches each uncached family once, caches it, and plans without writing', async () => {
    const m = memoryStore();
    const f = fakeFetch();
    const job = newJob('preview');
    await runCardVaultJob(job, deps(m.store, f.fn));
    expect(job.status).toBe('done');
    expect(f.cardVaultCalls()).toBe(1 + SLUGS.length);
    expect(Object.keys(m.cache).sort()).toEqual([...SLUGS].sort());
    expect(m.committed).toHaveLength(0);
    expect(job.result?.plan?.newCards.sort()).toEqual(['Viserai, Between Worlds', 'Viserai, Usurper', 'Viserai, the Forsaken']);
    expect(job.result?.plan?.newPrintings.length).toBeGreaterThan(0);
  });

  it('costs one request when every family is cached', async () => {
    const m = memoryStore();
    for (const s of SLUGS) m.cache[s] = payloads[s];
    const f = fakeFetch();
    const job = newJob('preview');
    await runCardVaultJob(job, deps(m.store, f.fn));
    expect(job.status).toBe('done');
    expect(f.cardVaultCalls()).toBe(1);
  });

  it('waits between CardVault requests (polite delay)', async () => {
    const m = memoryStore();
    await runCardVaultJob(newJob('preview'), deps(m.store, fakeFetch().fn));
    expect(sleeps.filter((ms) => ms >= 2000)).toHaveLength(SLUGS.length);
  });

  it('honours 429 Retry-After and retries', async () => {
    const m = memoryStore();
    const f = fakeFetch({ onCardVault: (_u, n) => (n === 1 ? json({}, { status: 429, headers: { 'retry-after': '7' } }) : undefined) });
    const job = newJob('preview');
    await runCardVaultJob(job, deps(m.store, f.fn));
    expect(job.status).toBe('done');
    expect(sleeps).toContain(7000);
  });

  it('fails when the request budget runs out', async () => {
    const m = memoryStore();
    const job = newJob('preview', { maxRequests: 2 });
    await runCardVaultJob(job, deps(m.store, fakeFetch().fn));
    expect(job.status).toBe('failed');
    expect(job.error).toMatch(/budget/);
  });

  it('fails fast on an unregistered set without touching CardVault', async () => {
    const m = memoryStore();
    const f = fakeFetch();
    const job = newJob('preview', { set: 'ZZZ' });
    await runCardVaultJob(job, deps(m.store, f.fn));
    expect(job.status).toBe('failed');
    expect(job.error).toMatch(/not registered/);
    expect(f.cardVaultCalls()).toBe(0);
  });

  it('stops between requests once cancelled', async () => {
    const m = memoryStore();
    const job = newJob('preview');
    const f = fakeFetch({ onCardVault: (_u, n) => { if (n === 1) job.cancelRequested = true; return undefined; } });
    await runCardVaultJob(job, deps(m.store, f.fn));
    expect(job.status).toBe('cancelled');
    expect(f.cardVaultCalls()).toBe(1);
  });
});

describe('runCardVaultJob — ingest', () => {
  it('commits the plan and reports what was written', async () => {
    const m = memoryStore();
    const job = newJob('ingest');
    await runCardVaultJob(job, deps(m.store, fakeFetch().fn));
    expect(job.status).toBe('done');
    expect(m.committed).toHaveLength(1);
    expect(job.result?.commit).toMatchObject({ cardsCreated: 3 });
  });

  it('passes skipCollectors to the planner', async () => {
    const m = memoryStore();
    const job = newJob('ingest', { skipCollectors: ['IAR106'] });
    await runCardVaultJob(job, deps(m.store, fakeFetch().fn));
    expect(m.committed[0].newPrintings.some((r) => r.collector_number === 'IAR106')).toBe(false);
  });
});

describe('runCardVaultJob — images', () => {
  const pendingRow = (id: string, cn: string) => ({
    printing_id: id, image_url: `https://lss.example/${cn}.webp`, lss_print_code: cn, language: 'en',
    collector_number: cn, foiling: 's', edition: 'n', is_extended_art: false, is_front_face: true, art_variations: [],
  });

  it('refuses to run without Cloudflare credentials', async () => {
    const m = memoryStore();
    const job = newJob('images');
    await runCardVaultJob(job, deps(m.store, fakeFetch().fn));
    expect(job.status).toBe('failed');
    expect(job.error).toMatch(/CLOUDFLARE/);
  });

  it('uploads under deterministic ids, treats "already exists" as success, and counts failures', async () => {
    const rows = [pendingRow('p1', 'IAR001'), pendingRow('p2', 'IAR002'), pendingRow('p3', 'IAR003')];
    const m = memoryStore({ listPendingImageRows: async () => ({ success: true, data: { pending: rows, universe: rows } }) });
    const f = fakeFetch({
      other: (url, init) => {
        if (url.endsWith('IAR003.webp')) return new Response('', { status: 404 });
        if (url.startsWith('https://lss.example/')) return new Response(new Blob(['img']));
        // Cloudflare: first upload succeeds, second already exists
        const body = init?.body as FormData;
        return body.get('id') === 'IAR001'
          ? json({ success: true, errors: [] })
          : json({ success: false, errors: [{ code: 5409, message: 'Resource already exists' }] }, { status: 409 });
      },
    });
    const job = newJob('images');
    await runCardVaultJob(job, deps(m.store, f.fn, { cloudflare: { accountId: 'acc', apiToken: 'tok' } }));
    expect(job.status).toBe('done');
    expect(job.result?.images).toMatchObject({ planned: 3, uploaded: 2, alreadyOnCloudflare: 1, failed: 1 });
    expect(m.imageUrls).toEqual({
      p1: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/IAR001/public',
      p2: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/IAR002/public',
    });
    expect(f.calls.some((c) => c.startsWith('POST https://api.cloudflare.com/client/v4/accounts/acc/images/v1'))).toBe(true);
  });
});

describe('runCardVaultJob — probe', () => {
  it('HEADs every image and lists the dead and missing ones', async () => {
    const m = memoryStore({
      listImageRows: async () => ({
        success: true,
        data: [
          { printingId: 'a', collectorNumber: 'IAR001', foiling: 's', edition: 'n', isFrontFace: true, imageUrl: 'https://imagedelivery.net/x/ok' },
          { printingId: 'b', collectorNumber: 'IAR002', foiling: 'r', edition: 'n', isFrontFace: true, imageUrl: 'https://img/dead' },
          { printingId: 'c', collectorNumber: 'IAR003', foiling: 's', edition: 'n', isFrontFace: true, imageUrl: null },
          { printingId: 'd', collectorNumber: 'IAR004', foiling: 's', edition: 'n', isFrontFace: true, imageUrl: 'https://lss.example/ok' },
        ],
      }),
    });
    const f = fakeFetch({ other: (url) => new Response(null, { status: url.endsWith('/ok') ? 200 : 404 }) });
    const job = newJob('probe');
    await runCardVaultJob(job, deps(m.store, f.fn));
    expect(job.status).toBe('done');
    expect(job.result?.probe).toMatchObject({ probed: 3, ok: 1 });
    // a loading image that is still served from CardVault is not done yet
    expect(job.result?.probe?.problems.map((p) => [p.collectorNumber, p.status])).toEqual([
      ['IAR002', 404], ['IAR003', 'no image_url'], ['IAR004', 'not on Cloudflare'],
    ]);
    expect(f.calls.every((c) => c.startsWith('HEAD '))).toBe(true);
  });
});

describe('job registry', () => {
  it('runs one job at a time and lets the running job be cancelled', async () => {
    const m = memoryStore();
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const slowStore = { ...m.store, getSet: async (c: string) => { await gate; return m.store.getSet(c); } };
    const d = deps(slowStore, fakeFetch().fn);

    const first = startCardVaultJob({ set: 'IAR', action: 'preview', startedBy: 'u1' }, d);
    expect(first.success).toBe(true);
    const second = startCardVaultJob({ set: 'IAR', action: 'preview', startedBy: 'u1' }, d);
    expect(second.success).toBe(false);

    const id = (first as { data: CardVaultJob }).data.id;
    expect(cancelCardVaultJob(id)).toBe(true);
    release();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(getCardVaultJob(id)?.status).toBe('cancelled');
  });
});
