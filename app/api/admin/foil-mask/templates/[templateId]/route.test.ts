/**
 * Unit tests for PATCH/DELETE /api/admin/foil-mask/templates/[templateId].
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  foilMaskService: { updateTemplate: vi.fn(), deleteTemplate: vi.fn() },
  userService: { getRoles: vi.fn() },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateSession: vi.fn(),
}));

import { PATCH, DELETE } from './route';
import { foilMaskService, userService } from '@/lib/services';
import { authenticateSession } from '@/lib/auth/multi-auth';

const mockUpdate = vi.mocked(foilMaskService.updateTemplate);
const mockDelete = vi.mocked(foilMaskService.deleteTemplate);
const mockRoles = vi.mocked(userService.getRoles);
const mockAuth = vi.mocked(authenticateSession);

const params = Promise.resolve({ templateId: 't1' });

function patchReq(body: unknown) {
  return new Request('http://localhost/api/admin/foil-mask/templates/t1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any;
}

function deleteReq() {
  return new Request('http://localhost/api/admin/foil-mask/templates/t1', { method: 'DELETE' }) as any;
}

function asSuperAdmin() {
  mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
  mockRoles.mockResolvedValue({ success: true, data: { isSuperAdmin: true } } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PATCH /api/admin/foil-mask/templates/[templateId]', () => {
  it('returns 403 for a non-superadmin', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockRoles.mockResolvedValue({ success: true, data: { isSuperAdmin: false } } as any);
    expect((await PATCH(patchReq({ name: 'x' }), { params })).status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('renames a template', async () => {
    asSuperAdmin();
    mockUpdate.mockResolvedValue({ success: true, data: { id: 't1', name: 'Renamed' } } as any);

    const res = await PATCH(patchReq({ name: 'Renamed' }), { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.name).toBe('Renamed');
    expect(mockUpdate).toHaveBeenCalledWith('t1', expect.objectContaining({ name: 'Renamed' }));
  });
});

describe('DELETE /api/admin/foil-mask/templates/[templateId]', () => {
  it('returns 403 for a non-superadmin', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockRoles.mockResolvedValue({ success: true, data: { isSuperAdmin: false } } as any);
    expect((await DELETE(deleteReq(), { params })).status).toBe(403);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('deletes a template', async () => {
    asSuperAdmin();
    mockDelete.mockResolvedValue({ success: true, data: { deleted: true } } as any);

    const res = await DELETE(deleteReq(), { params });
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith('t1');
  });
});
