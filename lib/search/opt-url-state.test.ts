import { describe, it, expect } from 'vitest';
import {
  uiStateToParams,
  paramsToUiState,
  DEFAULT_OPT_STATE,
  type OptUiState,
} from './opt-url-state';

const state = (over: Partial<OptUiState> = {}): OptUiState => ({ ...DEFAULT_OPT_STATE, ...over });

describe('opt-url-state', () => {
  it('omits everything for default state (clean URL)', () => {
    expect(uiStateToParams(state()).toString()).toBe('');
  });

  it('serializes text + chip selections', () => {
    const p = uiStateToParams(state({
      query: 'ninja', selectedSets: ['gem'], selectedPacks: [24720], selectedClasses: ['ninja'],
    }));
    expect(p.get('q')).toBe('ninja');
    expect(p.get('sets')).toBe('gem');
    expect(p.get('pack')).toBe('24720');
    expect(p.get('classes')).toBe('ninja');
  });

  it('round-trips a rich state losslessly', () => {
    const s = state({
      query: 'blood', selectedType: 'action', selectedHeroAges: ['young'],
      selectedClasses: ['runeblade'], selectedTalents: ['draconic'], selectedTalentless: true,
      selectedPitch: [1, 3], selectedKeywords: ['go again'], selectedRarities: ['L'],
      selectedFoilings: ['r'], selectedEditions: ['n'], selectedSets: ['gem'], selectedPacks: [24176, 24720],
      selectedFormat: 'cc', costMin: '0', costMax: '3', powerMin: '2', powerMax: '6',
      defenseMin: '1', defenseMax: '3', priceMin: '5', priceMax: '50',
      selectedLanguages: ['en', 'fr'], sortBy: 'price', sortOrder: 'desc',
      viewMode: 'checklist', groupByCard: false,
    });
    const round = { ...DEFAULT_OPT_STATE, ...paramsToUiState(uiStateToParams(s)) };
    expect(round).toEqual(s);
  });

  it('serializes and parses facet selections + match-all mode', () => {
    const p = uiStateToParams(state({ selectedFacets: ['tutor', 'evasive'], facetsMatchAll: true }));
    expect(p.get('facets')).toBe('tutor,evasive');
    expect(p.get('facetsAll')).toBe('1');
    const parsed = paramsToUiState(new URLSearchParams('facets=tutor,evasive&facetsAll=1'));
    expect(parsed.selectedFacets).toEqual(['tutor', 'evasive']);
    expect(parsed.facetsMatchAll).toBe(true);
  });

  it('omits facetsAll when ANY (default) and parses default as false', () => {
    expect(uiStateToParams(state({ selectedFacets: ['tutor'], facetsMatchAll: false })).has('facetsAll')).toBe(false);
    expect(paramsToUiState(new URLSearchParams('facets=tutor')).facetsMatchAll).toBeUndefined();
  });

  it('omits search mode when name (default) and serializes text mode', () => {
    expect(uiStateToParams(state({ searchMode: 'name' })).has('mode')).toBe(false);
    expect(uiStateToParams(state({ searchMode: 'text' })).get('mode')).toBe('text');
    expect(paramsToUiState(new URLSearchParams('mode=text')).searchMode).toBe('text');
    expect(paramsToUiState(new URLSearchParams('mode=bogus')).searchMode).toBeUndefined();
  });

  it('treats ["en"] languages as default (omitted) and [] as all', () => {
    expect(uiStateToParams(state({ selectedLanguages: ['en'] })).has('lang')).toBe(false);
    expect(uiStateToParams(state({ selectedLanguages: [] })).get('lang')).toBe('all');
    expect(paramsToUiState(new URLSearchParams('lang=all')).selectedLanguages).toEqual([]);
  });

  it('parses pitch 0 (a real value, not "absent")', () => {
    expect(uiStateToParams(state({ selectedPitch: [0] })).get('pitch')).toBe('0');
    expect(paramsToUiState(new URLSearchParams('pitch=0')).selectedPitch).toEqual([0]);
  });

  it('pitch is multi-select (OR): serializes as csv and parses both csv and legacy single', () => {
    expect(uiStateToParams(state({ selectedPitch: [1, 3] })).get('pitch')).toBe('1,3');
    expect(paramsToUiState(new URLSearchParams('pitch=1,3')).selectedPitch).toEqual([1, 3]);
    // Legacy single-value URLs (pre-multi-select) keep working.
    expect(paramsToUiState(new URLSearchParams('pitch=2')).selectedPitch).toEqual([2]);
    // Junk entries are dropped, valid ones kept.
    expect(paramsToUiState(new URLSearchParams('pitch=1,abc')).selectedPitch).toEqual([1]);
  });

  it('ignores junk pitch and unknown view values', () => {
    expect(paramsToUiState(new URLSearchParams('pitch=abc')).selectedPitch).toBeUndefined();
    expect(paramsToUiState(new URLSearchParams('view=spreadsheet')).viewMode).toBeUndefined();
  });

  it('returns a partial (absent keys are left undefined for the page to default)', () => {
    const parsed = paramsToUiState(new URLSearchParams('q=foo'));
    expect(parsed.query).toBe('foo');
    expect(parsed.selectedSets).toBeUndefined();
    expect(parsed.groupByCard).toBeUndefined();
  });
});

describe('arcane range params', () => {
  it('serializes arcaneMin/arcaneMax as arcMin/arcMax', () => {
    const p = uiStateToParams({ ...DEFAULT_OPT_STATE, arcaneMin: '3', arcaneMax: '5' });
    expect(p.get('arcMin')).toBe('3');
    expect(p.get('arcMax')).toBe('5');
  });

  it('hydrates arcMin/arcMax back into state', () => {
    const s = paramsToUiState(new URLSearchParams('arcMin=3&arcMax=5'));
    expect(s.arcaneMin).toBe('3');
    expect(s.arcaneMax).toBe('5');
  });
});
