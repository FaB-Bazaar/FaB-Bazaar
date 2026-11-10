/**
 * Brew tab card sizes: S (the original 120px) / M / L / XL, so the
 * printed text can be read without opening the details panel. The pick is a
 * per-viewer convenience kept in localStorage.
 */
import { describe, it, expect } from 'vitest';
import { BREW_TILE_SIZES, DEFAULT_BREW_TILE_SIZE, parseBrewTileSize, stepBrewTileSize } from './brew-tile-size';

describe('brew tile sizes', () => {
  it('offers S, M, L and XL, each wider than the last', () => {
    expect(BREW_TILE_SIZES.map(s => s.label)).toEqual(['S', 'M', 'L', 'XL']);
    expect(BREW_TILE_SIZES.map(s => s.name)).toEqual(['Small', 'Medium', 'Large', 'Extra large']);
    const widths = BREW_TILE_SIZES.map(s => s.width);
    expect(widths[0]).toBe(120);
    expect(widths).toEqual([...widths].sort((a, b) => a - b));
    expect(new Set(widths).size).toBe(4);
  });

  // The pool is about 1390px wide on a 2000px window (owner's screen): XL
  // fits three cards there with the 12px gap, and not four.
  it('XL fits three per row in a 1390px pool', () => {
    const xl = BREW_TILE_SIZES[3].width;
    const perRow = Math.floor((1390 - 24 + 12) / (xl + 12));
    expect(perRow).toBe(3);
  });

  it('starts on small — what the tab has always shown', () => {
    expect(DEFAULT_BREW_TILE_SIZE).toBe(0);
  });

  it('steps one size at a time and stops at the ends', () => {
    expect(stepBrewTileSize(0, 1)).toBe(1);
    expect(stepBrewTileSize(1, -1)).toBe(0);
    expect(stepBrewTileSize(0, -1)).toBe(0);
    expect(stepBrewTileSize(3, 1)).toBe(3);
  });

  it('reads a saved size and ignores anything else', () => {
    expect(parseBrewTileSize('3')).toBe(3);
    expect(parseBrewTileSize('0')).toBe(0);
    for (const bad of [null, '', '7', '-1', 'large', '1.5']) expect(parseBrewTileSize(bad)).toBe(DEFAULT_BREW_TILE_SIZE);
  });
});
