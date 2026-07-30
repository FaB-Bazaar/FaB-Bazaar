/**
 * Unit tests for /api/admin/feed-overrides (superadmin list + create).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  feedOverridesService: {
    list: vi.fn(),
    create: vi.fn(),
  },
  userService: {
    hasRole: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

import { GET, POST } from './route';
import { feedOverridesService, userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockList = vi.mocked(feedOverridesService.list);
const mockCreate = vi.mocked(feedOverridesService.create);
const mockHasRole = vi.mocked(userService.hasRole);
const mockAuth = vi.mocked(authenticateRequest);

const makeGet = () => new NextRequest('http://localhost/api/admin/feed-overrides');
const makePost = (body: unknown) =>
  new NextRequest('http://localhost/api/admin/feed-overrides', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const validBody = {
  collectorNumber: 'SEA016',
  foiling: 'R',
  setFields: { tcgplayer_product_id: '632643' },
  reason: 'feed points at 1st Strike product',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'admin-1' } as any);
  mockHasRole.mockResolvedValue({ success: true, data: true } as any);
});

describe('GET /api/admin/feed-overrides', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-superadmins', async () => {
    mockHasRole.mockResolvedValue({ success: true, data: false } as any);
    const res = await GET(makeGet());
    expect(res.status).toBe(403);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('returns the override list', async () => {
    mockList.mockResolvedValue({ success: true, data: [{ id: 'o-1' }] } as any);
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true, data: [{ id: 'o-1' }] });
  });

  it('returns 500 when the service fails', async () => {
    mockList.mockResolvedValue({ success: false, error: 'boom' } as any);
    const res = await GET(makeGet());
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('boom');
  });
});

describe('POST /api/admin/feed-overrides', () => {
  it('returns 403 for non-superadmins', async () => {
    mockHasRole.mockResolvedValue({ success: true, data: false } as any);
    const res = await POST(makePost(validBody));
    expect(res.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when collectorNumber is missing', async () => {
    const res = await POST(makePost({ ...validBody, collectorNumber: '' }));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when reason is missing', async () => {
    const res = await POST(makePost({ ...validBody, reason: '' }));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates with the caller as createdBy', async () => {
    mockCreate.mockResolvedValue({ success: true, data: { id: 'o-1' } } as any);
    const res = await POST(makePost(validBody));
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        collectorNumber: 'SEA016',
        foiling: 'R',
        setFields: { tcgplayer_product_id: '632643' },
        reason: validBody.reason,
        createdBy: 'admin-1',
      }),
    );
    expect((await res.json()).data).toEqual({ id: 'o-1' });
  });

  it('passes artVariations through to the service', async () => {
    mockCreate.mockResolvedValue({ success: true, data: { id: 'o-2' } } as any);
    const res = await POST(makePost({ ...validBody, artVariations: ['AA'] }));
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ artVariations: ['AA'] }),
    );
  });

  it('omits artVariations (wildcard) when the body does not send it', async () => {
    mockCreate.mockResolvedValue({ success: true, data: { id: 'o-3' } } as any);
    await POST(makePost(validBody));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ artVariations: null }),
    );
  });

  it('rejects a non-array artVariations with 400', async () => {
    const res = await POST(makePost({ ...validBody, artVariations: 'AA' }));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('maps a validation failure from the service to 400', async () => {
    mockCreate.mockResolvedValue({
      success: false,
      error: 'setFields keys not allowed: tcg_low',
    } as any);
    const res = await POST(makePost(validBody));
    expect(res.status).toBe(400);
  });
});
