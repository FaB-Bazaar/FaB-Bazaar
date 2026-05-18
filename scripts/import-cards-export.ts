#!/usr/bin/env npx tsx
/**
 * scripts/import-cards-export.ts
 *
 * Restore companion for scripts/export-cards-and-printings.ts.
 *
 * Reads the JSON snapshot and idempotently UPSERTs:
 *   - cards          (minimum identifiers; preserves existing rich fields)
 *   - printings      (full variant attributes — recreates non-EN rows)
 *   - card_translations (verbatim)
 *
 * Cards: this script only touches the columns the export carries (identity +
 * lss_card_id + talishar_card_id). Other columns (text, types, stats, flags,
 * legality) come from the pipeline and are left alone by ON CONFLICT.
 *
 * Printings: re-creates every row from the export including all variant flags
 * — so non-EN rows can be restored even without re-running the i18n importer.
 * Cloudflare image bindings stay intact because printing_id is preserved.
 *
 * Two modes:
 *   default       — printings + translations use ON CONFLICT DO UPDATE
 *                   (replaces existing rows with the export's values). Right
 *                   choice for DISASTER RECOVERY into an empty DB.
 *   --insert-only — printings + translations use ON CONFLICT DO NOTHING
 *                   (only inserts new rows, never overwrites). Right choice
 *                   for ADDITIVE DEPLOYMENT to a production DB that already
 *                   has live data (prices, admin tweaks, fresher prints).
 *                   The cards UPSERT in both modes only fills NULL
 *                   lss_card_id (COALESCE), never overwrites existing values.
 *
 * Usage:
 *   npx tsx scripts/import-cards-export.ts --in=/path/to/cards-export.json
 *   npx tsx scripts/import-cards-export.ts --in=... --insert-only   # PROD-SAFE
 *   npx tsx scripts/import-cards-export.ts --in=... --dry-run
 *   npx tsx scripts/import-cards-export.ts --in=... --skip-printings
 *   npx tsx scripts/import-cards-export.ts --in=... --skip-translations
 */

import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { Pool } from 'pg';
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (flag: string, fallback?: string) =>
  argv.find((a) => a.startsWith(`${flag}=`))?.split('=').slice(1).join('=') ?? fallback;

const IN_PATH = arg('--in');
const DRY_RUN = argv.includes('--dry-run');
const SKIP_PRINTINGS = argv.includes('--skip-printings');
const SKIP_TRANSLATIONS = argv.includes('--skip-translations');
const INSERT_ONLY = argv.includes('--insert-only');
const CHECK_CONFLICTS = argv.includes('--check-conflicts');
const BATCH = 500;

if (!IN_PATH) {
  console.error('Usage: import-cards-export.ts --in=/path/to/cards-export.json');
  process.exit(1);
}

interface ExportPayload {
  exported_at: string;
  schema_version: number;
  counts: { cards: number; printings: number; translations: number };
  cards: ExportCard[];
}

interface ExportCard {
  card_unique_id: string;
  display_name: string;
  lss_card_id: string | null;
  talishar_card_id: string | null;
  printings: ExportPrinting[];
  translations: ExportTranslation[];
}

interface ExportPrinting {
  printing_id: string;
  set: string;
  collector_number: string | null;
  edition: string;
  foiling: string;
  rarity: string;
  language: string;
  is_first_edition: boolean;
  is_unlimited: boolean;
  is_normal_edition: boolean;
  is_normal_foil: boolean;
  is_rainbow_foil: boolean;
  is_cold_foil: boolean;
  is_extended_art: boolean;
  is_common: boolean;
  is_rare: boolean;
  is_super_rare: boolean;
  is_majestic: boolean;
  is_legendary: boolean;
  is_fabled: boolean;
  is_promo: boolean;
  art_variations: string[] | null;
  image_url: string | null;
  image_rotation_degrees: number | null;
  artists: string[] | null;
  flavor_text: string | null;
  set_printing_unique_id: string | null;
  other_face_printing_id: string | null;
  is_front_face: boolean;
}

interface ExportTranslation {
  language: string;
  name: string;
  display_name: string;
  text: string | null;
  type_text: string | null;
  traits: string[] | null;
  flavor_text: string | null;
  source: string | null;
  source_card_id: string | null;
}

