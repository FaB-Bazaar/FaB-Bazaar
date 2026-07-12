/**
 * MCP passthrough for the arcane damage stat filters (arcane / arcaneMin /
 * arcaneMax / arcaneNot) — "what arcane spells deal 3+ damage" must reach the
 * service as a structured numeric filter, not silently no-op. Same harness as
 * searchPrintings.facets.test.ts: real tool handler, mocked service.
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
import { searchPrintingsTool, formatSearchSections, projectPrintingForMcp, describeSearchDescriptor } from './searchPrintings';
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

describe('search_printings arcane filter passthrough', () => {
  it('passes arcaneMin through ("deals 3 or more arcane damage")', async () => {
    const seen = await filtersSeenByService({ types: ['action'], arcaneMin: 3 });
    expect(seen.arcaneMin).toBe(3);
    expect(seen.types).toEqual(['action']);
  });

  it('passes arcane, arcaneMax, and arcaneNot through', async () => {
    const seen = await filtersSeenByService({ arcane: 2, arcaneMax: 4, arcaneNot: [1] });
    expect(seen.arcane).toBe(2);
    expect(seen.arcaneMax).toBe(4);
    expect(seen.arcaneNot).toEqual([1]);
  });
});

describe('search_printings arcane result surface', () => {
  const printing = {
    printing_id: 'pid_arc', card_unique_id: 'cuid_arc', collector_number: 'UPR173',
    name: 'Aether Dart', set: 'upr', edition: 'n', foiling: 's', rarity: 'c',
    pitch: 1, color: 'red', types: ['wizard', 'action'], cost: 0, defense: 3, arcane: 3,
  };

  it('renders arcane in the Stats line so the model can cite damage values', () => {
    const [text] = formatSearchSections(
      [{ index: 0, query: 'arcaneMin 3', total: 1, printings: [printing] }],
      {},
    );
    expect(text).toMatch(/arcane 3/);
  });

  it('carries arcane in the structured projection, omitting it when absent', () => {
    expect(projectPrintingForMcp(printing).arcane).toBe(3);
    expect('arcane' in projectPrintingForMcp({ ...printing, arcane: null })).toBe(false);
  });
});

describe('search_printings arcane deep-link subtitle', () => {
  it('describes arcane constraints instead of "no filters — the entire card pool"', () => {
    expect(describeSearchDescriptor({ filters: { arcaneMin: 3 } })).toBe('arcane ≥ 3');
    expect(describeSearchDescriptor({ filters: { types: ['action'], arcaneMin: 3 } }))
      .toBe('action · arcane ≥ 3');
    expect(describeSearchDescriptor({ filters: { arcane: 2 } })).toBe('arcane 2');
  });
});

describe('search_printings arcane LLM-facing surface', () => {
  it('documents arcane in the filters description so the model discovers it', () => {
    const filterProps = (searchPrintingsTool.parameters as any)
      .properties.cards.items.properties.filters;
    expect(filterProps.description).toMatch(/arcane\/Min\/Max/);
  });
});
