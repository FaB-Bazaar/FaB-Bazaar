/**
 * Unit tests for requireContentCreatorRole / requireCreatorProfile.
 * Mocks authenticateRequest, userService, customTokenCardService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));
vi.mock('@/lib/services', () => ({
  userService: { hasRole: vi.fn() },
  customTokenCardService: { getCreatorByUserId: vi.fn() },
}));

import { requireContentCreatorRole, requireCreatorProfile } from './require-creator';
import { authenticateRequest } from './multi-auth';
import { userService, customTokenCardService } from '@/lib/services';

const mockAuth = vi.mocked(authenticateRequest);
const mockHasRole = vi.mocked(userService.hasRole);
const mockGetCreator = vi.mocked(customTokenCardService.getCreatorByUserId);

const makeReq = () => new NextRequest('http://localhost/api/portal/creator-profile');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireContentCreatorRole', () => {
  it('returns 401 response when authenticateRequest fails', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'No session' } as any);

    const result = await requireContentCreatorRole(makeReq());
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.response.status).toBe(401);
    const body = await result.response.json();
    expect(body.error).toMatch(/auth/i);
  });

  it('returns 403 when the role lookup fails', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockHasRole.mockResolvedValue({ success: false, error: 'nope' } as any);

    const result = await requireContentCreatorRole(makeReq());
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.response.status).toBe(403);
  });

  it('returns 403 when the user is not a content creator', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockHasRole.mockResolvedValue({ success: true, data: false } as any);

    const result = await requireContentCreatorRole(makeReq());
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.response.status).toBe(403);
    const body = await result.response.json();
    expect(body.error).toMatch(/content creator/i);
  });

  it('returns success with userId when the user has the role', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockHasRole.mockResolvedValue({ success: true, data: true } as any);

    const result = await requireContentCreatorRole(makeReq());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.userId).toBe('u1');
  });
});

describe('requireCreatorProfile', () => {
  it('returns the same 401 as requireContentCreatorRole when auth fails', async () => {
    mockAuth.mockResolvedValue({ success: false } as any);

    const result = await requireCreatorProfile(makeReq());
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.response.status).toBe(401);
  });

  it('returns 403 when the user is not a content creator', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockHasRole.mockResolvedValue({ success: true, data: false } as any);

    const result = await requireCreatorProfile(makeReq());
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.response.status).toBe(403);
  });

  it('returns 404 when the content creator has not created a profile yet', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockHasRole.mockResolvedValue({ success: true, data: true } as any);
    mockGetCreator.mockResolvedValue({ success: true, data: null } as any);

    const result = await requireCreatorProfile(makeReq());
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.response.status).toBe(404);
    const body = await result.response.json();
    expect(body.error).toMatch(/creator profile/i);
  });

  it('returns 500 when the creator lookup itself errors', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockHasRole.mockResolvedValue({ success: true, data: true } as any);
    mockGetCreator.mockResolvedValue({ success: false, error: 'DB down' } as any);

    const result = await requireCreatorProfile(makeReq());
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.response.status).toBe(500);
  });

  it('returns success with userId and creator when everything checks out', async () => {
    const fakeCreator = { id: 'c1', userId: 'u1', displayName: 'Me' };
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockHasRole.mockResolvedValue({ success: true, data: true } as any);
    mockGetCreator.mockResolvedValue({ success: true, data: fakeCreator } as any);

    const result = await requireCreatorProfile(makeReq());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.userId).toBe('u1');
    expect(result.creator).toBe(fakeCreator);
  });
});
