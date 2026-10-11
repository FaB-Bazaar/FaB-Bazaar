// lib/scan/require-scan-access.test.ts — server-side scanner gate for API routes.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));
vi.mock('@/lib/services', () => ({ userService: { getRoles: vi.fn() } }));

import { requireScanAccess } from './require-scan-access';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { userService } from '@/lib/services';

const mockAuth = vi.mocked(authenticateRequest);
const mockRoles = vi.mocked(userService.getRoles);
const req = () => new NextRequest('http://localhost/api/scan/session', { method: 'POST' });
const roles = (isSuperAdmin: boolean) => ({ isAdmin: false, isSuperAdmin, isContentCreator: false, canManageLocations: false, canImportCardCollections: false, canModerateForums: false });

beforeEach(() => vi.clearAllMocks());

describe('requireScanAccess', () => {
  it('401s when not authenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'No session' } as any);
    const r = await requireScanAccess(req());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.response.status).toBe(401);
    expect(mockRoles).not.toHaveBeenCalled();
  });
  it('lets any signed-in user through without a roles lookup (rollout: everyone)', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockRoles.mockResolvedValue({ success: true, data: roles(false) });
    expect(await requireScanAccess(req())).toEqual({ ok: true, userId: 'u1' });
    expect(mockRoles).not.toHaveBeenCalled();
  });
  it('passes a superadmin through with the userId', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockRoles.mockResolvedValue({ success: true, data: roles(true) });
    expect(await requireScanAccess(req())).toEqual({ ok: true, userId: 'u1' });
  });
  it('forwards allowOAuth and the body to authenticateRequest', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockRoles.mockResolvedValue({ success: true, data: roles(true) });
    const body = { x: 1 };
    await requireScanAccess(req(), body, { allowOAuth: true });
    expect(mockAuth).toHaveBeenCalledWith(expect.anything(), body, { allowOAuth: true });
  });
});
