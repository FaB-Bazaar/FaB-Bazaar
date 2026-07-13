/** Unit tests for the PUBLIC /api/card-facets/assign route (any signed-in user
 *  casts/retracts a community vote). Service + auth + rate-limit mocked. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  facetService: { voteCardFacetTag: vi.fn(), unvoteCardFacetTag: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn() }));

import { POST, DELETE } from './route';
import { facetService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { rateLimit } from '@/lib/rate-limit';

const mockVote = vi.mocked(facetService.voteCardFacetTag);
const mockUnvote = vi.mocked(facetService.unvoteCardFacetTag);
const mockAuth = vi.mocked(authenticateRequest);
const mockRate = vi.mocked(rateLimit);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'user-1' } as any);
  mockRate.mockResolvedValue({ success: true, remaining: 99 } as any);
  mockVote.mockResolvedValue({ success: true, data: { votes: 2, applied: 3 } } as any);
  mockUnvote.mockResolvedValue({ success: true, data: { votes: 1, applied: 3 } } as any);
});

const req = (method: string, body: any) =>
  new NextRequest('http://localhost/api/card-facets/assign', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/card-facets/assign (vote)', () => {
  it('records the vote with the authenticated user id', async () => {
    const res = await POST(req('POST', { cardUniqueId: 'c1', tag: 'tutor' }));
    expect(res.status).toBe(200);
    expect(mockVote).toHaveBeenCalledWith('c1', 'tutor', 'user-1');
  });

  it('401 when not signed in', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'no' } as any);
    expect((await POST(req('POST', { cardUniqueId: 'c1', tag: 'tutor' }))).status).toBe(401);
    expect(mockVote).not.toHaveBeenCalled();
  });

  it('400 on missing fields', async () => {
    expect((await POST(req('POST', { cardUniqueId: 'c1' }))).status).toBe(400);
    expect(mockVote).not.toHaveBeenCalled();
  });

  it('429 when rate limited', async () => {
    mockRate.mockResolvedValue({ success: false, remaining: 0 } as any);
    expect((await POST(req('POST', { cardUniqueId: 'c1', tag: 'tutor' }))).status).toBe(429);
    expect(mockVote).not.toHaveBeenCalled();
  });

  it('400 when the service rejects (unknown tag)', async () => {
    mockVote.mockResolvedValue({ success: false, error: 'Unknown facet tag: x' } as any);
    expect((await POST(req('POST', { cardUniqueId: 'c1', tag: 'x' }))).status).toBe(400);
  });
});

describe('DELETE /api/card-facets/assign (retract vote)', () => {
  it('retracts the vote with the authenticated user id', async () => {
    const res = await DELETE(req('DELETE', { cardUniqueId: 'c1', tag: 'tutor' }));
    expect(res.status).toBe(200);
    expect(mockUnvote).toHaveBeenCalledWith('c1', 'tutor', 'user-1');
  });

  it('401 when not signed in', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'no' } as any);
    expect((await DELETE(req('DELETE', { cardUniqueId: 'c1', tag: 'tutor' }))).status).toBe(401);
  });
});
