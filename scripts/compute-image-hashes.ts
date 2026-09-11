/**
 * scripts/compute-image-hashes.ts — build/refresh the card-scanner hash index.
 *
 * For every English printing with an image_url (optionally restricted to sets),
 * fetch the Cloudflare render, hash it (lib/scan/image-hash) and upsert into
 * printing_image_hashes. Images are held in memory only — nothing is written
 * to disk. Resumable: rows already hashed for the SAME image_url are skipped
 * unless --force. Identical renders shared by several printings are fetched once.
 *
 * Usage:
 *   npx tsx scripts/compute-image-hashes.ts --sets=pen,sea      # subset
 *   npx tsx scripts/compute-image-hashes.ts                     # all English
 *   npx tsx scripts/compute-image-hashes.ts --force --limit=50  # re-hash a sample
 *   --all-languages   include non-English printings (art is shared; off by default)
 *   --concurrency=N   parallel fetches (default 6)
 *
 * Env (from .env.local via @next/env): POSTGRES_URL — the DB it writes to.
 * Run it against the DB that needs the index (local Docker for dev, the VPS
 * container for prod); the nightly pipeline never touches this table.
 */
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { planHashWork } from '@/lib/scan/hash-plan';
import { hashImage } from '@/lib/scan/image-hash';

const argv = process.argv.slice(2);
const arg = (name: string) => { const hit = argv.find(a => a.startsWith(`${name}=`)); return hit ? hit.slice(name.length + 1) : undefined; };
const SETS = arg('--sets')?.split(',').map(s => s.trim()).filter(Boolean);
const FORCE = argv.includes('--force');
const ALL_LANGUAGES = argv.includes('--all-languages');
const LIMIT = arg('--limit') ? parseInt(arg('--limit')!, 10) : undefined;
const CONCURRENCY = arg('--concurrency') ? parseInt(arg('--concurrency')!, 10) : 6;
const UA = { 'User-Agent': 'fabbazaar-scan-index/1.0 (+https://fabbazaar.app)' };

async function fetchWithRetry(url: string, tries = 3): Promise<Buffer> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) { const e = new Error(`HTTP ${res.status}`); (e as any).permanent = true; throw e; }
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastErr = err;
      if ((err as any).permanent) throw err;
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

async function main() {
  const { db } = await import('@/lib/postgres/db');
  const { printings } = await import('@/lib/postgres/schema');
  const { and, eq, isNotNull } = await import('drizzle-orm');
  // lazy: lib/postgres/db reads POSTGRES_URL at import time, after loadEnvConfig above
  const { PostgresScanService } = await import('@/lib/services/postgres/scan/PostgresScanService');
  const service = new PostgresScanService();

  const rows = await db
    .select({ printingId: printings.printingId, imageUrl: printings.imageUrl, set: printings.set, language: printings.language })
    .from(printings)
    .where(ALL_LANGUAGES ? isNotNull(printings.imageUrl) : and(eq(printings.language, 'en'), isNotNull(printings.imageUrl)));

  const hashedRes = await service.listHashedImageUrls();
  if (!hashedRes.success) throw new Error(hashedRes.error);

  let plan = planHashWork(rows, hashedRes.data, { sets: SETS, force: FORCE });
  if (LIMIT) plan = plan.slice(0, LIMIT);
  const totalPrintings = plan.reduce((n, p) => n + p.printingIds.length, 0);
  console.log(`candidates=${rows.length} already-hashed=${hashedRes.data.size} to-fetch=${plan.length} images → ${totalPrintings} printings` +
    (SETS ? ` (sets: ${SETS.join(',')})` : '') + (FORCE ? ' [force]' : ''));
  if (plan.length === 0) { console.log('nothing to do'); process.exit(0); }

  let done = 0, failed = 0, upserted = 0;
  const failures: string[] = [];
  const started = Date.now();
  let cursor = 0;
  const pending: Array<{ printingId: string; phash: string; dhash: string; artHash: string; imageUrl: string }> = [];

  async function flush() {
    if (pending.length === 0) return;
    const batch = pending.splice(0, pending.length);
    const res = await service.upsertHashes(batch);
    if (!res.success) throw new Error(res.error);
    upserted += res.data.upserted;
  }

  async function worker() {
    while (cursor < plan.length) {
      const item = plan[cursor++];
      try {
        const bytes = await fetchWithRetry(item.imageUrl);
        const h = await hashImage(bytes, { deskew: false }); // renders are flat + full-bleed; deskew is for photos
        for (const printingId of item.printingIds) pending.push({ printingId, phash: h.phash, dhash: h.dhash, artHash: h.artHash, imageUrl: item.imageUrl });
      } catch (err) {
        failed++;
        failures.push(`${item.imageUrl}: ${err instanceof Error ? err.message : String(err)}`);
      }
      done++;
      if (pending.length >= 100) await flush();
      if (done % 100 === 0 || done === plan.length) {
        const rate = done / ((Date.now() - started) / 1000);
        console.log(`  ${done}/${plan.length} images (${failed} failed, ${upserted + pending.length} rows) ${rate.toFixed(1)} img/s`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));
  await flush();
  console.log(`done: ${upserted} rows upserted, ${failed} images failed, ${((Date.now() - started) / 1000).toFixed(0)}s`);
  if (failures.length) { console.log('failures:'); for (const f of failures.slice(0, 20)) console.log('  ' + f); if (failures.length > 20) console.log(`  … ${failures.length - 20} more`); }
  process.exit(failed && !upserted ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
