import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the service layer BEFORE importing the module under test (vi.mock is hoisted)
vi.mock('@/lib/services', () => ({
  userService: { findByDiscordId: vi.fn() },
  binderService: { getBinderCards: vi.fn() },
}));
vi.mock('../utils.js', () => ({
  fetchBinderByDiscord: vi.fn(),
}));

import { handlePublicWants } from './contextMenu.js';
import { userService } from '@/lib/services';

const mockFindByDiscordId = vi.mocked(userService.findByDiscordId);

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
