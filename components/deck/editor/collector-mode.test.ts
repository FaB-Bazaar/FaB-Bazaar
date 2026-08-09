/**
 * Unit tests for the Collector Mode helpers extracted from
 * DeckEditorListView: ownership filtering and the toggle-on toast.
 *
 * Collector Mode ('unowned') HIDES copies you already own at the CARD
 * level — owning ANY printing of a card covers the deck's slot — and shows
 * only the copies still missing from your collection (each with
 * add-to-binder/wants buttons). Card-level ownership comes from a second
 * map keyed by card_unique_id; without it (signed out, still loading)
 * the filter falls back to annotate-only and hides nothing.
 */

import { describe, it, expect } from 'vitest';
import {
  filterSectionsByOwnership,
  countUnownedTiles,
  collectorModeToast,
  buildWantsMap,
  wantsBadgeTitle,
} from './collector-mode';

const tile = (printingId: string, copyIndex = 0, cardUniqueId = `cu-${printingId}`) =>
  ({ printingId, copyIndex, cardUniqueId });

const sections = () => [
  { key: 'hero', tiles: [tile('hero-p')] },
  { key: 'red', tiles: [tile('p1', 0), tile('p1', 1), tile('p2', 0)] },
  { key: 'blue', tiles: [tile('p3', 0)] },
];

// p1: owns 1 of 2 copies; p2: owns 0; p3: owns 1 (fully owned); hero unowned
const ownership = () =>
  new Map([
    ['p1', { owned: 1 }],
    ['p2', { owned: 0 }],
    ['p3', { owned: 1 }],
  ]);

// Same scenario at the card level (any printing counts)
const cardOwnership = () =>
  new Map([
    ['cu-p1', { owned: 1 }],
    ['cu-p2', { owned: 0 }],
    ['cu-p3', { owned: 1 }],
  ]);

describe('filterSectionsByOwnership', () => {
  it('returns sections untouched when filter is all', () => {
    const input = sections();
    expect(filterSectionsByOwnership(input, 'all', ownership(), cardOwnership())).toBe(input);
  });

  it('unowned: hides card-level owned copies and keeps only the missing ones', () => {
    const result = filterSectionsByOwnership(sections(), 'unowned', ownership(), cardOwnership());
    const red = result.find(s => s.key === 'red')!;
    // p1: owns 1 of 2 → first copy hidden, second shown; p2 unowned → shown
    expect(red.tiles).toEqual([tile('p1', 1), tile('p2', 0)]);
    // p3 fully owned → blue section emptied and dropped
    expect(result.find(s => s.key === 'blue')).toBeUndefined();
  });

  it('unowned: ownership spans printings of the same card', () => {
    const input = [{
      key: 'red',
      tiles: [
        { printingId: 'pA', copyIndex: 0, cardUniqueId: 'cu-X' },
        { printingId: 'pB', copyIndex: 0, cardUniqueId: 'cu-X' },
      ],
    }];
    // Owns 1 copy of the card (any printing) → one of the two tiles hides
    const result = filterSectionsByOwnership(input, 'unowned', new Map(), new Map([['cu-X', { owned: 1 }]]));
    expect(result[0].tiles).toEqual([{ printingId: 'pB', copyIndex: 0, cardUniqueId: 'cu-X' }]);
  });

  it('unowned: card-level ownership hides a tile even when the exact printing is unowned', () => {
    const input = [{ key: 'red', tiles: [tile('p9', 0, 'cu-9')] }];
    const result = filterSectionsByOwnership(
      input, 'unowned',
      new Map(),                              // exact printing: owns none
      new Map([['cu-9', { owned: 1 }]])       // but owns another printing of the card
    );
    expect(result.find(s => s.key === 'red')).toBeUndefined();
  });

  it('unowned: always keeps the hero section even when its tiles are filtered out', () => {
    const result = filterSectionsByOwnership(
      sections(), 'unowned', ownership(),
      new Map([...cardOwnership(), ['cu-hero-p', { owned: 1 }]])
    );
    const hero = result.find(s => s.key === 'hero');
    expect(hero).toBeDefined();
    expect(hero!.tiles).toEqual([]);
  });

  it('unowned: without a card-level map it annotates only — nothing hides', () => {
    const input = sections();
    expect(filterSectionsByOwnership(input, 'unowned', ownership())).toBe(input);
  });

  it('unowned: a tile without a cardUniqueId falls back to exact-printing ownership', () => {
    const input = [{ key: 'red', tiles: [{ printingId: 'p1', copyIndex: 0, cardUniqueId: '' }] }];
    const result = filterSectionsByOwnership(
      input, 'unowned',
      new Map([['p1', { owned: 1 }]]),
      new Map()
    );
    expect(result.find(s => s.key === 'red')).toBeUndefined();
  });

  it('keeps only owned copies under the owned filter', () => {
    const result = filterSectionsByOwnership(sections(), 'owned', ownership());
    const red = result.find(s => s.key === 'red')!;
    expect(red.tiles).toEqual([tile('p1', 0)]);
    const blue = result.find(s => s.key === 'blue')!;
    expect(blue.tiles).toEqual([tile('p3', 0)]);
  });

  it('always keeps the hero section even when its tiles are filtered out', () => {
    const result = filterSectionsByOwnership(sections(), 'owned', ownership());
    expect(result.find(s => s.key === 'hero')).toBeDefined();
  });

  it('treats tiles with no ownership entry as unowned', () => {
    const result = filterSectionsByOwnership(
      [{ key: 'red', tiles: [tile('mystery')] }],
      'owned',
      new Map()
    );
    // mystery is unowned → dropped by the owned filter → section removed
    expect(result.find(s => s.key === 'red')).toBeUndefined();
  });
});

