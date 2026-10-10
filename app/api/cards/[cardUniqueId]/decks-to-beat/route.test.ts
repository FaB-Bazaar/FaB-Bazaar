/**
 * Route unit tests for GET /api/cards/[cardUniqueId]/decks-to-beat
 *
 * The lazy-fetch behind the card-details lightbox "Decks to Beat" button.
 * Public (Decks to Beat are public decks) and Redis-cached per card.
 * Service layer + Redis are mocked — these tests prove shape and caching.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  deckService: {
    getCardDecksToBeat: vi.fn(),
  },
}));

vi.mock('@/lib/redis', () => ({
  getRedisClient: vi.fn(),
}));

// Import AFTER mocks (vi.mock is hoisted)
import { GET } from './route';
import { deckService } from '@/lib/services';
import { getRedisClient } from '@/lib/redis';

const mockGetCardDecksToBeat = vi.mocked(deckService.getCardDecksToBeat);
const mockGetRedisClient = vi.mocked(getRedisClient);

const CARD_UNIQUE_ID = 'cLHGKMCjPb89zwNPmMFBp';
const DATA = {
  decks: [{ publicId: 'abc', name: 'Winner', heroName: 'Valda', format: 'Classic Constructed', eventName: 'Calling: Yokohama', eventDate: '2026-04-10', placing: 3, quantity: 1 }],
  totalsByFormat: { 'Classic Constructed': 64 },
};

const get = async (cardUniqueId = CARD_UNIQUE_ID) => {
  const request = new NextRequest(`http://localhost/api/cards/${cardUniqueId}/decks-to-beat`);
  const response = await GET(request, { params: Promise.resolve({ cardUniqueId }) });
  return { response, data: await response.json() };
};

function fakeRedis(cached: string | null = null) {
  return { get: vi.fn().mockResolvedValue(cached), set: vi.fn().mockResolvedValue('OK') };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRedisClient.mockReturnValue(null);
});

describe('GET /api/cards/[cardUniqueId]/decks-to-beat', () => {
  it('returns the Decks to Beat for the card without requiring auth', async () => {
    mockGetCardDecksToBeat.mockResolvedValue({ success: true, data: DATA });

    const { response, data } = await get();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, data: DATA });
    expect(mockGetCardDecksToBeat).toHaveBeenCalledWith(CARD_UNIQUE_ID);
  });

  it('returns 500 when the service fails', async () => {
    mockGetCardDecksToBeat.mockResolvedValue({ success: false, error: 'boom' });

    const { response, data } = await get();

    expect(response.status).toBe(500);
    expect(data.error).toBe('boom');
  });

  it('rejects a malformed card id with 400 before touching the service or cache', async () => {
    const redis = fakeRedis();
    mockGetRedisClient.mockReturnValue(redis as never);

    const { response } = await get('not a valid id!');

    expect(response.status).toBe(400);
    expect(mockGetCardDecksToBeat).not.toHaveBeenCalled();
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('serves a cached result without querying the service', async () => {
    const redis = fakeRedis(JSON.stringify(DATA));
    mockGetRedisClient.mockReturnValue(redis as never);

    const { response, data } = await get();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, data: DATA });
    expect(mockGetCardDecksToBeat).not.toHaveBeenCalled();
  });

  it('caches a fresh result with a TTL', async () => {
    const redis = fakeRedis(null);
    mockGetRedisClient.mockReturnValue(redis as never);
    mockGetCardDecksToBeat.mockResolvedValue({ success: true, data: DATA });

    await get();

    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining(CARD_UNIQUE_ID),
      JSON.stringify(DATA),
      'EX',
      expect.any(Number),
    );
  });

  it('still answers from the DB when Redis errors', async () => {
    const redis = { get: vi.fn().mockRejectedValue(new Error('down')), set: vi.fn().mockRejectedValue(new Error('down')) };
    mockGetRedisClient.mockReturnValue(redis as never);
    mockGetCardDecksToBeat.mockResolvedValue({ success: true, data: DATA });

    const { response, data } = await get();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(DATA);
  });
});
