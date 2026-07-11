/**
 * Pure reducer over the /opt page's consolidated UI state (OptUiState).
 *
 * Encodes the page's cross-field invariants as atomic actions instead of
 * ordered setState calls: type ↔ hero-age and talent ↔ talentless mutual
 * exclusion, paired range fields, and clear-all that deliberately preserves
 * the session-only sort/view/grouping prefs.
 *
 * HYDRATE replaces onto DEFAULT_OPT_STATE (not the current state) so applying
 * a URL — on mount, or later from popstate / a chat-proposed search — resets
 * every param the URL doesn't mention.
 *
 * Framework-free on purpose: lives in lib/ (node vitest project) rather than
 * hooks/ (which no vitest project globs cover).
 */

import { DEFAULT_OPT_STATE, type HeroAge, type OptUiState } from './opt-url-state';

// string[] facets safe for generic membership toggling.
export type OptArrayKey =
  | 'selectedClasses'
  | 'selectedKeywords'
  | 'selectedRarities'
  | 'selectedFoilings'
  | 'selectedEditions'
  | 'selectedSets';

export type RangeKey = 'cost' | 'power' | 'defense' | 'price';

export type OptAction =
  | { type: 'HYDRATE'; state: Partial<OptUiState> }
  | { type: 'PATCH'; patch: Partial<OptUiState> }
  | { type: 'RESET' }
  | { type: 'TOGGLE_TYPE'; value: string }
  | { type: 'TOGGLE_HERO_AGE'; value: HeroAge }
  | { type: 'TOGGLE_TALENT'; value: string }
  | { type: 'TOGGLE_TALENTLESS' }
  | { type: 'TOGGLE_IN'; key: OptArrayKey; value: string }
  | { type: 'TOGGLE_PITCH'; value: number }
  | { type: 'TOGGLE_PACK'; value: number }
  | { type: 'PRUNE_PACKS'; valid: number[] }
  | { type: 'SET_RANGE'; range: RangeKey; min?: string; max?: string }
  | { type: 'CLEAR_RANGE'; range: RangeKey }
  | { type: 'TOGGLE_PRICE_PRESET'; min: string; max: string };

const toggle = <T,>(arr: T[], value: T): T[] =>
  arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];

// Range key → the two OptUiState fields it owns ('defense' → defenseMin/Max).
const rangeFields = (range: RangeKey): [keyof OptUiState, keyof OptUiState] =>
  [`${range}Min`, `${range}Max`] as [keyof OptUiState, keyof OptUiState];

export function optSearchReducer(state: OptUiState, action: OptAction): OptUiState {
  switch (action.type) {
    case 'HYDRATE':
      return { ...DEFAULT_OPT_STATE, ...action.state };

    case 'PATCH':
      return { ...state, ...action.patch };

    case 'RESET':
      // clear-all: everything back to defaults EXCEPT the session-only
      // sort/view/grouping prefs, which survive a filter reset.
      return {
        ...DEFAULT_OPT_STATE,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        viewMode: state.viewMode,
        groupByCard: state.groupByCard,
      };

    case 'TOGGLE_TYPE':
      return {
        ...state,
        selectedType: state.selectedType === action.value ? null : action.value,
        selectedHeroAges: [],
      };

    case 'TOGGLE_HERO_AGE':
      return {
        ...state,
        selectedHeroAges: toggle(state.selectedHeroAges, action.value),
        selectedType: null,
      };

    case 'TOGGLE_TALENT':
      return {
        ...state,
        selectedTalents: toggle(state.selectedTalents, action.value),
        selectedTalentless: false,
      };

    case 'TOGGLE_TALENTLESS':
      return {
        ...state,
        selectedTalentless: !state.selectedTalentless,
        selectedTalents: [],
      };

    case 'TOGGLE_IN':
      return { ...state, [action.key]: toggle(state[action.key], action.value) };

    case 'TOGGLE_PITCH':
      return { ...state, selectedPitch: toggle(state.selectedPitch, action.value) };

    case 'TOGGLE_PACK':
      return { ...state, selectedPacks: toggle(state.selectedPacks, action.value) };

    case 'PRUNE_PACKS': {
      const valid = new Set(action.valid);
      const next = state.selectedPacks.filter((g) => valid.has(g));
      // Identity-preserving no-op so the URL write-back effect doesn't churn.
      return next.length === state.selectedPacks.length
        ? state
        : { ...state, selectedPacks: next };
    }

    case 'SET_RANGE': {
      const [minKey, maxKey] = rangeFields(action.range);
      return {
        ...state,
        ...(action.min !== undefined ? { [minKey]: action.min } : null),
        ...(action.max !== undefined ? { [maxKey]: action.max } : null),
      };
    }

    case 'CLEAR_RANGE': {
      const [minKey, maxKey] = rangeFields(action.range);
      return { ...state, [minKey]: '', [maxKey]: '' };
    }

    case 'TOGGLE_PRICE_PRESET': {
      const active = state.priceMin === action.min && state.priceMax === action.max;
      return {
        ...state,
        priceMin: active ? '' : action.min,
        priceMax: active ? '' : action.max,
      };
    }
  }
}
