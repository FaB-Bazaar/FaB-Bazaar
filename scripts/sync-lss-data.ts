#!/usr/bin/env npx tsx
/**
 * scripts/sync-lss-data.ts
 *
 * Ad-hoc orchestrator for fetching LSS (Card Vault) data for any cards in our
 * DB that haven't been touched by the LSS sync yet. NOT part of the main
 * pipeline — run manually whenever you want to fill in translations + non-EN
 * printings + lss_card_id for newly-added English cards.
 *
 * What "untouched" means here: cards.lss_card_id IS NULL — i.e., we never
 * successfully captured & imported them from Card Vault. New cards from
 * pipeline/scripts/005_weekly_printings_updater.py have this state by
 * default until this orchestrator runs.
 *
 * Pipeline:
 *   1. Query DB for untouched card_unique_ids
 *   2. For each, pick ONE English collector_number (shortest, most stable)
 *   3. Write to /tmp/sync-lss-collectors.txt
 *   4. Spawn scripts/capture-cardvault.ts --by-collector
 *   5. Spawn /Users/eko/fabtcg/merge.py --replace-newer
 *   6. Spawn scripts/import-i18n.ts
 *   7. Re-query untouched count; print before/after delta
 *
 * Usage:
 *   npx tsx scripts/sync-lss-data.ts                      # all untouched
 *   npx tsx scripts/sync-lss-data.ts --max=10             # cap to first 10
 *   npx tsx scripts/sync-lss-data.ts --dry-run            # show plan only
 *   npx tsx scripts/sync-lss-data.ts --skip-capture       # only merge + import
 *                                                          (use if captures
 *                                                          already on disk)
 *
 * Required env (.env.local):
 *   POSTGRES_URL
 *   CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (for the import step)
 */

import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { spawnSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { Pool } from 'pg';

const argv = process.argv.slice(2);
const arg = (flag: string, fallback?: string) =>
  argv.find((a) => a.startsWith(`${flag}=`))?.split('=').slice(1).join('=') ?? fallback;

const DRY_RUN = argv.includes('--dry-run');
const SKIP_CAPTURE = argv.includes('--skip-capture');
const MAX = arg('--max') ? parseInt(arg('--max')!, 10) : undefined;

const SCRIPT_ROOT = '/Users/eko/FaB-Bazaar';
const COLLECTOR_FILE = '/tmp/sync-lss-collectors.txt';

async function getUntouched(pool: Pool): Promise<number> {
  const r = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM cards WHERE lss_card_id IS NULL`,
  );
  return parseInt(r.rows[0].count, 10);
}

async function listCollectorsForUntouched(pool: Pool): Promise<Array<{ collector: string; name: string }>> {
  // One English collector_number per untouched card. Pick the shortest
  // collector_number (e.g. "EVO249" over "WTR150-L") — they're the most
  // likely to resolve cleanly on a Card Vault search.
  const r = await pool.query<{ collector_number: string; display_name: string }>(`
    WITH untouched AS (
      SELECT card_unique_id, display_name FROM cards WHERE lss_card_id IS NULL
    ),
    pick_one AS (
      SELECT DISTINCT ON (u.card_unique_id)
             u.card_unique_id,
             u.display_name,
             p.collector_number
        FROM untouched u
        JOIN printings p ON p.card_unique_id = u.card_unique_id AND p.language = 'en'
       WHERE p.collector_number IS NOT NULL
       ORDER BY u.card_unique_id, LENGTH(p.collector_number), p.collector_number
    )
    SELECT collector_number, display_name FROM pick_one
     ORDER BY collector_number
  `);
  return r.rows.map((x) => ({ collector: x.collector_number, name: x.display_name }));
}

function runPhase(label: string, cmd: string, args: string[]): boolean {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Phase: ${label}`);
  console.log(`  $ ${cmd} ${args.join(' ')}`);
  console.log('='.repeat(70));
  const res = spawnSync(cmd, args, { stdio: 'inherit', cwd: SCRIPT_ROOT });
  if (res.status !== 0) {
    console.error(`\n❌ ${label} exited with code ${res.status}`);
    return false;
  }
  return true;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

  const beforeUntouched = await getUntouched(pool);
  console.log(`Untouched cards before run: ${beforeUntouched}`);

  if (beforeUntouched === 0) {
    console.log('Nothing to do — all cards have lss_card_id populated.');
    await pool.end();
    return;
  }

  let collectors = await listCollectorsForUntouched(pool);
  if (MAX != null) collectors = collectors.slice(0, MAX);

  console.log(`Will process ${collectors.length} collector_number(s).`);
  console.log(`First 5: ${collectors.slice(0, 5).map((c) => `${c.collector} (${c.name})`).join(', ')}`);

  if (DRY_RUN) {
    console.log('\n(dry run — no captures, no DB writes)');
    await pool.end();
    return;
  }

  writeFileSync(COLLECTOR_FILE, collectors.map((c) => c.collector).join('\n') + '\n', 'utf8');
  console.log(`\nWrote ${COLLECTOR_FILE} (${collectors.length} lines)`);

  // Phase 1: Capture
  if (!SKIP_CAPTURE) {
    const ok = runPhase('Capture (Playwright + Card Vault)', 'npx', [
      'tsx', 'scripts/capture-cardvault.ts',
      `--input=${COLLECTOR_FILE}`,
      '--by-collector',
    ]);
    if (!ok) { await pool.end(); process.exit(1); }
  } else {
    console.log('\n(--skip-capture — reusing existing captures in /Users/eko/fabtcg/captures/)');
  }

  // Phase 2: Merge captures into main JSON (allow refreshing stale signed URLs)
  if (!existsSync('/Users/eko/fabtcg/merge.py')) {
    console.error('Missing /Users/eko/fabtcg/merge.py — cannot proceed');
    await pool.end();
    process.exit(1);
  }
  const mergeOk = runPhase('Merge captures into fabtcgcards.json', 'python3', [
    '/Users/eko/fabtcg/merge.py',
    '--replace-newer',
  ]);
  if (!mergeOk) { await pool.end(); process.exit(1); }

  // Phase 3: Import (DB writes + Cloudflare uploads)
  const importOk = runPhase('Import (DB + Cloudflare)', 'npx', [
    'tsx', 'scripts/import-i18n.ts',
  ]);
  if (!importOk) { await pool.end(); process.exit(1); }

  // Report delta
  const afterUntouched = await getUntouched(pool);
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Untouched cards before:   ${beforeUntouched}`);
  console.log(`Untouched cards after:    ${afterUntouched}`);
  console.log(`Newly synced this run:    ${beforeUntouched - afterUntouched}`);
  console.log(`(Remaining untouched are likely cards LSS hasn't published — verify`);
  console.log(` by spot-checking Card Vault for a few of them before assuming.)`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
