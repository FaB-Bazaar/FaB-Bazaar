/**
 * MCP passthrough for the health stat filters (health / healthMin / healthMax
 * / healthNot) — "what allies have 4+ health" must reach the service as a
 * structured numeric filter, not silently no-op — plus the result surface:
 * ally/hero life totals must be visible in both the TEXT output and the
 * structured projection. Same harness as searchPrintings.arcane.test.ts:
 * real tool handler, mocked service.
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

describe('search_printings health filter passthrough', () => {
  it('passes healthMin through ("allies with 4 or more health")', async () => {
    const seen = await filtersSeenByService({ types: ['ally'], healthMin: 4 });
    expect(seen.healthMin).toBe(4);
    expect(seen.types).toEqual(['ally']);
  });

  it('passes health, healthMax, and healthNot through', async () => {
    const seen = await filtersSeenByService({ health: 20, healthMax: 40, healthNot: [1] });
    expect(seen.health).toBe(20);
    expect(seen.healthMax).toBe(40);
    expect(seen.healthNot).toEqual([1]);
  });
});

describe('search_printings health result surface', () => {
  const printing = {
    printing_id: 'pid_rig', card_unique_id: 'cuid_rig', collector_number: 'SEA077',
    name: 'Riggermortis', set: 'sea', edition: 'n', foiling: 's', rarity: 'c',
    pitch: 2, color: 'yellow', types: ['pirate', 'necromancer', 'action', 'ally'],
    cost: 2, health: 3,
  };

  it('renders health in the Stats line so the model can cite life totals', () => {
    const [text] = formatSearchSections(
      [{ index: 0, query: 'healthMin 3', total: 1, printings: [printing] }],
      {},
    );
    expect(text).toMatch(/health 3/);
  });

  it('carries health in the structured projection, omitting it when absent', () => {
    expect(projectPrintingForMcp(printing).health).toBe(3);
    expect('health' in projectPrintingForMcp({ ...printing, health: null })).toBe(false);
  });
});

describe('search_printings health deep-link subtitle', () => {
  it('describes health constraints instead of "no filters — the entire card pool"', () => {
    expect(describeSearchDescriptor({ filters: { healthMin: 4 } })).toBe('health ≥ 4');
    expect(describeSearchDescriptor({ filters: { types: ['ally'], healthMin: 4 } }))
      .toBe('ally · health ≥ 4');
    expect(describeSearchDescriptor({ filters: { health: 20 } })).toBe('health 20');
  });
});

describe('search_printings health LLM-facing surface', () => {
  it('documents health in the filters description so the model discovers it', () => {
    const filterProps = (searchPrintingsTool.parameters as any)
      .properties.cards.items.properties.filters;
    expect(filterProps.description).toMatch(/health\/Min\/Max/);
  });
});
