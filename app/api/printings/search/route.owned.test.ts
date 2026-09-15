/**
 * Unit tests for POST /api/printings/search "your collection" threading:
 * a client sends `filters.ownedOnly: true`; the route resolves it to
 * `filters.ownedByUserId` from AUTH ONLY (a client-supplied ownedByUserId is
 * always stripped — it would read another user's collection), rejects
 * anonymous callers, and never serves an owned search from the shared cache.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  printingsService: { searchPrintings: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
  hasAuthParams: vi.fn(() => false),
}));
const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();
vi.mock('@/lib/redis', () => ({
  getRedisClient: vi.fn(() => ({ get: mockRedisGet, set: mockRedisSet, setex: mockRedisSet, setEx: mockRedisSet })),
}));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn(async () => ({ success: true, remaining: 1 })) }));
vi.mock('@/lib/postgres/db', () => ({
  db: { select: vi.fn(() => ({ from: vi.fn(async () => [{ maxTs: 'v1' }]) })) },
}));

import { POST } from './route';
import { printingsService } from '@/lib/services';
import { authenticateRequest, hasAuthParams } from '@/lib/auth/multi-auth';
import { NextRequest } from 'next/server';

const mockSearch = vi.mocked(printingsService.searchPrintings);
const mockAuth = vi.mocked(authenticateRequest);
const mockHasAuth = vi.mocked(hasAuthParams);

beforeEach(() => {
  vi.clearAllMocks();
  mockHasAuth.mockReturnValue(false);
  mockRedisGet.mockResolvedValue(null);
  mockSearch.mockResolvedValue({
    success: true,
    data: { printings: [], total: 0, page: 1, pages: 0, queryInfo: { executionTime: 1, filters: {} } },
  } as any);
});

const post = (body: any) =>
  POST(new NextRequest('http://localhost/api/printings/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));

const signedIn = () => {
  mockHasAuth.mockReturnValue(true);
  mockAuth.mockResolvedValue({ success: true, userId: 'user-1' } as any);
};

describe('POST /api/printings/search — ownedOnly (your collection)', () => {
  it('resolves ownedOnly to the authenticated caller\'s id', async () => {
    signedIn();
    const res = await post({ filters: { ownedOnly: true, name: 'snatch' }, options: {} });
    expect(res.status).toBe(200);
    const sent = mockSearch.mock.calls[0][0] as any;
    expect(sent.ownedByUserId).toBe('user-1');
    expect(sent).not.toHaveProperty('ownedOnly');
  });

  it('rejects an anonymous ownedOnly search with 401', async () => {
    const res = await post({ filters: { ownedOnly: true }, options: {} });
    expect(res.status).toBe(401);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('always strips a client-supplied ownedByUserId (never another user\'s collection)', async () => {
    await post({ filters: { ownedByUserId: 'victim', name: 'snatch' }, options: {} });
    expect((mockSearch.mock.calls[0][0] as any).ownedByUserId).toBeUndefined();
    signedIn();
    await post({ filters: { ownedByUserId: 'victim', name: 'snatch' }, options: {} });
    expect((mockSearch.mock.calls[1][0] as any).ownedByUserId).toBeUndefined();
  });

  it('bypasses the shared Redis cache for owned searches', async () => {
    signedIn();
    mockRedisGet.mockResolvedValue(JSON.stringify({ _priceVersion: 'v1', printings: [{ printing_id: 'cached' }], total: 1 }));
    const res = await post({ filters: { ownedOnly: true }, options: {} });
    const json = await res.json();
    expect(mockRedisGet).not.toHaveBeenCalled();
    expect(mockRedisSet).not.toHaveBeenCalled();
    expect(json.data?.total ?? json.total).toBe(0);
  });
});
