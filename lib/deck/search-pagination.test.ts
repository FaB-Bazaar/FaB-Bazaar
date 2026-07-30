/**
 * Pagination helpers for the mobile deck-editor card search.
 *
 * The search API is paginated (limit/page, returns total/pages) but
 * MobileCardSearch used to fetch a single page of 96 and silently truncate.
 * Grouping must merge printings of the SAME card that arrive on different
 * pages into one row (page boundaries split cards) while preserving
 * first-seen order.
 */
import { describe, it, expect } from 'vitest';
import { groupSearchPrintings, hasMoreSearchPages } from './search-pagination';

const p = (printingId: string, card_unique_id: string, set = 'wtr') =>
  ({ printingId, card_unique_id, set, edition: 'u', foiling: 's' }) as any;

describe('groupSearchPrintings', () => {
  it('groups printings by card_unique_id with one row per card', () => {
    const grouped = groupSearchPrintings([p('a1', 'cardA'), p('a2', 'cardA'), p('b1', 'cardB')]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].card_unique_id).toBe('cardA');
    expect(grouped[0].allPrintings).toHaveLength(2);
    expect(grouped[1].card_unique_id).toBe('cardB');
  });

  it('merges printings of the same card arriving in a later page chunk', () => {
    const pageOne = [p('a1', 'cardA'), p('b1', 'cardB')];
    const pageTwo = [p('b2', 'cardB'), p('c1', 'cardC')];
    const grouped = groupSearchPrintings([...pageOne, ...pageTwo]);
    expect(grouped).toHaveLength(3);
    const cardB = grouped.find(g => g.card_unique_id === 'cardB')!;
    expect(cardB.allPrintings.map((x: any) => x.printingId).sort()).toEqual(['b1', 'b2']);
  });

  it('preserves first-seen card order', () => {
    const grouped = groupSearchPrintings([p('b1', 'cardB'), p('a1', 'cardA'), p('b2', 'cardB')]);
    expect(grouped.map(g => g.card_unique_id)).toEqual(['cardB', 'cardA']);
  });

  it('returns [] for empty input', () => {
    expect(groupSearchPrintings([])).toEqual([]);
  });
});

describe('hasMoreSearchPages', () => {
  it('is true while the current page is below the page count', () => {
    expect(hasMoreSearchPages(1, 3)).toBe(true);
    expect(hasMoreSearchPages(2, 3)).toBe(true);
  });

  it('is false on the last page, missing metadata, or a single page', () => {
    expect(hasMoreSearchPages(3, 3)).toBe(false);
    expect(hasMoreSearchPages(1, 1)).toBe(false);
    expect(hasMoreSearchPages(1, undefined)).toBe(false);
    expect(hasMoreSearchPages(undefined, 2)).toBe(false);
  });
});
