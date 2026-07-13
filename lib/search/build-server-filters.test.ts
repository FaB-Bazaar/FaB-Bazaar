import { describe, it, expect } from 'vitest';
import { buildServerFilters, type SearchUiState } from './build-server-filters';
import { FORMAT_OPTIONS, PRICE_PRESETS, HERO_AGE_CHIPS } from './card-filter-chips';

const baseState: SearchUiState = {
  query: '',
  selectedType: null,
  selectedClasses: [],
  selectedTalents: [],
  selectedPitch: [],
  selectedKeywords: [],
  selectedRarities: [],
  selectedFoilings: [],
  selectedEditions: [],
  selectedSets: [],
  costMin: '', costMax: '',
  powerMin: '', powerMax: '',
  defenseMin: '', defenseMax: '',
  priceMax: '',
};

describe('buildServerFilters — facets', () => {
  it('maps selectedFacets to facetTags, ANY mode by default', () => {
    const f = buildServerFilters({ ...baseState, selectedFacets: ['tutor', 'evasive'] });
    expect(f.facetTags).toEqual(['tutor', 'evasive']);
    expect(f.facetTagsMode ?? 'any').toBe('any');
  });

  it('sets facetTagsMode to all when facetsMatchAll is true', () => {
    const f = buildServerFilters({ ...baseState, selectedFacets: ['tutor', 'evasive'], facetsMatchAll: true });
    expect(f.facetTagsMode).toBe('all');
  });

  it('omits the facet filter when none are selected (even with match-all set)', () => {
    expect(buildServerFilters({ ...baseState, facetsMatchAll: true })).not.toHaveProperty('facetTags');
  });
});

describe('buildServerFilters — pitch (multi-select OR)', () => {
  it('maps selected pitches to an array filter (server ORs via inArray)', () => {
    expect(buildServerFilters({ ...baseState, selectedPitch: [1, 3] }).pitch).toEqual([1, 3]);
    expect(buildServerFilters({ ...baseState, selectedPitch: [2] }).pitch).toEqual([2]);
  });

  it('omits the pitch filter when nothing is selected', () => {
    expect(buildServerFilters(baseState)).not.toHaveProperty('pitch');
  });
});

describe('buildServerFilters — search mode', () => {
  it('maps a bare query to filters.name by default (name mode)', () => {
    const f = buildServerFilters({ ...baseState, query: 'prevent' });
    expect(f.name).toBe('prevent');
    expect(f).not.toHaveProperty('text');
  });

  it('maps a bare query to filters.text in text mode (rule text only, not name)', () => {
    const f = buildServerFilters({ ...baseState, query: 'prevent', searchMode: 'text' });
    expect(f.text).toBe('prevent');
    expect(f).not.toHaveProperty('name');
  });

  it('still parses shorthand in text mode (mode only affects the bare-string fallback)', () => {
    const f = buildServerFilters({ ...baseState, query: 't:equipment', searchMode: 'text' });
    expect(f.types).toEqual(['equipment']);
    expect(f).not.toHaveProperty('text');
  });

  it('lets chips layer on top of a text-mode query', () => {
    const f = buildServerFilters({ ...baseState, query: 'prevent', searchMode: 'text', selectedClasses: ['guardian'] });
    expect(f.text).toBe('prevent');
    expect(f.classes).toEqual(['guardian']);
  });
});

describe('buildServerFilters — format', () => {
  it('maps selectedFormat to filters.format', () => {
    const f = buildServerFilters({ ...baseState, selectedFormat: 'cc' });
    expect(f.format).toBe('cc');
  });

  it('omits format when no format is selected', () => {
    const f = buildServerFilters({ ...baseState, query: 'snatch' });
    expect(f).not.toHaveProperty('format');
  });

  it('lets the format chip win over a shorthand format: term', () => {
    const f = buildServerFilters({
      ...baseState,
      query: 'format:blitz t:attack',
      selectedFormat: 'silver_age',
    });
    expect(f.format).toBe('silver_age');
  });

  it('still parses shorthand format: when no chip is selected', () => {
    const f = buildServerFilters({ ...baseState, query: 'format:cc t:attack' });
    expect(f.format).toBe('cc');
  });
});

describe('buildServerFilters — classes (multi-select, OR)', () => {
  it('maps a single class to filters.classes', () => {
    const f = buildServerFilters({ ...baseState, selectedClasses: ['guardian'] });
    expect(f.classes).toEqual(['guardian']);
  });

  it('passes multiple classes through (OR applied server-side via array overlap)', () => {
    const f = buildServerFilters({ ...baseState, selectedClasses: ['guardian', 'generic'] });
    expect(f.classes).toEqual(['guardian', 'generic']);
  });

  it('treats generic as just another class value', () => {
    const f = buildServerFilters({ ...baseState, selectedClasses: ['generic'] });
    expect(f.classes).toEqual(['generic']);
    // generic-as-class must NOT route through the stricter isGenericOnly flag
    expect(f).not.toHaveProperty('isGenericOnly');
  });

  it('omits classes when none are selected', () => {
    const f = buildServerFilters({ ...baseState, query: 'snatch' });
    expect(f).not.toHaveProperty('classes');
  });
});

