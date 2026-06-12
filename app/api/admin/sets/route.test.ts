/**
 * Unit tests for GET /api/admin/sets
 *
 * Uses mocked setsService, userService, and session auth — tests HTTP
 * concerns: superadmin gating and response shape.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  setsService: { listSets: vi.fn() },
  userService: { getRoles: vi.fn() },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateSession: vi.fn(),
}));

import { GET } from './route';
import { setsService, userService } from '@/lib/services';
import { authenticateSession } from '@/lib/auth/multi-auth';

const mockList = vi.mocked(setsService.listSets);
const mockRoles = vi.mocked(userService.getRoles);
const mockAuth = vi.mocked(authenticateSession);

const SET = {
  code: 'wtr', displayCode: 'WTR', name: 'Welcome to Rathe', releaseDate: '2019-10-11',
  releaseOrder: 20, displayOrder: 10, category: 'standard', tier: 1, isCore: true,
  hasFirstEdition: true, unlimitedBeforeFirst: true, defaultRarity: null, imageId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/admin/sets', () => {
  it('returns 401 when there is no session', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-superadmin user', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockRoles.mockResolvedValue({ success: true, data: { isSuperAdmin: false } } as any);
    const res = await GET();
    expect(res.status).toBe(403);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('returns the sets list for a superadmin', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockRoles.mockResolvedValue({ success: true, data: { isSuperAdmin: true } } as any);
    mockList.mockResolvedValue({ success: true, data: [SET] } as any);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([SET]);
  });

  it('returns 500 when the service fails', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockRoles.mockResolvedValue({ success: true, data: { isSuperAdmin: true } } as any);
    mockList.mockResolvedValue({ success: false, error: 'boom' } as any);
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
