/**
 * Unit tests for GET /api/admin/collectibles/submissions (superadmin review queue).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  collectibleService: {
    listSubmissions: vi.fn(),
  },
  userService: {
    hasRole: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

import { GET } from './route';
import { collectibleService, userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockList = vi.mocked(collectibleService.listSubmissions);
const mockHasRole = vi.mocked(userService.hasRole);
const mockAuth = vi.mocked(authenticateRequest);

const makeRequest = (query = '') =>
  new NextRequest(`http://localhost/api/admin/collectibles/submissions${query}`);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'admin-1' } as any);
  mockHasRole.mockResolvedValue({ success: true, data: true } as any);
  mockList.mockResolvedValue({ success: true, data: [] } as any);
});

describe('GET /api/admin/collectibles/submissions', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);

    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
  });

  it('returns 403 for non-superadmins', async () => {
    mockHasRole.mockResolvedValue({ success: true, data: false } as any);

    const res = await GET(makeRequest());

    expect(res.status).toBe(403);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('defaults to the pending queue', async () => {
    await GET(makeRequest());

    expect(mockList).toHaveBeenCalledWith({ status: 'pending' });
  });

  it('passes an explicit status filter through', async () => {
    await GET(makeRequest('?status=rejected'));

    expect(mockList).toHaveBeenCalledWith({ status: 'rejected' });
  });

  it('status=all lists every submission', async () => {
    await GET(makeRequest('?status=all'));

    expect(mockList).toHaveBeenCalledWith({});
  });

  it('returns 400 for an invalid status value', async () => {
    const res = await GET(makeRequest('?status=bogus'));

    expect(res.status).toBe(400);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('returns the submissions list', async () => {
    mockList.mockResolvedValue({
      success: true,
      data: [{ id: 's-1', status: 'pending' }],
    } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it('returns 500 when the service fails', async () => {
    mockList.mockResolvedValue({ success: false, error: 'db down' } as any);

    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
  });
});
