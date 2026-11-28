/**
 * Retired card flags (is_assassin, is_token, …): the app no longer filters on
 * them, ahead of dropping the columns. search_printings drops them, tells the
 * model what to use instead, and logs a greppable line so usage can be
 * checked before the DB columns go. Same harness as searchPrintings.frontFace.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  printingsService: {
    searchPrintings: vi.fn(),
    bulkResolveByName: vi.fn(),
    getCardIdsByTranslatedName: vi.fn(),
    getCardTranslations: vi.fn(),
  },
}));

import { searchPrintingsTool } from './searchPrintings';
import { printingsService } from '@/lib/services';
import { RETIRED_CARD_FLAGS } from '@/lib/search/retired-card-flags';

const mockSearch = vi.mocked(printingsService.searchPrintings);
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockSearch.mockResolvedValue({ success: true, data: { printings: [], total: 0, page: 1, pages: 0 } } as any);
  vi.mocked(printingsService.getCardIdsByTranslatedName).mockResolvedValue({ success: true, data: [] } as any);
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { warn.mockRestore(); });

describe('search_printings — retired card flags', () => {
  it('lists exactly the ten retired columns', () => {
    expect([...RETIRED_CARD_FLAGS].sort()).toEqual([
      'isAdjudicator', 'isAssassin', 'isBard', 'isIllusionist', 'isMentor',
      'isMerchant', 'isShapeshifter', 'isThief', 'isToken', 'playedHorizontally',
    ]);
  });

  it('does not pass a retired flag to the service', async () => {
    await searchPrintingsTool.handler({ cards: [{ filters: { isThief: true, types: ['action'] } }] });
    expect(mockSearch.mock.calls[0][0]).not.toHaveProperty('isThief');
    expect(mockSearch.mock.calls[0][0]).toMatchObject({ types: ['action'] });
  });

  it('tells the model the flag was ignored and what to use', async () => {
    const result = await searchPrintingsTool.handler({ cards: [{ filters: { isToken: true } }] });
    expect(result.message).toContain('isToken');
    expect(result.message).toMatch(/types: \["token"\]/);
  });

  it('logs a greppable usage line', async () => {
    await searchPrintingsTool.handler({ cards: [{ filters: { isAssassin: true, isMentor: false } }] });
    expect(warn).toHaveBeenCalledWith('[retired-card-flag]', expect.objectContaining({
      tool: 'search_printings',
      flags: ['isAssassin', 'isMentor'],
    }));
  });

  it('stays silent when no retired flag is sent', async () => {
    const result = await searchPrintingsTool.handler({ cards: [{ filters: { isAttack: true } }] });
    expect(warn).not.toHaveBeenCalledWith('[retired-card-flag]', expect.anything());
    expect(result.message).not.toContain('Retired');
  });
});
