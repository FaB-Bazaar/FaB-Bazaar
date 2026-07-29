import { describe, it, expect } from 'vitest';
import { resolveDefaultDeckViewMode } from './deckViewMode';

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
