#!/usr/bin/env npx tsx
/**
 * Upgrade low-resolution Cloudflare card images IN PLACE from CardVault's
 * 546×763 `large` renditions. The image id (and therefore image_url) never
 * changes, so no DB writes happen anywhere — one run fixes every environment
 * that shares the Cloudflare account.
 *
 * Per image, strictly SEQUENTIAL (at most one card is ever mid-replacement):
 *   1. GET the delivered image; skip if already >= --min-width (idempotent).
 *   2. Resolve a CardVault source (candidateSourceKeys fallback chain), and
 *      verify it serves 200 with a full-size body BEFORE touching anything.
 *   3. DELETE the Cloudflare id, immediately re-upload the CardVault bytes
 *      under the SAME id (CF Images has no overwrite). Upload retries with
 *      backoff; a persistent failure is logged CRITICAL — re-running repairs
 *      it (a 404 current image with a known source goes straight to upload).
 *
 * Contested fallback sources (two keys → one image) are skipped and reported,
 * never guessed — see lib/images/upgrade-plan.ts.
 *
 * Usage:
 *   npx tsx scripts/upgrade-image-resolution.ts --set=ros          # dry run
 *   npx tsx scripts/upgrade-image-resolution.ts --set=ros --live
 *   npx tsx scripts/upgrade-image-resolution.ts --set=ros --live --limit=5
 *
 * Required env (.env.local): POSTGRES_URL; plus CLOUDFLARE_ACCOUNT_ID and
 * CLOUDFLARE_API_TOKEN for --live.
 */
import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";
import { candidateSourceKeys, resolveFallbackClaims, type SourceClaim } from "@/lib/images/upgrade-plan";
import { imageWidth } from "@/lib/images/image-dimensions";

loadEnvConfig(process.cwd());

const argv = process.argv.slice(2);
const arg = (name: string) => {
  const hit = argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : undefined;
};
const LIVE = argv.includes("--live");
const SET = arg("--set")?.toLowerCase();
const LIMIT = arg("--limit") ? parseInt(arg("--limit")!, 10) : undefined;
const MIN_WIDTH = arg("--min-width") ? parseInt(arg("--min-width")!, 10) : 546;
const LANGUAGE = arg("--language") ?? "en";

if (!SET) {
  console.error("usage: upgrade-image-resolution.ts --set=<code> [--live] [--limit=N] [--language=en]");
  process.exit(1);
}

const CV_LARGE = "https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/large";
const UA = { "User-Agent": "Mozilla/5.0 (fabbazaar image-upgrade)" };
// Gentle pacing: at most 2 Cloudflare API calls per image, sequential, plus a
// small sleep — far inside the 1200-per-5-min global API cap.
const DELAY_MS = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function deliveredWidth(url: string): Promise<number | "missing" | "unreadable"> {
  const res = await fetch(url, { headers: UA });
  if (res.status === 404) return "missing";
  if (!res.ok) return "unreadable";
  const w = imageWidth(new Uint8Array(await res.arrayBuffer()));
  return w ?? "unreadable";
}

/** Verify a CardVault key serves a real image; returns its bytes on success. */
async function fetchSource(key: string): Promise<Uint8Array | null> {
  const res = await fetch(`${CV_LARGE}/${key}.webp`, { headers: UA });
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  const w = imageWidth(bytes);
  return w && w >= MIN_WIDTH ? bytes : null;
}

async function cfDelete(accountId: string, token: string, id: string): Promise<void> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${encodeURIComponent(id)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
  );
  const json = (await res.json()) as { success: boolean; errors: Array<{ code: number; message: string }> };
  // 5404 not-found is fine — a previous run may have deleted but failed to upload.
  if (!json.success && !json.errors?.some((e) => e.code === 5404 || /not found/i.test(e.message))) {
    throw new Error(`delete failed for ${id}: ${JSON.stringify(json.errors)}`);
  }
}

