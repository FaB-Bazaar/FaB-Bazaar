/**
 * The rail deck page keeps its main view (Results, Notes, Import list, Prices)
 * in `?tab=` so it can be linked, survives a refresh and Back returns to the
 * deck. Editor-only views fall back to the deck for everyone else.
 */
import { describe, it, expect } from 'vitest';
import { mainModeHref, resolveMainMode } from './deck-page-url';

describe('resolveMainMode', () => {
  it('opens the deck with no tab', () => {
    expect(resolveMainMode(null, true)).toBe('deck');
  });

  it('opens Prices for any viewer', () => {
    expect(resolveMainMode('prices', false)).toBe('prices');
  });

  it.each(['results', 'notes', 'import'] as const)('opens %s for an editor only', tab => {
    expect(resolveMainMode(tab, true)).toBe(tab);
    expect(resolveMainMode(tab, false)).toBe('deck');
  });

  it('ignores an unknown tab', () => {
    expect(resolveMainMode('nonsense', true)).toBe('deck');
  });
});

describe('mainModeHref', () => {
  it('adds the tab', () => {
    expect(mainModeHref('/decks/abc', '', 'prices')).toBe('/decks/abc?tab=prices');
  });

  it('drops the tab for the deck itself', () => {
    expect(mainModeHref('/decks/abc', '?tab=notes', 'deck')).toBe('/decks/abc');
  });

  it('keeps other params', () => {
    expect(mainModeHref('/decks/abc', '?ref=discord&tab=notes', 'results')).toBe('/decks/abc?ref=discord&tab=results');
    expect(mainModeHref('/decks/abc', '?ref=discord&tab=notes', 'deck')).toBe('/decks/abc?ref=discord');
  });
});
