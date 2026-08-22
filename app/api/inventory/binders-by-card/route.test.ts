/**
 * Unit tests for POST /api/inventory/binders-by-card
 *
 * Mocks inventoryService + authenticateRequest. Covers auth, validation,
 * response shape, and error propagation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  inventoryService: {
    getBindersByCardUniqueId: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

import { POST } from './route';
import { inventoryService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockService = vi.mocked(inventoryService.getBindersByCardUniqueId);
const mockAuth = vi.mocked(authenticateRequest);

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/inventory/binders-by-card', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/inventory/binders-by-card', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);
    const res = await POST(makeRequest({ cardUniqueIds: ['a'] }));
    expect(res.status).toBe(401);
    expect(mockService).not.toHaveBeenCalled();
  });

  it('returns 400 for a non-array / non-string / oversized cardUniqueIds', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'user-1' } as any);
    expect((await POST(makeRequest({}))).status).toBe(400);
    expect((await POST(makeRequest({ cardUniqueIds: 'foo' }))).status).toBe(400);
    expect((await POST(makeRequest({ cardUniqueIds: [1] }))).status).toBe(400);
    expect((await POST(makeRequest({ cardUniqueIds: Array.from({ length: 101 }, (_, i) => `id-${i}`) }))).status).toBe(400);
    expect((await POST(makeRequest('{not json'))).status).toBe(400);
    expect(mockService).not.toHaveBeenCalled();
  });

  it('returns the service map under data for the authenticated user', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'user-1' } as any);
    const payload = { card1: [{ binderId: 'b1', name: 'Main', slug: 'main', quantity: 2 }] };
    mockService.mockResolvedValue({ success: true, data: payload });

    const res = await POST(makeRequest({ cardUniqueIds: ['card1'] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: payload });
    expect(mockService).toHaveBeenCalledWith('user-1', ['card1']);
  });

  it('returns 500 when the service fails', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'user-1' } as any);
    mockService.mockResolvedValue({ success: false, error: 'db down' });
    const res = await POST(makeRequest({ cardUniqueIds: ['card1'] }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'db down' });
  });
});
