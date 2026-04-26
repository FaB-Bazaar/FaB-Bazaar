/**
 * Unit tests for GET /api/binders — focused on the navbar pin flow.
 *
 * Only exercises the summary path (?summary=true), which is what the navbar uses.
 * Service is mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  binderService: { getUserBindersWithStats: vi.fn(), listBinders: vi.fn() },
  userService: {},
}));
vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
  verifyDiscordBotToken: vi.fn(),
}));
vi.mock('@/auth', () => ({ auth: vi.fn() }));

import { GET } from './route';
import { binderService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockGetWithStats = vi.mocked(binderService.getUserBindersWithStats);
const mockAuth = vi.mocked(authenticateRequest);

const makeRequest = (qs = '') =>
  new NextRequest(`http://localhost/api/binders${qs}`);

const binderStats = (overrides: Partial<{ _id: string; pinnedInNav: boolean }>) => ({
  _id: overrides._id ?? `b-${Math.random()}`,
  userId: 'user-123',
  name: 'Test Binder',
  isPublic: true,
  pinnedInNav: overrides.pinnedInNav ?? false,
  stats: {},
});

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'user-123' } as any);
});

describe('GET /api/binders ?summary=true — pinned flow', () => {
  it('?pinned=true returns only pinned and hasPinned:true when user has pinned binders', async () => {
    const pinned1 = binderStats({ _id: 'pin-1', pinnedInNav: true });
    const pinned2 = binderStats({ _id: 'pin-2', pinnedInNav: true });
    const unpinned = binderStats({ _id: 'unp-1', pinnedInNav: false });
    mockGetWithStats.mockResolvedValue({ success: true, data: [pinned1, unpinned, pinned2] } as any);

    const res = await GET(makeRequest('?summary=true&pinned=true'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.hasPinned).toBe(true);
    expect(body.binders.map((b: any) => b._id).sort()).toEqual(['pin-1', 'pin-2']);
  });

  it('?pinned=true falls back to all and hasPinned:false when user has none pinned', async () => {
    const a = binderStats({ _id: 'a', pinnedInNav: false });
    const b = binderStats({ _id: 'b', pinnedInNav: false });
    mockGetWithStats.mockResolvedValue({ success: true, data: [a, b] } as any);

    const res = await GET(makeRequest('?summary=true&pinned=true'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.hasPinned).toBe(false);
    expect(body.binders).toHaveLength(2);
  });

  it('hasPinned is present in summary response without ?pinned=true', async () => {
    mockGetWithStats.mockResolvedValue({
      success: true,
      data: [binderStats({ _id: 'pin', pinnedInNav: true })],
    } as any);

    const res = await GET(makeRequest('?summary=true'));
    const body = await res.json();

    expect(body.hasPinned).toBe(true);
  });
});
