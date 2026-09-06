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
    const cardC = `zzt-dfc-c-${uid}`;
    const name = `Zzt Sibling Test ${uid}`;
    const nameC = `Zzt Selflink Test ${uid}`;
    let pool: Pool;

    beforeAll(async () => {
      pool = new Pool({ connectionString: process.env.POSTGRES_URL });
      // cards.name is the lowercase searchable copy (pipeline convention);
      // display_name keeps the cased form.
      await pool.query(
        `INSERT INTO cards (card_unique_id, name, display_name, talishar_card_id)
         VALUES ($1, $2, $3, $4), ($5, $6, $7, $8), ($9, $10, $11, $12)`,
        [cardA, name.toLowerCase(), name, `zzt_sib_a_${uid}`,
         cardB, `${name} Back`.toLowerCase(), `${name} Back`, `zzt_sib_b_${uid}`,
         cardC, nameC.toLowerCase(), nameC, `zzt_sib_c_${uid}`]);
      await pool.query(
        `INSERT INTO printings (printing_id, card_unique_id, set, collector_number, edition, foiling, rarity, language,
                                is_front_face, other_face_printing_id, image_url)
         VALUES ($1, $3, 'zzt', 'ZZT600', 'n', 's', 'm', 'en', true, $2, 'https://x/front-s.webp'),
                ($2, $4, 'zzt', 'ZZT600', 'n', 's', 'm', 'en', false, $1, 'https://x/back-s.webp'),
                ($5, $3, 'zzt', 'ZZT600', 'n', 'r', 'm', 'en', true, NULL, 'https://x/front-r.webp'),
                -- cardA again, but in ANOTHER set with no link of its own: a
                -- single-faced reprint (the Crown-of-Providence shape) that
                -- must NOT inherit zzt's back face.
                ($6, $3, 'zzu', 'ZZU600', 'n', 's', 'm', 'en', true, NULL, 'https://x/reprint.webp'),
                -- cardC: an unlinked row plus a SELF-LINKED sibling in the same
                -- set (the corrupt fab-cube back-row shape, 307 rows in prod).
                -- A self-link is never a real partner — no donation, and the
                -- self-linked row itself must not render itself as its back.
                ($7, $8, 'zzt', 'ZZT601', 'n', 's', 'm', 'en', true, NULL, 'https://x/c-plain.webp'),
                ($9, $8, 'zzt', 'ZZT601', 'n', 'c', 'm', 'en', false, $9, 'https://x/c-selflink.webp')`,
        [`zzt-p-fs-${uid}`, `zzt-p-bs-${uid}`, cardA, cardB, `zzt-p-fr-${uid}`,
         `zzu-p-re-${uid}`, `zzt-p-cp-${uid}`, cardC, `zzt-p-cs-${uid}`]);
    });

    afterAll(async () => {
      await pool.query(`DELETE FROM printings WHERE card_unique_id IN ($1, $2, $3)`, [cardA, cardB, cardC]);
      await pool.query(`DELETE FROM cards WHERE card_unique_id IN ($1, $2, $3)`, [cardA, cardB, cardC]);
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

    it('a reprint in another set does NOT inherit the back face (cross-set misfire)', async () => {
      const res = await service.searchPrintings({ name, exact: true }, { limit: 10 });
      expect(res.success).toBe(true);
      if (!res.success) return;
      const reprint = res.data.printings.find((p) => p.set === 'zzu');
      expect(reprint).toBeTruthy();
      expect(reprint!.other_face_image_url ?? null).toBeNull();
      expect(reprint!.other_face_name ?? null).toBeNull();
    });

    it('self-linked rows neither donate a back face nor render themselves as one', async () => {
      const res = await service.searchPrintings({ name: nameC, exact: true }, { limit: 10 });
      expect(res.success).toBe(true);
      if (!res.success) return;
      const plain = res.data.printings.find((p) => p.foiling === 's');
      expect(plain).toBeTruthy();
      expect(plain!.other_face_image_url ?? null).toBeNull();
      const selfLinked = res.data.printings.find((p) => p.foiling === 'c');
      expect(selfLinked).toBeTruthy();
      expect(selfLinked!.other_face_image_url ?? null).toBeNull();
    });
  });

  describe('self-linked back face whose front points at it (the fab-cube back-row shape)', () => {
    // Every fab-cube back face ships other_face_unique_id = ITSELF (107/107 in
    // the feed), while the front links correctly to the back. The partner
    // lookup fetches the back row for the front's sake, so the back used to
    // find its own id in that map and render itself as its flip target
    // (Nitro Mechanoid → "Flip to Nitro Mechanoid"). The back must resolve
    // to the front by the REVERSE link instead.
    const uid = randomUUID().slice(0, 8);
    const frontCard = `zzt-nm-front-${uid}`;
    const backCard = `zzt-nm-back-${uid}`;
    const frontName = `Zzt Construct Mechanoid ${uid}`;
    const backName = `Zzt Mechanoid ${uid}`;
    const frontId = `zzt-p-nmf-${uid}`;
    const backId = `zzt-p-nmb-${uid}`;
    let pool: Pool;

    beforeAll(async () => {
      pool = new Pool({ connectionString: process.env.POSTGRES_URL });
      await pool.query(
        `INSERT INTO cards (card_unique_id, name, display_name, talishar_card_id)
         VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
        [frontCard, frontName.toLowerCase(), frontName, `zzt_nm_f_${uid}`,
         backCard, backName.toLowerCase(), backName, `zzt_nm_b_${uid}`]);
      await pool.query(
        `INSERT INTO printings (printing_id, card_unique_id, set, collector_number, edition, foiling, rarity, language,
                                is_front_face, other_face_printing_id, image_url)
         VALUES ($1, $3, 'zzt', 'ZZT700', 'n', 's', 'm', 'en', true, $2, 'https://x/nm-front.webp'),
                ($2, $4, 'zzt', 'ZZT700', 'n', 's', 'm', 'en', false, $2, 'https://x/nm-back.webp')`,
        [frontId, backId, frontCard, backCard]);
    });

    afterAll(async () => {
      await pool.query(`DELETE FROM printings WHERE card_unique_id IN ($1, $2)`, [frontCard, backCard]);
      await pool.query(`DELETE FROM cards WHERE card_unique_id IN ($1, $2)`, [frontCard, backCard]);
      await pool.end();
    });

    it('the front still flips to the back', async () => {
      const res = await service.searchPrintings({ name: frontName, exact: true }, { limit: 10 });
      expect(res.success).toBe(true);
      if (!res.success) return;
      const f = res.data.printings.find((p) => p.printing_id === frontId);
      expect(f).toBeTruthy();
      expect(f!.other_face_image_url).toBe('https://x/nm-back.webp');
      expect(f!.other_face_name).toBe(backName);
    });

    it('the self-linked back flips to the FRONT, never to itself', async () => {
      const res = await service.searchPrintings({ name: backName, exact: true }, { limit: 10 });
      expect(res.success).toBe(true);
      if (!res.success) return;
      const b = res.data.printings.find((p) => p.printing_id === backId);
      expect(b).toBeTruthy();
      expect(b!.other_face_image_url).toBe('https://x/nm-front.webp');
      expect(b!.other_face_name).toBe(frontName);
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
