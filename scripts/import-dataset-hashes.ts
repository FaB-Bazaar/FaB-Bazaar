/**
 * scripts/import-dataset-hashes.ts — load the fab-cube dataset's precomputed
 * card pHashes into printing_image_hashes, keyed by our fab_cube_printing_id.
 *
 *   npx tsx scripts/import-dataset-hashes.ts --csv=/path/to/csvs/english/card-printing.csv [--commit]
 *
 * The dataset hashes the same 546×762 LSS renders we serve from Cloudflare
 * (verified bit-exact on the art hash), and lib/scan/phash-exact.ts reproduces
 * its recipe, so photos hashed by the app match these rows directly. Printings
 * without a fab-cube anchor (CardVault-only sets) are reported — hash those with
 * scripts/compute-image-hashes.ts afterwards (it skips rows already hashed).
 * Dry run by default. Writes to POSTGRES_URL (.env.local).
 */
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import fs from 'node:fs';
import { planDatasetImport, parseDatasetTsv } from '@/lib/scan/dataset-import';

const argv = process.argv.slice(2);
const arg = (n: string) => { const h = argv.find(a => a.startsWith(`${n}=`)); return h ? h.slice(n.length + 1) : undefined; };
const CSV = arg('--csv');
const COMMIT = argv.includes('--commit');


async function main() {
  if (!CSV) { console.error('Usage: --csv=<path to card-printing.csv> [--commit]'); process.exit(1); }
  const theirs = parseDatasetTsv(fs.readFileSync(CSV, 'utf8'));
  const { db } = await import('@/lib/postgres/db');
  const { printings } = await import('@/lib/postgres/schema');
  const { PostgresScanService } = await import('@/lib/services/postgres/scan/PostgresScanService');
  const ours = await db.select({ printingId: printings.printingId, fabCubePrintingId: printings.fabCubePrintingId, imageUrl: printings.imageUrl }).from(printings);
  const plan = planDatasetImport(theirs, ours);
  console.log(`dataset rows=${theirs.length} (hashed ${theirs.filter(t => t.phashFull).length})  our printings=${ours.length}`);
  console.log(`→ import ${plan.rows.length} rows (${plan.rows.filter(r => r.artHash).length} with art hash)`);
  console.log(`   unanchored (hash locally): ${plan.unanchored.length}   anchored but unhashed in dataset: ${plan.unhashedInDataset.length}   dataset ids we lack: ${plan.unknownDatasetIds}`);
  if (!COMMIT) { console.log('DRY RUN — nothing written. Re-run with --commit.'); process.exit(0); }
  const service = new PostgresScanService();
  let done = 0;
  for (let i = 0; i < plan.rows.length; i += 500) {
    const res = await service.upsertHashes(plan.rows.slice(i, i + 500));
    if (!res.success) { console.error('upsert failed:', res.error); process.exit(1); }
    done += res.data.upserted;
  }
  console.log(`done: ${done} rows upserted`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
