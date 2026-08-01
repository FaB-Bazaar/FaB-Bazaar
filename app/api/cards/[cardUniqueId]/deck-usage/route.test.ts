/**
 * Route unit tests for GET /api/cards/[cardUniqueId]/deck-usage
 *
 * The lazy-fetch behind the binder tile "Decks (N)" button: the requesting
 * user's own (non-system) decks containing any printing of the card.
 * Service layer is mocked — these tests prove auth and response shape.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  deckService: {
    getCardDeckUsage: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

// Import AFTER mocks (vi.mock is hoisted)
import { GET } from './route';
import { deckService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockGetCardDeckUsage = vi.mocked(deckService.getCardDeckUsage);
const mockAuthenticateRequest = vi.mocked(authenticateRequest);

const CARD_UNIQUE_ID = 'cLHGKMCjPb89zwNPmMFBp';

const getUsage = async (cardUniqueId = CARD_UNIQUE_ID) => {
  const request = new NextRequest(`http://localhost/api/cards/${cardUniqueId}/deck-usage`);
  const response = await GET(request, { params: Promise.resolve({ cardUniqueId }) });
  return { response, data: await response.json() };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/cards/[cardUniqueId]/deck-usage', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuthenticateRequest.mockResolvedValueOnce({ success: false, error: 'Unauthorized' } as any);

    const { response, data } = await getUsage();

    expect(response.status).toBe(401);
    expect(data.success).toBeUndefined();
    expect(data.error).toBeTruthy();
    expect(mockGetCardDeckUsage).not.toHaveBeenCalled();
  });

  it('returns the authenticated user\'s deck list for the card', async () => {
    mockAuthenticateRequest.mockResolvedValueOnce({ success: true, userId: 'user123' } as any);
    const decks = [
      { publicId: 'pub-1', name: 'Bravo', quantity: 3, heroName: 'Fai', format: 'Classic Constructed' },
      { publicId: 'pub-2', name: 'Alpha', quantity: 2 },
    ];
    mockGetCardDeckUsage.mockResolvedValueOnce({ success: true, data: decks });

    const { response, data } = await getUsage();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(decks);
    // Scoped to the caller — never another user's decks.
    expect(mockGetCardDeckUsage).toHaveBeenCalledWith('user123', CARD_UNIQUE_ID);
  });

  it('returns 500 when the service fails', async () => {
    mockAuthenticateRequest.mockResolvedValueOnce({ success: true, userId: 'user123' } as any);
    mockGetCardDeckUsage.mockResolvedValueOnce({ success: false, error: 'db down' });

    const { response, data } = await getUsage();

    expect(response.status).toBe(500);
    expect(data.error).toBe('db down');
  });
});
