/**
 * Unit tests for /api/admin/feed-overrides/[id] (superadmin update + delete).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  feedOverridesService: {
    update: vi.fn(),
    delete: vi.fn(),
  },
  userService: {
    hasRole: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

import { PATCH, DELETE } from './route';
import { feedOverridesService, userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockUpdate = vi.mocked(feedOverridesService.update);
const mockDelete = vi.mocked(feedOverridesService.delete);
const mockHasRole = vi.mocked(userService.hasRole);
const mockAuth = vi.mocked(authenticateRequest);

const params = { params: Promise.resolve({ id: 'o-1' }) };
const makePatch = (body: unknown) =>
  new NextRequest('http://localhost/api/admin/feed-overrides/o-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
const makeDelete = () =>
  new NextRequest('http://localhost/api/admin/feed-overrides/o-1', { method: 'DELETE' });

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'admin-1' } as any);
  mockHasRole.mockResolvedValue({ success: true, data: true } as any);
});

describe('PATCH /api/admin/feed-overrides/[id]', () => {
  it('returns 403 for non-superadmins', async () => {
    mockHasRole.mockResolvedValue({ success: true, data: false } as any);
    const res = await PATCH(makePatch({ active: false }), params);
    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('updates and returns the row', async () => {
    mockUpdate.mockResolvedValue({ success: true, data: { id: 'o-1', active: false } } as any);
    const res = await PATCH(makePatch({ active: false }), params);
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith('o-1', { active: false });
    expect((await res.json()).data).toEqual({ id: 'o-1', active: false });
  });

  it('passes through setFields and reason only', async () => {
    mockUpdate.mockResolvedValue({ success: true, data: { id: 'o-1' } } as any);
    await PATCH(
      makePatch({
        setFields: { tcgplayer_product_id: '1' },
        reason: 'r',
        collectorNumber: 'HACK01',
      }),
      params,
    );
    expect(mockUpdate).toHaveBeenCalledWith('o-1', {
      setFields: { tcgplayer_product_id: '1' },
      reason: 'r',
    });
  });

  it('returns 404 when the override is missing', async () => {
    mockUpdate.mockResolvedValue({ success: false, error: 'Feed override not found' } as any);
    const res = await PATCH(makePatch({ active: true }), params);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/admin/feed-overrides/[id]', () => {
  it('returns 403 for non-superadmins', async () => {
    mockHasRole.mockResolvedValue({ success: true, data: false } as any);
    const res = await DELETE(makeDelete(), params);
    expect(res.status).toBe(403);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('deletes the override', async () => {
    mockDelete.mockResolvedValue({ success: true, data: undefined } as any);
    const res = await DELETE(makeDelete(), params);
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith('o-1');
  });
});
