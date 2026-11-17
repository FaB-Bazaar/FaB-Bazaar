/**
 * /trade @user — 1:1 trade view via inventoryService.getUserTradeMatches
 * (replaces the deprecated TradeAnalyzer). Default = exact printing; the
 * any_printing option = loose (any printing of a wanted card).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  userService: { findByDiscordId: vi.fn() },
  inventoryService: { getUserTradeMatches: vi.fn(), getStoreTradeMatches: vi.fn() },
  locationService: { getLocationById: vi.fn(), browseLocations: vi.fn() },
}));

import { handleTradeAnalysis } from './trade-analysis.js';
import { userService, inventoryService } from '@/lib/services';

const mockFind = vi.mocked(userService.findByDiscordId);
const mockMatches = vi.mocked(inventoryService.getUserTradeMatches);

const body = { member: { user: { id: 'd-me' } } };
const userOpt = { name: 'user', value: 'd-them' };

const card = (displayName: string, quantity: number, extra: Record<string, unknown> = {}) => ({
  inventoryItemId: `i-${displayName}`, binderId: 'b1', binderName: 'Trades', binderViewable: true,
  printingId: `p-${displayName}`, cardUniqueId: `c-${displayName}`, displayName,
  set: 'wtr', collectorNumber: 'WTR001', foiling: 'S', quantity, tcgLow: 1, imageUrl: null, ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockFind.mockImplementation(async (id: string) => ({
    success: true,
    data: id === 'd-me'
      ? { _id: 'u-me', username: 'me', discordId: 'd-me' }
      : { _id: 'u-them', username: 'dc_them', discordId: 'd-them' },
  }) as any);
  mockMatches.mockResolvedValue({ success: true, data: { theyHaveYouWant: [], theyWantYouHave: [] } });
});

async function content(options: any[]) {
  const json = await (await handleTradeAnalysis(body, options)).json();
  return json.data.content as string;
}

describe('/trade @user', () => {
  it('matches exact printings by default', async () => {
    await content([userOpt]);
    expect(mockMatches).toHaveBeenCalledWith('u-me', 'u-them', 'exact');
  });

  it('matches any printing when any_printing is set', async () => {
    await content([userOpt, { name: 'any_printing', value: true }]);
    expect(mockMatches).toHaveBeenCalledWith('u-me', 'u-them', 'loose');
  });

  it('lists both directions with quantities, set and foiling', async () => {
    mockMatches.mockResolvedValue({
      success: true,
      data: {
        theyHaveYouWant: [card('Enlightened Strike', 2, { foiling: 'R', collectorNumber: 'WTR159' })],
        theyWantYouHave: [card('Snatch', 1)],
      },
    });
    const text = await content([userOpt]);
    expect(text).toMatch(/They have for you[\s\S]*2x Enlightened Strike \(WTR159, Rainbow Foil\)/);
    expect(text).toMatch(/You have for them[\s\S]*1x Snatch \(WTR001\)/);
  });

  it('links to the web trade page with the stripped display name and the match mode', async () => {
    const text = await content([userOpt, { name: 'any_printing', value: true }]);
    expect(text).toContain('Trade with them');
    expect(text).toContain('/profile/dc_them/trade?match=loose');
  });

  it('suggests any_printing when an exact search finds nothing', async () => {
    const text = await content([userOpt]);
    expect(text).toMatch(/No trade matches/);
    expect(text).toMatch(/any_printing/);
  });

  it('refuses to trade with yourself', async () => {
    const text = await content([{ name: 'user', value: 'd-me' }]);
    expect(text).toMatch(/yourself/);
    expect(mockMatches).not.toHaveBeenCalled();
  });
});
