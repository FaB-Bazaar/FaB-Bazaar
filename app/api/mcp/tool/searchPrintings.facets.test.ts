/**
 * MCP filter-passthrough tests: fields the printings service implements must
 * survive convertMCPFilters, or the model composes filters that silently
 * no-op. Exercised through the tool handler (the real path) with the service
 * mocked, asserting on the filters it receives.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  printingsService: {
    searchPrintings: vi.fn(),
    bulkResolveByName: vi.fn(),
    getCardIdsByTranslatedName: vi.fn(),
    getCardTranslations: vi.fn(),
  },
}));

// Import AFTER mocks (vi.mock is hoisted)
import { searchPrintingsTool } from './searchPrintings';
import { printingsService } from '@/lib/services';

const mockSearch = vi.mocked(printingsService.searchPrintings);
const mockTranslatedName = vi.mocked(printingsService.getCardIdsByTranslatedName);

const EMPTY_RESULT = {
  success: true as const,
  data: { printings: [], total: 0, page: 1, pages: 0 },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSearch.mockResolvedValue(EMPTY_RESULT as any);
  mockTranslatedName.mockResolvedValue({ success: true, data: [] } as any);
});

async function filtersSeenByService(filters: Record<string, unknown>) {
  const result = await searchPrintingsTool.handler({ cards: [{ filters }] });
  expect(result.success).toBe(true);
  expect(mockSearch).toHaveBeenCalled();
  return mockSearch.mock.calls[0][0];
}

describe('search_printings filter passthrough', () => {
  it('passes facetTags through to the service (curated facet search)', async () => {
    const seen = await filtersSeenByService({ facetTags: ['beats-fatigue', 'combo-enabler'] });
    expect(seen.facetTags).toEqual(['beats-fatigue', 'combo-enabler']);
  });

  it('passes heroAges through (young/adult hero filtering)', async () => {
    const seen = await filtersSeenByService({ isHero: true, heroAges: ['young'] });
    expect(seen.heroAges).toEqual(['young']);
    expect(seen.isHero).toBe(true);
  });

  it('passes talentless and classTalentUnion through (deck-pool primitives)', async () => {
    const seen = await filtersSeenByService({
      classes: ['ninja'],
      talentless: true,
      classTalentUnion: true,
    });
    expect(seen.talentless).toBe(true);
    expect(seen.classTalentUnion).toBe(true);
  });

  it('passes hasPricing through (listed-on-TCGplayer filter)', async () => {
    const seen = await filtersSeenByService({ types: ['equipment'], hasPricing: true });
    expect(seen.hasPricing).toBe(true);
  });
});

describe('search_printings LLM-facing schema', () => {
  const filterProps = (searchPrintingsTool.parameters as any)
    .properties.cards.items.properties.filters.properties;

  it('declares facetTags as a real schema property (not just additionalProperties)', () => {
    expect(filterProps.facetTags).toBeDefined();
    expect(filterProps.facetTags.type).toBe('array');
  });

  it('documents cross-field OR via multiple descriptors in the tool description', () => {
    expect(searchPrintingsTool.description).toMatch(/one descriptor per/i);
  });
});

describe('search_printings includeFacets projection (card→tags visibility)', () => {
  const P = {
    printing_id: 'p1', card_unique_id: 'c1', collector_number: 'EVO001', name: 'Test Card',
    set: 'evo', edition: 'n', foiling: 's', rarity: 'm', pitch: 1, color: 'red',
    types: ['mechanologist'], facet_tags: ['boost', 'tekloboost-staple'], tcg_low: 1,
  };
  const ONE_RESULT = { success: true as const, data: { printings: [P], total: 1, page: 1, pages: 1 } };

  it('carries facet_tags per printing when options.includeFacets is true', async () => {
    mockSearch.mockResolvedValue(ONE_RESULT as any);
    const result = await searchPrintingsTool.handler({
      cards: [{ filters: { facetTags: ['boost'] } }],
      options: { includeFacets: true },
    });
    expect(result.success).toBe(true);
    expect((result as any).results[0].printings[0].facet_tags).toEqual(['boost', 'tekloboost-staple']);
  });

  it('omits facet_tags by default (token thrift)', async () => {
    mockSearch.mockResolvedValue(ONE_RESULT as any);
    const result = await searchPrintingsTool.handler({ cards: [{ filters: { facetTags: ['boost'] } }] });
    expect(result.success).toBe(true);
    expect((result as any).results[0].printings[0].facet_tags).toBeUndefined();
  });

  it('declares includeFacets in the LLM-facing options schema', () => {
    const optionProps = (searchPrintingsTool.parameters as any).properties.options.properties;
    expect(optionProps.includeFacets).toBeDefined();
    expect(optionProps.includeFacets.type).toBe('boolean');
  });
});
