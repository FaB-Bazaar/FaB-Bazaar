/**
 * Unit tests for POST /api/printings/search personal-facet threading: the
 * authenticated caller's id becomes filters.facetTagsViewerId (their own votes
 * count as live for them), and a client-SUPPLIED viewer id is always stripped
 * (spoof prevention).
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

describe('POST /api/printings/search — facetTagsViewerId threading', () => {
  it('sets the authenticated caller as viewer when facetTags are filtered', async () => {
    mockHasAuth.mockReturnValue(true);
    mockAuth.mockResolvedValue({ success: true, userId: 'user-1' } as any);
    await post({ filters: { facetTags: ['tutor'] }, options: {} });
    expect(mockSearch.mock.calls[0][0].facetTagsViewerId).toBe('user-1');
  });

  it('strips a client-supplied viewer id when anonymous (spoof prevention)', async () => {
    await post({ filters: { facetTags: ['tutor'], facetTagsViewerId: 'victim' }, options: {} });
    expect(mockSearch.mock.calls[0][0].facetTagsViewerId).toBeUndefined();
  });

  it('replaces a client-supplied viewer id with the real caller', async () => {
    mockHasAuth.mockReturnValue(true);
    mockAuth.mockResolvedValue({ success: true, userId: 'user-1' } as any);
    await post({ filters: { facetTags: ['tutor'], facetTagsViewerId: 'victim' }, options: {} });
    expect(mockSearch.mock.calls[0][0].facetTagsViewerId).toBe('user-1');
  });

  it('does not set a viewer without a facetTags filter (no cache fragmentation)', async () => {
    mockHasAuth.mockReturnValue(true);
    mockAuth.mockResolvedValue({ success: true, userId: 'user-1' } as any);
    await post({ filters: { name: 'snatch' }, options: {} });
    expect(mockSearch.mock.calls[0][0].facetTagsViewerId).toBeUndefined();
  });

  it('bypasses the Redis cache for personalized searches (votes change without a price bump)', async () => {
    // A cached entry exists — but a viewer-personalized search must not read
    // (stale the moment the user votes) or write it.
    mockRedisGet.mockResolvedValue(JSON.stringify({ printings: [], total: 0, _priceVersion: 'v1' }));
    mockHasAuth.mockReturnValue(true);
    mockAuth.mockResolvedValue({ success: true, userId: 'user-1' } as any);
    await post({ filters: { facetTags: ['tutor'] }, options: {} });
    expect(mockRedisGet).not.toHaveBeenCalled();
    expect(mockRedisSet).not.toHaveBeenCalled();
    expect(mockSearch).toHaveBeenCalledTimes(1);
  });

  it('still uses the cache for anonymous facet searches (global results are cacheable)', async () => {
    mockRedisGet.mockResolvedValue(null);
    await post({ filters: { facetTags: ['tutor'] }, options: {} });
    expect(mockRedisGet).toHaveBeenCalled();
  });
});
