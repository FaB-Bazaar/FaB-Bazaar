/**
 * Unit tests for GET / DELETE /api/decks/[deckId]/results/[resultId].
 *
 * GET is new: returns one full game result (with turn-log fields and the
 * imageUrls map) when the caller is the owner or a co-owner of the deck.
 * DELETE preserves existing owner-only behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  deckService: { findByPublicId: vi.fn() },
  gameResultsService: {
    getGameResult: vi.fn(),
    deleteGameResult: vi.fn(),
  },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { GET, DELETE } from './route';
import { deckService, gameResultsService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockFindByPublicId = vi.mocked(deckService.findByPublicId);
const mockGetGameResult = vi.mocked(gameResultsService.getGameResult);
const mockDelete = vi.mocked(gameResultsService.deleteGameResult);
const mockAuth = vi.mocked(authenticateRequest);

const DECK_ID = 'deck-public';
const RESULT_ID = 'result-1';
const OWNER_ID = 'owner-id';
const CO_OWNER_ID = 'co-owner-id';
const STRANGER_ID = 'stranger-id';

const makeParams = () => Promise.resolve({ deckId: DECK_ID, resultId: RESULT_ID });
const makeRequest = (method: 'GET' | 'DELETE' = 'GET') =>
  new NextRequest(`http://localhost/api/decks/${DECK_ID}/results/${RESULT_ID}`, { method });
const setAuth = (userId: string | undefined) =>
  mockAuth.mockResolvedValue(userId ? { success: true, userId } as any : { success: false, error: 'Unauthorized' } as any);
const makeDeck = (overrides?: Partial<{ userId: string; coOwners: string[] }>) => ({
  _id: 'internal-id', publicId: DECK_ID, userId: OWNER_ID, coOwners: [] as string[], ...overrides,
});

beforeEach(() => vi.clearAllMocks());

describe('GET /api/decks/[deckId]/results/[resultId]', () => {
  it('returns 401 when unauthenticated', async () => {
    setAuth(undefined);
    const res = await GET(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(401);
    expect(mockGetGameResult).not.toHaveBeenCalled();
  });

  it('returns 404 when the deck is not found', async () => {
    setAuth(OWNER_ID);
    mockFindByPublicId.mockResolvedValue({ success: true, data: null } as any);
    const res = await GET(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is neither owner nor co-owner', async () => {
    setAuth(STRANGER_ID);
    mockFindByPublicId.mockResolvedValue({ success: true, data: makeDeck() } as any);
    const res = await GET(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(403);
  });

  it('allows the owner to fetch detail', async () => {
    setAuth(OWNER_ID);
    mockFindByPublicId.mockResolvedValue({ success: true, data: makeDeck() } as any);
    mockGetGameResult.mockResolvedValue({
      success: true,
      data: { id: RESULT_ID, turnLog: [[1, 'x', 'M']], imageUrls: { x: 'http://img' } },
    } as any);

    const res = await GET(makeRequest(), { params: makeParams() });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.imageUrls).toEqual({ x: 'http://img' });
    // Service called with internal deck id (not the public id from the URL).
    expect(mockGetGameResult).toHaveBeenCalledWith(RESULT_ID, 'internal-id');
  });

  it('allows a co-owner to fetch detail', async () => {
    setAuth(CO_OWNER_ID);
    mockFindByPublicId.mockResolvedValue({
      success: true, data: makeDeck({ coOwners: [CO_OWNER_ID] }),
    } as any);
    mockGetGameResult.mockResolvedValue({ success: true, data: { id: RESULT_ID, imageUrls: {} } } as any);
    const res = await GET(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(200);
  });

  it('returns 404 when the game result does not exist', async () => {
    setAuth(OWNER_ID);
    mockFindByPublicId.mockResolvedValue({ success: true, data: makeDeck() } as any);
    mockGetGameResult.mockResolvedValue({ success: false, error: 'Game result not found' } as any);
    const res = await GET(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(404);
  });

  it('returns 500 for other service errors', async () => {
    setAuth(OWNER_ID);
    mockFindByPublicId.mockResolvedValue({ success: true, data: makeDeck() } as any);
    mockGetGameResult.mockResolvedValue({ success: false, error: 'DB exploded' } as any);
    const res = await GET(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(500);
  });
});

// Existing DELETE behavior — kept as a regression net.
describe('DELETE /api/decks/[deckId]/results/[resultId]', () => {
  it('rejects co-owners (owner-only)', async () => {
    setAuth(CO_OWNER_ID);
    mockFindByPublicId.mockResolvedValue({
      success: true, data: makeDeck({ coOwners: [CO_OWNER_ID] }),
    } as any);
    const res = await DELETE(makeRequest('DELETE'), { params: makeParams() });
    expect(res.status).toBe(403);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