/**
 * Pre-flight check: detect potential "logical duplicates" where the
 * destination DB already has a printing for the same (card_unique_id, set,
 * collector_number, language, foiling, is_extended_art) but under a
 * DIFFERENT printing_id.
 *
 * ⚠️ KNOWN LIMITATION (false positives): Some cards have multiple physically
 * distinct printings that share all of these attributes (e.g., MST Spectral
 * Shield has 8 different English printings with the same foiling='s',
 * art_variations={}, is_extended_art=f — distinguished only by printing_id).
 * In those cases this check will incorrectly flag legitimately distinct rows
 * as conflicts. Use sparingly and only when prod is known to have
 * independently-imported non-EN data with a clear printing_id ↔ logical-print
 * mapping. When prod has zero non-EN data, the printing_id PK alone is
 * sufficient protection — every export row is genuinely new.
 *
 * Returns the conflict list. Empty list = safe to proceed.
 */
async function checkConflicts(
  pool: Pool,
  cards: ExportCard[],
): Promise<Array<{ card_unique_id: string; set: string; collector_number: string | null; language: string; foiling: string; export_printing_id: string; db_printing_id: string }>> {
  const conflicts: Array<{ card_unique_id: string; set: string; collector_number: string | null; language: string; foiling: string; export_printing_id: string; db_printing_id: string }> = [];

  // Build a lookup index from the export, only for NON-EN rows (we don't
  // expect prod to have any non-EN rows yet; EN rows are managed by the
  // pipeline using stable upstream printing_ids so they wouldn't drift).
  const exportRows = cards.flatMap((c) =>
    c.printings
      .filter((p) => p.language !== 'en')
      .map((p) => ({ ...p, card_unique_id: c.card_unique_id })),
  );

  if (exportRows.length === 0) return conflicts;

  console.log(`  checking ${exportRows.length.toLocaleString()} non-EN printing(s) against destination DB…`);

  // Batch query: for each (card_unique_id, set, collector_number, language,
  // foiling, is_extended_art) tuple, find DB printing_id (if any).
  for (let i = 0; i < exportRows.length; i += BATCH) {
    const batch = exportRows.slice(i, i + BATCH);
    const values: any[] = [];
    const tuples: string[] = [];
    let p = 1;
    for (const r of batch) {
      tuples.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
      values.push(r.card_unique_id, r.set, r.collector_number, r.language, r.foiling, r.is_extended_art);
    }
    const res = await pool.query<{ card_unique_id: string; set: string; collector_number: string | null; language: string; foiling: string; printing_id: string }>(
      `SELECT p.card_unique_id, p."set", p.collector_number, p.language, p.foiling, p.printing_id
         FROM printings p
         JOIN (VALUES ${tuples.join(',')})
           AS v(card_unique_id, set, collector_number, language, foiling, is_extended_art)
           ON p.card_unique_id = v.card_unique_id
          AND p."set" = v.set
          AND p.collector_number IS NOT DISTINCT FROM v.collector_number
          AND p.language = v.language
          AND p.foiling = v.foiling
          AND p.is_extended_art = v.is_extended_art::boolean`,
      values,
    );

    for (const row of res.rows) {
      // Find the matching export row to grab its printing_id
      const exportRow = batch.find((r) =>
        r.card_unique_id === row.card_unique_id &&
        r.set === row.set &&
        (r.collector_number ?? null) === (row.collector_number ?? null) &&
        r.language === row.language &&
        r.foiling === row.foiling,
      );
      if (!exportRow) continue;
      if (exportRow.printing_id !== row.printing_id) {
        conflicts.push({
          card_unique_id: row.card_unique_id,
          set: row.set,
          collector_number: row.collector_number,
          language: row.language,
          foiling: row.foiling,
          export_printing_id: exportRow.printing_id,
          db_printing_id: row.printing_id,
        });
      }
    }
  }
  return conflicts;
}

