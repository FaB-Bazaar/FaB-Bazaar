/**
 * Unit tests for POST /api/admin/collectibles (superadmin catalog create).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  collectibleService: {
    createCollectible: vi.fn(),
  },
  userService: {
    hasRole: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

import { POST } from './route';
import { collectibleService, userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockCreate = vi.mocked(collectibleService.createCollectible);
const mockHasRole = vi.mocked(userService.hasRole);
const mockAuth = vi.mocked(authenticateRequest);

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/admin/collectibles', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'admin-1' } as any);
  mockHasRole.mockResolvedValue({ success: true, data: true } as any);
});

describe('POST /api/admin/collectibles', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);

    const res = await POST(makeRequest({ name: 'Mat' }));

    expect(res.status).toBe(401);
  });

  it('returns 403 for non-superadmins', async () => {
    mockHasRole.mockResolvedValue({ success: true, data: false } as any);

    const res = await POST(makeRequest({ name: 'Mat' }));

    expect(res.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeRequest({ artist: 'No Name' }));

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates the collectible with the caller as createdBy', async () => {
    mockCreate.mockResolvedValue({
      success: true,
      data: { id: 'c-1', name: 'Worlds Mat', kind: 'playmat' },
    } as any);

    const res = await POST(
      makeRequest({ name: 'Worlds Mat', artist: 'A', source: 'Worlds 2026', year: 2026 }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('c-1');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Worlds Mat', year: 2026 }),
      'admin-1',
    );
  });

  it('returns 500 when the service fails', async () => {
    mockCreate.mockResolvedValue({ success: false, error: 'duplicate' } as any);

    const res = await POST(makeRequest({ name: 'Dupe Mat' }));

    expect(res.status).toBe(500);
  });
});
