import { describe, it, expect } from 'vitest';
import { getHeroPrimer } from './hero-strategy';

describe('getHeroPrimer', () => {
  it('resolves Teklovossen across his hero-form slugs', () => {
    for (const slug of ['teklovossen_the_mechropotent', 'teklovossen_esteemed_magnate', 'teklovossen']) {
      const p = getHeroPrimer(slug);
      expect(p, slug).toBeTruthy();
      expect(p).toMatch(/Evo engine/i);
      // bakes in the temper correction
      expect(p).toMatch(/temper/i);
    }
  });

  it('returns null for a hero without a curated primer', () => {
    expect(getHeroPrimer('kassai_of_the_golden_sand')).toBeNull();
    expect(getHeroPrimer('dash_io')).toBeNull();
    expect(getHeroPrimer(null)).toBeNull();
    expect(getHeroPrimer(undefined)).toBeNull();
  });
});
