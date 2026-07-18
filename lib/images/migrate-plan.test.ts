/**
 * Unit tests: planImageIdMigration() — decides, for every printing row, what
 * the image-id migration should do:
 *   - upload:   compute deterministic id, CF-copy the image, flip image_url
 *   - fallback: key collides with another row (or no key derivable) — keep
 *               the printing_id-keyed image forever
 *   - done:     image_url already carries the deterministic id (resume)
 *
 * Collisions are computed across ALL rows passed in, then actions can be
 * filtered by set — so a set-scoped run can never adopt a key that collides
 * with a row outside the filter.
 */
import { describe, it, expect } from 'vitest';
import { planImageIdMigration } from './migrate-plan';

const CF_BASE = 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg';

function mkRow(over: Record<string, unknown> = {}) {
  return {
    printing_id: 'nanoid_' + Math.random().toString(36).slice(2, 10),
    language: 'en',
    collector_number: 'IAR106',
    foiling: 's',
    edition: 'n',
    is_extended_art: false,
    is_front_face: true,
    art_variations: null,
    set: 'iar',
    image_url: `${CF_BASE}/someNanoId123/public`,
    ...over,
  };
}

describe('planImageIdMigration', () => {
  it('plans an upload with the deterministic id and the current URL as source', () => {
    const row = mkRow();
    const plan = planImageIdMigration([row]);
    expect(plan.uploads).toHaveLength(1);
    expect(plan.uploads[0]).toEqual({
      printing_id: row.printing_id,
      new_image_id: 'IAR106',
      source_url: row.image_url,
      new_image_url: `${CF_BASE}/IAR106/public`,
    });
    expect(plan.fallbacks).toHaveLength(0);
    expect(plan.done).toHaveLength(0);
  });

  it('sends colliding rows to fallback, never uploads either', () => {
    const a = mkRow();
    const b = mkRow(); // identical attrs, different printing_id/image
    const plan = planImageIdMigration([a, b]);
    expect(plan.uploads).toHaveLength(0);
    expect(plan.fallbacks.map((f) => f.printing_id).sort()).toEqual(
      [a.printing_id, b.printing_id].sort(),
    );
  });

  it('rows with no derivable key go to fallback', () => {
    const plan = planImageIdMigration([mkRow({ collector_number: '' })]);
    expect(plan.uploads).toHaveLength(0);
    expect(plan.fallbacks).toHaveLength(1);
  });

  it('rows already on their deterministic URL are done (resume)', () => {
    const row = mkRow({ image_url: `${CF_BASE}/IAR106/public` });
    const plan = planImageIdMigration([row]);
    expect(plan.uploads).toHaveLength(0);
    expect(plan.done).toHaveLength(1);
  });

  it('non-imagedelivery URLs go to fallback rather than being copied', () => {
    const plan = planImageIdMigration([mkRow({ image_url: 'https://x/legacy.webp' })]);
    expect(plan.uploads).toHaveLength(0);
    expect(plan.fallbacks).toHaveLength(1);
  });

  it('collisions are computed over all rows even when actions are set-filtered', () => {
    const iar = mkRow();
    const clash = mkRow({ set: 'zzz' }); // same key, different set
    const plan = planImageIdMigration([iar, clash], { set: 'iar' });
    expect(plan.uploads).toHaveLength(0);
    expect(plan.fallbacks).toHaveLength(1); // only the iar row is reported
    expect(plan.fallbacks[0].printing_id).toBe(iar.printing_id);
  });

  it('set filter limits planned actions', () => {
    const a = mkRow();
    const b = mkRow({ collector_number: 'ZZZ001', set: 'zzz' });
    const plan = planImageIdMigration([a, b], { set: 'zzz' });
    expect(plan.uploads).toHaveLength(1);
    expect(plan.uploads[0].new_image_id).toBe('ZZZ001');
  });
});
