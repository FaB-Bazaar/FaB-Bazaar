import { describe, it, expect } from 'vitest';
import { resolveDefaultDeckViewMode } from './deckViewMode';

describe('resolveDefaultDeckViewMode', () => {
  it('defaults to tile view for decks the viewer can edit', () => {
    expect(resolveDefaultDeckViewMode(true)).toBe('tile');
  });

  it("defaults to game view for someone else's deck (read-only)", () => {
    expect(resolveDefaultDeckViewMode(false)).toBe('game');
  });
});
