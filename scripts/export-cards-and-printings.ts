#!/usr/bin/env npx tsx
/**
 * scripts/export-cards-and-printings.ts
 *
 * Dumps the full card catalog + all printings + all card_translations to a
 * single portable JSON file. Used as a safety-net snapshot — if the Postgres
 * DB is ever lost, this file + the live Cloudflare account + the existing
 * fabtcgcards.json is enough to fully rebuild i18n state without re-scraping
 * Card Vault.
 *
 * The Cloudflare image ID == printing_id for every row, so preserving
 * printing_id in this export keeps every image binding intact across a
 * restore.
 *
 * Usage:
 *   npx tsx scripts/export-cards-and-printings.ts
 *   npx tsx scripts/export-cards-and-printings.ts --out=/path/to/file.json
 *   npx tsx scripts/export-cards-and-printings.ts --pretty       # indent=2
 */

import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { Pool } from 'pg';
import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';

const argv = process.argv.slice(2);
const arg = (flag: string, fallback?: string) =>
  argv.find((a) => a.startsWith(`${flag}=`))?.split('=').slice(1).join('=') ?? fallback;

const DEFAULT_OUT = `/Users/eko/fabbazaar-backups/cards-export-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`;
const OUT_PATH = arg('--out', DEFAULT_OUT)!;
const PRETTY = argv.includes('--pretty');

interface CardRow {
  card_unique_id: string;
  display_name: string;
  lss_card_id: string | null;
  talishar_card_id: string | null;
}

interface PrintingRow {
  printing_id: string;
  card_unique_id: string;
  set: string;
  edition: string;
  foiling: string;
  rarity: string;
  collector_number: string | null;
  language: string;
  // Edition flags
  is_first_edition: boolean;
  is_unlimited: boolean;
  is_normal_edition: boolean;
  // Foiling flags
  is_normal_foil: boolean;
  is_rainbow_foil: boolean;
  is_cold_foil: boolean;
  is_extended_art: boolean;
  // Rarity flags
  is_common: boolean;
  is_rare: boolean;
  is_super_rare: boolean;
  is_majestic: boolean;
  is_legendary: boolean;
  is_fabled: boolean;
  is_promo: boolean;
  // Visual / metadata
  art_variations: string[] | null;
  image_url: string | null;
  image_rotation_degrees: number | null;
  artists: string[] | null;
  flavor_text: string | null;
  set_printing_unique_id: string | null;
  // DFC
  other_face_printing_id: string | null;
  is_front_face: boolean;
}

interface TranslationRow {
  card_unique_id: string;
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

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

  console.log('Querying…');
  const t0 = Date.now();

  const [cardsRes, printingsRes, translationsRes] = await Promise.all([
    pool.query<CardRow>(
      `SELECT card_unique_id, display_name, lss_card_id, talishar_card_id
         FROM cards
        ORDER BY card_unique_id`,
    ),
    pool.query<PrintingRow>(
      `SELECT printing_id, card_unique_id, "set", edition, foiling, rarity, collector_number,
              language,
              is_first_edition, is_unlimited, is_normal_edition,
              is_normal_foil, is_rainbow_foil, is_cold_foil, is_extended_art,
              is_common, is_rare, is_super_rare, is_majestic, is_legendary, is_fabled, is_promo,
              art_variations, image_url, image_rotation_degrees, artists, flavor_text,
              set_printing_unique_id, other_face_printing_id, is_front_face
         FROM printings
        ORDER BY card_unique_id, printing_id`,
    ),
    pool.query<TranslationRow>(
      `SELECT card_unique_id, language, name, display_name, text, type_text,
              traits, flavor_text, source, source_card_id
         FROM card_translations
        ORDER BY card_unique_id, language`,
    ),
  ]);

  console.log(`  cards:             ${cardsRes.rows.length.toLocaleString()}`);
  console.log(`  printings:         ${printingsRes.rows.length.toLocaleString()}`);
  console.log(`  card_translations: ${translationsRes.rows.length.toLocaleString()}`);

  // Group printings + translations under each card
  const printingsByCard = new Map<string, PrintingRow[]>();
  for (const p of printingsRes.rows) {
    let arr = printingsByCard.get(p.card_unique_id);
    if (!arr) { arr = []; printingsByCard.set(p.card_unique_id, arr); }
    arr.push(p);
  }
  const translationsByCard = new Map<string, TranslationRow[]>();
  for (const t of translationsRes.rows) {
    let arr = translationsByCard.get(t.card_unique_id);
    if (!arr) { arr = []; translationsByCard.set(t.card_unique_id, arr); }
    arr.push(t);
  }

  const cards = cardsRes.rows.map((c) => ({
    card_unique_id: c.card_unique_id,
    display_name: c.display_name,
    lss_card_id: c.lss_card_id,
    talishar_card_id: c.talishar_card_id,
    // Strip card_unique_id since it's the grouping key; everything else verbatim
    printings: (printingsByCard.get(c.card_unique_id) ?? []).map(({ card_unique_id, ...rest }) => rest),
    translations: (translationsByCard.get(c.card_unique_id) ?? []).map(({ card_unique_id, ...rest }) => rest),
  }));

  const payload = {
    exported_at: new Date().toISOString(),
    schema_version: 1,
    counts: {
      cards: cardsRes.rows.length,
      printings: printingsRes.rows.length,
      translations: translationsRes.rows.length,
    },
    cards,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(payload, null, PRETTY ? 2 : 0), 'utf8');

  const sizeBytes = statSync(OUT_PATH).size;
  const sizeMB = (sizeBytes / 1024 / 1024).toFixed(1);
  const elapsedMs = Date.now() - t0;

  console.log();
  console.log(`Done in ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`  size: ${sizeMB} MB`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
