/**
 * Unit tests for POST/DELETE /api/collectibles/[collectibleId]/mark
 *
 * Mocked service + auth. POST sets a have/want mark (upsert), DELETE clears
 * it. Requires auth; passes allowOAuth so MCP/OAuth clients (Volzar) work.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  collectibleService: {
    setMark: vi.fn(),
    clearMark: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

import { POST, DELETE } from './route';
import { collectibleService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockSetMark = vi.mocked(collectibleService.setMark);
const mockClearMark = vi.mocked(collectibleService.clearMark);
const mockAuth = vi.mocked(authenticateRequest);

const routeParams = { params: Promise.resolve({ collectibleId: 'c-1' }) };

const makePost = (body: unknown) =>
  new NextRequest('http://localhost/api/collectibles/c-1/mark', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const makeDelete = () =>
  new NextRequest('http://localhost/api/collectibles/c-1/mark', { method: 'DELETE' });

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'user-42' } as any);
});

describe('POST /api/collectibles/[collectibleId]/mark', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);

    const res = await POST(makePost({ status: 'have' }), routeParams);

    expect(res.status).toBe(401);
    expect(mockSetMark).not.toHaveBeenCalled();
  });

  it('authenticates with allowOAuth so OAuth/MCP clients are accepted', async () => {
    mockSetMark.mockResolvedValue({ success: true, data: { status: 'have' } } as any);

    await POST(makePost({ status: 'have' }), routeParams);

    const opts = mockAuth.mock.calls[0][2];
    expect(opts).toMatchObject({ allowOAuth: true });
  });

  it('returns 400 for an invalid status', async () => {
    const res = await POST(makePost({ status: 'maybe' }), routeParams);

    expect(res.status).toBe(400);
    expect(mockSetMark).not.toHaveBeenCalled();
  });

  it('sets the mark and returns it', async () => {
    mockSetMark.mockResolvedValue({ success: true, data: { status: 'want' } } as any);

    const res = await POST(makePost({ status: 'want' }), routeParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('want');
    expect(mockSetMark).toHaveBeenCalledWith('user-42', 'c-1', 'want');
  });

  it('returns 404 when the collectible does not exist', async () => {
    mockSetMark.mockResolvedValue({ success: false, error: 'Collectible not found' } as any);

    const res = await POST(makePost({ status: 'have' }), routeParams);

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/collectibles/[collectibleId]/mark', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);

    const res = await DELETE(makeDelete(), routeParams);

    expect(res.status).toBe(401);
    expect(mockClearMark).not.toHaveBeenCalled();
  });

  it('clears the mark', async () => {
    mockClearMark.mockResolvedValue({ success: true, data: { cleared: true } } as any);

    const res = await DELETE(makeDelete(), routeParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockClearMark).toHaveBeenCalledWith('user-42', 'c-1');
  });
});
