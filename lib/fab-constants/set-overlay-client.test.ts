import { describe, it, expect, afterEach } from 'vitest';
import {
  adoptLayoutOverlay, adoptFetchedOverlay, subscribeSetOverlay, setOverlayVersion, __resetSetOverlayClientForTests,
} from './set-overlay-client';
import { currentSetOverlay, resetSetOverlay, type SetOverlay } from './set-overlay';

const o = (version: string): SetOverlay => ({ version, meta: {}, images: {}, filterSets: null });

afterEach(() => { __resetSetOverlayClientForTests(); resetSetOverlay(); });

describe('browser overlay adoption', () => {
  it('applies the overlay the layout rendered with', () => {
    adoptLayoutOverlay(o('a'));
    expect(currentSetOverlay().version).toBe('a');
  });

  it('a fetched overlay replaces the layout one', () => {
    adoptLayoutOverlay(o('a'));
    adoptFetchedOverlay(o('b'));
    expect(currentSetOverlay().version).toBe('b');
  });

  it('re-rendering with the same layout overlay never downgrades a fetched one', () => {
    adoptLayoutOverlay(o('a'));
    adoptFetchedOverlay(o('b'));
    adoptLayoutOverlay(o('a'));
    expect(currentSetOverlay().version).toBe('b');
  });

  it('a genuinely new layout overlay (fresh server render) is adopted', () => {
    adoptLayoutOverlay(o('a'));
    adoptFetchedOverlay(o('b'));
    adoptLayoutOverlay(o('c'));
    expect(currentSetOverlay().version).toBe('c');
  });

  // /sets is prerendered with the compiled snapshot: the fetched overlay has
  // to re-render it, or a logo registered after the build never shows there.
  it('tells subscribers when a fetched overlay changes what is published', () => {
    adoptLayoutOverlay(o('a'));
    let calls = 0;
    const unsubscribe = subscribeSetOverlay(() => { calls++; });
    expect(setOverlayVersion()).toBe('a');

    adoptFetchedOverlay(o('b'));
    expect(calls).toBe(1);
    expect(setOverlayVersion()).toBe('b');

    adoptFetchedOverlay(o('b'));
    expect(calls).toBe(1);

    unsubscribe();
    adoptFetchedOverlay(o('c'));
    expect(calls).toBe(1);
  });

  it('ignores a malformed fetch result', () => {
    adoptLayoutOverlay(o('a'));
    adoptFetchedOverlay({} as SetOverlay);
    expect(currentSetOverlay().version).toBe('a');
  });
});
