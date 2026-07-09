import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/mcp-fetch', () => ({
  mcpFetch: vi.fn(),
  getMcpApiBaseUrl: () => 'http://test',
}));

import { getDeckPerformanceTool } from './getDeckPerformance';
import { mcpFetch } from '@/lib/mcp-fetch';

const mockFetch = vi.mocked(mcpFetch);
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => '' }) as never;

const ROWS = [
  {
    deckPublicId: 'abc', deckName: 'Dash Aggro', heroName: 'Dash', format: 'Classic Constructed',
    games: 5, wins: 2, losses: 3, winRatePct: 40, lastPlayedAt: '2026-07-01T00:00:00Z',
    recentForm: ['W', 'L', 'W', 'L', 'L'],
    bestMatchup: { opponentHero: 'kano', games: 3, wins: 2 },
    worstMatchup: { opponentHero: 'katsu', games: 2, wins: 0 },
  },
];

beforeEach(() => vi.clearAllMocks());

describe('get_deck_performance', () => {
  it('requires an auth token', async () => {
    const res = await getDeckPerformanceTool.handler({}, undefined, undefined);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/auth/i);
  });

  it('fetches the aggregate with the caller bearer and formats per-deck lines', async () => {
    mockFetch.mockResolvedValue(ok({ success: true, data: ROWS }));
    const res = await getDeckPerformanceTool.handler({}, { id: 'u1' }, 'tok-9');
    expect(res.success).toBe(true);

    const [url, opts] = mockFetch.mock.calls[0] as [string, any];
    expect(url).toContain('/api/results/performance');
    expect(opts.headers.Authorization).toBe('Bearer tok-9');

    expect(res.decks).toHaveLength(1);
    expect(res.message).toMatch(/Dash Aggro/);
    expect(res.message).toMatch(/2W–3L/);
    expect(res.message).toMatch(/40%/);
    expect(res.message).toMatch(/kano/i);
  });

  it('passes sinceDays through as a query param', async () => {
    mockFetch.mockResolvedValue(ok({ success: true, data: [] }));
    await getDeckPerformanceTool.handler({ sinceDays: 30 }, { id: 'u1' }, 'tok');
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('sinceDays=30');
  });

  it('reports "no games" cleanly', async () => {
    mockFetch.mockResolvedValue(ok({ success: true, data: [] }));
    const res = await getDeckPerformanceTool.handler({}, { id: 'u1' }, 'tok');
    expect(res.success).toBe(true);
    expect(res.message).toMatch(/no recorded games/i);
  });

  it('surfaces API failures', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}), text: async () => 'boom' } as never);
    const res = await getDeckPerformanceTool.handler({}, { id: 'u1' }, 'tok');
    expect(res.success).toBe(false);
  });
});