describe('countUnownedTiles', () => {
  it('counts copies not covered by ownership', () => {
    // hero-p (no entry) + p1 copy 1 + p2 copy 0 = 3
    expect(countUnownedTiles(sections(), ownership())).toBe(3);
  });

  it('counts at the card level when a card map is provided', () => {
    const input = [{
      key: 'red',
      tiles: [
        { printingId: 'pA', copyIndex: 0, cardUniqueId: 'cu-X' },
        { printingId: 'pB', copyIndex: 0, cardUniqueId: 'cu-X' },
      ],
    }];
    // Owns 1 copy of the card across printings → only 1 copy still missing
    expect(countUnownedTiles(input, new Map(), new Map([['cu-X', { owned: 1 }]]))).toBe(1);
  });

  it('returns 0 when everything is owned', () => {
    expect(
      countUnownedTiles(
        [{ key: 'red', tiles: [tile('p1', 0)] }],
        new Map([['p1', { owned: 1 }]])
      )
    ).toBe(0);
  });
});

describe('collectorModeToast', () => {
  it('reports the unowned count, that owned cards are hidden, and the icon legend', () => {
    const { title, description } = collectorModeToast(23);
    expect(title).toMatch(/collector mode/i);
    expect(description).toContain('23');
    expect(description).toMatch(/hidden|hiding/i);
    expect(description).toMatch(/binder/i);
    expect(description).toMatch(/wants/i);
  });

  it('uses singular phrasing for one card', () => {
    expect(collectorModeToast(1).description).toContain('1 card ');
  });

  it('says you own everything when the count is 0', () => {
    const { description } = collectorModeToast(0);
    expect(description).toMatch(/already own every card/i);
  });
});

describe('buildWantsMap', () => {
  it('keys quantities by card_unique_id', () => {
    const map = buildWantsMap([
      { cardId: 'cu1', quantity: 2 },
      { cardId: 'cu2', quantity: 1 },
    ]);
    expect(map.get('cu1')).toBe(2);
    expect(map.get('cu2')).toBe(1);
  });

  it('sums quantities across printings of the same card', () => {
    // Same card wanted as two different printings (e.g. regular + rainbow foil)
    const map = buildWantsMap([
      { cardId: 'cu1', quantity: 2 },
      { cardId: 'cu1', quantity: 3 },
    ]);
    expect(map.get('cu1')).toBe(5);
  });

  it('treats a missing or non-positive quantity as 1', () => {
    const map = buildWantsMap([
      { cardId: 'cu1' },
      { cardId: 'cu2', quantity: 0 },
    ]);
    expect(map.get('cu1')).toBe(1);
    expect(map.get('cu2')).toBe(1);
  });

  it('skips rows without a cardId', () => {
    const map = buildWantsMap([
      { cardId: '', quantity: 2 },
      { quantity: 4 },
      { cardId: 'cu1', quantity: 1 },
    ]);
    expect(map.size).toBe(1);
    expect(map.get('cu1')).toBe(1);
  });

  it('returns an empty map for empty or missing input', () => {
    expect(buildWantsMap([]).size).toBe(0);
    expect(buildWantsMap(undefined).size).toBe(0);
  });
});

describe('wantsBadgeTitle', () => {
  it('names the card, the total across printings, and that clicking adds one more', () => {
    const title = wantsBadgeTitle('Command and Conquer', 3);
    expect(title).toContain('Command and Conquer');
    expect(title).toContain('3');
    expect(title).toMatch(/wants/i);
    expect(title).toMatch(/printing/i);
    expect(title).toMatch(/add 1 more/i);
  });

  it('uses singular phrasing for one copy', () => {
    const title = wantsBadgeTitle('Fyendal\'s Spring Tunic', 1);
    expect(title).toContain('1 copy ');
    expect(title).not.toContain('copies');
  });

  it('uses plural phrasing for multiple copies', () => {
    expect(wantsBadgeTitle('Snatch', 2)).toContain('2 copies');
  });
});
