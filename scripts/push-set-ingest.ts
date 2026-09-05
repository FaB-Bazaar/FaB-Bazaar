#!/usr/bin/env npx tsx
/**
 * scripts/push-set-ingest.ts
 *
 * Push a set's cards/printings/card_translations from the LOCAL database to
 * another FaB Bazaar instance via POST /api/admin/printings/ingest — the
 * no-SSH replacement for running import-new-set.ts / import-i18n.ts on the
 * VPS. Run and VERIFY the local ingest first; this ships what local has.
 *
 * The server resolves rows by natural identity (talishar_card_id,
 * lss_print_id, natural key) and mints its own ids — local ids in the payload
 * are refs only. Idempotent: re-push anytime. Images are NOT uploaded here;
 * local ingest already put them on the shared Cloudflare account, and
 * image_url is carried verbatim.
 *
 * Usage:
 *   npx tsx scripts/push-set-ingest.ts --set=iar                      # dry-run vs prod
 *   npx tsx scripts/push-set-ingest.ts --set=iar --commit
 *   flags: --base-url=https://fabbazaar.app (default) --langs=en,fr,ja (default: all)
 *
 * Auth: INGEST_BEARER env — a superadmin MCP/OAuth bearer token (same model
 * as COLLECTIBLES_BEARER for the playmat ingest).
 */
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { Pool } from 'pg';

const argv = process.argv.slice(2);
const arg = (f: string, d?: string) => argv.find((a) => a.startsWith(`${f}=`))?.split('=').slice(1).join('=') ?? d;
const SET = arg('--set')?.toLowerCase();
const COMMIT = argv.includes('--commit');
const BASE_URL = (arg('--base-url', 'https://fabbazaar.app') ?? '').replace(/\/$/, '');
const LANGS = arg('--langs')?.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

const BEARER = process.env.INGEST_BEARER;
// Collector numbers to leave out of the payload (e.g. rows the target already
// holds but its deployed endpoint can't yet recognise — the FAB232-234
// fab-cube DFC backs before the back-face dedupe fix shipped).
const SKIP_COLLECTORS = new Set((arg('--skip-collectors', '') ?? '').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean));
if (!SET) {
  console.error('usage: push-set-ingest.ts --set=iar [--commit] [--base-url=...] [--langs=en,fr] [--skip-collectors=FAB232,FAB233]');
  process.exit(1);
}
if (!BEARER) {
  console.error('Set INGEST_BEARER (superadmin MCP/OAuth bearer for the target instance).');
  process.exit(1);
}

(async () => {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

  const printings = (await pool.query(
    `SELECT * FROM printings WHERE set = $1${LANGS ? ' AND language = ANY($2)' : ''} ORDER BY collector_number, language, foiling`,
    LANGS ? [SET, LANGS] : [SET],
  )).rows.filter((p) => !SKIP_COLLECTORS.has(String(p.collector_number ?? '').toUpperCase()));
  if (!printings.length) {
    console.error(`✗ no local printings for set '${SET}' — run the local ingest first`);
    process.exit(1);
  }
  const cardIds = [...new Set(printings.map((p) => p.card_unique_id))];
  const cards = (await pool.query(
    'SELECT * FROM cards WHERE card_unique_id = ANY($1)', [cardIds],
  )).rows;
  const translations = (await pool.query(
    'SELECT * FROM card_translations WHERE card_unique_id = ANY($1)', [cardIds],
  )).rows;
  await pool.end();

  const missingTal = cards.filter((c) => !c.talishar_card_id);
  if (missingTal.length) {
    console.error(`✗ ${missingTal.length} card(s) missing talishar_card_id (server resolves by it): ` +
      missingTal.map((c) => c.name).join(', '));
    process.exit(1);
  }

  console.log(`${COMMIT ? 'COMMIT' : 'DRY RUN'} — pushing '${SET}' to ${BASE_URL}`);
  console.log(`  ${cards.length} cards, ${printings.length} printings, ${translations.length} translations`);

  const res = await fetch(`${BASE_URL}/api/admin/printings/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BEARER}`,
      'User-Agent': 'FaBBazaar-PushIngest/1.0',
    },
    body: JSON.stringify({ set: SET, cards, printings, translations, dryRun: !COMMIT }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    console.error(`✗ ${res.status}: ${json.error ?? 'request failed'}`);
    process.exit(1);
  }
  const d = json.data;
  console.log(`${d.dryRun ? 'plan' : '✓ applied'}: ${d.cardsCreated} cards created, ` +
    `${d.cardsEnriched} enriched, ${d.cardsMatched} matched; ` +
    `${d.printingsCreated} printings created, ${d.printingsSkipped} skipped; ` +
    `${d.faceLinksSet} face links, ${d.translationsUpserted} translations upserted`);
  if (d.dryRun) console.log('\nDRY RUN — nothing written. Re-run with --commit to apply.');
})();