describe('buildServerFilters — talents (multi-select, OR)', () => {
  it('maps selected talents to filters.talents', () => {
    const f = buildServerFilters({ ...baseState, selectedTalents: ['light', 'shadow'] });
    expect(f.talents).toEqual(['light', 'shadow']);
  });

  it('unions class + talent (sets classTalentUnion) so the pool is class ∪ talent', () => {
    const f = buildServerFilters({
      ...baseState,
      selectedClasses: ['warrior'],
      selectedTalents: ['light'],
    });
    expect(f.classes).toEqual(['warrior']);
    expect(f.talents).toEqual(['light']);
    expect(f.classTalentUnion).toBe(true);
  });

  it('does not set classTalentUnion when nothing is selected', () => {
    const f = buildServerFilters({ ...baseState, query: 'snatch' });
    expect(f).not.toHaveProperty('classTalentUnion');
  });

  it('maps selectedTalentless to filters.talentless (class + talentless)', () => {
    const f = buildServerFilters({ ...baseState, selectedClasses: ['illusionist'], selectedTalentless: true });
    expect(f.classes).toEqual(['illusionist']);
    expect(f.talentless).toBe(true);
  });

  it('omits talentless when not selected', () => {
    const f = buildServerFilters({ ...baseState, selectedClasses: ['illusionist'] });
    expect(f).not.toHaveProperty('talentless');
  });

  it('omits talents when none are selected', () => {
    const f = buildServerFilters({ ...baseState, query: 'snatch' });
    expect(f).not.toHaveProperty('talents');
  });
});

describe('buildServerFilters — price', () => {
  it('maps a maximum to priceMax against tcg_low', () => {
    const f = buildServerFilters({ ...baseState, priceMax: '25' });
    expect(f.priceMax).toBe(25);
    expect(f.priceField).toBe('tcg_low');
  });

  it('maps a minimum to priceMin against tcg_low ("above an amount")', () => {
    const f = buildServerFilters({ ...baseState, priceMin: '50' });
    expect(f.priceMin).toBe(50);
    expect(f.priceField).toBe('tcg_low');
  });

  it('supports a min+max range together', () => {
    const f = buildServerFilters({ ...baseState, priceMin: '25', priceMax: '100' });
    expect(f.priceMin).toBe(25);
    expect(f.priceMax).toBe(100);
    expect(f.priceField).toBe('tcg_low');
  });

  it('omits price fields when neither bound is set', () => {
    const f = buildServerFilters({ ...baseState, query: 'snatch' });
    expect(f).not.toHaveProperty('priceMin');
    expect(f).not.toHaveProperty('priceMax');
    expect(f).not.toHaveProperty('priceField');
  });
});

describe('PRICE_PRESETS', () => {
  it('offers the under-10/25/50 and over-50 buckets', () => {
    expect(PRICE_PRESETS.map(p => ({ min: p.min, max: p.max }))).toEqual([
      { min: '', max: '10' },
      { min: '', max: '25' },
      { min: '', max: '50' },
      { min: '50', max: '' },
    ]);
  });
});

describe('buildServerFilters — hero ages', () => {
  it('maps a single hero age to filters.heroAges', () => {
    const f = buildServerFilters({ ...baseState, selectedHeroAges: ['young'] });
    expect(f.heroAges).toEqual(['young']);
  });

  it('passes both ages through (OR is applied server-side)', () => {
    const f = buildServerFilters({ ...baseState, selectedHeroAges: ['adult', 'young'] });
    expect(f.heroAges).toEqual(['adult', 'young']);
  });

  it('omits heroAges when none are selected', () => {
    const f = buildServerFilters({ ...baseState, query: 'snatch' });
    expect(f).not.toHaveProperty('heroAges');
  });
});

describe('HERO_AGE_CHIPS', () => {
  it('offers adult then young, each with a card image', () => {
    expect(HERO_AGE_CHIPS.map((c) => c.value)).toEqual(['adult', 'young']);
    expect(HERO_AGE_CHIPS.every((c) => c.iconUrl.startsWith('https://imagedelivery.net'))).toBe(true);
  });
});

describe('FORMAT_OPTIONS', () => {
  it('covers the five supported formats, CC and Silver Age first', () => {
    expect(FORMAT_OPTIONS.map(o => o.value)).toEqual([
      'cc', 'silver_age', 'blitz', 'll', 'commoner',
    ]);
  });

  it('uses full display names', () => {
    const labels = Object.fromEntries(FORMAT_OPTIONS.map(o => [o.value, o.label]));
    expect(labels.cc).toBe('Classic Constructed');
    expect(labels.silver_age).toBe('Silver Age');
    expect(labels.ll).toBe('Living Legend');
  });
});

describe('arcane range', () => {
  it('maps arcaneMin/arcaneMax state to numeric service filters', () => {
    const f = buildServerFilters({ ...baseState, arcaneMin: '3', arcaneMax: '5' });
    expect(f.arcaneMin).toBe(3);
    expect(f.arcaneMax).toBe(5);
  });
});
