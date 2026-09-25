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
    setGameResultOutcome: vi.fn(),
  },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { GET, DELETE, PATCH } from './route';
import { deckService, gameResultsService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockFindByPublicId = vi.mocked(deckService.findByPublicId);
const mockGetGameResult = vi.mocked(gameResultsService.getGameResult);
const mockDelete = vi.mocked(gameResultsService.deleteGameResult);
const mockSetOutcome = vi.mocked(gameResultsService.setGameResultOutcome);
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

describe('PATCH /api/decks/[deckId]/results/[resultId] (change result)', () => {
  const patch = (body: unknown) =>
    PATCH(
      new NextRequest(`http://localhost/api/decks/${DECK_ID}/results/${RESULT_ID}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: makeParams() },
    );

  beforeEach(() => {
    mockFindByPublicId.mockResolvedValue({ success: true, data: makeDeck() } as any);
    mockSetOutcome.mockResolvedValue({ success: true, data: { id: RESULT_ID, result: 'win' } });
  });

  it('lets the deck owner turn a loss into a win', async () => {
    setAuth(OWNER_ID);
    const res = await patch({ result: 'win' });
    expect(res.status).toBe(200);
    expect(mockSetOutcome).toHaveBeenCalledWith(RESULT_ID, 'internal-id', 'win');
    expect((await res.json()).data).toEqual({ id: RESULT_ID, result: 'win' });
  });

  it('returns 401 when unauthenticated', async () => {
    setAuth(undefined);
    expect((await patch({ result: 'win' })).status).toBe(401);
    expect(mockSetOutcome).not.toHaveBeenCalled();
  });

  it('forbids co-owners and strangers (owner only, like delete)', async () => {
    mockFindByPublicId.mockResolvedValue({ success: true, data: makeDeck({ coOwners: [CO_OWNER_ID] }) } as any);
    for (const who of [CO_OWNER_ID, STRANGER_ID]) {
      setAuth(who);
      expect((await patch({ result: 'win' })).status).toBe(403);
    }
    expect(mockSetOutcome).not.toHaveBeenCalled();
  });

  it('rejects anything but win or loss', async () => {
    setAuth(OWNER_ID);
    expect((await patch({ result: 'draw' })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
    expect(mockSetOutcome).not.toHaveBeenCalled();
  });

  it('returns 404 when the result is not in this deck', async () => {
    setAuth(OWNER_ID);
    mockSetOutcome.mockResolvedValue({ success: false, error: 'Game result not found' });
    expect((await patch({ result: 'win' })).status).toBe(404);
  });
});
