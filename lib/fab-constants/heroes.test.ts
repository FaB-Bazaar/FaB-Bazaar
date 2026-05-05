// lib/fab-constants/heroes.test.ts
//
// Contract + structural tests pinning the public surface of the heroes module.
// Phase 1: contract (should be green against the current monolith).
// Phase 2 (appended): structural (red until heroes-rosters.ts / heroes-meta.ts exist).

import { describe, it, expect } from 'vitest';

// ---------- Phase 1: direct module under test ----------
import * as HeroesModule from './heroes';
import * as FabConstantsBarrel from './index';

import {
  HERO_NICKNAMES,
  HERO_INFO,
  YOUNG_HERO_INFO,
  TALISHAR_HERO_IDS,
  TALISHAR_HERO_SLUGS,
  getTalisharHeroSlug,
  LIVING_LEGEND_POINTS,
  LIVING_LEGEND_THRESHOLD,
  LIVING_LEGEND_POINTS_UPDATED_AT,
  LIVING_LEGEND_POINTS_SOURCE_LABEL,
  HERO_MARVEL_PRINTING_IDS,
  getHeroInfo,
  getHeroesGroupedByClass,
  getYoungHeroesGroupedByClass,
  getAllClasses,
  normalizeHeroName,
  normalizeClassName,
  toHeroDisplayName,
  getHeroesByFormatDetailed,
  getLivingLegendPoints,
  isLivingLegendGraduated,
  getHeroMarvelImageUrl,
} from './heroes';

describe('heroes.ts — export presence (from ./heroes)', () => {
  const expectedNames = [
    // constants / records
    'HERO_NICKNAMES',
    'HERO_INFO',
    'YOUNG_HERO_INFO',
    'TALISHAR_HERO_IDS',
    'TALISHAR_HERO_SLUGS',
    'LIVING_LEGEND_POINTS',
    'LIVING_LEGEND_THRESHOLD',
    'LIVING_LEGEND_POINTS_UPDATED_AT',
    'LIVING_LEGEND_POINTS_SOURCE_LABEL',
    'HERO_MARVEL_PRINTING_IDS',
    // functions
    'getTalisharHeroSlug',
    'getHeroInfo',
    'getHeroesGroupedByClass',
    'getYoungHeroesGroupedByClass',
    'getAllClasses',
    'normalizeHeroName',
    'normalizeClassName',
    'toHeroDisplayName',
    'getHeroesByFormatDetailed',
    'getLivingLegendPoints',
    'isLivingLegendGraduated',
    'getHeroMarvelImageUrl',
  ];

  it.each(expectedNames)('exports %s', (name) => {
    expect(HeroesModule).toHaveProperty(name);
  });
});

describe('heroes.ts — export presence (via @/lib/fab-constants barrel)', () => {
  // Barrel historically re-exports the canonical public set. LIVING_LEGEND_*,
  // HERO_MARVEL_PRINTING_IDS, and getHeroMarvelImageUrl are intentionally NOT
  // re-exported through the barrel (consumers import them directly).
  const barrelExports = [
    'HERO_NICKNAMES',
    'HERO_INFO',
    'YOUNG_HERO_INFO',
    'TALISHAR_HERO_IDS',
    'TALISHAR_HERO_SLUGS',
    'getTalisharHeroSlug',
    'getHeroInfo',
    'getHeroesGroupedByClass',
    'getYoungHeroesGroupedByClass',
    'getAllClasses',
    'normalizeHeroName',
    'normalizeClassName',
    'toHeroDisplayName',
    'getHeroesByFormatDetailed',
  ];

  it.each(barrelExports)('barrel re-exports %s', (name) => {
    expect(FabConstantsBarrel).toHaveProperty(name);
  });
});

describe('HERO_NICKNAMES', () => {
  it('resolves known nicknames to full names', () => {
    expect(HERO_NICKNAMES['dori']).toBe('Dorinthea Ironsong');
    expect(HERO_NICKNAMES['slippy']).toBe('Arakni, 5L!p3d 7hRu 7h3 cR4X');
    expect(HERO_NICKNAMES['rhinar']).toBe('Rhinar, Reckless Rampage');
  });
});

