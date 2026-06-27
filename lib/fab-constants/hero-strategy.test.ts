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
      // tournament-derived gems: control plan, disruption, matchup awareness
      expect(p).toMatch(/Pulsewave|Ripple Away/);
      expect(p).toMatch(/Oscilio/);
      expect(p).toMatch(/Shred/);
    }
  });

  it('resolves Kassai across her slug + name fragment', () => {
    for (const slug of ['kassai_of_the_golden_sand', 'kassai']) {
      const p = getHeroPrimer(slug);
      expect(p, slug).toBeTruthy();
      // includes the "don't block her weapons with attack actions" guidance
      expect(p).toMatch(/attack action/i);
    }
  });

  it('returns null for a hero without a curated primer', () => {
    expect(getHeroPrimer('dash_io')).toBeNull();
    expect(getHeroPrimer(null)).toBeNull();
    expect(getHeroPrimer(undefined)).toBeNull();
  });
});
