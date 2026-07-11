import { describe, it, expect } from 'vitest';
import { DEFAULT_OPT_STATE, paramsToUiState, uiStateToParams, type OptUiState } from './opt-url-state';
import { optSearchReducer, type OptAction } from './opt-search-reducer';

const reduce = (state: OptUiState, ...actions: OptAction[]) =>
  actions.reduce(optSearchReducer, state);

describe('optSearchReducer', () => {
  describe('HYDRATE', () => {
    it('applies a partial state on top of defaults', () => {
      const s = reduce(DEFAULT_OPT_STATE, {
        type: 'HYDRATE',
        state: { selectedClasses: ['Ninja'], priceMin: '5' },
      });
      expect(s.selectedClasses).toEqual(['Ninja']);
      expect(s.priceMin).toBe('5');
      expect(s.sortBy).toBe('name');
    });

    it('replaces onto defaults: keys absent from the partial reset even if previously set', () => {
      const dirty = reduce(DEFAULT_OPT_STATE, { type: 'PATCH', patch: { selectedSets: ['wtr'], query: 'snatch' } });
      const s = reduce(dirty, { type: 'HYDRATE', state: { selectedClasses: ['Ninja'] } });
      expect(s.selectedClasses).toEqual(['Ninja']);
      expect(s.selectedSets).toEqual([]);
      expect(s.query).toBe('');
    });
  });

  describe('PATCH', () => {
    it('shallow-merges the patch', () => {
      const s = reduce(DEFAULT_OPT_STATE, { type: 'PATCH', patch: { sortBy: 'price', sortOrder: 'desc' } });
      expect(s.sortBy).toBe('price');
      expect(s.sortOrder).toBe('desc');
      expect(s.selectedLanguages).toEqual(['en']);
    });
  });

  describe('RESET (clear-all semantics)', () => {
    it('resets filters but preserves sortBy, sortOrder, viewMode, groupByCard', () => {
      const dirty = reduce(DEFAULT_OPT_STATE, {
        type: 'PATCH',
        patch: {
          query: 'snatch', selectedClasses: ['Ninja'], selectedSets: ['wtr'], selectedPacks: [42],
          selectedLanguages: ['fr'], priceMin: '5', selectedTalentless: true,
          sortBy: 'price', sortOrder: 'desc', viewMode: 'checklist', groupByCard: false,
        },
      });
      const s = reduce(dirty, { type: 'RESET' });
      expect(s.query).toBe('');
      expect(s.selectedClasses).toEqual([]);
      expect(s.selectedSets).toEqual([]);
      expect(s.selectedPacks).toEqual([]);
      expect(s.selectedTalentless).toBe(false);
      expect(s.priceMin).toBe('');
      expect(s.selectedLanguages).toEqual(['en']);
      // deliberately preserved (session-only view/sort prefs)
      expect(s.sortBy).toBe('price');
      expect(s.sortOrder).toBe('desc');
      expect(s.viewMode).toBe('checklist');
      expect(s.groupByCard).toBe(false);
    });
  });

  describe('type ↔ hero-age mutual exclusion', () => {
    it('TOGGLE_TYPE selects a type and clears hero ages', () => {
      const withAges = reduce(DEFAULT_OPT_STATE, { type: 'TOGGLE_HERO_AGE', value: 'adult' });
      const s = reduce(withAges, { type: 'TOGGLE_TYPE', value: 'action' });
      expect(s.selectedType).toBe('action');
      expect(s.selectedHeroAges).toEqual([]);
    });

    it('TOGGLE_TYPE toggles off when re-selected', () => {
      const s = reduce(DEFAULT_OPT_STATE,
        { type: 'TOGGLE_TYPE', value: 'action' },
        { type: 'TOGGLE_TYPE', value: 'action' });
      expect(s.selectedType).toBeNull();
    });

    it('TOGGLE_HERO_AGE toggles in the array and clears the type', () => {
      const withType = reduce(DEFAULT_OPT_STATE, { type: 'TOGGLE_TYPE', value: 'action' });
      const s = reduce(withType, { type: 'TOGGLE_HERO_AGE', value: 'young' });
      expect(s.selectedHeroAges).toEqual(['young']);
      expect(s.selectedType).toBeNull();
      const s2 = reduce(s, { type: 'TOGGLE_HERO_AGE', value: 'young' });
      expect(s2.selectedHeroAges).toEqual([]);
    });
  });

  describe('talent ↔ talentless mutual exclusion', () => {
    it('TOGGLE_TALENT toggles in the array and clears talentless', () => {
      const talentless = reduce(DEFAULT_OPT_STATE, { type: 'TOGGLE_TALENTLESS' });
      const s = reduce(talentless, { type: 'TOGGLE_TALENT', value: 'Shadow' });
      expect(s.selectedTalents).toEqual(['Shadow']);
      expect(s.selectedTalentless).toBe(false);
    });

    it('TOGGLE_TALENTLESS toggles and clears talents', () => {
      const withTalents = reduce(DEFAULT_OPT_STATE, { type: 'TOGGLE_TALENT', value: 'Shadow' });
      const s = reduce(withTalents, { type: 'TOGGLE_TALENTLESS' });
      expect(s.selectedTalentless).toBe(true);
      expect(s.selectedTalents).toEqual([]);
      const s2 = reduce(s, { type: 'TOGGLE_TALENTLESS' });
      expect(s2.selectedTalentless).toBe(false);
    });
  });

  describe('TOGGLE_IN (generic string-array facets)', () => {
    it('adds then removes a value', () => {
      const s = reduce(DEFAULT_OPT_STATE,
        { type: 'TOGGLE_IN', key: 'selectedClasses', value: 'Ninja' },
        { type: 'TOGGLE_IN', key: 'selectedClasses', value: 'Brute' });
      expect(s.selectedClasses).toEqual(['Ninja', 'Brute']);
      const s2 = reduce(s, { type: 'TOGGLE_IN', key: 'selectedClasses', value: 'Ninja' });
      expect(s2.selectedClasses).toEqual(['Brute']);
    });
  });

  describe('TOGGLE_PITCH (multi-select OR)', () => {
    it('toggles pitch values in and out independently', () => {
      const one = reduce(DEFAULT_OPT_STATE, { type: 'TOGGLE_PITCH', value: 1 });
      expect(one.selectedPitch).toEqual([1]);
      const two = reduce(one, { type: 'TOGGLE_PITCH', value: 3 });
      expect(two.selectedPitch).toEqual([1, 3]);
      const back = reduce(two, { type: 'TOGGLE_PITCH', value: 1 });
      expect(back.selectedPitch).toEqual([3]);
    });
  });

  describe('packs', () => {
    it('TOGGLE_PACK adds and removes a group id', () => {
      const s = reduce(DEFAULT_OPT_STATE, { type: 'TOGGLE_PACK', value: 42 });
      expect(s.selectedPacks).toEqual([42]);
      const s2 = reduce(s, { type: 'TOGGLE_PACK', value: 42 });
      expect(s2.selectedPacks).toEqual([]);
    });

    it('PRUNE_PACKS drops packs missing from the valid list', () => {
      const s = reduce(DEFAULT_OPT_STATE,
        { type: 'PATCH', patch: { selectedPacks: [1, 2, 3] } },
        { type: 'PRUNE_PACKS', valid: [2] });
      expect(s.selectedPacks).toEqual([2]);
    });

    it('PRUNE_PACKS returns the same state reference when nothing is pruned', () => {
      const before = reduce(DEFAULT_OPT_STATE, { type: 'PATCH', patch: { selectedPacks: [1, 2] } });
      const after = optSearchReducer(before, { type: 'PRUNE_PACKS', valid: [1, 2, 3] });
      expect(after).toBe(before);
    });
  });

  describe('ranges', () => {
    it('SET_RANGE sets only the provided side', () => {
      const s = reduce(DEFAULT_OPT_STATE, { type: 'SET_RANGE', range: 'cost', min: '2' });
      expect(s.costMin).toBe('2');
      expect(s.costMax).toBe('');
      const s2 = reduce(s, { type: 'SET_RANGE', range: 'cost', max: '4' });
      expect(s2.costMin).toBe('2');
      expect(s2.costMax).toBe('4');
    });

    it('CLEAR_RANGE clears both sides of the pair', () => {
      const s = reduce(DEFAULT_OPT_STATE,
        { type: 'SET_RANGE', range: 'defense', min: '1', max: '3' },
        { type: 'CLEAR_RANGE', range: 'defense' });
      expect(s.defenseMin).toBe('');
      expect(s.defenseMax).toBe('');
    });

    it('TOGGLE_PRICE_PRESET sets the pair, and clears it when the same pair is active', () => {
      const s = reduce(DEFAULT_OPT_STATE, { type: 'TOGGLE_PRICE_PRESET', min: '5', max: '20' });
      expect(s.priceMin).toBe('5');
      expect(s.priceMax).toBe('20');
      const s2 = reduce(s, { type: 'TOGGLE_PRICE_PRESET', min: '5', max: '20' });
      expect(s2.priceMin).toBe('');
      expect(s2.priceMax).toBe('');
      // a different preset replaces rather than clears
      const s3 = reduce(s, { type: 'TOGGLE_PRICE_PRESET', min: '20', max: '' });
      expect(s3.priceMin).toBe('20');
      expect(s3.priceMax).toBe('');
    });
  });

  describe('URL round-trip', () => {
    it('reducer output survives uiStateToParams → paramsToUiState', () => {
      const s = reduce(DEFAULT_OPT_STATE,
        { type: 'PATCH', patch: { query: 'snatch' } },
        { type: 'TOGGLE_IN', key: 'selectedClasses', value: 'Ninja' },
        { type: 'TOGGLE_IN', key: 'selectedSets', value: 'wtr' },
        { type: 'TOGGLE_HERO_AGE', value: 'adult' },
        { type: 'SET_RANGE', range: 'price', min: '5' },
        { type: 'PATCH', patch: { selectedLanguages: [] } });
      const roundTripped: OptUiState = { ...DEFAULT_OPT_STATE, ...paramsToUiState(uiStateToParams(s)) };
      expect(roundTripped).toEqual(s);
    });
  });
});