async function cfUpload(accountId: string, token: string, id: string, bytes: Uint8Array): Promise<void> {
  let lastErr = "";
  for (let attempt = 1; attempt <= 5; attempt++) {
    const form = new FormData();
    form.append("file", new Blob([bytes as BufferSource], { type: "image/webp" }), id);
    form.append("id", id);
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form },
    ).catch((e) => ({ ok: false, json: async () => ({ success: false, errors: [{ code: 0, message: String(e) }] }) }));
    const json = (await res.json()) as { success: boolean; errors: Array<{ code: number; message: string }> };
    if (json.success) return;
    // "already exists" right after our own delete means the delete hasn't
    // propagated yet (CF is eventually consistent) — the OLD image is still
    // registered, so accepting would silently keep the low-res version.
    // Delete again and retry until the id is genuinely free.
    if (json.errors?.some((e) => e.code === 5409 || /already exists/i.test(e.message))) {
      await sleep(1500 * attempt);
      await cfDelete(accountId, token, id);
      lastErr = "5409 already exists (delete not yet propagated)";
      await sleep(1500 * attempt);
      continue;
    }
    lastErr = JSON.stringify(json.errors);
    await sleep(1000 * attempt);
  }
  throw new Error(`upload failed for ${id} after 5 attempts: ${lastErr}`);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const { rows } = await pool.query<{ image_url: string }>(
    `SELECT DISTINCT image_url FROM printings
      WHERE set = $1 AND language = $2 AND image_url LIKE '%imagedelivery%'`,
    [SET, LANGUAGE],
  );
  await pool.end();
  console.log(`${rows.length} distinct ${SET}/${LANGUAGE} imagedelivery URLs`);

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
  const apiToken = process.env.CLOUDFLARE_API_TOKEN ?? "";
  if (LIVE && (!accountId || !apiToken)) {
    throw new Error("Missing CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN");
  }

  // ── Pass 1: measure + resolve (read-only) ──────────────────────────────────
  type Item = { url: string; key: string; width: number | "missing" | "unreadable"; source?: string };
  const needsWork: Item[] = [];
  let alreadyLarge = 0;
  const notDerivable: Item[] = [];
  const noSource: Item[] = [];

  for (const { image_url } of rows) {
    const key = image_url.split("/")[4];
    const width = await deliveredWidth(image_url);
    if (typeof width === "number" && width >= MIN_WIDTH) { alreadyLarge++; continue; }

    const candidates = candidateSourceKeys(key);
    if (candidates.length === 0) { notDerivable.push({ url: image_url, key, width }); continue; }

    let source: string | undefined;
    for (const c of candidates) {
      if (await fetchSource(c)) { source = c; break; }
    }
    if (!source) { noSource.push({ url: image_url, key, width }); continue; }
    needsWork.push({ url: image_url, key, width, source });
  }

  // Contested fallback sources → skip all claimants. Every key in the set
  // participates as a self-claim — including already-healthy ones — so a
  // fallback can never resolve onto an image that belongs to another printing
  // (learned the hard way: after run 1 healed ROS219-RF, a re-run saw
  // ROS219-RF-EA-EA's claim on it as uncontested and overwrote EA art).
  const claims: SourceClaim[] = [
    ...rows.map(({ image_url }) => { const k = image_url.split("/")[4]; return { key: k, source: k }; }),
    ...needsWork.map((i) => ({ key: i.key, source: i.source! })),
  ];
  const { collided } = resolveFallbackClaims(claims);
  // Filter by rejection, not acceptance: every key also carries an accepted
  // SELF-claim from the all-keys guard, so acceptedSet.has(key) is true even
  // for keys whose FALLBACK claim was rejected (this exact bug shipped wrong
  // art for 49 contested UPR/HNT keys on 2026-08-08 before being caught).
  const collidedSet = new Set(collided.map((c) => c.key));
  const todo = needsWork.filter((i) => !collidedSet.has(i.key));
  const limited = LIMIT ? todo.slice(0, LIMIT) : todo;

  console.log(`\nPlan:`);
  console.log(`  already >= ${MIN_WIDTH}px:   ${alreadyLarge}`);
  console.log(`  to upgrade:          ${todo.length}${LIMIT ? ` (limited to ${limited.length})` : ""}`);
  console.log(`  contested source:    ${collided.length}`);
  console.log(`  not derivable:       ${notDerivable.length} (nanoid keys)`);
  console.log(`  no CardVault source: ${noSource.length}`);
  for (const c of collided) console.log(`    contested: ${c.key} -> ${c.source}`);
  for (const i of notDerivable) console.log(`    nanoid: ${i.key} (${i.width}px)`);
  for (const i of noSource) console.log(`    no source: ${i.key} (${i.width}px)`);

  if (!LIVE) {
    console.log(`\nDry run — no writes. Full mapping:`);
    for (const i of todo) {
      const via = i.source === i.key ? "direct" : `fallback ${i.source}`;
      console.log(`  ${i.key} (${i.width}px) <- ${via}`);
    }
    return;
  }

  // ── Pass 2: sequential replace ─────────────────────────────────────────────
  let upgraded = 0, failed = 0;
  const failures: string[] = [];
  const t0 = Date.now();
  for (const [n, item] of limited.entries()) {
    try {
      // Re-fetch the source right before the delete so the unavailable window
      // stays as short as the delete+upload round-trips.
      const bytes = await fetchSource(item.source!);
      if (!bytes) throw new Error(`source vanished: ${item.source}`);
      if (item.width !== "missing") await cfDelete(accountId, apiToken, item.key);
      await cfUpload(accountId, apiToken, item.key, bytes);
      upgraded++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`${item.key}: ${msg}`);
      console.error(`  CRITICAL ${item.key}: ${msg} — re-run to repair`);
    }
    if ((n + 1) % 25 === 0 || n + 1 === limited.length) {
      const rate = (n + 1) / ((Date.now() - t0) / 1000);
      const eta = ((limited.length - n - 1) / rate / 60).toFixed(1);
      console.log(`[${n + 1}/${limited.length}] upgraded=${upgraded} failed=${failed} (~${eta} min left)`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nDone in ${((Date.now() - t0) / 60000).toFixed(1)} min: upgraded=${upgraded} failed=${failed}`);
  if (failures.length) {
    console.log(`Failures (re-run the same command to repair):`);
    for (const f of failures) console.log(`  ${f}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
