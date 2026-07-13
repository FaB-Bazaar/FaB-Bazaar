/** Unit tests for GET /api/card-facets?cardUniqueId= — a card's community tags
 *  with counts and (for the signed-in caller) which they voted. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  facetService: { getCardCommunityTags: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { GET } from './route';
import { facetService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockGet = vi.mocked(facetService.getCardCommunityTags);
const mockAuth = vi.mocked(authenticateRequest);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'user-1' } as any);
  mockGet.mockResolvedValue({ success: true, data: [{ tag: 'tutor', votes: 2, votedByMe: true }] } as any);
});

const req = (qs: string) => new NextRequest(`http://localhost/api/card-facets${qs}`);

describe('GET /api/card-facets', () => {
  it('returns community tags for the card, scoped to the caller', async () => {
    const res = await GET(req('?cardUniqueId=c1'));
    expect(res.status).toBe(200);
    expect(mockGet).toHaveBeenCalledWith('c1', 'user-1');
    const json = await res.json();
    expect(json.data[0].votedByMe).toBe(true);
  });

  it('400 when cardUniqueId is missing', async () => {
    expect((await GET(req(''))).status).toBe(400);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('serves anonymous readers with votedByMe scoped to nobody', async () => {
    // Public page is browseable signed-out — reads must not 401.
    mockAuth.mockResolvedValue({ success: false, error: 'no' } as any);
    const res = await GET(req('?cardUniqueId=c1'));
    expect(res.status).toBe(200);
    expect(mockGet).toHaveBeenCalledWith('c1', undefined);
  });
});
