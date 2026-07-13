/**
 * Unit tests for the shared filter-facet descriptor builder used by /opt and
 * /tags. Asserts descriptor keys/counts only — popover bodies are JSX
 * rendered by the consuming pages (covered by their e2e specs).
 */
import { describe, it, expect, vi } from 'vitest';
import { buildFilterFacets } from './card-filter-facets';
import { DEFAULT_OPT_STATE, type OptUiState } from '@/lib/search/opt-url-state';

const state = (over: Partial<OptUiState> = {}): OptUiState => ({ ...DEFAULT_OPT_STATE, ...over });
const build = (s: OptUiState, opts: { exclude?: string[] } = {}) =>
  buildFilterFacets({ state: s, dispatch: vi.fn(), availablePacks: [], facetDefs: [], ...opts });

describe('buildFilterFacets', () => {
  it('returns every facet key in the canonical order', () => {
    expect(build(state()).map((f) => f.key)).toEqual([
      'pitch', 'type', 'class', 'talent', 'keywords', 'facets', 'format',
      'rarity', 'stats', 'price', 'more', 'language',
    ]);
  });

  it('reflects selections in the per-facet counts', () => {
    const facets = build(state({
      selectedPitch: [1, 3],
      selectedClasses: ['ninja'],
      selectedFacets: ['tutor', 'evasive'],
      costMin: '2',
      selectedSets: ['wtr'],
    }));
    const count = (key: string) => facets.find((f) => f.key === key)!.count;
    expect(count('pitch')).toBe(2);
    expect(count('class')).toBe(1);
    expect(count('facets')).toBe(2);
    expect(count('stats')).toBe(1);
    expect(count('more')).toBe(1);
    expect(count('keywords')).toBe(0);
  });

  it('omits excluded keys (card-facets hides the facets popover — its rail owns them)', () => {
    const keys = build(state(), { exclude: ['facets', 'language'] }).map((f) => f.key);
    expect(keys).not.toContain('facets');
    expect(keys).not.toContain('language');
    expect(keys).toContain('pitch');
  });

  it('counts default language as zero (["en"] is the default)', () => {
    expect(build(state()).find((f) => f.key === 'language')!.count).toBe(0);
    expect(build(state({ selectedLanguages: ['en', 'fr'] })).find((f) => f.key === 'language')!.count).toBe(2);
  });
});
