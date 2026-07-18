/**
 * Integration tests: import-i18n's foreign-print planning must
 *  (a) attribute art per LSS FACE (art_type), not blanket-mirror the English
 *      counterpart — two rainbow prints (regular art vs extended art) must
 *      land as two distinct rows with correct is_extended_art/art_variations,
 *  (b) dedupe same-run twin prints that are attribute-identical (CardVault
 *      "-CC" style duplicates share collector+finish+art → one row only),
 *  (c) store lss_print_id / lss_print_code (face-level ids) for idempotency.
 *
 * These are the two bugs that produced the May twin cohort (288 groups).
 *
 * Runs against the local Postgres DB. Uploads are stubbed via ImportDeps.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { importCard } from '../../scripts/import-i18n';

const uid = randomUUID().slice(0, 8);
const cardId = `zzm-card-${uid}`;
const cardName = `Zzm Hardening ${uid}`;
const enEA = `zzm-en-ea-${uid}`;
const enRF = `zzm-en-rf-${uid}`;

let pool: Pool;
const noopUpload = async () => {};

const face = (over: Record<string, unknown>) => ({
  face_language: 'fr',
  finish_type: 'rainbow-foil',
  art_type: 'regular',
  printed_code: 'ZZM100',
  printed_name: `Zzm Renforcé ${uid}`,
  printed_rules_text: 'Texte.',
  printed_typebox: 'Action',
  printed_traitbox: '',
  printed_flavor_text: '',
  image: { small: 'https://x/s.webp', normal: 'https://x/n.webp', large: 'https://x/l.webp' },
  ...over,
});

const feedCard = () => ({
  id: `zzm-lss-${uid}`,
  cores: [{ name: `zzm-hardening---${cardName}` }],
  card_prints: [
    {
      print_id: 'ZZM100', print_language: 'en', rarity: 'Rare', layout: 'regular',
      print_set: { set_code: 'ZZM' },
      faces: [face({ face_language: 'en', printed_name: cardName, id: `zzm-f-en-${uid}`, face_id: 'ZZM100-RF' })],
    },
    {
      print_id: 'ZZM100-EA', print_language: 'fr', rarity: 'Rare', layout: 'regular',
      print_set: { set_code: 'ZZM' },
      faces: [face({ art_type: 'extended-art', id: `zzm-f-ea-${uid}`, face_id: 'FR_ZZM100-EA' })],
    },
    {
      print_id: 'ZZM100-RF', print_language: 'fr', rarity: 'Rare', layout: 'regular',
      print_set: { set_code: 'ZZM' },
      faces: [face({ id: `zzm-f-rf-${uid}`, face_id: 'FR_ZZM100-RF' })],
    },
    {
      // attribute-identical twin of the -RF print (the "-CC" pattern)
      print_id: 'ZZM100-CC', print_language: 'fr', rarity: 'Rare', layout: 'regular',
      print_set: { set_code: 'ZZM' },
      faces: [face({ id: `zzm-f-cc-${uid}`, face_id: 'FR_ZZM100-CC' })],
    },
  ],
});

beforeEach(async () => {
  pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  await pool.query(
    `INSERT INTO cards (card_unique_id, name, display_name, talishar_card_id)
     VALUES ($1, $2, $3, $4)`,
    [cardId, cardName.toLowerCase(), cardName, `zzm_${uid}`],
  );
  await pool.query(
    `INSERT INTO printings (printing_id, card_unique_id, set, collector_number, edition, foiling, rarity, language,
                            is_extended_art, art_variations, image_url)
     VALUES ($1, $3, 'zzm', 'ZZM100', 'n', 'r', 'r', 'en', true,  '{EA}', 'https://x/en-ea.webp'),
            ($2, $3, 'zzm', 'ZZM100', 'n', 'r', 'r', 'en', false, '{}',   'https://x/en-rf.webp')`,
    [enEA, enRF, cardId],
  );
});

afterEach(async () => {
  await pool.query(`DELETE FROM printings WHERE card_unique_id = $1`, [cardId]);
  await pool.query(`DELETE FROM cards WHERE card_unique_id = $1`, [cardId]);
  await pool.end();
});

async function frRows() {
  const r = await pool.query(
    `SELECT is_extended_art, art_variations, lss_print_id, lss_print_code
       FROM printings WHERE card_unique_id = $1 AND language = 'fr' ORDER BY is_extended_art DESC`,
    [cardId],
  );
  return r.rows;
}

describe('import-i18n foreign print hardening', () => {
  it('creates one row per DISTINCT variant with face-accurate art attribution', async () => {
    const res = await importCard(pool, feedCard() as never, { upload: noopUpload });
    expect(res.cardUniqueId).toBe(cardId);

    const rows = await frRows();
    expect(rows).toHaveLength(2); // EA + RF; the -CC twin is deduped
    expect(rows[0].is_extended_art).toBe(true);
    expect(rows[0].art_variations).toEqual(['EA']);
    expect(rows[1].is_extended_art).toBe(false);
    expect(rows[1].art_variations).toEqual([]);
  });

  it('stores face-level lss identifiers for idempotency', async () => {
    await importCard(pool, feedCard() as never, { upload: noopUpload });
    const rows = await frRows();
    expect(rows[0].lss_print_id).toBe(`zzm-f-ea-${uid}`);
    expect(rows[0].lss_print_code).toBe('FR_ZZM100-EA');
    expect(rows[1].lss_print_id).toBe(`zzm-f-rf-${uid}`);
    expect(rows[1].lss_print_code).toBe('FR_ZZM100-RF');
  });

  it('a second run inserts nothing', async () => {
    await importCard(pool, feedCard() as never, { upload: noopUpload });
    const second = await importCard(pool, feedCard() as never, { upload: noopUpload });
    expect(second.stats.printings).toBe(0);
    expect(await frRows()).toHaveLength(2);
  });
});
