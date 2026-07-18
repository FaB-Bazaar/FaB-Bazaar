/**
 * Unit tests: pure decision logic for the API-based CardVault capture —
 * which card slugs to fetch for an input query, and what filename each
 * captured payload is saved under (byte-compatible with the legacy
 * browser-intercept capture files).
 */
import { describe, it, expect } from 'vitest';
import { pickSlugs, captureFilename, slugifyCardName } from './cardvault-capture';

const r = (card_id: string) => ({ card_id });

describe('slugifyCardName', () => {
  it('matches CardVault canonical slugs', () => {
    expect(slugifyCardName('Grasp of the Darknight')).toBe('grasp-of-the-darknight');
    expect(slugifyCardName("Oldhim, Grandfather of Eternity")).toBe('oldhim-grandfather-of-eternity');
    expect(slugifyCardName('Nuu, Alluring Desire')).toBe('nuu-alluring-desire');
  });

  it('transliterates special characters', () => {
    expect(slugifyCardName('Viserai, Rönin')).toBe('viserai-ronin');
  });
});

describe('pickSlugs', () => {
  it('by-collector returns ALL distinct card slugs (DFC promos share a collector)', () => {
    const results = [r('tuffnut-bumbling-hulkster'), r('kassai-of-the-golden-sand'), r('tuffnut-bumbling-hulkster')];
    expect(pickSlugs('HER146', true, results)).toEqual(['tuffnut-bumbling-hulkster', 'kassai-of-the-golden-sand']);
  });

  it('by-name prefers the exact slug match', () => {
    const results = [r('grasp-of-reality'), r('grasp-of-the-darknight')];
    expect(pickSlugs('Grasp of the Darknight', false, results)).toEqual(['grasp-of-the-darknight']);
  });

  it('by-name falls back to all distinct slugs when no exact match', () => {
    const results = [r('grasp-of-reality'), r('grasp-of-illusion')];
    expect(pickSlugs('Grasp', false, results)).toEqual(['grasp-of-reality', 'grasp-of-illusion']);
  });

  it('returns empty for no results', () => {
    expect(pickSlugs('ZZZ999', true, [])).toEqual([]);
  });
});

describe('captureFilename', () => {
  it('by-collector: first slug keeps the legacy <collector>.json name', () => {
    expect(captureFilename('HER146', true, 'tuffnut-bumbling-hulkster', 0)).toBe('her146.json');
  });

  it('by-collector: additional slugs get a suffixed name so nothing is overwritten', () => {
    expect(captureFilename('HER146', true, 'kassai-of-the-golden-sand', 1)).toBe('her146--kassai-of-the-golden-sand.json');
  });

  it('by-name: slug.json (legacy convention)', () => {
    expect(captureFilename('Grasp of the Darknight', false, 'grasp-of-the-darknight', 0)).toBe('grasp-of-the-darknight.json');
  });
});
