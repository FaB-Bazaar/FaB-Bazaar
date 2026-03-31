/**
 * Unit tests for GET /api/decks/[deckId]/results
 *
 * Focused on the co-owner access change: co-owners must be allowed
 * to view results (403 guard relaxed from owner-only to owner-or-co-owner).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  deckService: {
    findByPublicId: vi.fn(),
  },
  gameResultsService: {
    getGameResultsForDeck: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

import { GET } from './route';
import { deckService, gameResultsService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockFindByPublicId = vi.mocked(deckService.findByPublicId);
const mockGetResults = vi.mocked(gameResultsService.getGameResultsForDeck);
const mockAuth = vi.mocked(authenticateRequest);

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const DECK_ID = 'deck-abc';
const OWNER_ID = 'owner-id';
const CO_OWNER_ID = 'co-owner-id';
const STRANGER_ID = 'stranger-id';

const makeParams = () => Promise.resolve({ deckId: DECK_ID });

const makeRequest = () =>
  new NextRequest(`http://localhost/api/decks/${DECK_ID}/results`);

const setAuth = (userId: string) =>
  mockAuth.mockResolvedValue({ success: true, userId } as any);

const makeDeck = (overrides?: Partial<{ userId: string; coOwners: string[] }>) => ({
  _id: 'internal-id',
  publicId: DECK_ID,
  userId: OWNER_ID,
  coOwners: [] as string[],
  ...overrides,
});

const emptyResults = {
  success: true as const,
  data: { data: [], total: 0 },
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ────────────────────────────────────────────────────────────
// Auth
// ────────────────────────────────────────────────────────────

describe('auth', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);

    const res = await GET(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────
// Access control
// ────────────────────────────────────────────────────────────

describe('access control', () => {
  it('returns 404 when deck is not found', async () => {
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

  it('allows the primary owner to fetch results', async () => {
    setAuth(OWNER_ID);
    mockFindByPublicId.mockResolvedValue({ success: true, data: makeDeck() } as any);
    mockGetResults.mockResolvedValue(emptyResults as any);

    const res = await GET(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(200);
  });

  it('allows a co-owner to fetch results', async () => {
    setAuth(CO_OWNER_ID);
    mockFindByPublicId.mockResolvedValue({
      success: true,
      data: makeDeck({ coOwners: [CO_OWNER_ID] }),
    } as any);
    mockGetResults.mockResolvedValue(emptyResults as any);

    const res = await GET(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(200);
  });
});

// ────────────────────────────────────────────────────────────
// Response shape
// ────────────────────────────────────────────────────────────

describe('response shape', () => {
  beforeEach(() => {
    setAuth(OWNER_ID);
    mockFindByPublicId.mockResolvedValue({ success: true, data: makeDeck() } as any);
  });

  it('returns results array and total', async () => {
    mockGetResults.mockResolvedValue({
      success: true,
      data: { data: [{ id: 'r1' }], total: 1 },
    } as any);

    const res = await GET(makeRequest(), { params: makeParams() });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.total).toBe(1);
  });

  it('returns 500 when gameResultsService fails', async () => {
    mockGetResults.mockResolvedValue({ success: false, error: 'DB error' } as any);

    const res = await GET(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(500);
  });
});
