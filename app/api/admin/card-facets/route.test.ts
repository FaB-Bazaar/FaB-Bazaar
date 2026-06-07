/**
 * Unit tests for /api/admin/card-facets (superadmin) — GET a card's facet tags,
 * POST to set them. Service + auth mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  printingsService: { getCardFacetTags: vi.fn(), setCardFacetTags: vi.fn() },
  userService: { hasRole: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { GET, POST } from './route';
import { printingsService, userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockGet = vi.mocked(printingsService.getCardFacetTags);
const mockSet = vi.mocked(printingsService.setCardFacetTags);
const mockHasRole = vi.mocked(userService.hasRole);
const mockAuth = vi.mocked(authenticateRequest);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'admin-1' } as any);
  mockHasRole.mockResolvedValue({ success: true, data: true } as any);
  mockGet.mockResolvedValue({ success: true, data: ['scaling'] } as any);
  mockSet.mockResolvedValue({ success: true, data: { applied: 3 } } as any);
});

const getReq = (qs: string) => new NextRequest('http://localhost/api/admin/card-facets' + qs);
const postReq = (body: any) =>
  new NextRequest('http://localhost/api/admin/card-facets', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });

describe('GET /api/admin/card-facets', () => {
  it('returns a card\'s facet tags for a superadmin', async () => {
    const res = await GET(getReq('?cardUniqueId=abc'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: ['scaling'] });
    expect(mockGet).toHaveBeenCalledWith('abc');
  });
  it('403 when not a superadmin', async () => {
    mockHasRole.mockResolvedValue({ success: true, data: false } as any);
    expect((await GET(getReq('?cardUniqueId=abc'))).status).toBe(403);
  });
  it('401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'no' } as any);
    expect((await GET(getReq('?cardUniqueId=abc'))).status).toBe(401);
  });
  it('400 when cardUniqueId is missing', async () => {
    expect((await GET(getReq(''))).status).toBe(400);
  });
});

describe('POST /api/admin/card-facets', () => {
  it('sets tags for a superadmin', async () => {
    const res = await POST(postReq({ cardUniqueId: 'abc', tags: ['scaling', 'recursion'] }));
    expect(res.status).toBe(200);
    expect(mockSet).toHaveBeenCalledWith('abc', ['scaling', 'recursion']);
  });
  it('403 when not a superadmin', async () => {
    mockHasRole.mockResolvedValue({ success: true, data: false } as any);
    expect((await POST(postReq({ cardUniqueId: 'abc', tags: [] }))).status).toBe(403);
    expect(mockSet).not.toHaveBeenCalled();
  });
  it('400 on invalid body (missing cardUniqueId)', async () => {
    expect((await POST(postReq({ tags: ['scaling'] }))).status).toBe(400);
    expect(mockSet).not.toHaveBeenCalled();
  });
  it('500 when the service rejects (e.g. bad tag)', async () => {
    mockSet.mockResolvedValue({ success: false, error: 'Invalid facet tags: x' } as any);
    expect((await POST(postReq({ cardUniqueId: 'abc', tags: ['x'] }))).status).toBe(500);
  });
});
