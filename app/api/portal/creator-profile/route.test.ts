/**
 * Unit tests for the creator-profile portal route.
 * Mocks the auth helpers and the service — tests HTTP concerns only.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/services', () => ({
  customTokenCardService: {
    getCreatorByUserId: vi.fn(),
    createCreatorProfile: vi.fn(),
    updateCreatorProfile: vi.fn(),
  },
}));
vi.mock('@/lib/auth/require-creator', () => ({
  requireContentCreatorRole: vi.fn(),
  requireCreatorProfile: vi.fn(),
}));

import { GET, POST, PATCH } from './route';
import { customTokenCardService } from '@/lib/services';
import { requireContentCreatorRole, requireCreatorProfile } from '@/lib/auth/require-creator';

const mockRequireRole = vi.mocked(requireContentCreatorRole);
const mockRequireProfile = vi.mocked(requireCreatorProfile);
const mockGetByUser = vi.mocked(customTokenCardService.getCreatorByUserId);
const mockCreate = vi.mocked(customTokenCardService.createCreatorProfile);
const mockUpdate = vi.mocked(customTokenCardService.updateCreatorProfile);

const makeReq = (method = 'GET', body?: unknown) => new NextRequest('http://localhost/api/portal/creator-profile', {
  method,
  ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
});

const gateFail = (status: number, error = 'gate') => ({
  success: false as const,
  response: NextResponse.json({ error }, { status }),
});

beforeEach(() => vi.clearAllMocks());

describe('GET /api/portal/creator-profile', () => {
  it('forwards the gate response when the gate fails', async () => {
    mockRequireRole.mockResolvedValue(gateFail(401) as any);

    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    expect(mockGetByUser).not.toHaveBeenCalled();
  });

  it('returns 200 with data:null when the creator has no profile yet', async () => {
    mockRequireRole.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockGetByUser.mockResolvedValue({ success: true, data: null } as any);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, data: null });
  });

  it('returns 200 with the creator when present', async () => {
    mockRequireRole.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockGetByUser.mockResolvedValue({ success: true, data: { id: 'c1' } } as any);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe('c1');
  });

  it('returns 500 when the service errors', async () => {
    mockRequireRole.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockGetByUser.mockResolvedValue({ success: false, error: 'DB' } as any);

    const res = await GET(makeReq());
    expect(res.status).toBe(500);
  });
});

describe('POST /api/portal/creator-profile', () => {
  it('forwards the gate response when the gate fails', async () => {
    mockRequireRole.mockResolvedValue(gateFail(403) as any);

    const res = await POST(makeReq('POST', { displayName: 'x' }));
    expect(res.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('passes the userId + parsed body to the service and returns 201', async () => {
    mockRequireRole.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockCreate.mockResolvedValue({ success: true, data: { id: 'c1' } } as any);

    const res = await POST(makeReq('POST', { displayName: 'Token Smith' }));
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith('u1', { displayName: 'Token Smith' });
  });

  it('returns 400 when the service rejects the input', async () => {
    mockRequireRole.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockCreate.mockResolvedValue({ success: false, error: 'displayName is required' } as any);

    const res = await POST(makeReq('POST', {}));
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/portal/creator-profile', () => {
  it('uses requireCreatorProfile (not just role) and forwards its failure response', async () => {
    mockRequireProfile.mockResolvedValue(gateFail(404) as any);

    const res = await PATCH(makeReq('PATCH', {}));
    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('passes creator.id (not userId) to updateCreatorProfile', async () => {
    mockRequireProfile.mockResolvedValue({ success: true, userId: 'u1', creator: { id: 'c1' } } as any);
    mockUpdate.mockResolvedValue({ success: true, data: { id: 'c1', bio: 'new' } } as any);

    const res = await PATCH(makeReq('PATCH', { bio: 'new' }));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith('c1', { bio: 'new' });
  });
});
