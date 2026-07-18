/**
 * Integration tests: search results must carry the DFC face fields so the UI
 * can offer flip affordances — other_face_printing_id / is_front_face
 * (declared in the DTO but historically never selected, so they came back
 * null/default) plus other_face_image_url for rendering the flip without a
 * second request.
 *
 * Uses the live IAR transform-hero data (Viserai, the Forsaken // Viserai,
 * Usurper), which is guaranteed linked by the face-aware ingest.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

describe('searchPrintings — DFC face fields', () => {
  it('flat results carry face linkage and the other face image', async () => {
    const res = await service.searchPrintings({ name: 'Viserai, the Forsaken', exact: true }, { limit: 10 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.printings.length).toBeGreaterThan(0);
    for (const p of res.data.printings) {
      expect(p.is_front_face).toBe(true);
      expect(p.other_face_printing_id).toBeTruthy();
      expect(p.other_face_image_url).toBeTruthy();
      expect(p.other_face_name).toBe('Viserai, Usurper');
    }
  });

  it('back-face results link back to the front', async () => {
    const res = await service.searchPrintings({ name: 'Viserai, Usurper', exact: true }, { limit: 10 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.printings.length).toBeGreaterThan(0);
    for (const p of res.data.printings) {
      expect(p.is_front_face).toBe(false);
      expect(p.other_face_printing_id).toBeTruthy();
      expect(p.other_face_image_url).toBeTruthy();
    }
  });

  describe('sibling fallback — unlinked variant of a double-sided card', () => {
    // fab-cube's own linkage is patchy (e.g. only some Figment variants carry
    // other_face_printing_id). A row with no link of its own must still get
    // the card-level back face from any LINKED sibling printing.
    const uid = randomUUID().slice(0, 8);
    const cardA = `zzt-dfc-a-${uid}`;
    const cardB = `zzt-dfc-b-${uid}`;
    const name = `Zzt Sibling Test ${uid}`;
    let pool: Pool;

    beforeAll(async () => {
      pool = new Pool({ connectionString: process.env.POSTGRES_URL });
      // cards.name is the lowercase searchable copy (pipeline convention);
      // display_name keeps the cased form.
      await pool.query(
        `INSERT INTO cards (card_unique_id, name, display_name, talishar_card_id)
         VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
        [cardA, name.toLowerCase(), name, `zzt_sib_a_${uid}`,
         cardB, `${name} Back`.toLowerCase(), `${name} Back`, `zzt_sib_b_${uid}`]);
      await pool.query(
        `INSERT INTO printings (printing_id, card_unique_id, set, collector_number, edition, foiling, rarity, language,
                                is_front_face, other_face_printing_id, image_url)
         VALUES ($1, $3, 'zzt', 'ZZT600', 'n', 's', 'm', 'en', true, $2, 'https://x/front-s.webp'),
                ($2, $4, 'zzt', 'ZZT600', 'n', 's', 'm', 'en', false, $1, 'https://x/back-s.webp'),
                ($5, $3, 'zzt', 'ZZT600', 'n', 'r', 'm', 'en', true, NULL, 'https://x/front-r.webp')`,
        [`zzt-p-fs-${uid}`, `zzt-p-bs-${uid}`, cardA, cardB, `zzt-p-fr-${uid}`]);
    });

    afterAll(async () => {
      await pool.query(`DELETE FROM printings WHERE card_unique_id IN ($1, $2)`, [cardA, cardB]);
      await pool.query(`DELETE FROM cards WHERE card_unique_id IN ($1, $2)`, [cardA, cardB]);
      await pool.end();
    });

    it('the unlinked rainbow variant still carries the back face via its linked sibling', async () => {
      const res = await service.searchPrintings({ name, exact: true }, { limit: 10 });
      expect(res.success).toBe(true);
      if (!res.success) return;
      const rf = res.data.printings.find((p) => p.foiling === 'r');
      expect(rf).toBeTruthy();
      expect(rf!.other_face_printing_id ?? null).toBeNull();
      expect(rf!.other_face_image_url).toBe('https://x/back-s.webp');
      expect(rf!.other_face_name).toBe(`${name} Back`);
    });
  });

  it('single-faced cards stay null', async () => {
    const res = await service.searchPrintings({ name: 'Vox Necropolis', exact: true }, { limit: 5 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.printings.length).toBeGreaterThan(0);
    for (const p of res.data.printings) {
      expect(p.other_face_printing_id).toBeNull();
      expect(p.other_face_image_url ?? null).toBeNull();
    }
  });
});
