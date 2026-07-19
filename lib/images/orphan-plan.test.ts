/**
 * Unit tests: computeOrphanDeletions() — which old printing_id-keyed
 * Cloudflare images are safe to delete after the deterministic-id migration.
 *
 * Deletable = candidate printing_ids (rows whose image_url moved off their
 * own printing_id) MINUS every id still referenced anywhere: any row's
 * current image_url id segment (fallback rows keep their printing_id image),
 * matchup-gallery ids, training-puzzle ids. The shared Cloudflare account
 * hosts other apps' assets, so deletion is allowlist-of-candidates only —
 * never inventory-diff.
 */
import { describe, it, expect } from 'vitest';
import { computeOrphanDeletions } from './orphan-plan';

describe('computeOrphanDeletions', () => {
  it('deletes candidates not referenced anywhere', () => {
    expect(
      computeOrphanDeletions(['aaa', 'bbb'], [['ccc']]),
    ).toEqual(['aaa', 'bbb']);
  });

  it('keeps ids still used in any image_url (fallback rows)', () => {
    expect(computeOrphanDeletions(['aaa', 'bbb'], [['bbb']])).toEqual(['aaa']);
  });

  it('keeps ids referenced by matchups or puzzles', () => {
    expect(
      computeOrphanDeletions(['aaa', 'bbb', 'ccc'], [['bbb'], ['ccc']]),
    ).toEqual(['aaa']);
  });

  it('dedupes candidates', () => {
    expect(computeOrphanDeletions(['aaa', 'aaa'], [])).toEqual(['aaa']);
  });

  it('empty candidates → empty plan', () => {
    expect(computeOrphanDeletions([], [['x']])).toEqual([]);
  });
});
