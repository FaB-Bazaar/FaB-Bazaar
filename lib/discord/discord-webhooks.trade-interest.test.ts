/**
 * Unit tests for DiscordWebhooks.sendTradeInterest
 *
 * Stubs global fetch + env — asserts the Discord payload shape:
 * both users mentioned in content, allowed_mentions scoped to exactly
 * those users, username fallback when a discordId is missing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiscordWebhooks, type TradeInterestData } from './discord-webhooks';

const WEBHOOK_URL = 'https://discord.com/api/webhooks/123/test-token';

const mockFetch = vi.fn();

const baseData = (): TradeInterestData => ({
  requesterUsername: 'dc_alice',
  requesterDiscordId: '111111111111111111',
  ownerUsername: 'dc_bob',
  ownerDiscordId: '222222222222222222',
  binderName: 'Trade Binder',
  binderUrl: 'https://fabbazaar.app/binder/binder-1',
  cards: [
    { name: 'Command and Conquer', quantity: 1, value: 25.5 },
    { name: 'Enlightened Strike', quantity: 3, value: 10 },
  ],
  totalValue: 55.5,
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

describe('sendTradeInterest', () => {
  it('returns false and does not fetch when the webhook env var is missing', async () => {
    vi.stubEnv('DISCORD_WEBHOOK_TRADE_INTEREST', '');

    const ok = await DiscordWebhooks.sendTradeInterest(baseData());

    expect(ok).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('mentions both users in content and scopes allowed_mentions to exactly them', async () => {
    const ok = await DiscordWebhooks.sendTradeInterest(baseData());

    expect(ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(WEBHOOK_URL, expect.anything());

    const payload = sentPayload();
    expect(payload.content).toContain('<@111111111111111111>');
    expect(payload.content).toContain('<@222222222222222222>');
    expect(payload.allowed_mentions).toEqual({
      users: ['111111111111111111', '222222222222222222'],
    });
  });

  it('falls back to display usernames (dc_ prefix stripped) when discordIds are missing', async () => {
    const data = {
      ...baseData(),
      requesterDiscordId: undefined,
      ownerDiscordId: undefined,
    };

    const ok = await DiscordWebhooks.sendTradeInterest(data);

    expect(ok).toBe(true);
    const payload = sentPayload();
    expect(payload.content).not.toContain('<@');
    expect(payload.content).toContain('alice');
    expect(payload.content).toContain('bob');
    expect(payload.allowed_mentions).toEqual({ users: [] });
  });

  it('includes a binder link and the selected cards in the embed', async () => {
    await DiscordWebhooks.sendTradeInterest(baseData());

    const embed = sentPayload().embeds[0];
    const flat = JSON.stringify(embed);
    expect(flat).toContain('https://fabbazaar.app/binder/binder-1');
    expect(flat).toContain('Command and Conquer');
    expect(flat).toContain('Enlightened Strike');
  });

  it('caps the embed card list at 5 lines', async () => {
    const data = {
      ...baseData(),
      cards: Array.from({ length: 8 }, (_, i) => ({
        name: `Card ${i + 1}`,
        quantity: 1,
        value: 1,
      })),
    };

    await DiscordWebhooks.sendTradeInterest(data);

    const flat = JSON.stringify(sentPayload().embeds[0]);
    expect(flat).toContain('Card 5');
    expect(flat).not.toContain('Card 6');
  });

  it('returns false when Discord responds non-ok', async () => {
    mockFetch.mockResolvedValue(
      new Response('rate limited', { status: 429, statusText: 'Too Many Requests' })
    );

    expect(await DiscordWebhooks.sendTradeInterest(baseData())).toBe(false);
  });

  it('returns false instead of throwing when fetch rejects', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    expect(await DiscordWebhooks.sendTradeInterest(baseData())).toBe(false);
  });
});
