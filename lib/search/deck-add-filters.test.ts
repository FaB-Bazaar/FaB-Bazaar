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
    // CC decks search the spoiler-inclusive pool (Future CC folded into CC).
    expect(f.format).toBe('future_cc');
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
    // format still applies (hero must be format-legal — spoiled heroes included)
    expect(f.format).toBe('future_cc');
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

describe('formats other than CC keep their own pool', () => {
  it('Silver Age sends silver_age; the retired Future CC name maps to nothing', () => {
    expect(buildDeckAddFilters(state(), '', ctx({ deckFormat: 'Silver Age' })).format).toBe('silver_age');
    expect(buildDeckAddFilters(state(), '', ctx({ deckFormat: 'Future Classic Constructed' })).format).toBeUndefined();
  });
});

describe('buildDeckAddFilters — equipment slots', () => {
  it('equipment zone keeps the equipment/weapon type guard AND adds the slot subtypes', () => {
    // off-hand is also carried by two companion allies (Polly Cranka, Sticky
    // Fingers) — the zone's type guard must stay in place so a slot never
    // widens the picker beyond equipment + weapons.
    const f = buildDeckAddFilters(state({ selectedSlots: ['off-hand', 'head'] }), '', ctx({ targetCategory: 'equipment' }));
    expect(f.types).toEqual(['equipment', 'weapon']);
    expect(f.subtypes).toEqual(['off-hand', 'head']);
  });

  it('hero zone ignores slots (heroes have none)', () => {
    const f = buildDeckAddFilters(state({ selectedSlots: ['arms'] }), '', ctx({ targetCategory: 'hero' }));
    expect(f).not.toHaveProperty('subtypes');
  });
});

describe('buildDeckAddFilters — hero specializations', () => {
  it("passes the deck hero's name so other heroes' specializations drop out", () => {
    const f = buildDeckAddFilters(state(), '', ctx({ heroName: "Maxx 'The Hype' Nitro" }));
    expect(f.specializationHero).toBe("Maxx 'The Hype' Nitro");
  });

  it('sends nothing without a hero name', () => {
    expect(buildDeckAddFilters(state(), '', ctx())).not.toHaveProperty('specializationHero');
  });

  it('the hero picker is unrestricted — no specialization filter', () => {
    const f = buildDeckAddFilters(state(), '', ctx({ heroName: 'Maxx Nitro', targetCategory: 'hero' }));
    expect(f).not.toHaveProperty('specializationHero');
  });
});

describe('buildDeckAddFilters — double-faced backs', () => {
  // A back face (Bank Breaker = back of Construct Bank Breaker) can't be put
  // in a deck — Talishar validates the front.
  it('searches front faces only', () => {
    expect(buildDeckAddFilters(state(), 'bank breaker', ctx()).frontFaceOnly).toBe(true);
  });

  it('the hero picker hides back faces too (Viserai, Usurper)', () => {
    expect(buildDeckAddFilters(state(), '', ctx({ targetCategory: 'hero' })).frontFaceOnly).toBe(true);
  });

  it('adds nothing when there is nothing to search (dialog stays idle)', () => {
    expect(buildDeckAddFilters(state(), '', ctx({ hero: null, deckFormat: undefined }))).toEqual({});
  });
});
