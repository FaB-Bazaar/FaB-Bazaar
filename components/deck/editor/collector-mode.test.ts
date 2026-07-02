/**
 * Unit tests for the Collector Mode helpers extracted from
 * DeckEditorListView: ownership filtering (including the "just added —
 * don't disappear" exemption) and the toggle-on toast content.
 */

import { describe, it, expect } from 'vitest';
import {
  filterSectionsByOwnership,
  countUnownedTiles,
  collectorModeToast,
} from './collector-mode';

const tile = (printingId: string, copyIndex = 0) => ({ printingId, copyIndex });

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

describe('filterSectionsByOwnership', () => {
  it('returns sections untouched when filter is all', () => {
    const input = sections();
    expect(filterSectionsByOwnership(input, 'all', ownership())).toBe(input);
  });

  it('keeps only owned copies under the owned filter', () => {
    const result = filterSectionsByOwnership(sections(), 'owned', ownership());
    const red = result.find(s => s.key === 'red')!;
    expect(red.tiles).toEqual([tile('p1', 0)]);
    const blue = result.find(s => s.key === 'blue')!;
    expect(blue.tiles).toEqual([tile('p3', 0)]);
  });

  it('keeps only unowned copies under the unowned filter', () => {
    const result = filterSectionsByOwnership(sections(), 'unowned', ownership());
    const red = result.find(s => s.key === 'red')!;
    expect(red.tiles).toEqual([tile('p1', 1), tile('p2', 0)]);
    // p3 fully owned → blue section dropped entirely
    expect(result.find(s => s.key === 'blue')).toBeUndefined();
  });

  it('always keeps the hero section even when its tiles are filtered out', () => {
    const result = filterSectionsByOwnership(sections(), 'owned', ownership());
    expect(result.find(s => s.key === 'hero')).toBeDefined();
  });

  it('treats tiles with no ownership entry as unowned', () => {
    const result = filterSectionsByOwnership(
      [{ key: 'red', tiles: [tile('mystery')] }],
      'unowned',
      new Map()
    );
    expect(result[0].tiles).toEqual([tile('mystery')]);
  });

  it('keeps exempt printings visible under the unowned filter even when owned (just-added cards must not disappear)', () => {
    const result = filterSectionsByOwnership(
      sections(),
      'unowned',
      ownership(),
      new Set(['p3'])
    );
    // p3 is fully owned but exempt → its copy stays visible
    const blue = result.find(s => s.key === 'blue')!;
    expect(blue.tiles).toEqual([tile('p3', 0)]);
  });

  it('does not let exemptions leak into the owned filter', () => {
    const result = filterSectionsByOwnership(
      sections(),
      'owned',
      ownership(),
      new Set(['p2'])
    );
    const red = result.find(s => s.key === 'red')!;
    expect(red.tiles).toEqual([tile('p1', 0)]);
  });
});

describe('countUnownedTiles', () => {
  it('counts copies not covered by ownership', () => {
    // hero-p (no entry) + p1 copy 1 + p2 copy 0 = 3
    expect(countUnownedTiles(sections(), ownership())).toBe(3);
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
  it('reports the unowned count and the icon legend', () => {
    const { title, description } = collectorModeToast(23);
    expect(title).toMatch(/collector mode/i);
    expect(description).toContain('23');
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
