#!/usr/bin/env npx tsx
/**
 * scripts/backfill-lss-print-codes.ts
 *
 * One-off backfill: stamp CardVault's print code (`printings.lss_print_code`)
 * on printings that predate the CardVault ingest. The codes were matched
 * offline (card + language + collector number + foiling + face + edition,
 * exactly one CardVault print per printing) and reviewed before this runs —
 * the script only applies the reviewed list, it does not match anything.
 *
 * Writes exactly ONE column, and only where it is NULL. It never touches
 * `lss_print_id` on purpose: apply_provisional_legality() reads "English
 * printing with an lss_print_id" as its CardVault marker, so stamping ids on
 * feed-origin rows would flip deliberately-illegal cards legal overnight.
 *
 * A row is skipped (and counted) when:
 *   - the printing no longer exists, or already has a code
 *   - its language / collector number / edition / foiling changed since the
 *     list was built
 *   - the code already sits on another printing
 *   - it is an English printing with no fab-cube anchor (pipeline 009 reads
 *     the code to class those rows as Marvels when pricing)
 *
 * No deletes, no repointing — inventory/wants/decks and prices are untouched
 * by construction (gate with scripts/snapshot-binder-values.ts regardless).
 *
 * Input CSV header: printing_id,lss_print_code,language,collector_number,edition,foiling
 *
 * Usage:
 *   npx tsx scripts/backfill-lss-print-codes.ts --file=/path/print-code-backfill.csv            # dry-run
 *   npx tsx scripts/backfill-lss-print-codes.ts --file=/path/print-code-backfill.csv --commit
 *
 * Required env (.env.local): POSTGRES_URL
 */
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { Pool } from 'pg';
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const COMMIT = argv.includes('--commit');
const FILE = argv.find((a) => a.startsWith('--file='))?.split('=').slice(1).join('=');
const HEADER = 'printing_id,lss_print_code,language,collector_number,edition,foiling';

(async () => {
  if (!FILE) {
    console.error('--file=<csv> is required');
    process.exit(1);
  }
  console.log(`${COMMIT ? 'COMMIT' : 'DRY RUN'} — CardVault print-code backfill from ${FILE}`);

  const lines = readFileSync(FILE, 'utf8').split(/\r?\n/).filter((l) => l.length > 0);
  if (lines[0] !== HEADER) {
    console.error(`unexpected CSV header — want "${HEADER}"`);
    process.exit(1);
  }
  const rows = lines.slice(1).map((l) => l.split(','));
  const malformed = rows.filter((r) => r.length !== 6 || r.some((v) => v === ''));
  if (malformed.length > 0) {
    console.error(`${malformed.length} malformed row(s), e.g. "${malformed[0].join(',')}" — nothing written`);
    process.exit(1);
  }
  const col = (i: number) => rows.map((r) => r[i]);
  if (new Set(col(0)).size !== rows.length || new Set(col(1)).size !== rows.length) {
    console.error('duplicate printing_id or lss_print_code in the list — nothing written');
    process.exit(1);
  }
  console.log(`list: ${rows.length} rows`);

  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TEMP TABLE _print_code_backfill (
        printing_id text PRIMARY KEY, code text NOT NULL, language text NOT NULL,
        collector_number text NOT NULL, edition text NOT NULL, foiling text NOT NULL
      ) ON COMMIT DROP`);
    await client.query(
      `INSERT INTO _print_code_backfill
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[])`,
      [col(0), col(1), col(2), col(3), col(4), col(5)],
    );

    // One verdict per row; the UPDATE below applies only 'apply'.
    await client.query(`
      CREATE TEMP TABLE _print_code_verdict ON COMMIT DROP AS
      SELECT b.printing_id, b.code,
        CASE
          WHEN p.printing_id IS NULL THEN 'printing not found'
          WHEN p.lss_print_code = b.code THEN 'already has this code'
          WHEN p.lss_print_code IS NOT NULL THEN 'already has a different code'
          WHEN p.language <> b.language OR p.collector_number <> b.collector_number
            OR p.edition <> b.edition OR p.foiling <> b.foiling THEN 'attributes changed'
          WHEN EXISTS (SELECT 1 FROM printings x WHERE x.lss_print_code = b.code) THEN 'code on another printing'
          WHEN p.language = 'en' AND p.fab_cube_printing_id IS NULL THEN 'english provisional row'
          ELSE 'apply'
        END AS verdict
      FROM _print_code_backfill b
      LEFT JOIN printings p ON p.printing_id = b.printing_id`);

    const verdicts = await client.query(
      `SELECT verdict, count(*)::int AS n FROM _print_code_verdict GROUP BY 1 ORDER BY 2 DESC`,
    );
    for (const v of verdicts.rows) console.log(`  ${String(v.n).padStart(6)}  ${v.verdict}`);
    const flagged = await client.query(
      `SELECT printing_id, code, verdict FROM _print_code_verdict
       WHERE verdict NOT IN ('apply', 'already has this code') ORDER BY verdict, printing_id LIMIT 20`,
    );
    for (const f of flagged.rows) console.log(`    skipped ${f.printing_id} ${f.code} — ${f.verdict}`);

    const before = await client.query(`SELECT count(lss_print_code)::int AS n FROM printings`);
    const updated = await client.query(`
      UPDATE printings p SET lss_print_code = v.code
      FROM _print_code_verdict v
      WHERE v.verdict = 'apply' AND p.printing_id = v.printing_id AND p.lss_print_code IS NULL`);
    const after = await client.query(`SELECT count(lss_print_code)::int AS n FROM printings`);
    console.log(`printings with a code: ${before.rows[0].n} -> ${after.rows[0].n} (${updated.rowCount} written)`);

    if (COMMIT) {
      await client.query('COMMIT');
      console.log('committed.');
    } else {
      await client.query('ROLLBACK');
      console.log('dry run — rolled back. Re-run with --commit to write.');
    }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
