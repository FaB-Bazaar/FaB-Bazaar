/**
 * Route unit tests for GET /api/binders/[binderId]/cards
 *
 * Service layer is mocked — these tests prove auth handling, filter/option
 * parsing, visibility rules, and HTTP response shape.
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
import { binderService, deckService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockGetBinder = vi.mocked(binderService.getBinder);
const mockGetBinderCards = vi.mocked(binderService.getBinderCards);
const mockGetCardDeckUsageSummary = vi.mocked(deckService.getCardDeckUsageSummary);
const mockAuthenticateRequest = vi.mocked(authenticateRequest);

const BINDER_ID = '68acbd2c27d38b1af2694536';
const createMockRequest = (url: string) => new NextRequest(`http://localhost${url}`);
const getCards = async (query = '') => {
  const request = createMockRequest(`/api/binders/${BINDER_ID}/cards${query}`);
  const response = await GET(request, { params: Promise.resolve({ binderId: BINDER_ID }) });
  return { response, data: await response.json() };
};

const publicBinder = {
  _id: BINDER_ID,
  name: 'Test Binder',
  userId: 'user123',
  visibility: { level: 'public' },
} as any;

const cardsResult = (overrides: Partial<{ cards: any[]; pagination: any }> = {}) => ({
  success: true as const,
  data: {
    cards: overrides.cards ?? [
      { _id: '1', name: 'Card A', quantity: 2 },
      { _id: '2', name: 'Card B', quantity: 3 },
    ],
    pagination: overrides.pagination ?? { page: 1, limit: 2, total: 3, totalPages: 2, totalQuantity: 10 },
    metadata: {
      uniqueValues: { rarities: [], foilings: [], sets: [], conditions: [] },
      counts: { forTrade: 2, notForTrade: 1 },
    },
  } as any,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthenticateRequest.mockResolvedValue({ success: false } as any);
  mockGetBinder.mockResolvedValue({ success: true, data: publicBinder });
});

describe('GET /api/binders/[binderId]/cards', () => {
  it('reports totalCards from the service-wide totalQuantity, not the current page sum', async () => {
    mockGetBinderCards.mockResolvedValueOnce(cardsResult());

    const { response, data } = await getCards('?page=1&limit=2');

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.cards).toHaveLength(2);
    // Page quantities sum to 5; the whole filtered set is 10 — the tab count must be 10
    expect(data.pagination.totalCards).toBe(10);
    expect(data.pagination.total).toBe(3);
  });

  it('adds id field to each card for backwards compatibility', async () => {
    mockGetBinderCards.mockResolvedValueOnce(cardsResult());

    const { data } = await getCards();

    expect(data.cards[0].id).toBe('1');
    expect(data.cards[1].id).toBe('2');
  });

  it('passes filters through to binderService.getBinderCards', async () => {
    mockGetBinderCards.mockResolvedValueOnce(cardsResult());

    await getCards('?foiling=r&set=wtr&search=beast&forTrade=true&class=warrior&talent=ice&startsWith=B');

    expect(mockGetBinderCards).toHaveBeenCalledWith(
      BINDER_ID,
      expect.objectContaining({
        foiling: 'r',
        set: 'wtr',
        search: 'beast',
        forTrade: true,
        class: 'warrior',
        talent: 'ice',
        startsWith: 'B',
      }),
      expect.any(Object)
    );
  });

  it('passes pagination and sort options through to binderService.getBinderCards', async () => {
    mockGetBinderCards.mockResolvedValueOnce(cardsResult());

    await getCards('?page=3&limit=200&sortBy=tcg-low-desc');

    expect(mockGetBinderCards).toHaveBeenCalledWith(
      BINDER_ID,
      expect.any(Object),
      expect.objectContaining({ page: 3, limit: 200, sortBy: 'tcg-low-desc' })
    );
  });

  it('handles empty results gracefully', async () => {
    mockGetBinderCards.mockResolvedValueOnce(
      cardsResult({ cards: [], pagination: { page: 1, limit: 48, total: 0, totalPages: 0, totalQuantity: 0 } })
    );

    const { response, data } = await getCards('?search=nonexistent');

    expect(response.status).toBe(200);
    expect(data.cards).toEqual([]);
    expect(data.pagination.totalCards).toBe(0);
  });

  it('returns 404 when the binder does not exist', async () => {
    mockGetBinder.mockResolvedValueOnce({ success: true, data: null as any });

    const { response, data } = await getCards();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Binder not found');
  });

  it('denies access to private binders for unauthenticated requests', async () => {
    mockGetBinder.mockResolvedValueOnce({
      success: true,
      data: { ...publicBinder, visibility: { level: 'private' }, isPublic: false },
    });

    const { response, data } = await getCards();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Access denied: This binder is private');
    expect(mockGetBinderCards).not.toHaveBeenCalled();
  });

  it('allows the owner to view a private binder', async () => {
    mockAuthenticateRequest.mockResolvedValueOnce({ success: true, userId: 'user123' } as any);
    mockGetBinder.mockResolvedValueOnce({
      success: true,
      data: { ...publicBinder, visibility: { level: 'private' }, isPublic: false },
    });
    mockGetBinderCards.mockResolvedValueOnce(cardsResult());

    const { response, data } = await getCards();

    expect(response.status).toBe(200);
    expect(data.binder.isOwner).toBe(true);
  });

  it('allows unauthenticated access to unlisted binders', async () => {
    mockGetBinder.mockResolvedValueOnce({
      success: true,
      data: { ...publicBinder, visibility: { level: 'unlisted' }, isPublic: false },
    });
    mockGetBinderCards.mockResolvedValueOnce(cardsResult());

    const { response } = await getCards();

    expect(response.status).toBe(200);
  });
});

describe('GET /api/binders/[binderId]/cards — deck-usage enrichment', () => {
  const cardsWithUniqueIds = [
    { _id: '1', name: 'Card A', quantity: 2, card_unique_id: 'cu-a' },
    { _id: '2', name: 'Card B', quantity: 3, card_unique_id: 'cu-b' },
    { _id: '3', name: 'Card A foil', quantity: 1, card_unique_id: 'cu-a' },
  ];

  it('attaches deckUsage to the owner\'s cards, batched by unique card ids', async () => {
    mockAuthenticateRequest.mockResolvedValueOnce({ success: true, userId: 'user123' } as any);
    mockGetBinderCards.mockResolvedValueOnce(cardsResult({ cards: cardsWithUniqueIds }));
    mockGetCardDeckUsageSummary.mockResolvedValueOnce({
      success: true,
      data: { 'cu-a': { deckCount: 3, maxDeckQuantity: 3, ownedQuantity: 3 } },
    });

    const { response, data } = await getCards();

    expect(response.status).toBe(200);
    // One batched call, deduped card ids, keyed to the requesting owner.
    expect(mockGetCardDeckUsageSummary).toHaveBeenCalledTimes(1);
    expect(mockGetCardDeckUsageSummary).toHaveBeenCalledWith('user123', ['cu-a', 'cu-b']);
    // Both inventory rows of the same card get the usage; unused card gets none.
    expect(data.cards[0].deckUsage).toEqual({ deckCount: 3, maxDeckQuantity: 3, ownedQuantity: 3 });
    expect(data.cards[2].deckUsage).toEqual({ deckCount: 3, maxDeckQuantity: 3, ownedQuantity: 3 });
    expect(data.cards[1].deckUsage).toBeUndefined();
  });

  it('does NOT compute deck usage for non-owner viewers', async () => {
    // Unauthenticated viewer of a public binder (default beforeEach auth = failure).
    mockGetBinderCards.mockResolvedValueOnce(cardsResult({ cards: cardsWithUniqueIds }));

    const { response, data } = await getCards();

    expect(response.status).toBe(200);
    expect(mockGetCardDeckUsageSummary).not.toHaveBeenCalled();
    expect(data.cards[0].deckUsage).toBeUndefined();
  });

  it('still returns cards when the deck-usage lookup fails (best-effort enrichment)', async () => {
    mockAuthenticateRequest.mockResolvedValueOnce({ success: true, userId: 'user123' } as any);
    mockGetBinderCards.mockResolvedValueOnce(cardsResult({ cards: cardsWithUniqueIds }));
    mockGetCardDeckUsageSummary.mockResolvedValueOnce({ success: false, error: 'boom' });

    const { response, data } = await getCards();

    expect(response.status).toBe(200);
    expect(data.cards).toHaveLength(3);
    expect(data.cards[0].deckUsage).toBeUndefined();
  });
});
