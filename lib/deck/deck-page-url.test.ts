/**
 * The rail deck page keeps its main view (Results, Notes, Import list, Prices)
 * in `?tab=` so it can be linked, survives a refresh and Back returns to the
 * deck. Editor-only views fall back to the deck for everyone else.
 */
import { describe, it, expect } from 'vitest';
import { mainModeHref, resolveMainMode, resolveOpenVersion, versionHref } from './deck-page-url';

describe('resolveMainMode', () => {
  it('opens the deck with no tab', () => {
    expect(resolveMainMode(null, true)).toBe('deck');
  });

  it('opens Prices for any viewer', () => {
    expect(resolveMainMode('prices', false)).toBe('prices');
  });

  it.each(['results', 'notes', 'import', 'versions'] as const)('opens %s for an editor only', tab => {
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

describe('resolveOpenVersion', () => {
  it('reads a positive whole number', () => {
    expect(resolveOpenVersion('3')).toBe(3);
  });

  it.each([null, '', '0', '-2', '1.5', 'abc', '99999999999'])('ignores %s', value => {
    expect(resolveOpenVersion(value)).toBeNull();
  });
});

describe('versionHref', () => {
  it('opens the Versions view on one version', () => {
    expect(versionHref('/decks/abc', '', 3)).toBe('/decks/abc?tab=versions&version=3');
  });

  it('switches version and keeps other params', () => {
    expect(versionHref('/decks/abc', '?ref=discord&tab=versions&version=3', 1)).toBe('/decks/abc?ref=discord&tab=versions&version=1');
  });

  it('with no version, opens the Versions view with none open', () => {
    expect(versionHref('/decks/abc', '?tab=versions&version=3', null)).toBe('/decks/abc?tab=versions');
  });
});

describe('mainModeHref and the open version', () => {
  it('drops the open version when leaving the Versions view', () => {
    expect(mainModeHref('/decks/abc', '?tab=versions&version=3', 'deck')).toBe('/decks/abc');
    expect(mainModeHref('/decks/abc', '?tab=versions&version=3', 'prices')).toBe('/decks/abc?tab=prices');
  });
});