describe('HERO_INFO', () => {
  it('has expected shape for a representative hero', () => {
    const rhinar = HERO_INFO['rhinar, reckless rampage'];
    expect(rhinar).toBeDefined();
    expect(rhinar.classes).toEqual(['brute']);
    expect(rhinar.talents).toEqual([]);
    expect(rhinar.shortName).toBe('rhinar');
    expect(typeof rhinar.cardUniqueId).toBe('string');
  });

  it('captures essences for elemental heroes', () => {
    const oldhim = HERO_INFO['oldhim, grandfather of eternity'];
    expect(oldhim.classes).toEqual(['guardian']);
    expect(oldhim.talents).toEqual(['elemental']);
    expect(oldhim.essences).toEqual(['earth', 'ice']);
  });

  it('has multi-class talents where applicable', () => {
    const cindra = HERO_INFO['cindra, dracai of retribution'];
    expect(cindra.classes).toEqual(['ninja']);
    expect(cindra.talents).toEqual(['royal', 'draconic']);
  });
});

describe('YOUNG_HERO_INFO', () => {
  it('has expected shape for young dorinthea', () => {
    const dori = YOUNG_HERO_INFO['dorinthea'];
    expect(dori).toBeDefined();
    expect(dori.classes).toEqual(['warrior']);
    expect(dori.shortName).toBe('dorinthea');
  });

  it('includes young-only heroes not present in adult roster', () => {
    expect(YOUNG_HERO_INFO['scurv, stowaway']).toBeDefined();
    expect(HERO_INFO['scurv, stowaway']).toBeUndefined();
  });
});

describe('TALISHAR_HERO_IDS', () => {
  it('maps canonical hero keys to Talishar collector numbers', () => {
    expect(TALISHAR_HERO_IDS['rhinar, reckless rampage']).toBe('WTR001');
    expect(TALISHAR_HERO_IDS['dorinthea ironsong']).toBe('WTR113');
    expect(TALISHAR_HERO_IDS['dorinthea']).toBe('WTR114');
  });
});

describe('TALISHAR_HERO_SLUGS', () => {
  it('maps canonical hero keys to exact Talishar slug identifiers', () => {
    expect(TALISHAR_HERO_SLUGS['rhinar, reckless rampage']).toBe('rhinar_reckless_rampage');
    expect(TALISHAR_HERO_SLUGS['dorinthea ironsong']).toBe('dorinthea_ironsong');
    expect(TALISHAR_HERO_SLUGS['dorinthea']).toBe('dorinthea');
  });

  it('preserves special characters that toTalisharIdentifier would strip', () => {
    expect(TALISHAR_HERO_SLUGS['dash i/o']).toBe('dash_i/o');
    expect(TALISHAR_HERO_SLUGS['arakni, 5l!p3d 7hru 7h3 cr4x']).toBe('arakni_5l!p3d_7hru_7h3_cr4x');
    expect(TALISHAR_HERO_SLUGS['jarl vetreiði']).toBe('jarl_vetreidi');
    expect(TALISHAR_HERO_SLUGS['kayo, strong-arm']).toBe('kayo_strong-arm');
  });

  it('getTalisharHeroSlug is case-insensitive', () => {
    expect(getTalisharHeroSlug('Dash I/O')).toBe('dash_i/o');
    expect(getTalisharHeroSlug('RHINAR')).toBe('rhinar');
  });

  it('getTalisharHeroSlug returns null for unknown heroes', () => {
    expect(getTalisharHeroSlug('nonexistent hero')).toBeNull();
  });
});

describe('LIVING_LEGEND_POINTS', () => {
  it('exposes a threshold of 1000 points', () => {
    expect(LIVING_LEGEND_THRESHOLD).toBe(1000);
  });

  it('has a string-formatted updated-at snapshot label', () => {
    expect(typeof LIVING_LEGEND_POINTS_UPDATED_AT).toBe('string');
    expect(LIVING_LEGEND_POINTS_UPDATED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof LIVING_LEGEND_POINTS_SOURCE_LABEL).toBe('string');
    expect(LIVING_LEGEND_POINTS_SOURCE_LABEL.length).toBeGreaterThan(0);
  });

  it('includes at least one graduated hero (≥ threshold)', () => {
    const starvo = LIVING_LEGEND_POINTS['bravo, star of the show'];
    expect(starvo).toBeGreaterThanOrEqual(LIVING_LEGEND_THRESHOLD);
  });

  it('includes at least one active-CC hero (< threshold)', () => {
    const prism = LIVING_LEGEND_POINTS['prism, awakener of sol'];
    expect(prism).toBeLessThan(LIVING_LEGEND_THRESHOLD);
  });
});

