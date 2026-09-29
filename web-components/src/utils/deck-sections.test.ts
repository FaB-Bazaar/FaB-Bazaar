import { describe, it, expect } from 'vitest';
import { deckToSections, diffDecklists } from './deck-sections';

const card = (printingId: string, name: string, quantity: number, extra: Record<string, unknown> = {}) =>
  ({ printingId, quantity, printingDetails: { name, image_url: `https://img/${printingId}`, cost: 1, power: 3, defense: 3, types: ['action'], keywords: [], ...extra } });

// The /api/decks/[id] payload shape the decklist block renders.
const DECK = {
  name: 'Midrange Maxx',
  fabraryUrl: 'https://fabrary.net/decks/x',
  description: 'notes',
  hero: [card('h1', 'Maxx', 1, { pitch: null, types: ['hero'] })],
  equipment: [card('e1', 'Cogwerx Base Legs', 1, { pitch: null, types: ['equipment'] })],
  maindeck: [
    card('r1', 'Heist', 3, { pitch: 1 }),
    card('y1', 'Hyper Driver', 2, { pitch: 2 }),
    card('y1', 'Hyper Driver', 1, { pitch: 2 }), // same printing twice → merged
    card('b1', 'Assembly Module', 3, { pitch: 3 }),
  ],
  inventory: [card('i1', 'Big Bertha', 1, { pitch: 3 })],
};

describe('deckToSections (shared by the live block and the article snapshot)', () => {
  it('groups hero+equipment, the library by pitch, then inventory', () => {
    const { sections, title, exportUrl, notes } = deckToSections(DECK);
    expect(sections.map(s => `${s.label}:${s.totalCards}`)).toEqual([
      'EQUIPMENT & WEAPONS:2', 'LIBRARY — RED:3', 'LIBRARY — YELLOW:3', 'LIBRARY — BLUE:3', 'Inventory:1',
    ]);
    expect(sections[2].cards).toEqual([expect.objectContaining({ cardName: 'Hyper Driver', quantity: 3, pitch: 2, imageUrl: 'https://img/y1' })]);
    expect([title, exportUrl, notes]).toEqual(['Midrange Maxx', 'https://fabrary.net/decks/x', 'notes']);
  });
});

describe('diffDecklists (article snapshot vs the deck today)', () => {
  const now = {
    ...DECK,
    maindeck: [
      card('r1', 'Heist', 2, { pitch: 1 }),                 // 3 → 2
      card('b1x', 'Assembly Module', 3, { pitch: 3, foiling: 'C' }), // new printing, same card: no change
      card('r9', 'Zipper Hit', 2, { pitch: 1 }),            // new
    ],                                                        // Hyper Driver (yellow) gone
  };

  it('lists cards added and removed by name + pitch, ignoring printing swaps', () => {
    const d = diffDecklists(deckToSections(DECK).sections, deckToSections(now).sections);
    expect(d.added).toEqual([{ cardName: 'Zipper Hit', pitch: 1, quantity: 2 }]);
    expect(d.removed).toEqual([
      { cardName: 'Heist', pitch: 1, quantity: 1 },
      { cardName: 'Hyper Driver', pitch: 2, quantity: 3 },
    ]);
  });

  it('an unchanged deck has no differences', () => {
    const s = deckToSections(DECK).sections;
    expect(diffDecklists(s, s)).toEqual({ added: [], removed: [] });
  });
});
