/**
 * Unit tests for POST /api/admin/foil-mask/ops/undo — reverts a recorded bulk
 * apply using the prior values snapshotted with it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  foilMaskService: { undoOp: vi.fn() },
  userService: { getRoles: vi.fn() },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateSession: vi.fn(),
}));

import { POST } from './route';
import { foilMaskService, userService } from '@/lib/services';
import { authenticateSession } from '@/lib/auth/multi-auth';

const mockUndo = vi.mocked(foilMaskService.undoOp);
const mockRoles = vi.mocked(userService.getRoles);
const mockAuth = vi.mocked(authenticateSession);

function req(body: unknown) {
  return new Request('http://localhost/api/admin/foil-mask/ops/undo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any;
}

function asSuperAdmin() {
  mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
  mockRoles.mockResolvedValue({ success: true, data: { isSuperAdmin: true } } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/admin/foil-mask/ops/undo', () => {
  it('returns 401 without a session', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);
    expect((await POST(req({ opId: 'op1' }))).status).toBe(401);
    expect(mockUndo).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-superadmin', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockRoles.mockResolvedValue({ success: true, data: { isSuperAdmin: false } } as any);
    expect((await POST(req({ opId: 'op1' }))).status).toBe(403);
    expect(mockUndo).not.toHaveBeenCalled();
  });

  it('requires an opId', async () => {
    asSuperAdmin();
    expect((await POST(req({}))).status).toBe(400);
    expect(mockUndo).not.toHaveBeenCalled();
  });

  it('reports how many printings were restored', async () => {
    asSuperAdmin();
    mockUndo.mockResolvedValue({ success: true, data: { opId: 'op1', restored: 11383 } } as any);

    const res = await POST(req({ opId: 'op1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.restored).toBe(11383);
    expect(mockUndo).toHaveBeenCalledWith('op1');
  });

  it('surfaces an already-undone op as a 400', async () => {
    asSuperAdmin();
    mockUndo.mockResolvedValue({ success: false, error: 'This operation was already undone' } as any);

    const res = await POST(req({ opId: 'op1' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('This operation was already undone');
  });
});
