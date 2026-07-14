/**
 * Unit tests for /api/admin/card-facets/pending (curator/superadmin) — the
 * approval queue of pending public facet-vote requests. Service + auth mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  facetService: { listPendingFacetVotes: vi.fn() },
  userService: { hasRole: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { GET } from './route';
import { facetService, userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockList = vi.mocked(facetService.listPendingFacetVotes);
const mockHasRole = vi.mocked(userService.hasRole);
const mockAuth = vi.mocked(authenticateRequest);

const PENDING = [{ cardUniqueId: 'c1', tag: 'tutor', userId: 'u1', username: 'alice', cardName: 'Sink Below' }];

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'curator-1' } as any);
  mockHasRole.mockResolvedValue({ success: true, data: true } as any);
  mockList.mockResolvedValue({ success: true, data: PENDING } as any);
});

const req = () => new NextRequest('http://localhost/api/admin/card-facets/pending');

describe('GET /api/admin/card-facets/pending', () => {
  it('returns the pending queue for a curator', async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(PENDING);
  });

  it('403 for a non-curator, non-superadmin', async () => {
    mockHasRole.mockResolvedValue({ success: true, data: false } as any);
    expect((await GET(req())).status).toBe(403);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('401 when not signed in', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'no' } as any);
    expect((await GET(req())).status).toBe(401);
  });
});
