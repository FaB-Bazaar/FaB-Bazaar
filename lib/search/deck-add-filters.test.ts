import { describe, it, expect } from 'vitest';
import { buildDeckAddFilters, type DeckAddContext } from './deck-add-filters';
import { DEFAULT_OPT_STATE } from './opt-url-state';
import type { OptUiState } from './opt-url-state';

const HERO = { heroClasses: ['guardian'], heroTalents: ['ice'], heroEssences: [] };

const state = (overrides: Partial<OptUiState> = {}): OptUiState => ({
  ...DEFAULT_OPT_STATE,
  ...overrides,
});

const ctx = (overrides: Partial<DeckAddContext> = {}): DeckAddContext => ({
  hero: HERO,
  deckFormat: 'Classic Constructed',
  targetCategory: 'maindeck',
  ...overrides,
});

describe('buildDeckAddFilters — legality merge', () => {
  it('bakes hero legality + format into every maindeck search', () => {
    const f = buildDeckAddFilters(state(), '', ctx());
    expect(f.heroClasses).toEqual(['guardian']);
    expect(f.heroTalents).toEqual(['ice']);
    expect(f.format).toBe('cc');
  });

  it('omits empty essence arrays instead of sending []', () => {
    const f = buildDeckAddFilters(state(), '', ctx());
    expect(f).not.toHaveProperty('heroEssences');
  });

  it('passes essences when the hero has them', () => {
    const f = buildDeckAddFilters(state(), '', ctx({ hero: { ...HERO, heroEssences: ['ice'] } }));
    expect(f.heroEssences).toEqual(['ice']);
  });

  it('null hero ctx (curation dialog) produces no legality keys', () => {
    const f = buildDeckAddFilters(state(), '', ctx({ hero: null, deckFormat: undefined }));
    expect(f).not.toHaveProperty('heroClasses');
    expect(f).not.toHaveProperty('heroTalents');
    expect(f).not.toHaveProperty('heroEssences');
    expect(f).not.toHaveProperty('format');
  });

  it('unknown deck format name is omitted, not sent raw', () => {
    const f = buildDeckAddFilters(state(), '', ctx({ deckFormat: 'Kitchen Table' }));
    expect(f).not.toHaveProperty('format');
  });
});

describe('buildDeckAddFilters — target category overrides', () => {
  it('hero target searches heroes only, WITHOUT legality restriction', () => {
    const f = buildDeckAddFilters(state(), '', ctx({ targetCategory: 'hero' }));
    expect(f.types).toEqual(['hero']);
    expect(f).not.toHaveProperty('heroClasses');
    expect(f).not.toHaveProperty('heroTalents');
    // format still applies (hero must be format-legal)
    expect(f.format).toBe('cc');
  });

  it('equipment target forces equipment/weapon types WITH legality', () => {
    const f = buildDeckAddFilters(state(), '', ctx({ targetCategory: 'equipment' }));
    expect(f.types).toEqual(['equipment', 'weapon']);
    expect(f.heroClasses).toEqual(['guardian']);
  });

  it('hero target overrides a user-selected type', () => {
    const f = buildDeckAddFilters(state({ selectedType: 'attack' }), '', ctx({ targetCategory: 'hero' }));
    expect(f.types).toEqual(['hero']);
  });
});

describe('buildDeckAddFilters — query + facet pass-through', () => {
  it('uses the debounced query, not state.query', () => {
    const f = buildDeckAddFilters(state({ query: 'typing-in-flight' }), 'snapdragon', ctx());
    expect(f.name).toBe('snapdragon');
  });

  it('text mode routes bare words in a shorthand query to rule text', () => {
    const f = buildDeckAddFilters(state({ searchMode: 'text' }), 'hits t:attack', ctx());
    expect(f.text).toBe('hits');
    expect(f.types).toEqual(['attack']);
    expect(f).not.toHaveProperty('name');
  });

  it('passes pitch / rarity / sets / facet tags through from UI state', () => {
    const f = buildDeckAddFilters(state({
      selectedPitch: [1], selectedRarities: ['m'], selectedSets: ['sea'], selectedFacets: ['tutor'],
    }), '', ctx());
    expect(f.pitch).toEqual([1]);
    expect(f.rarities).toEqual(['m']);
    expect(f.sets).toEqual(['sea']);
    expect(f.facetTags).toEqual(['tutor']);
  });

  it('ignores selectedFormat from UI state (deck format is the only format source)', () => {
    const f = buildDeckAddFilters(state({ selectedFormat: 'blitz' as any }), '', ctx({ deckFormat: undefined }));
    expect(f).not.toHaveProperty('format');
  });
});

describe('Future Classic Constructed deck', () => {
  it('sends the future_cc format code', () => {
    const f = buildDeckAddFilters(state(), '', ctx({ deckFormat: 'Future Classic Constructed' }));
    expect(f.format).toBe('future_cc');
  });
});
