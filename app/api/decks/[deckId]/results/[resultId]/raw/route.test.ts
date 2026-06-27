import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  deckService: { findByPublicId: vi.fn() },
  gameResultsService: { getRawGamePayload: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { GET } from './route';
import { deckService, gameResultsService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockAuth = vi.mocked(authenticateRequest);
const mockFindByPublicId = vi.mocked(deckService.findByPublicId);
const mockGetRaw = vi.mocked(gameResultsService.getRawGamePayload);

const ctx = (deckId = 'pub1', resultId = 'res1') => ({ params: Promise.resolve({ deckId, resultId }) });
const req = {} as Parameters<typeof GET>[0];

// minimal valid raw blob the analyzer can chew on
const rawPayload = {
  self: {
    playerHero: 'dash_io',
    result: 1,
    firstPlayer: 1,
    turns: 3,
    turnResults: { turn_0: { lifeAtTurnEnd: 40, opponentLifeAtTurnEnd: 40 } },
  },
  opponent: null,
  format: '1',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'owner1' } as never);
  mockFindByPublicId.mockResolvedValue({ success: true, data: { _id: 'deckInternal1', userId: 'owner1', coOwners: [] } } as never);
  mockGetRaw.mockResolvedValue({ success: true, data: rawPayload } as never);
});

describe('GET /api/decks/[deckId]/results/[resultId]/raw', () => {
  it('401s when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'no auth' } as never);
    const res = await GET(req, ctx());
    expect(res.status).toBe(401);
  });

  it('404s when the deck does not exist', async () => {
    mockFindByPublicId.mockResolvedValue({ success: true, data: null } as never);
    const res = await GET(req, ctx());
    expect(res.status).toBe(404);
  });

  it('403s when the requester is not the owner', async () => {
    mockFindByPublicId.mockResolvedValue({ success: true, data: { _id: 'd', userId: 'someoneElse', coOwners: [] } } as never);
    const res = await GET(req, ctx());
    expect(res.status).toBe(403);
  });

  it('returns analyzed data when a raw blob exists', async () => {
    const res = await GET(req, ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.you.hero).toBe('dash_io');
    expect(body.data.lifeRace[0]).toEqual({ turn: 0, you: 40, opp: 40 });
    // scoped by internal deck id, not the public id
    expect(mockGetRaw).toHaveBeenCalledWith('res1', 'deckInternal1');
  });

  it('returns data:null when no archive exists for the game', async () => {
    mockGetRaw.mockResolvedValue({ success: true, data: null } as never);
    const res = await GET(req, ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeNull();
  });
});
