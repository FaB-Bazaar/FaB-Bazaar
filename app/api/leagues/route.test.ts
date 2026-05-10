/**
 * Unit tests for /api/leagues (collection endpoint).
 *
 * Mocks leagueService + userService + auth. Tests HTTP concerns —
 * auth, curator gating, slug-collision status codes, and the standard
 * { success, data } / { success: false, error } response shape.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  leagueService: {
    createLeague: vi.fn(),
    listLeagues: vi.fn(),
  },
  userService: {
    hasRole: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

import { GET, POST } from './route';
import { leagueService, userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockCreate = vi.mocked(leagueService.createLeague);
const mockList = vi.mocked(leagueService.listLeagues);
const mockHasRole = vi.mocked(userService.hasRole);
const mockAuth = vi.mocked(authenticateRequest);

const postReq = (body: unknown) =>
  new NextRequest('http://localhost/api/leagues', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const getReq = (search = '') => new NextRequest(`http://localhost/api/leagues${search}`);

const setAuthOk = (userId = 'user-1') =>
  mockAuth.mockResolvedValue({ success: true, userId } as any);
const setAuthFail = () =>
  mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);

const setRoles = (opts: { curator?: boolean; superAdmin?: boolean } = {}) => {
  mockHasRole.mockImplementation(async (_userId: string, role: any) => {
    if (role === 'isCurator') return { success: true, data: !!opts.curator };
    if (role === 'isSuperAdmin') return { success: true, data: !!opts.superAdmin };
    return { success: true, data: false };
  });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/leagues — creation gating', () => {
  it('returns 401 when unauthenticated', async () => {
    setAuthFail();
    const res = await POST(postReq({ slug: 's', name: 'n' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated but not curator/superadmin', async () => {
    setAuthOk();
    setRoles({ curator: false, superAdmin: false });
    const res = await POST(postReq({ slug: 's', name: 'n' }));
    expect(res.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('allows curator to create a league', async () => {
    setAuthOk('curator-1');
    setRoles({ curator: true });
    mockCreate.mockResolvedValue({ success: true, data: { id: 'lid', slug: 's', name: 'N' } as any });

    const res = await POST(postReq({ slug: 's', name: 'N' }));
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith('curator-1', expect.objectContaining({ slug: 's', name: 'N' }));
  });

  it('allows superadmin to create a league', async () => {
    setAuthOk('admin-1');
    setRoles({ superAdmin: true });
    mockCreate.mockResolvedValue({ success: true, data: { id: 'lid' } as any });

    const res = await POST(postReq({ slug: 's', name: 'N' }));
    expect(res.status).toBe(201);
  });

  it('returns 409 when the service reports slug_taken', async () => {
    setAuthOk();
    setRoles({ curator: true });
    mockCreate.mockResolvedValue({ success: false, error: 'slug is already taken', code: 'slug_taken' } as any);

    const res = await POST(postReq({ slug: 'taken', name: 'N' }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns 400 for other validation failures', async () => {
    setAuthOk();
    setRoles({ curator: true });
    mockCreate.mockResolvedValue({ success: false, error: 'name is required' } as any);

    const res = await POST(postReq({ slug: 's' }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/leagues — listing', () => {
  it('returns public leagues without auth', async () => {
    mockList.mockResolvedValue({ success: true, data: [{ id: '1' }, { id: '2' }] as any });
    setAuthFail();

    const res = await GET(getReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ publicOnly: true }));
  });

  it('returns 401 for ?mine=true when unauthenticated', async () => {
    setAuthFail();
    const res = await GET(getReq('?mine=true'));
    expect(res.status).toBe(401);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('passes ownerId and includes private leagues when ?mine=true with auth', async () => {
    setAuthOk('owner-7');
    mockList.mockResolvedValue({ success: true, data: [] as any });

    const res = await GET(getReq('?mine=true'));
    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith(expect.objectContaining({
      publicOnly: false,
      ownerId: 'owner-7',
    }));
  });
});
