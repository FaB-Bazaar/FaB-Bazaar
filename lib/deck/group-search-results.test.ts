import { describe, it, expect } from 'vitest';
import { groupSearchPrintingsToCards } from './group-search-results';

describe('groupSearchPrintingsToCards', () => {
  it('grouped response: one row per card, __printingsCount from printing_count', () => {
    // What the card-level (groupByCard) search returns: one representative
    // printing per card, each carrying the true printing_count.
    const rows = [
      { printing_id: 'w1', card_unique_id: 'whelming-red', display_name: 'Whelming Gustwave', types: ['action', 'attack'], pitch: 1, printing_count: 30 },
      { printing_id: 'd1', card_unique_id: 'descendent-red', display_name: 'Descendent Gustwave', types: ['action', 'attack'], pitch: 1, printing_count: 12 },
    ];

    const cards = groupSearchPrintingsToCards(rows);

    expect(cards.map(c => c.unique_id).sort()).toEqual(['descendent-red', 'whelming-red']);
    const whelming = cards.find(c => c.unique_id === 'whelming-red')!;
    expect(whelming.__printingsCount).toBe(30); // drives the tile count + lazy drilldown
    expect(whelming.printings).toHaveLength(1);  // representative only until expand
    expect(whelming.name).toBe('Whelming Gustwave');
  });

  it('flat response (no printing_count): keeps every printing, no synthetic count', () => {
    const rows = [
      { printing_id: 'a', card_unique_id: 'c1', display_name: 'Card One', types: ['action'], pitch: 1 },
      { printing_id: 'b', card_unique_id: 'c1', display_name: 'Card One', types: ['action'], pitch: 1 },
    ];

    const cards = groupSearchPrintingsToCards(rows);

    expect(cards).toHaveLength(1);
    expect(cards[0].printings).toHaveLength(2);
    // No printing_count → leave undefined so the tile falls back to printings.length.
    expect(cards[0].__printingsCount).toBeUndefined();
  });

  it('lowercases types and sorts cards alphabetically by name', () => {
    const rows = [
      { printing_id: 'z', card_unique_id: 'z1', display_name: 'Zebra', types: ['ACTION'], pitch: 2, printing_count: 1 },
      { printing_id: 'a', card_unique_id: 'a1', display_name: 'Apple', types: ['Attack'], pitch: 1, printing_count: 1 },
    ];

    const cards = groupSearchPrintingsToCards(rows);

    expect(cards.map(c => c.name)).toEqual(['Apple', 'Zebra']);
    expect(cards[0].types).toEqual(['attack']);
  });
});
