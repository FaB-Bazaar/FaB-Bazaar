// lib/landing-page.test.ts
import { describe, it, expect } from 'vitest';
import { resolveLandingPath, LANDING_PAGE_OPTIONS } from './landing-page';

describe('resolveLandingPath', () => {
  it('maps "collection" to /collection', () => {
    expect(resolveLandingPath('collection')).toBe('/collection');
  });

  it('maps "decks" to /decks', () => {
    expect(resolveLandingPath('decks')).toBe('/decks');
  });

  it('maps "volzar" to /volzar', () => {
    expect(resolveLandingPath('volzar')).toBe('/volzar');
  });

  it('defaults to /volzar when unset', () => {
    expect(resolveLandingPath(null)).toBe('/volzar');
    expect(resolveLandingPath(undefined)).toBe('/volzar');
    expect(resolveLandingPath('')).toBe('/volzar');
  });

  it('defaults to /volzar for unknown values', () => {
    expect(resolveLandingPath('garbage')).toBe('/volzar');
    expect(resolveLandingPath('/etc/passwd')).toBe('/volzar');
  });

  it('exposes the options list for UI and validation, volzar first', () => {
    expect(LANDING_PAGE_OPTIONS.map((o) => o.value)).toEqual(['volzar', 'collection', 'decks']);
  });
});
