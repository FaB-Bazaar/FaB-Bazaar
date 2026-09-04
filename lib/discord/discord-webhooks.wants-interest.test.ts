/**
 * Unit tests for DiscordWebhooks.sendWantsInterest
 *
 * The wants-list twin of sendTradeInterest: the viewer is offering cards
 * from the owner's wants list. Same channel webhook, reversed framing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiscordWebhooks, type WantsInterestData } from './discord-webhooks';

const WEBHOOK_URL = 'https://discord.com/api/webhooks/123/test-token';

const mockFetch = vi.fn();

const baseData = (): WantsInterestData => ({
  requesterUsername: 'dc_alice',
  requesterDiscordId: '111111111111111111',
  ownerUsername: 'dc_bob',
  ownerDiscordId: '222222222222222222',
  wantsUrl: 'https://fabbazaar.app/wants/owner-1',
  cards: [
    { name: 'Command and Conquer', quantity: 1, value: 25.5 },
    { name: 'Enlightened Strike', quantity: 3, value: 10 },
  ],
});

const sentPayload = () => JSON.parse(mockFetch.mock.calls[0][1].body);

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  vi.stubEnv('DISCORD_WEBHOOK_TRADE_INTEREST', WEBHOOK_URL);
  mockFetch.mockResolvedValue(new Response(null, { status: 204 }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('sendWantsInterest', () => {
  it('returns false and does not fetch when the webhook env var is missing', async () => {
    vi.stubEnv('DISCORD_WEBHOOK_TRADE_INTEREST', '');

    expect(await DiscordWebhooks.sendWantsInterest(baseData())).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('mentions both users and scopes allowed_mentions to exactly them', async () => {
    const ok = await DiscordWebhooks.sendWantsInterest(baseData());

    expect(ok).toBe(true);
    const payload = sentPayload();
    expect(payload.content).toContain('<@111111111111111111>');
    expect(payload.content).toContain('<@222222222222222222>');
    expect(payload.content).toMatch(/wants list/i);
    expect(payload.allowed_mentions).toEqual({
      users: ['111111111111111111', '222222222222222222'],
    });
  });

  it('falls back to display usernames when discordIds are missing', async () => {
    const ok = await DiscordWebhooks.sendWantsInterest({
      ...baseData(),
      requesterDiscordId: undefined,
      ownerDiscordId: undefined,
    });

    expect(ok).toBe(true);
    const payload = sentPayload();
    expect(payload.content).not.toContain('<@');
    expect(payload.content).toContain('alice');
    expect(payload.content).toContain('bob');
    expect(payload.allowed_mentions).toEqual({ users: [] });
  });

  it('links to the wants list and lists the selected cards in the embed', async () => {
    await DiscordWebhooks.sendWantsInterest(baseData());

    const flat = JSON.stringify(sentPayload().embeds[0]);
    expect(flat).toContain('https://fabbazaar.app/wants/owner-1');
    expect(flat).toContain('Command and Conquer');
    expect(flat).toContain('Enlightened Strike');
  });

  it('caps the embed card list at 5 lines', async () => {
    await DiscordWebhooks.sendWantsInterest({
      ...baseData(),
      cards: Array.from({ length: 8 }, (_, i) => ({
        name: `Card ${i + 1}`,
        quantity: 1,
        value: 1,
      })),
    });

    const flat = JSON.stringify(sentPayload().embeds[0]);
    expect(flat).toContain('Card 5');
    expect(flat).not.toContain('Card 6');
  });

  it('returns false instead of throwing when fetch rejects', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    expect(await DiscordWebhooks.sendWantsInterest(baseData())).toBe(false);
  });

  it('names where the match was spotted when a source is given, and stays silent otherwise', async () => {
    await DiscordWebhooks.sendWantsInterest({
      ...baseData(),
      source: {
        label: 'Card Kingdom',
        url: 'https://fabbazaar.app/stores/store-1',
        detail: 'Next event: Armory (Sep 12, 2026)',
      },
    });
    const spotted = sentPayload().embeds[0].fields.find((f: { name: string }) => /spotted/i.test(f.name));
    expect(spotted).toBeDefined();
    expect(spotted.value).toContain('[Card Kingdom](https://fabbazaar.app/stores/store-1)');
    expect(spotted.value).toContain('Next event: Armory (Sep 12, 2026)');

    mockFetch.mockClear();
    await DiscordWebhooks.sendWantsInterest(baseData());
    const fields = sentPayload().embeds[0].fields;
    expect(fields.some((f: { name: string }) => /spotted/i.test(f.name))).toBe(false);
  });
});
