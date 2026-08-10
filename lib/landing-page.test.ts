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

  it('maps "opt" to /opt', () => {
    expect(resolveLandingPath('opt')).toBe('/opt');
  });

  it('defaults to /opt when unset', () => {
    expect(resolveLandingPath(null)).toBe('/opt');
    expect(resolveLandingPath(undefined)).toBe('/opt');
    expect(resolveLandingPath('')).toBe('/opt');
  });

  it('defaults to /opt for unknown values', () => {
    expect(resolveLandingPath('garbage')).toBe('/opt');
    expect(resolveLandingPath('/etc/passwd')).toBe('/opt');
  });

  it('an explicit volzar preference still resolves (default changed to opt)', () => {
    expect(resolveLandingPath('volzar')).toBe('/volzar');
  });

  it('exposes the options list for UI and validation, volzar first', () => {
    expect(LANDING_PAGE_OPTIONS.map((o) => o.value)).toEqual(['volzar', 'collection', 'decks', 'opt']);
  });
});
