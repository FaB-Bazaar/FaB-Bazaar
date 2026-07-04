import { describe, it, expect } from 'vitest';
import { DEFAULT_OPT_STATE, type OptUiState } from './opt-url-state';
import { optSearchReducer } from './opt-search-reducer';
import { optStateToChips, describeOptState } from './opt-state-describe';

const state = (partial: Partial<OptUiState>): OptUiState => ({ ...DEFAULT_OPT_STATE, ...partial });

describe('optStateToChips', () => {
  it('returns no chips for the default state', () => {
    expect(optStateToChips(DEFAULT_OPT_STATE)).toEqual([]);
  });

  it('labels every facet family, resolving display names from chip constants', () => {
    const s = state({
      selectedPitch: 1,
      selectedType: 'attack',
      selectedClasses: ['Ninja'],
      selectedKeywords: ['go again'],
      selectedRarities: ['m'],
      selectedFoilings: ['c'],
      selectedEditions: ['f'],
      selectedFormat: 'cc',
      selectedSets: ['wtr'],
    });
    const labels = optStateToChips(s).map(c => c.label);
    expect(labels).toEqual([
      'Pitch: Red',
      'Attack',
      'Ninja',
      'Go Again',
      'Majestic',
      'Cold Foil',
      '1st Edition',
      'Format: Classic Constructed',
      'Welcome to Rathe',
    ]);
  });

  it('labels hero ages, talentless, ranges, price, and non-default language', () => {
    const s = state({
      selectedHeroAges: ['young'],
      selectedTalentless: true,
      costMin: '2', costMax: '4',
      powerMin: '6',
      defenseMax: '3',
      priceMin: '5',
      selectedLanguages: [],
    });
    const labels = optStateToChips(s).map(c => c.label);
    expect(labels).toEqual([
      'Young Hero',
      'Talentless',
      'Cost 2–4',
      'Power ≥ 6',
      'Defense ≤ 3',
      '≥ $5',
      'All languages',
    ]);
  });

  it('labels packs from meta.availablePacks with a "Pack <id>" fallback', () => {
    const s = state({ selectedPacks: [42, 77] });
    const labels = optStateToChips(s, { availablePacks: [{ groupId: 42, name: 'GEM Pack 1' }] }).map(c => c.label);
    expect(labels).toEqual(['GEM Pack 1', 'Pack 77']);
  });

  it('every chip removeAction actually clears its chip through the reducer', () => {
    const s = state({
      selectedPitch: 1,
      selectedType: 'attack',
      selectedClasses: ['Ninja', 'Brute'],
      selectedTalents: ['Shadow'],
      selectedKeywords: ['ward'],
      selectedRarities: ['m'],
      selectedFoilings: ['c'],
      selectedEditions: ['f'],
      selectedFormat: 'cc',
      selectedSets: ['wtr'],
      selectedPacks: [42],
      costMin: '2',
      priceMax: '25',
      selectedLanguages: ['fr'],
    });
    for (const chip of optStateToChips(s)) {
      const next = optSearchReducer(s, chip.removeAction);
      const remaining = optStateToChips(next).map(c => c.key);
      expect(remaining, `removing chip ${chip.key}`).not.toContain(chip.key);
    }
  });
});

describe('describeOptState', () => {
  it('describes an empty state', () => {
    expect(describeOptState(DEFAULT_OPT_STATE)).toBe(
      "The user's current /opt card search: no filters set.",
    );
  });

  it('describes query, mode, and chip labels', () => {
    const s = state({ query: 'snatch', selectedClasses: ['Ninja'], priceMin: '5' });
    expect(describeOptState(s)).toBe(
      'The user\'s current /opt card search: query "snatch" (name search); filters: Ninja, ≥ $5.',
    );
  });

  it('marks rule-text searches', () => {
    const s = state({ query: 'dominate', searchMode: 'text' });
    expect(describeOptState(s)).toBe(
      'The user\'s current /opt card search: query "dominate" (rule-text search).',
    );
  });

  it('includes result total and canonical link from meta', () => {
    const s = state({ selectedSets: ['wtr'] });
    expect(describeOptState(s, { total: 342, optUrl: '/opt?sets=wtr' })).toBe(
      "The user's current /opt card search (342 results): filters: Welcome to Rathe. Link: /opt?sets=wtr",
    );
  });
});
