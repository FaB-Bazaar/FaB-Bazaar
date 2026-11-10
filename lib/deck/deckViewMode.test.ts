import { describe, it, expect } from 'vitest';
import { deckTileWidth, isCardGridMode, resolveDefaultDeckViewMode } from './deckViewMode';

describe('resolveDefaultDeckViewMode', () => {
  it('defaults to tile view for decks the viewer can edit', () => {
    expect(resolveDefaultDeckViewMode(true)).toBe('tile');
  });

  it("defaults to game view for someone else's deck (read-only)", () => {
    expect(resolveDefaultDeckViewMode(false)).toBe('game');
  });

  it('defaults to list view on mobile regardless of edit rights', () => {
    expect(resolveDefaultDeckViewMode(true, true)).toBe('list');
    expect(resolveDefaultDeckViewMode(false, true)).toBe('list');
  });

  it('keeps the desktop defaults when isMobile is explicitly false', () => {
    expect(resolveDefaultDeckViewMode(true, false)).toBe('tile');
    expect(resolveDefaultDeckViewMode(false, false)).toBe('game');
  });
});

// "Full" = the tile view with the whole card face instead of the cropped
// tile. It shares the tile view's controls (size, hover preview, highlights),
// so every "is this a card-grid mode" check goes through isCardGridMode.
describe('full card view', () => {
  it('counts tile, full and game as card-grid modes, list not', () => {
    expect((['list', 'tile', 'full', 'game'] as const).map(isCardGridMode)).toEqual([false, true, true, true]);
  });

  it('is never a default — a viewer picks it', () => {
    for (const canEdit of [true, false]) for (const mobile of [true, false]) {
      expect(resolveDefaultDeckViewMode(canEdit, mobile)).not.toBe('full');
    }
  });

  it('keeps the cropped tile widths for tile and game', () => {
    expect([0, 1, 2].map(i => deckTileWidth('tile', i))).toEqual([108, 150, 200]);
    expect(deckTileWidth('game', 0)).toBe(108);
  });

  it('draws full cards wider at every size, so the card text is readable', () => {
    for (const i of [0, 1, 2]) expect(deckTileWidth('full', i)).toBeGreaterThan(deckTileWidth('tile', i));
    expect(deckTileWidth('full', 0)).toBeGreaterThanOrEqual(150);
  });

  it('clamps an out-of-range size', () => {
    expect(deckTileWidth('tile', 9)).toBe(200);
    expect(deckTileWidth('tile', -1)).toBe(108);
  });
});