async function upsertCards(pool: Pool, cards: ExportCard[]): Promise<number> {
  let total = 0;
  for (let i = 0; i < cards.length; i += BATCH) {
    const batch = cards.slice(i, i + BATCH);
    const values: any[] = [];
    const placeholders: string[] = [];
    let p = 1;
    for (const c of batch) {
      placeholders.push(`($${p++}, $${p++}, $${p++}, $${p++})`);
      values.push(c.card_unique_id, c.display_name, c.lss_card_id, c.talishar_card_id);
    }
    if (!DRY_RUN) {
      await pool.query(
        `INSERT INTO cards (card_unique_id, display_name, name, lss_card_id, talishar_card_id, created_at, updated_at)
         SELECT v.card_unique_id, v.display_name, LOWER(v.display_name), v.lss_card_id, v.talishar_card_id, NOW(), NOW()
         FROM (VALUES ${placeholders.join(',')}) AS v(card_unique_id, display_name, lss_card_id, talishar_card_id)
         ON CONFLICT (card_unique_id) DO UPDATE SET
           lss_card_id = COALESCE(cards.lss_card_id, EXCLUDED.lss_card_id),
           talishar_card_id = COALESCE(cards.talishar_card_id, EXCLUDED.talishar_card_id),
           updated_at = NOW()`,
        values,
      );
    }
    total += batch.length;
    process.stdout.write(`\r  cards: ${total.toLocaleString()} / ${cards.length.toLocaleString()}`);
  }
  process.stdout.write('\n');
  return total;
}

async function upsertPrintings(pool: Pool, cards: ExportCard[]): Promise<number> {
  const all = cards.flatMap((c) => c.printings.map((p) => ({ ...p, card_unique_id: c.card_unique_id })));
  const cols = [
    'printing_id', 'card_unique_id', 'set', 'edition', 'foiling', 'rarity', 'collector_number', 'language',
    'is_first_edition', 'is_unlimited', 'is_normal_edition',
    'is_normal_foil', 'is_rainbow_foil', 'is_cold_foil', 'is_extended_art',
    'is_common', 'is_rare', 'is_super_rare', 'is_majestic', 'is_legendary', 'is_fabled', 'is_promo',
    'art_variations', 'image_url', 'image_rotation_degrees', 'artists', 'flavor_text',
    'set_printing_unique_id', 'other_face_printing_id', 'is_front_face',
  ];

  let total = 0;
  for (let i = 0; i < all.length; i += BATCH) {
    const batch = all.slice(i, i + BATCH);
    const values: any[] = [];
    const placeholders: string[] = [];
    let p = 1;
    for (const r of batch) {
      const ph = cols.map(() => `$${p++}`).join(', ');
      placeholders.push(`(${ph})`);
      values.push(
        r.printing_id, r.card_unique_id, r.set, r.edition, r.foiling, r.rarity, r.collector_number, r.language,
        r.is_first_edition, r.is_unlimited, r.is_normal_edition,
        r.is_normal_foil, r.is_rainbow_foil, r.is_cold_foil, r.is_extended_art,
        r.is_common, r.is_rare, r.is_super_rare, r.is_majestic, r.is_legendary, r.is_fabled, r.is_promo,
        r.art_variations, r.image_url, r.image_rotation_degrees, r.artists, r.flavor_text,
        r.set_printing_unique_id, r.other_face_printing_id, r.is_front_face,
      );
    }
    if (!DRY_RUN) {
      const conflictClause = INSERT_ONLY
        ? 'ON CONFLICT (printing_id) DO NOTHING'
        : (() => {
            const updateCols = cols.filter((c) => c !== 'printing_id');
            const updateSet = updateCols.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ');
            return `ON CONFLICT (printing_id) DO UPDATE SET ${updateSet}, updated_at = NOW()`;
          })();
      await pool.query(
        `INSERT INTO printings (${cols.map((c) => `"${c}"`).join(', ')}, created_at, updated_at)
         VALUES ${placeholders.map((ph) => `${ph.slice(0, -1)}, NOW(), NOW())`).join(', ')}
         ${conflictClause}`,
        values,
      );
    }
    total += batch.length;
    process.stdout.write(`\r  printings: ${total.toLocaleString()} / ${all.length.toLocaleString()}`);
  }
  process.stdout.write('\n');
  return total;
}

