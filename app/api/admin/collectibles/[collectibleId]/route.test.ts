/**
 * Unit tests for PATCH/DELETE /api/admin/collectibles/[collectibleId]
 * (superadmin catalog update/delete).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  collectibleService: {
    updateCollectible: vi.fn(),
    deleteCollectible: vi.fn(),
  },
  userService: {
    hasRole: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

import { PATCH, DELETE } from './route';
import { collectibleService, userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockUpdate = vi.mocked(collectibleService.updateCollectible);
const mockDelete = vi.mocked(collectibleService.deleteCollectible);
const mockHasRole = vi.mocked(userService.hasRole);
const mockAuth = vi.mocked(authenticateRequest);

const routeParams = { params: Promise.resolve({ collectibleId: 'c-1' }) };

const makePatch = (body: unknown) =>
  new NextRequest('http://localhost/api/admin/collectibles/c-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const makeDelete = () =>
  new NextRequest('http://localhost/api/admin/collectibles/c-1', { method: 'DELETE' });

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'admin-1' } as any);
  mockHasRole.mockResolvedValue({ success: true, data: true } as any);
});

describe('PATCH /api/admin/collectibles/[collectibleId]', () => {
  it('returns 403 for non-superadmins', async () => {
    mockHasRole.mockResolvedValue({ success: true, data: false } as any);

    const res = await PATCH(makePatch({ name: 'X' }), routeParams);

    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('updates the collectible', async () => {
    mockUpdate.mockResolvedValue({
      success: true,
      data: { id: 'c-1', name: 'Renamed' },
    } as any);

    const res = await PATCH(makePatch({ name: 'Renamed' }), routeParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.name).toBe('Renamed');
    expect(mockUpdate).toHaveBeenCalledWith('c-1', expect.objectContaining({ name: 'Renamed' }));
  });

  it('returns 404 when the collectible does not exist', async () => {
    mockUpdate.mockResolvedValue({ success: false, error: 'Collectible not found' } as any);

    const res = await PATCH(makePatch({ name: 'X' }), routeParams);

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/admin/collectibles/[collectibleId]', () => {
  it('returns 403 for non-superadmins', async () => {
    mockHasRole.mockResolvedValue({ success: true, data: false } as any);

    const res = await DELETE(makeDelete(), routeParams);

    expect(res.status).toBe(403);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('deletes the collectible', async () => {
    mockDelete.mockResolvedValue({ success: true, data: { deleted: true } } as any);

    const res = await DELETE(makeDelete(), routeParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith('c-1');
  });

  it('returns 404 when the collectible does not exist', async () => {
    mockDelete.mockResolvedValue({ success: false, error: 'Collectible not found' } as any);

    const res = await DELETE(makeDelete(), routeParams);

    expect(res.status).toBe(404);
  });
});
