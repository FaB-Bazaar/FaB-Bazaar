/**
 * Integration tests: listHeroCards must offer only FRONT faces as starting
 * heroes. Transform-hero back faces (e.g. 'Viserai, Usurper' — typeboxed
 * 'Shadow Runeblade Hero - Demon', entered mid-game by flipping) are hero
 * CARDS but not pickable starting heroes: a card whose every printing is
 * is_front_face = false stays out of the list.
 *
 * Runs against local Postgres (POSTGRES_URL in .env.local). Uses the live
 * IAR data when present, plus a self-cleaning synthetic pair so the test
 * doesn't depend on IAR staying provisional forever.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();
const uid = randomUUID().slice(0, 8);
const FRONT_CARD = `zzt-hero-front-${uid}`;
const BACK_CARD = `zzt-hero-back-${uid}`;
let pool: Pool;

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  await pool.query(
    `INSERT INTO cards (card_unique_id, name, display_name, talishar_card_id, types)
     VALUES ($1, $2, $2, $3, '{shadow,brute,hero}'),
            ($4, $5, $5, $6, '{shadow,brute,hero,demon}')`,
    [FRONT_CARD, `zzt front hero ${uid}`, `zzt_front_${uid}`,
     BACK_CARD, `zzt back hero ${uid}`, `zzt_back_${uid}`],
  );
  await pool.query(
    `INSERT INTO printings (printing_id, card_unique_id, set, collector_number, edition, foiling, rarity, language,
                            is_front_face, other_face_printing_id, image_url)
     VALUES ($1, $2, 'zzt', 'ZZT500', 'n', 's', 'm', 'en', true, $3, 'https://x/front.webp'),
            ($3, $4, 'zzt', 'ZZT500', 'n', 's', 'm', 'en', false, $1, 'https://x/back.webp')`,
    [`zzt-print-front-${uid}`, FRONT_CARD, `zzt-print-back-${uid}`, BACK_CARD],
  );
});

afterAll(async () => {
  await pool.query(`DELETE FROM printings WHERE card_unique_id IN ($1, $2)`, [FRONT_CARD, BACK_CARD]);
  await pool.query(`DELETE FROM cards WHERE card_unique_id IN ($1, $2)`, [FRONT_CARD, BACK_CARD]);
  await pool.end();
});

describe('listHeroCards front-face gating', () => {
  it('includes front-face heroes and excludes back-only heroes', async () => {
    const res = await service.listHeroCards();
    expect(res.success).toBe(true);
    if (!res.success) return;
    const names = res.data.map((h) => h.displayName);
    expect(names).toContain(`zzt front hero ${uid}`);
    expect(names).not.toContain(`zzt back hero ${uid}`);
  });

  it('never lists a hero whose every printing is a back face (live-data invariant)', async () => {
    const res = await service.listHeroCards();
    expect(res.success).toBe(true);
    if (!res.success) return;
    const ids = res.data.map((h) => h.cardUniqueId);
    if (ids.length === 0) return;
    const r = await pool.query(
      `SELECT c.display_name FROM cards c
        WHERE c.card_unique_id = ANY($1)
          AND EXISTS (SELECT 1 FROM printings p WHERE p.card_unique_id = c.card_unique_id)
          AND NOT EXISTS (SELECT 1 FROM printings p WHERE p.card_unique_id = c.card_unique_id AND p.is_front_face = true)`,
      [ids],
    );
    expect(r.rows).toEqual([]);
  });
});