async function upsertTranslations(pool: Pool, cards: ExportCard[]): Promise<number> {
  const all = cards.flatMap((c) => c.translations.map((t) => ({ ...t, card_unique_id: c.card_unique_id })));
  const cols = [
    'card_unique_id', 'language', 'name', 'display_name', 'text', 'type_text',
    'traits', 'flavor_text', 'source', 'source_card_id',
  ];

  let total = 0;
  for (let i = 0; i < all.length; i += BATCH) {
    const batch = all.slice(i, i + BATCH);
    const values: any[] = [];
    const placeholders: string[] = [];
    let p = 1;
    for (const r of batch) {
      const ph = cols.map(() => `$${p++}`).join(', ');
      placeholders.push(`(${ph})`);
      values.push(
        r.card_unique_id, r.language, r.name, r.display_name, r.text, r.type_text,
        r.traits, r.flavor_text, r.source, r.source_card_id,
      );
    }
    if (!DRY_RUN) {
      const conflictClause = INSERT_ONLY
        ? 'ON CONFLICT (card_unique_id, language) DO NOTHING'
        : (() => {
            const updateCols = cols.filter((c) => c !== 'card_unique_id' && c !== 'language');
            const updateSet = updateCols.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ');
            return `ON CONFLICT (card_unique_id, language) DO UPDATE SET ${updateSet}, updated_at = NOW()`;
          })();
      await pool.query(
        `INSERT INTO card_translations (${cols.map((c) => `"${c}"`).join(', ')}, updated_at)
         VALUES ${placeholders.map((ph) => `${ph.slice(0, -1)}, NOW())`).join(', ')}
         ${conflictClause}`,
        values,
      );
    }
    total += batch.length;
    process.stdout.write(`\r  translations: ${total.toLocaleString()} / ${all.length.toLocaleString()}`);
  }
  process.stdout.write('\n');
  return total;
}

async function main() {
  console.log(`Reading ${IN_PATH}…`);
  const payload = JSON.parse(readFileSync(IN_PATH!, 'utf8')) as ExportPayload;
  console.log(`  exported_at: ${payload.exported_at}`);
  console.log(`  cards: ${payload.counts.cards.toLocaleString()}`);
  console.log(`  printings: ${payload.counts.printings.toLocaleString()}`);
  console.log(`  translations: ${payload.counts.translations.toLocaleString()}`);
  const modeLabel = [
    INSERT_ONLY ? 'INSERT-ONLY (ON CONFLICT DO NOTHING)' : 'UPSERT (ON CONFLICT DO UPDATE)',
    DRY_RUN ? 'dry-run' : null,
  ].filter(Boolean).join(', ');
  console.log(`  mode: ${modeLabel}\n`);

  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const t0 = Date.now();

  // Pre-flight: detect logical duplicates if requested
  if (CHECK_CONFLICTS) {
    console.log('Pre-flight: checking for logical printing conflicts…');
    const conflicts = await checkConflicts(pool, payload.cards);
    if (conflicts.length > 0) {
      console.error(`\n❌ Found ${conflicts.length} logical conflict(s) — destination DB has different printing_ids for the same logical printings:\n`);
      for (const c of conflicts.slice(0, 20)) {
        console.error(`  ${c.set}/${c.collector_number ?? '?'} ${c.language}/${c.foiling}`);
        console.error(`    export: ${c.export_printing_id}`);
        console.error(`    db:     ${c.db_printing_id}`);
      }
      if (conflicts.length > 20) console.error(`  ... and ${conflicts.length - 20} more`);
      console.error('\nAborting — resolve conflicts (e.g., delete the destination rows or use a matched export) before re-running.\n');
      await pool.end();
      process.exit(1);
    }
    console.log('  ✓ no logical conflicts found\n');
  }

  console.log('Upserting cards…');
  await upsertCards(pool, payload.cards);

  if (!SKIP_PRINTINGS) {
    console.log('Upserting printings…');
    await upsertPrintings(pool, payload.cards);
  } else {
    console.log('Skipping printings (--skip-printings)');
  }

  if (!SKIP_TRANSLATIONS) {
    console.log('Upserting card_translations…');
    await upsertTranslations(pool, payload.cards);
  } else {
    console.log('Skipping translations (--skip-translations)');
  }

  const elapsedMs = Date.now() - t0;
  console.log(`\nDone in ${(elapsedMs / 1000).toFixed(1)}s`);

  await pool.end();
}

main().catch((err) => {
  console.error('\n', err);
  process.exit(1);
});
