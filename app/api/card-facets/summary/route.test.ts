/** Unit tests for GET /api/card-facets/summary — public batch read of per-card
 *  facet tags + vote counts for result grids. No auth. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  facetService: { getFacetSummaryForCards: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { GET } from './route';
import { facetService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockSummary = vi.mocked(facetService.getFacetSummaryForCards);
const mockAuth = vi.mocked(authenticateRequest);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: false, error: 'no' } as any);
  mockSummary.mockResolvedValue({
    success: true,
    data: { c1: [{ tag: 'tutor', votes: 2, live: true, mine: false }] },
  } as any);
});

const req = (qs: string) => new NextRequest(`http://localhost/api/card-facets/summary${qs}`);

describe('GET /api/card-facets/summary', () => {
  it('returns summaries for the requested cards without auth', async () => {
    const res = await GET(req('?cardUniqueIds=c1,c2'));
    expect(res.status).toBe(200);
    expect(mockSummary).toHaveBeenCalledWith(['c1', 'c2'], undefined);
    const json = await res.json();
    expect(json.data.c1[0].tag).toBe('tutor');
  });

  it('passes the signed-in caller as viewer (their own votes flagged mine)', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'user-1' } as any);
    await GET(req('?cardUniqueIds=c1'));
    expect(mockSummary).toHaveBeenCalledWith(['c1'], 'user-1');
  });

  it('400 when cardUniqueIds is missing or empty', async () => {
    expect((await GET(req(''))).status).toBe(400);
    expect((await GET(req('?cardUniqueIds='))).status).toBe(400);
    expect(mockSummary).not.toHaveBeenCalled();
  });

  it('400 when more than 100 ids are requested (grid pages are ≤60)', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `c${i}`).join(',');
    expect((await GET(req(`?cardUniqueIds=${ids}`))).status).toBe(400);
    expect(mockSummary).not.toHaveBeenCalled();
  });

  it('500 when the service fails', async () => {
    mockSummary.mockResolvedValue({ success: false, error: 'db down' } as any);
    expect((await GET(req('?cardUniqueIds=c1'))).status).toBe(500);
  });
});