describe('HERO_MARVEL_PRINTING_IDS', () => {
  it('maps canonical hero keys to non-empty printing IDs', () => {
    const huntsman = HERO_MARVEL_PRINTING_IDS['arakni, huntsman'];
    expect(typeof huntsman).toBe('string');
    expect(huntsman.length).toBeGreaterThan(0);
  });
});

describe('getHeroInfo', () => {
  it('resolves by full canonical name (any casing)', () => {
    const info = getHeroInfo('Rhinar, Reckless Rampage');
    expect(info?.shortName).toBe('rhinar');
  });

  it('resolves by nickname', () => {
    const info = getHeroInfo('slippy');
    expect(info?.classes).toEqual(['assassin']);
  });

  it('resolves by shortName', () => {
    const info = getHeroInfo('dori');
    expect(info?.classes).toEqual(['warrior']);
  });

  it('returns null for unknown heroes', () => {
    expect(getHeroInfo('not-a-real-hero-xyz')).toBeNull();
  });
});

describe('normalizeHeroName / normalizeClassName', () => {
  it('normalizeHeroName returns canonical lowercase key for known heroes', () => {
    expect(normalizeHeroName('  Rhinar, Reckless Rampage  ')).toBe('rhinar, reckless rampage');
  });

  it('normalizeHeroName returns trimmed original for unknown input', () => {
    expect(normalizeHeroName('  unknown hero  ')).toBe('unknown hero');
  });

  it('normalizeHeroName returns null for null/empty input', () => {
    expect(normalizeHeroName(null)).toBeNull();
    expect(normalizeHeroName('')).toBeNull();
    expect(normalizeHeroName('   ')).toBeNull();
  });

  it('normalizeClassName lowercases + trims', () => {
    expect(normalizeClassName('  Brute  ')).toBe('brute');
    expect(normalizeClassName(null)).toBeNull();
    expect(normalizeClassName('')).toBeNull();
  });
});

describe('toHeroDisplayName', () => {
  it('uses HERO_NICKNAMES mapping when shortName provided', () => {
    expect(toHeroDisplayName('rhinar, reckless rampage', 'rhinar'))
      .toBe('Rhinar, Reckless Rampage');
  });

  it('title-cases the canonical key when no shortName is provided', () => {
    expect(toHeroDisplayName('dorinthea ironsong')).toBe('Dorinthea Ironsong');
  });
});

describe('getHeroesGroupedByClass / getYoungHeroesGroupedByClass', () => {
  it('groups adult heroes under properly-cased class names', () => {
    const grouped = getHeroesGroupedByClass();
    expect(grouped['Brute']).toContain('rhinar, reckless rampage');
    expect(grouped['Warrior']).toContain('dorinthea ironsong');
  });

  it('groups young heroes similarly', () => {
    const grouped = getYoungHeroesGroupedByClass();
    expect(grouped['Warrior']).toContain('dorinthea');
    expect(grouped['Thief']).toContain('scurv, stowaway');
  });

  it('returns sorted hero arrays within each class', () => {
    const grouped = getHeroesGroupedByClass();
    for (const heroes of Object.values(grouped)) {
      const sorted = [...heroes].sort();
      expect(heroes).toEqual(sorted);
    }
  });
});

describe('getAllClasses', () => {
  it('returns alphabetically-sorted adult classes', () => {
    const classes = getAllClasses();
    expect(classes).toContain('brute');
    expect(classes).toContain('warrior');
    const sorted = [...classes].sort();
    expect(classes).toEqual(sorted);
  });
});

