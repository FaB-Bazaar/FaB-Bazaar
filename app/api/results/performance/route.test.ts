/**
 * Route unit tests for GET /api/results/performance — per-deck W/L aggregates
 * (backs the get_deck_performance MCP tool). Mocked service, no DB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({ gameResultsService: { getDeckPerformanceForUser: vi.fn() } }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

// Import AFTER mocks (vi.mock is hoisted)
import { GET } from './route';
import { gameResultsService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockPerf = vi.mocked(gameResultsService.getDeckPerformanceForUser);
const mockAuth = vi.mocked(authenticateRequest);

const makeReq = (qs = '') =>
  new NextRequest(`http://localhost/api/results/performance${qs}`, { method: 'GET' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/results/performance', () => {
  it('401s when authentication fails', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'nope' } as any);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('authenticates with allowOAuth (MCP/Volzar callers)', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockPerf.mockResolvedValue({ success: true, data: [] } as any);
    await GET(makeReq());
    expect(mockAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ allowOAuth: true }),
    );
  });

  it('returns the per-deck aggregates', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    const rows = [{ deckPublicId: 'abc', deckName: 'D', games: 5, winRatePct: 40 }];
    mockPerf.mockResolvedValue({ success: true, data: rows } as any);
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: rows });
    expect(mockPerf).toHaveBeenCalledWith('u1', expect.any(Object));
  });

  it('parses sinceDays from the query string', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockPerf.mockResolvedValue({ success: true, data: [] } as any);
    await GET(makeReq('?sinceDays=30'));
    expect(mockPerf).toHaveBeenCalledWith('u1', expect.objectContaining({ sinceDays: 30 }));
  });

  it('ignores an invalid sinceDays', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockPerf.mockResolvedValue({ success: true, data: [] } as any);
    await GET(makeReq('?sinceDays=banana'));
    const opts = mockPerf.mock.calls[0][1] as Record<string, unknown>;
    expect(opts?.sinceDays).toBeUndefined();
  });

  it('500s on service failure', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockPerf.mockResolvedValue({ success: false, error: 'db down' } as any);
    const res = await GET(makeReq());
    expect(res.status).toBe(500);
  });
});
