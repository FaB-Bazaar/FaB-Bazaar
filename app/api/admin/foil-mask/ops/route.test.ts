/**
 * Unit tests for GET /api/admin/foil-mask/ops — the bulk-op history the admin
 * UI reads to offer "undo last apply".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  foilMaskService: { listOps: vi.fn() },
  userService: { getRoles: vi.fn() },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateSession: vi.fn(),
}));

import { GET } from './route';
import { foilMaskService, userService } from '@/lib/services';
import { authenticateSession } from '@/lib/auth/multi-auth';

const mockListOps = vi.mocked(foilMaskService.listOps);
const mockRoles = vi.mocked(userService.getRoles);
const mockAuth = vi.mocked(authenticateSession);

function req(url = 'http://localhost/api/admin/foil-mask/ops') {
  return new Request(url) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/admin/foil-mask/ops', () => {
  it('returns 401 without a session', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);
    expect((await GET(req())).status).toBe(401);
    expect(mockListOps).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-superadmin', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockRoles.mockResolvedValue({ success: true, data: { isSuperAdmin: false } } as any);
    expect((await GET(req())).status).toBe(403);
    expect(mockListOps).not.toHaveBeenCalled();
  });

  it('returns the op history for a superadmin', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockRoles.mockResolvedValue({ success: true, data: { isSuperAdmin: true } } as any);
    mockListOps.mockResolvedValue({
      success: true,
      data: [{ id: 'op1', kind: 'match', description: 'all sets', affectedCount: 11383, undoneAt: null }],
    } as any);

    const res = await GET(req());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data[0].affectedCount).toBe(11383);
  });
});
