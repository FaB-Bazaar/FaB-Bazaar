/**
 * Route unit tests for GET /api/binders/[binderId]/cards — hideValue privacy.
 *
 * When a binder has hideValue set, value stats (totalValue / valueForTrade /
 * valueNotForTrade) must be stripped from metadata.stats SERVER-SIDE for
 * non-owner viewers, so the totals never reach the network payload.
 * The owner always receives full stats.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  binderService: {
    getBinder: vi.fn(),
    getBinderCards: vi.fn(),
    addCardsToBinder: vi.fn(),
  },
  printingsService: {
    getPrintingsByIds: vi.fn(),
  },
  deckService: {
    getCardDeckUsageSummary: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

vi.mock('@/lib/discord/discord-webhooks', () => ({
  DiscordWebhooks: { sendBinderUpdate: vi.fn() },
}));

// Import AFTER mocks (vi.mock is hoisted)
import { GET } from '../route';
import { binderService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockGetBinder = vi.mocked(binderService.getBinder);
const mockGetBinderCards = vi.mocked(binderService.getBinderCards);
const mockAuthenticateRequest = vi.mocked(authenticateRequest);

const BINDER_ID = 'binder-hide-value';
const OWNER_ID = 'owner-1';

const hiddenValueBinder = {
  _id: BINDER_ID,
  name: 'Pricey Binder',
  userId: OWNER_ID,
  visibility: { level: 'public' },
  hideValue: true,
} as any;

const cardsResult = () => ({
  success: true as const,
  data: {
    cards: [{ _id: '1', name: 'Card A', quantity: 2 }],
    pagination: { page: 1, limit: 48, total: 1, totalPages: 1, totalQuantity: 2 },
    metadata: {
      uniqueValues: { rarities: [], foilings: [], sets: [], conditions: [] },
      counts: { forTrade: 1, notForTrade: 0 },
      stats: {
        totalCards: 2,
        forTradeCount: 1,
        totalValue: { tcg_low: 1234.56, tcg_market: 2000, tcg_mid: 1500, tcg_high: 3000 },
        valueForTrade: { tcg_low: 1000 },
        valueNotForTrade: { tcg_low: 234.56 },
        rarityCounts: { L: 2 },
      },
      priceUpdatedAt: null,
    },
  } as any,
});

const getCards = async () => {
  const request = new NextRequest(`http://localhost/api/binders/${BINDER_ID}/cards`);
  const response = await GET(request, { params: Promise.resolve({ binderId: BINDER_ID }) });
  return { response, data: await response.json() };
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBinder.mockResolvedValue({ success: true, data: hiddenValueBinder });
  mockGetBinderCards.mockResolvedValue(cardsResult());
});

describe('GET /api/binders/[binderId]/cards — hideValue', () => {
  it('strips value stats for anonymous viewers when hideValue is set', async () => {
    mockAuthenticateRequest.mockResolvedValue({ success: false } as any);

    const { response, data } = await getCards();

    expect(response.status).toBe(200);
    expect(data.metadata.stats.totalValue).toBeUndefined();
    expect(data.metadata.stats.valueForTrade).toBeUndefined();
    expect(data.metadata.stats.valueNotForTrade).toBeUndefined();
    // Non-value stats survive
    expect(data.metadata.stats.totalCards).toBe(2);
    expect(data.metadata.stats.forTradeCount).toBe(1);
    expect(data.metadata.stats.rarityCounts).toEqual({ L: 2 });
  });

  it('strips value stats for signed-in non-owners when hideValue is set', async () => {
    mockAuthenticateRequest.mockResolvedValue({ success: true, userId: 'visitor-9' } as any);

    const { data } = await getCards();

    expect(data.metadata.stats.totalValue).toBeUndefined();
    expect(data.metadata.stats.valueForTrade).toBeUndefined();
    expect(data.metadata.stats.valueNotForTrade).toBeUndefined();
  });

  it('keeps full value stats for the owner even when hideValue is set', async () => {
    mockAuthenticateRequest.mockResolvedValue({ success: true, userId: OWNER_ID } as any);

    const { data } = await getCards();

    expect(data.metadata.stats.totalValue).toEqual({
      tcg_low: 1234.56, tcg_market: 2000, tcg_mid: 1500, tcg_high: 3000,
    });
    expect(data.metadata.stats.valueForTrade).toEqual({ tcg_low: 1000 });
  });

  it('keeps value stats for non-owners when hideValue is NOT set', async () => {
    mockAuthenticateRequest.mockResolvedValue({ success: false } as any);
    mockGetBinder.mockResolvedValue({
      success: true,
      data: { ...hiddenValueBinder, hideValue: false },
    });

    const { data } = await getCards();

    expect(data.metadata.stats.totalValue.tcg_low).toBe(1234.56);
  });
});
