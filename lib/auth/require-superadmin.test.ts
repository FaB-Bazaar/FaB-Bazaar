// lib/auth/require-superadmin.test.ts — shared superadmin route gate (bearer-friendly).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));
vi.mock('@/lib/services', () => ({ userService: { hasRole: vi.fn() } }));

import { requireSuperAdmin } from './require-superadmin';
import { authenticateRequest } from './multi-auth';
import { userService } from '@/lib/services';

const mockAuth = vi.mocked(authenticateRequest);
const mockHasRole = vi.mocked(userService.hasRole);
const req = () => new NextRequest('http://localhost/api/admin/scan/hashes');

beforeEach(() => vi.clearAllMocks());

describe('requireSuperAdmin', () => {
  it('401s when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'No valid authentication provided' } as any);
    const r = await requireSuperAdmin(req());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.response.status).toBe(401);
  });
  it('403s a non-superadmin', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockHasRole.mockResolvedValue({ success: true, data: false });
    const r = await requireSuperAdmin(req());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.response.status).toBe(403);
  });
  it('403s when the role lookup fails', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockHasRole.mockResolvedValue({ success: false, error: 'db' });
    const r = await requireSuperAdmin(req());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.response.status).toBe(403);
  });
  it('passes a superadmin through, forwarding the body with allowOAuth', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockHasRole.mockResolvedValue({ success: true, data: true });
    const body = { rows: [] };
    expect(await requireSuperAdmin(req(), body)).toEqual({ ok: true, userId: 'u1' });
    expect(mockAuth).toHaveBeenCalledWith(expect.anything(), body, { allowOAuth: true });
    expect(mockHasRole).toHaveBeenCalledWith('u1', 'isSuperAdmin');
  });
});
