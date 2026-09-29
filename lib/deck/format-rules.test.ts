import { describe, it, expect } from 'vitest';
import { CONSTRUCTED_FORMAT_RULES, maxCopiesFor } from './format-rules';

// Pinned to the official format pages (fabtcg.com/gameplay-formats/*) and
// TRP section 7, verified 2026-09-29. Blitz went singleton on 2026-01-01.
describe('CONSTRUCTED_FORMAT_RULES', () => {
  it('Classic Constructed: adult hero, 80 pool, 60+ deck, 3 copies', () => {
    expect(CONSTRUCTED_FORMAT_RULES['Classic Constructed']).toMatchObject({
      heroAge: 'adult', maxCardPool: 80, deckSize: { min: 60 }, maxCopies: 3,
    });
  });

  it('Living Legend: adult hero, 80 pool, 60+ deck, 3 copies', () => {
    expect(CONSTRUCTED_FORMAT_RULES['Living Legend']).toMatchObject({
      heroAge: 'adult', maxCardPool: 80, deckSize: { min: 60 }, maxCopies: 3,
    });
  });

  it('Blitz: young hero, 52 pool, exactly 40, 1 copy', () => {
    expect(CONSTRUCTED_FORMAT_RULES.Blitz).toMatchObject({
      heroAge: 'young', maxCardPool: 52, deckSize: { exact: 40 }, maxCopies: 1,
    });
  });

  it('Silver Age: young hero, 55 pool, exactly 40, 2 copies', () => {
    expect(CONSTRUCTED_FORMAT_RULES['Silver Age']).toMatchObject({
      heroAge: 'young', maxCardPool: 55, deckSize: { exact: 40 }, maxCopies: 2,
    });
  });

  it('Commoner: young hero, 52 pool, exactly 40, 2 copies', () => {
    expect(CONSTRUCTED_FORMAT_RULES.Commoner).toMatchObject({
      heroAge: 'young', maxCardPool: 52, deckSize: { exact: 40 }, maxCopies: 2,
    });
  });
});

describe('maxCopiesFor', () => {
  it('reads the table case-insensitively', () => {
    expect(maxCopiesFor('blitz')).toBe(1);
    expect(maxCopiesFor('Silver Age')).toBe(2);
    expect(maxCopiesFor('CLASSIC CONSTRUCTED')).toBe(3);
  });

  it('treats the retired Future CC name as CC', () => {
    expect(maxCopiesFor('Future Classic Constructed')).toBe(3);
  });

  it('returns null (no limit) for free-form formats', () => {
    expect(maxCopiesFor('Casual')).toBeNull();
    expect(maxCopiesFor('Limited')).toBeNull();
    expect(maxCopiesFor('Ultimate Pit Fight')).toBeNull();
  });
});
