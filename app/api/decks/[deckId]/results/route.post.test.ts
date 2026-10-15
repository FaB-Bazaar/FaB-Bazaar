/**
 * Unit tests for POST /api/decks/[deckId]/results — log games by hand (games
 * played outside Talishar / migrated from Fabrary). Owner-only, OAuth-enabled
 * (the add_game_result MCP tool proxies here), validates the whole batch before
 * writing anything.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  deckService: { findByPublicId: vi.fn() },
  gameResultsService: { createManualGameResult: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { POST } from './route';
import { deckService, gameResultsService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockFind = vi.mocked(deckService.findByPublicId);
const mockCreate = vi.mocked(gameResultsService.createManualGameResult);
const mockAuth = vi.mocked(authenticateRequest);

const DECK_ID = 'deck-abc';
const OWNER_ID = 'owner-id';
const params = () => Promise.resolve({ deckId: DECK_ID });
const post = (body: unknown) =>
  new NextRequest(`http://localhost/api/decks/${DECK_ID}/results`, { method: 'POST', body: JSON.stringify(body) });

const deck = (over: Record<string, unknown> = {}) => ({
  _id: 'internal-id', publicId: DECK_ID, userId: OWNER_ID, coOwners: ['co-id'],
  heroName: 'Jarl Vetreiði', format: 'Classic Constructed', ...over,
});

const game = (over: Record<string, unknown> = {}) => ({
  opponentHero: 'Malice, Domina of the Dead', playedAt: '2026-10-14T20:49:00-04:00',
  eventType: 'Classic Constructed Competitive', turnOrder: 'first', totalTurns: 7, result: 'won', ...over,
});

beforeEach(() => {
  mockFind.mockReset();
  mockCreate.mockReset();
  mockAuth.mockReset();
  mockAuth.mockResolvedValue({ success: true, userId: OWNER_ID } as any);
  mockFind.mockResolvedValue({ success: true, data: deck() } as any);
  mockCreate.mockImplementation(async (_d, _h, g) => ({ success: true, data: { created: true, result: { id: `r-${g.opponentHero}` } } }) as any);
});

describe('POST /api/decks/[deckId]/results', () => {
  it('logs a batch of games for the deck owner, accepting OAuth (MCP) callers', async () => {
    const res = await POST(post({ games: [game(), game({ opponentHero: 'Dorinthea Ironsong', result: 'lost', turnOrder: 'second' })] }), { params: params() });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ success: true, data: { created: 2, skipped: 0 } });
    expect(mockAuth.mock.calls[0][2]).toMatchObject({ allowOAuth: true });
    expect(mockCreate).toHaveBeenNthCalledWith(1, 'internal-id', 'jarl_vetreidi', expect.objectContaining({
      opponentHero: 'malice_domina_of_the_dead', format: '1', firstPlayer: true, totalTurns: 7, result: 'win',
    }));
    expect(mockCreate).toHaveBeenNthCalledWith(2, 'internal-id', 'jarl_vetreidi', expect.objectContaining({
      opponentHero: 'dorinthea_ironsong', result: 'loss', firstPlayer: false,
    }));
  });

  it('accepts a single game object; a game with no event type takes the deck format', async () => {
    const res = await POST(post(game({ eventType: undefined })), { params: params() });
    expect(res.status).toBe(201);
    expect(mockCreate.mock.calls[0][2]).toMatchObject({ format: '0' });
  });

  it('reports a re-logged game as skipped, not created', async () => {
    mockCreate.mockResolvedValueOnce({ success: true, data: { created: false, result: { id: 'existing' } as any } });
    const body = await (await POST(post({ games: [game()] }), { params: params() })).json();
    expect(body.data).toMatchObject({ created: 0, skipped: 1, results: [{ index: 0, id: 'existing', created: false }] });
  });

  it('rejects the whole batch (writing nothing) when any game is invalid, naming each bad game', async () => {
    const res = await POST(post({ games: [game(), game({ opponentHero: 'Nobody' }), game({ result: 'draw' })] }), { params: params() });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.errors.map((e: any) => e.index)).toEqual([1, 2]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects an empty or oversized batch', async () => {
    expect((await POST(post({ games: [] }), { params: params() })).status).toBe(400);
    expect((await POST(post({ games: Array.from({ length: 101 }, () => game()) }), { params: params() })).status).toBe(400);
  });

  it('is owner-only (co-owners and strangers get 403) and 404s an unknown deck', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'co-id' } as any);
    expect((await POST(post(game()), { params: params() })).status).toBe(403);
    mockAuth.mockResolvedValue({ success: true, userId: OWNER_ID } as any);
    mockFind.mockResolvedValue({ success: true, data: null } as any);
    expect((await POST(post(game()), { params: params() })).status).toBe(404);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('401s without authentication', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'nope' } as any);
    expect((await POST(post(game()), { params: params() })).status).toBe(401);
  });
});
