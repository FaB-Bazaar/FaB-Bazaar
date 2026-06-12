/**
 * Unit tests for PUT /api/admin/sets/order
 *
 * Uses mocked setsService, userService, and session auth — tests HTTP
 * concerns: superadmin gating, payload validation, response shape.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  setsService: { reorderSets: vi.fn() },
  userService: { getRoles: vi.fn() },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateSession: vi.fn(),
}));

import { PUT } from './route';
import { setsService, userService } from '@/lib/services';
import { authenticateSession } from '@/lib/auth/multi-auth';

const mockReorder = vi.mocked(setsService.reorderSets);
const mockRoles = vi.mocked(userService.getRoles);
const mockAuth = vi.mocked(authenticateSession);

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/admin/sets/order', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const asSuperAdmin = () => {
  mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
  mockRoles.mockResolvedValue({ success: true, data: { isSuperAdmin: true } } as any);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PUT /api/admin/sets/order', () => {
  it('returns 403 for a non-superadmin user', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockRoles.mockResolvedValue({ success: true, data: { isSuperAdmin: false } } as any);
    const res = await PUT(makeRequest({ orders: [{ code: 'wtr', displayOrder: 10 }] }));
    expect(res.status).toBe(403);
    expect(mockReorder).not.toHaveBeenCalled();
  });

  it('rejects a payload without a non-empty orders array', async () => {
    asSuperAdmin();
    for (const bad of [{}, { orders: [] }, { orders: 'nope' }]) {
      const res = await PUT(makeRequest(bad));
      expect(res.status).toBe(400);
    }
    expect(mockReorder).not.toHaveBeenCalled();
  });

  it('rejects entries missing code or a numeric displayOrder', async () => {
    asSuperAdmin();
    const res = await PUT(makeRequest({ orders: [{ code: 'wtr' }] }));
    expect(res.status).toBe(400);
    expect(mockReorder).not.toHaveBeenCalled();
  });

  it('calls reorderSets and returns the updated count', async () => {
    asSuperAdmin();
    mockReorder.mockResolvedValue({ success: true, data: { updated: 2 } } as any);
    const orders = [
      { code: 'wtr', displayOrder: 20 },
      { code: 'arc', displayOrder: 10 },
    ];
    const res = await PUT(makeRequest({ orders }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.updated).toBe(2);
    expect(mockReorder).toHaveBeenCalledWith(orders);
  });

  it('maps a service validation failure to 400', async () => {
    asSuperAdmin();
    mockReorder.mockResolvedValue({ success: false, error: 'unknown set code(s): zzz' } as any);
    const res = await PUT(makeRequest({ orders: [{ code: 'zzz', displayOrder: 10 }] }));
    expect(res.status).toBe(400);
  });
});
