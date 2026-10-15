import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/mcp-fetch', () => ({
  mcpFetch: vi.fn(),
  getMcpApiBaseUrl: () => 'http://test',
}));

import { addGameResultTool } from './addGameResult';
import { mcpFetch } from '@/lib/mcp-fetch';

const mockFetch = vi.mocked(mcpFetch);
const res = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => '' }) as never;

const game = { opponentHero: 'Malice, Domina of the Dead', playedAt: '2026-10-14T20:49:00-04:00', result: 'win' };

beforeEach(() => vi.clearAllMocks());

describe('add_game_result MCP tool', () => {
  it('requires authentication', async () => {
    const r = await addGameResultTool.handler({ deckId: 'pub1', games: [game] }, undefined, undefined);
    expect(r.success).toBe(false);
  });

  it('posts the games to the deck by id and reports what was logged', async () => {
    mockFetch.mockResolvedValue(res(201, { success: true, data: { created: 1, skipped: 0, results: [{ index: 0, id: 'r1', created: true }] } }));
    const r = await addGameResultTool.handler({ deckId: 'pub1', games: [game] }, undefined, 'tok');
    expect(r.success).toBe(true);
    const [url, init] = mockFetch.mock.calls[0] as [string, any];
    expect(url).toBe('http://test/api/decks/pub1/results');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({ games: [game] });
    expect(r.message).toMatch(/1 game logged/i);
    expect(r.data).toMatchObject({ created: 1, skipped: 0 });
  });

  it('resolves a deck NAME among your decks before posting', async () => {
    mockFetch.mockImplementation((url: any) => Promise.resolve(
      url.includes('/api/decks?')
        ? res(200, { success: true, decks: [{ name: 'Jarl Ice', publicId: 'pubJ' }] })
        : res(201, { success: true, data: { created: 1, skipped: 0, results: [] } }),
    ));
    const r = await addGameResultTool.handler({ deckName: 'jarl ice', games: [game] }, undefined, 'tok');
    expect(r.success).toBe(true);
    expect(mockFetch.mock.calls.at(-1)![0]).toBe('http://test/api/decks/pubJ/results');
  });

  it('says how many were already logged on a re-run', async () => {
    mockFetch.mockResolvedValue(res(200, { success: true, data: { created: 0, skipped: 2, results: [] } }));
    const r = await addGameResultTool.handler({ deckId: 'pub1', games: [game, game] }, undefined, 'tok');
    expect(r.message).toMatch(/2 already logged/i);
  });

  it('surfaces per-game validation errors from the API (nothing saved)', async () => {
    mockFetch.mockResolvedValue(res(400, { success: false, error: '1 of 1 games are invalid — nothing was saved.', errors: [{ index: 0, error: 'Unknown opponentHero "Nobody"' }] }));
    const r = await addGameResultTool.handler({ deckId: 'pub1', games: [{ ...game, opponentHero: 'Nobody' }] }, undefined, 'tok');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/game 1: Unknown opponentHero "Nobody"/);
  });

  it('needs a deck and at least one game', async () => {
    expect((await addGameResultTool.handler({ games: [game] }, undefined, 'tok')).success).toBe(false);
    expect((await addGameResultTool.handler({ deckId: 'pub1', games: [] }, undefined, 'tok')).success).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
