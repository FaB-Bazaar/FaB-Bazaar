import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the service layer BEFORE importing the module under test (vi.mock is hoisted)
vi.mock('@/lib/services', () => ({
  userService: { findByDiscordId: vi.fn() },
  binderService: { getBinderCards: vi.fn(), getUserBindersWithStats: vi.fn() },
}));
vi.mock('../utils.js', () => ({
  fetchBinderByDiscord: vi.fn(),
}));

import { handlePublicWants, handlePublicBinder } from './contextMenu.js';
import { userService, binderService } from '@/lib/services';

const mockFindByDiscordId = vi.mocked(userService.findByDiscordId);
const mockGetBindersWithStats = vi.mocked(binderService.getUserBindersWithStats);

const wantsListFixture = {
  cards: [
    {
      quantity: 2,
      name: 'silverwind shuriken',
      printingId: 'p1',
      printingDetails: {
        display_name: 'Silverwind Shuriken',
        set: 'out',
        rarity: 'm',
        foiling: 'r',
        edition: 'n',
        tcg_low: 1.69,
        tcgplayer_url: 'https://www.tcgplayer.com/product/12345',
      },
    },
  ],
};

describe('handlePublicWants — Show Wants List context menu', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://fabbazaar.app';
    mockFindByDiscordId.mockResolvedValue({
      success: true,
      data: { _id: 'user-1', username: 'mistercakes', discordId: 'discord-123' },
    } as any);
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ success: true, wantsList: wantsListFixture }),
    }) as any;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('suppresses link embeds while staying a public message', async () => {
    const body = { member: { user: { id: 'discord-123' } } };
    const response = await handlePublicWants('discord-123', body);
    const json = await response.json();

    expect(json.type).toBe(4); // CHANNEL_MESSAGE_WITH_SOURCE
    // Card lines carry raw fabbazaar + TCGPlayer URLs; without SUPPRESS_EMBEDS
    // Discord unfurls a preview card for every link under the message.
    expect(json.data.flags & 4).toBe(4); // SUPPRESS_EMBEDS
    expect(json.data.flags & 64).toBe(0); // must NOT become ephemeral — this is the public view
    expect(json.data.content).toContain('Wants List');
  });
});

describe('handlePublicBinder — Show Binder context menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByDiscordId.mockResolvedValue({
      success: true,
      data: { _id: 'user-1', username: 'mistercakes', discordId: 'discord-123' },
    } as any);
  });

  it('shows real card counts and tcg_low values from binder.stats in the dropdown', async () => {
    // BinderWithStatsDTO has NO `cards` array — aggregates live under `stats`
    // (the old code read binder.cards, a MongoDB-era shape, and rendered $0.00).
    const binderWithStats = (name: string, slug: string, totalQuantity: number, tcgLow: number) => ({
      _id: `id-${slug}`,
      name,
      slug,
      isPublic: true,
      visibility: { allowDiscordCommands: true },
      stats: {
        totalQuantity,
        totalValue: { tcg_low: tcgLow, tcg_market: 999999, tcg_mid: 0, tcg_high: 0 },
      },
    });
    mockGetBindersWithStats.mockResolvedValue({
      success: true,
      data: [
        binderWithStats('Main Binder', 'main', 42, 123.45),
        binderWithStats('Trade Binder', 'trades', 7, 55.2),
      ],
    } as any);

    const body = { member: { user: { id: 'discord-123' } } };
    const response = await handlePublicBinder('discord-123', body);
    const json = await response.json();

    const options = json.data.components[0].components[0].options;
    expect(options).toHaveLength(2);
    expect(options[0].label).toBe('Main Binder (42 cards)');
    expect(options[0].description).toBe('💰 $123'); // tcg_low, matching /binder — never tcg_market
    expect(options[1].label).toBe('Trade Binder (7 cards)');
    expect(options[1].description).toBe('💰 $55');
  });
});