describe('getLivingLegendPoints / isLivingLegendGraduated', () => {
  it('returns points for known heroes (any casing)', () => {
    expect(getLivingLegendPoints('Bravo, Star of the Show')).toBeGreaterThanOrEqual(1000);
    expect(getLivingLegendPoints('prism, awakener of sol')).toBeLessThan(1000);
  });

  it('returns null for heroes with no LL points', () => {
    expect(getLivingLegendPoints('not-a-real-hero-xyz')).toBeNull();
  });

  it('isLivingLegendGraduated true for ≥ threshold, false otherwise', () => {
    expect(isLivingLegendGraduated('bravo, star of the show')).toBe(true);
    expect(isLivingLegendGraduated('prism, awakener of sol')).toBe(false);
    expect(isLivingLegendGraduated('not-a-real-hero-xyz')).toBe(false);
  });
});

describe('getHeroMarvelImageUrl', () => {
  it('returns a cloudflare images URL for heroes with a marvel printing', () => {
    const url = getHeroMarvelImageUrl('Arakni, Huntsman');
    expect(url).toMatch(/^https:\/\/imagedelivery\.net\//);
    expect(url).toMatch(/\/public$/);
  });

  it('returns null for heroes without a marvel printing', () => {
    expect(getHeroMarvelImageUrl('not-a-real-hero-xyz')).toBeNull();
  });
});

describe('getHeroesByFormatDetailed', () => {
  it('returns { adult, young } segmented rosters with display names', () => {
    const { adult, young } = getHeroesByFormatDetailed();
    const adultBrutes = adult['Brute'];
    expect(Array.isArray(adultBrutes)).toBe(true);
    const rhinar = adultBrutes.find(h => h.name === 'rhinar, reckless rampage');
    expect(rhinar).toBeDefined();
    expect(rhinar?.displayName).toBe('Rhinar, Reckless Rampage');
    expect(rhinar?.shortName).toBe('rhinar');

    const youngWarriors = young['Warrior'];
    expect(youngWarriors.some(h => h.name === 'dorinthea')).toBe(true);
  });
});

// ---------- Phase 2: structural tests (red until sibling files exist) ----------

describe('heroes-rosters.ts — owns roster data + class grouping', () => {
  it('exports HERO_INFO, YOUNG_HERO_INFO, and the grouping helpers', async () => {
    const rosters = await import('./heroes-rosters');
    const expected = [
      'HERO_INFO',
      'YOUNG_HERO_INFO',
      'getHeroesGroupedByClass',
      'getYoungHeroesGroupedByClass',
      'getAllClasses',
    ];
    for (const name of expected) {
      expect(rosters).toHaveProperty(name);
    }
  });

  it('roster data in the sibling file matches the current public data', async () => {
    const rosters = await import('./heroes-rosters');
    expect(rosters.HERO_INFO['rhinar, reckless rampage'])
      .toEqual(HERO_INFO['rhinar, reckless rampage']);
    expect(rosters.YOUNG_HERO_INFO['dorinthea'])
      .toEqual(YOUNG_HERO_INFO['dorinthea']);
  });
});

describe('heroes-meta.ts — owns integrations + competitive meta + showcase art', () => {
  // Note: `getHeroesByFormatDetailed` stays in heroes.ts — it depends on
  // toHeroDisplayName, which would create a cycle if pulled into meta.
  it('exports Talishar, LL, and Marvel constants + helpers', async () => {
    const meta = await import('./heroes-meta');
    const expected = [
      'TALISHAR_HERO_IDS',
      'TALISHAR_HERO_SLUGS',
      'getTalisharHeroSlug',
      'LIVING_LEGEND_POINTS',
      'LIVING_LEGEND_THRESHOLD',
      'LIVING_LEGEND_POINTS_UPDATED_AT',
      'LIVING_LEGEND_POINTS_SOURCE_LABEL',
      'getLivingLegendPoints',
      'isLivingLegendGraduated',
      'HERO_MARVEL_PRINTING_IDS',
      'getHeroMarvelImageUrl',
    ];
    for (const name of expected) {
      expect(meta).toHaveProperty(name);
    }
  });

  it('meta data in the sibling file matches the current public data', async () => {
    const meta = await import('./heroes-meta');
    expect(meta.TALISHAR_HERO_IDS['rhinar, reckless rampage']).toBe('WTR001');
    expect(meta.LIVING_LEGEND_THRESHOLD).toBe(1000);
    expect(meta.HERO_MARVEL_PRINTING_IDS['arakni, huntsman']).toBeTruthy();
  });
});
