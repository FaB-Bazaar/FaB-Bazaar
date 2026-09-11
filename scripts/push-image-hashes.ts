/**
 * scripts/push-image-hashes.ts — ship the LOCAL card-scanner hash index to
 * another FaB Bazaar instance over HTTP (the prod image has no scripts/tsx).
 *
 *   npx tsx scripts/push-image-hashes.ts                    # dry run against prod
 *   npx tsx scripts/push-image-hashes.ts --commit           # write
 *   npx tsx scripts/push-image-hashes.ts --sets=pen,sea --commit
 *   --base-url=https://fabbazaar.app (default) | http://localhost:3000
 *   --batch=500   rows per request (route cap 1000)
 *   --limit=N     smoke-push only the first N rows
 *
 * Auth: INGEST_BEARER (a superadmin MCP/OAuth token — same as push-set-ingest.ts),
 * or INGEST_COOKIE (a browser session cookie header) for local rehearsals.
 * Reads local rows from POSTGRES_URL (.env.local). Idempotent: the route
 * upserts, and unknown printing ids are reported, never fatal.
 */
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { chunk } from '@/lib/scan/hash-rows';

const argv = process.argv.slice(2);
const arg = (name: string) => { const hit = argv.find(a => a.startsWith(`${name}=`)); return hit ? hit.slice(name.length + 1) : undefined; };
const COMMIT = argv.includes('--commit');
const BASE_URL = (arg('--base-url') ?? 'https://fabbazaar.app').replace(/\/+$/, '');
const SETS = arg('--sets')?.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const BATCH = Math.min(1000, Math.max(1, parseInt(arg('--batch') ?? '500', 10)));
const LIMIT = arg('--limit') ? parseInt(arg('--limit')!, 10) : undefined;
const BEARER = process.env.INGEST_BEARER;
const COOKIE = process.env.INGEST_COOKIE;

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', 'User-Agent': 'FaBBazaar-PushHashes/1.0' };
  if (BEARER) h.Authorization = `Bearer ${BEARER}`;
  else if (COOKIE) h.Cookie = COOKIE;
  return h;
}

async function counts(): Promise<{ total: number; withArt: number; latestComputedAt: string | null }> {
  const res = await fetch(`${BASE_URL}/api/admin/scan/hashes`, { headers: headers() });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    const why = res.status === 401 ? 'bad/missing token' : res.status === 403 ? 'token is not a superadmin' : json.hint ?? json.error ?? `HTTP ${res.status}`;
    throw new Error(`pre-flight GET failed: ${why}`);
  }
  return json.data;
}

async function main() {
  if (!BEARER && !COOKIE) { console.error('Set INGEST_BEARER (superadmin token) or INGEST_COOKIE'); process.exit(1); }
  // lazy: lib/postgres/db reads POSTGRES_URL at import time, after loadEnvConfig above
  const { db } = await import('@/lib/postgres/db');
  const { printings, printingImageHashes } = await import('@/lib/postgres/schema');
  const { eq, inArray, asc } = await import('drizzle-orm');
  const base = db
    .select({ printingId: printingImageHashes.printingId, phash: printingImageHashes.phash, dhash: printingImageHashes.dhash, artHash: printingImageHashes.artPhash, imageUrl: printingImageHashes.imageUrl })
    .from(printingImageHashes)
    .innerJoin(printings, eq(printings.printingId, printingImageHashes.printingId));
  const fetched = await (SETS?.length ? base.where(inArray(printings.set, SETS)) : base).orderBy(asc(printingImageHashes.printingId));
  let rows = fetched.map(r => ({ ...r, phash: r.phash.trim(), dhash: r.dhash.trim(), artHash: r.artHash?.trim() ?? null }));
  if (LIMIT) rows = rows.slice(0, LIMIT);
  if (rows.length === 0) { console.error('no local hash rows to push' + (SETS ? ` for sets ${SETS.join(',')}` : '')); process.exit(1); }
  const noArt = rows.filter(r => !r.artHash).length;
  if (noArt) console.warn(`warning: ${noArt} local rows have no art_phash — run scripts/compute-image-hashes.ts --force first for full accuracy`);

  console.log(`${COMMIT ? 'PUSH' : 'DRY RUN'} → ${BASE_URL}  rows=${rows.length} batch=${BATCH}${SETS ? ` sets=${SETS.join(',')}` : ''}`);
  const before = await counts();
  console.log(`remote before: total=${before.total} withArt=${before.withArt} latest=${before.latestComputedAt ?? '—'}`);

  let upserted = 0; const unknown: string[] = [];
  const batches = chunk(rows, BATCH);
  for (let i = 0; i < batches.length; i++) {
    const r = await fetch(`${BASE_URL}/api/admin/scan/hashes`, { method: 'POST', headers: headers(), body: JSON.stringify({ rows: batches[i], dryRun: !COMMIT }) });
    const json: any = await r.json().catch(() => ({}));
    if (!r.ok || !json.success) { console.error(`batch ${i + 1}/${batches.length} failed: HTTP ${r.status} ${json.error ?? ''}`); process.exit(1); }
    upserted += json.data.upserted;
    unknown.push(...json.data.unknownPrintingIds);
    console.log(`  batch ${i + 1}/${batches.length}: received=${json.data.received} upserted=${json.data.upserted} unknown=${json.data.unknownCount}`);
  }
  const after = await counts();
  console.log(`remote after:  total=${after.total} withArt=${after.withArt} latest=${after.latestComputedAt ?? '—'}`);
  console.log(`done: rows=${rows.length} upserted=${upserted} unknown=${unknown.length}` + (unknown.length ? ` (first: ${unknown.slice(0, 20).join(', ')})` : ''));
  if (!COMMIT) console.log('DRY RUN — nothing written. Re-run with --commit.');
  process.exit(0);
}
main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
