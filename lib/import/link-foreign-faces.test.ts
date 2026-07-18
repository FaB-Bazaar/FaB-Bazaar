/**
 * Integration tests: linkForeignFaces() — the post-insert pass that mirrors
 * English DFC face linkage onto foreign-language printings.
 *
 * import-i18n.ts creates foreign rows by mirroring an English counterpart, but
 * is_front_face / other_face_printing_id can't be finalized at insert time
 * (the partner face's row may not exist yet). This pass repairs both fields
 * from the English rows' linkage, idempotently, and never touches English
 * rows or already-correct foreign rows.
 *
 * Fixture cards use zzl- prefixed ids scoped to this file (facet-test
 * convention: cleanup scoped to our own ids only).
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { linkForeignFaces } from './link-foreign-faces';

let pool: Pool;
const uid = randomUUID().slice(0, 8);
const cardFront = `zzl-front-${uid}`;
const cardBack = `zzl-back-${uid}`;

// printing ids
const enFrontS = `zzl-en-fs-${uid}`;
const enBackS = `zzl-en-bs-${uid}`;
const enFrontC = `zzl-en-fc-${uid}`;
const enBackC = `zzl-en-bc-${uid}`;
const frFrontS = `zzl-fr-fs-${uid}`;
const frBackS = `zzl-fr-bs-${uid}`;
const jaFrontC = `zzl-ja-fc-${uid}`;
const jaBackC = `zzl-ja-bc-${uid}`;

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  await pool.query(
    `INSERT INTO cards (card_unique_id, name, display_name, talishar_card_id)
     VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
    [cardFront, `zzl front ${uid}`, `Zzl Front ${uid}`, `zzl_front_${uid}`,
     cardBack, `zzl back ${uid}`, `Zzl Back ${uid}`, `zzl_back_${uid}`],
  );
});

afterAll(async () => {
  await pool.query(`DELETE FROM printings WHERE card_unique_id IN ($1, $2)`, [cardFront, cardBack]);
  await pool.query(`DELETE FROM cards WHERE card_unique_id IN ($1, $2)`, [cardFront, cardBack]);
  await pool.end();
});

beforeEach(async () => {
  // English: two properly linked foiling pairs (standard + cold foil).
  await pool.query(
    `INSERT INTO printings (printing_id, card_unique_id, set, collector_number, edition, foiling, rarity, language,
                            is_front_face, other_face_printing_id, image_url)
     VALUES
       ($1, $9,  'zzl', 'ZZL100', 'n', 's', 'm', 'en', true,  $2, 'https://x/en-fs.webp'),
       ($2, $10, 'zzl', 'ZZL100', 'n', 's', 'm', 'en', false, $1, 'https://x/en-bs.webp'),
       ($3, $9,  'zzl', 'ZZL100', 'n', 'c', 'm', 'en', true,  $4, 'https://x/en-fc.webp'),
       ($4, $10, 'zzl', 'ZZL100', 'n', 'c', 'm', 'en', false, $3, 'https://x/en-bc.webp'),
       -- Foreign rows exactly as today's import-i18n leaves them:
       -- is_front_face defaulted true, no linkage.
       ($5, $9,  'zzl', 'ZZL100', 'n', 's', 'm', 'fr', true, NULL, 'https://x/fr-fs.webp'),
       ($6, $10, 'zzl', 'ZZL100', 'n', 's', 'm', 'fr', true, NULL, 'https://x/fr-bs.webp'),
       ($7, $9,  'zzl', 'ZZL100', 'n', 'c', 'm', 'ja', true, NULL, 'https://x/ja-fc.webp'),
       ($8, $10, 'zzl', 'ZZL100', 'n', 'c', 'm', 'ja', true, NULL, 'https://x/ja-bc.webp')`,
    [enFrontS, enBackS, enFrontC, enBackC, frFrontS, frBackS, jaFrontC, jaBackC, cardFront, cardBack],
  );
});

afterEach(async () => {
  await pool.query(`DELETE FROM printings WHERE card_unique_id IN ($1, $2)`, [cardFront, cardBack]);
});

async function row(printingId: string) {
  const r = await pool.query(
    `SELECT is_front_face, other_face_printing_id FROM printings WHERE printing_id = $1`,
    [printingId],
  );
  return r.rows[0];
}

describe('linkForeignFaces', () => {
  it('sets is_front_face=false on foreign back-face rows', async () => {
    const res = await linkForeignFaces(pool);
    expect(res.facesFlagged).toBeGreaterThanOrEqual(2); // fr back + ja back
    expect((await row(frBackS)).is_front_face).toBe(false);
    expect((await row(jaBackC)).is_front_face).toBe(false);
    expect((await row(frFrontS)).is_front_face).toBe(true);
    expect((await row(jaFrontC)).is_front_face).toBe(true);
  });

  it('links foreign face pairs to each other within the same language and foiling', async () => {
    await linkForeignFaces(pool);
    expect((await row(frFrontS)).other_face_printing_id).toBe(frBackS);
    expect((await row(frBackS)).other_face_printing_id).toBe(frFrontS);
    expect((await row(jaFrontC)).other_face_printing_id).toBe(jaBackC);
    expect((await row(jaBackC)).other_face_printing_id).toBe(jaFrontC);
  });

  it('never touches English rows', async () => {
    await linkForeignFaces(pool);
    expect(await row(enFrontS)).toEqual({ is_front_face: true, other_face_printing_id: enBackS });
    expect(await row(enBackS)).toEqual({ is_front_face: false, other_face_printing_id: enFrontS });
  });

  it('is idempotent — a second run reports zero changes', async () => {
    await linkForeignFaces(pool);
    const second = await linkForeignFaces(pool);
    expect(second.facesFlagged).toBe(0);
    expect(second.pairsLinked).toBe(0);
  });

  describe('same-card DFC (front and back share card_unique_id)', () => {
    const enF = `zzl-en-sf-${uid}`;
    const enB = `zzl-en-sb-${uid}`;
    const frF = `zzl-fr-sf-${uid}`;
    const frB = `zzl-fr-sb-${uid}`;

    beforeEach(async () => {
      await pool.query(
        `INSERT INTO printings (printing_id, card_unique_id, set, collector_number, edition, foiling, rarity, language,
                                is_front_face, other_face_printing_id, image_url, lss_print_code)
         VALUES
           ($1, $5, 'zzl', 'ZZL200', 'n', 's', 'm', 'en', true,  $2, 'https://x/en-sf.webp', 'ZZL200'),
           ($2, $5, 'zzl', 'ZZL200', 'n', 's', 'm', 'en', false, $1, 'https://x/en-sb.webp', 'ZZL200_BACK'),
           ($3, $5, 'zzl', 'ZZL200', 'n', 's', 'm', 'fr', true, NULL, 'https://x/fr-sf.webp', 'FR_ZZL200'),
           ($4, $5, 'zzl', 'ZZL200', 'n', 's', 'm', 'fr', true, NULL, 'https://x/fr-sb.webp', 'FR_ZZL200_BACK')`,
        [enF, enB, frF, frB, cardFront],
      );
    });

    it('classifies faces by the lss_print_code _BACK marker and links the pair', async () => {
      await linkForeignFaces(pool);
      expect((await row(frF)).is_front_face).toBe(true);
      expect((await row(frB)).is_front_face).toBe(false);
      expect((await row(frF)).other_face_printing_id).toBe(frB);
      expect((await row(frB)).other_face_printing_id).toBe(frF);
    });

    it('stays idempotent with same-card DFC rows present', async () => {
      await linkForeignFaces(pool);
      const second = await linkForeignFaces(pool);
      expect(second.facesFlagged).toBe(0);
      expect(second.pairsLinked).toBe(0);
    });
  });

  it('leaves an already-correct foreign link alone rather than rewriting it', async () => {
    // Simulate a hand-repaired pair.
    await pool.query(
      `UPDATE printings SET is_front_face = false, other_face_printing_id = $2 WHERE printing_id = $1`,
      [frBackS, frFrontS],
    );
    await pool.query(
      `UPDATE printings SET other_face_printing_id = $2 WHERE printing_id = $1`,
      [frFrontS, frBackS],
    );
    const res = await linkForeignFaces(pool);
    expect((await row(frBackS)).other_face_printing_id).toBe(frFrontS);
    // ja pair still gets fixed
    expect((await row(jaBackC)).other_face_printing_id).toBe(jaFrontC);
    expect(res.pairsLinked).toBeGreaterThanOrEqual(1);
  });
});
