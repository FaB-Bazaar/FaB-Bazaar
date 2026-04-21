import { describe, it, expect } from 'vitest';
import { shapeWantsForMcp } from './getWants';

describe('shapeWantsForMcp', () => {
  it('returns a full markdown table + widget shape when showDetails is true (default)', () => {
    const raw = {
      success: true,
      authenticatedUser: 'alice',
      wantsList: { name: 'Main Wants', totalCards: 12, totalUniqueCards: 9 },
      pagination: { currentPage: 1, totalPages: 1, cardsPerPage: 100, cardsInPage: 2 },
      cards: [
        {
          printing_id: 'abc', card_id: 'ELE146',
          display_name: 'Channel Lake Frigid',
          quantity: 3, priority: 'high',
          set: 'ele', edition: 'f', foiling: 'r', rarity: 'm',
          tcg_low: 10.25, tcg_market: 12.5,
        },
        {
          printing_id: 'def', card_id: 'ELE144',
          display_name: 'Heart of Ice',
          quantity: 1, priority: 'medium',
          set: 'ele', edition: 'f', foiling: 'c', rarity: 'l',
          tcg_low: 8, tcg_market: null,
        },
      ],
    };

    const out = shapeWantsForMcp(raw);

    const text = out.content[0].text;
    expect(text).toContain("Wants 'Main Wants'");
    expect(text).toContain('https://fabbazaar.app/wants');
    expect(text).toMatch(/\| Qty \| Foil \| Name \| Set \| Rarity \| Price \| Priority \|/);
    expect(text).toContain('Channel Lake Frigid');
    expect(text).toContain('RF');
    expect(text).toContain('Majestic');
    expect(text).toContain('$12.50'); // prefers tcg_market when present
    expect(text).toContain('$8.00');  // falls back to tcg_low
    expect(text).toContain('HIGH');
    expect(text).toContain('MEDIUM');

    expect(out.structuredContent?.title).toBe('Wants · Main Wants');
    expect(out.structuredContent?.subtitle).toBe('9 unique · 12 total cards');
    expect(out.structuredContent?.url).toBe('https://fabbazaar.app/wants');
    expect(out.structuredContent?.filters).toEqual({ priority: true, rarity: true, set: true });
    expect(out.structuredContent?.tool).toMatchObject({ name: 'get_wants', pageParam: 'page' });
    expect(out.structuredContent?.cards).toHaveLength(2);
  });

  it('omits the table when showDetails is false but keeps widget structuredContent', () => {
    const raw = {
      success: true,
      wantsList: { name: 'Wants', totalCards: 1, totalUniqueCards: 1 },
      pagination: { currentPage: 1, totalPages: 1, cardsPerPage: 100 },
      cards: [{ display_name: 'Alpha', quantity: 1, set: 'arr' }],
    };

    const out = shapeWantsForMcp(raw, { showDetails: false });
    expect(out.content[0].text).toContain('https://fabbazaar.app/wants');
    expect(out.content[0].text).not.toContain('|');
    expect(out.structuredContent?.cards).toHaveLength(1);
  });

  it('handles empty wants list', () => {
    const raw = {
      success: true,
      wantsList: { name: 'Wants', totalCards: 0, totalUniqueCards: 0 },
      pagination: { currentPage: 1, totalPages: 1, cardsPerPage: 100 },
      cards: [],
    };

    const out = shapeWantsForMcp(raw);
    expect(out.content[0].text).toContain('0 shown');
    expect(out.content[0].text).not.toContain('| Qty |');
    expect(out.structuredContent?.cards).toEqual([]);
  });

  it('passes errors through with isError flag and no structuredContent payload', () => {
    const raw = { success: false, error: 'Unauthorized' };
    const out = shapeWantsForMcp(raw);
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toContain('Unauthorized');
    expect(out.structuredContent).toBeUndefined();
  });
});
