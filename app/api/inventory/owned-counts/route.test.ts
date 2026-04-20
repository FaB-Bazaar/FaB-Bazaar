/**
 * Unit tests for POST /api/inventory/owned-counts
 *
 * Mocks inventoryService + authenticateRequest. Covers auth, validation,
 * response shape, and error propagation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  inventoryService: {
    getOwnedCountsByCardUniqueId: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

import { POST } from './route';
import { inventoryService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockService = vi.mocked(inventoryService.getOwnedCountsByCardUniqueId);
const mockAuth = vi.mocked(authenticateRequest);

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/inventory/owned-counts', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/inventory/owned-counts', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);
    const res = await POST(makeRequest({ cardUniqueIds: ['a'] }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when cardUniqueIds missing', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'user-1' } as any);
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 when cardUniqueIds not an array', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'user-1' } as any);
    const res = await POST(makeRequest({ cardUniqueIds: 'foo' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when cardUniqueIds exceeds max size', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'user-1' } as any);
    const tooMany = Array.from({ length: 1001 }, (_, i) => `id-${i}`);
    const res = await POST(makeRequest({ cardUniqueIds: tooMany }));
    expect(res.status).toBe(400);
  });

  it('returns counts record on success', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'user-1' } as any);
    mockService.mockResolvedValue({ success: true, data: { a: 3, b: 1 } } as any);

    const res = await POST(makeRequest({ cardUniqueIds: ['a', 'b'] }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, data: { a: 3, b: 1 } });
    expect(mockService).toHaveBeenCalledWith('user-1', ['a', 'b']);
  });

  it('handles empty array as success with empty data', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'user-1' } as any);
    mockService.mockResolvedValue({ success: true, data: {} } as any);

    const res = await POST(makeRequest({ cardUniqueIds: [] }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, data: {} });
  });

  it('returns 500 when service fails', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'user-1' } as any);
    mockService.mockResolvedValue({ success: false, error: 'db down' } as any);

    const res = await POST(makeRequest({ cardUniqueIds: ['a'] }));
    expect(res.status).toBe(500);
  });
});
