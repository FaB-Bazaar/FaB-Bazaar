/**
 * runCachedSearch — the Redis-cached search shared by POST /api/printings/search
 * and the nightly cache warm-up. The last test is the warm-up's whole point: a
 * warm-up run for an /opt URL must fill the exact key the browser's POST reads.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  printingsService: { searchPrintings: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
  hasAuthParams: vi.fn(() => false),
}));
const store = new Map<string, string>();
const mockRedisGet = vi.fn(async (k: string) => store.get(k) ?? null);
const mockRedisSet = vi.fn(async (k: string, v: string) => { store.set(k, v); return 'OK'; });
vi.mock('@/lib/redis', () => ({
  getRedisClient: vi.fn(() => ({ get: mockRedisGet, set: mockRedisSet })),
}));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn(async () => ({ success: true, remaining: 1 })) }));
let priceVersion = 'v1';
vi.mock('@/lib/postgres/db', () => ({
  db: { select: vi.fn(() => ({ from: vi.fn(async () => [{ maxTs: priceVersion }]) })) },
}));

import { runCachedSearch } from './cached-search';
import { optQueryToSearchRequest } from './opt-search-request';
import { POST } from '@/app/api/printings/search/route';
import { printingsService } from '@/lib/services';
import { NextRequest } from 'next/server';

const mockSearch = vi.mocked(printingsService.searchPrintings);
const result = (total: number) => ({
  success: true,
  data: { printings: [], total, page: 1, pages: 1, queryInfo: { executionTime: 1, filters: {} } },
}) as any;

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  priceVersion = 'v1';
  mockSearch.mockResolvedValue(result(5));
});

describe('runCachedSearch', () => {
  it('queries the service on a miss and caches the result for 24h', async () => {
    const r = await runCachedSearch({ classes: ['ninja'] }, { page: 1 });
    expect(r).toMatchObject({ success: true, cached: false, data: { total: 5 } });
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockRedisSet).toHaveBeenCalledWith(expect.stringMatching(/^search:/), expect.any(String), 'EX', 86400);
  });

  it('serves a hit from Redis without touching the service', async () => {
    await runCachedSearch({ classes: ['ninja'] }, { page: 1 });
    mockSearch.mockClear();
    const r = await runCachedSearch({ classes: ['ninja'] }, { page: 1 });
    expect(r).toMatchObject({ success: true, cached: true, data: { total: 5 } });
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('re-queries once prices have changed since the entry was cached', async () => {
    await runCachedSearch({ classes: ['ninja'] }, { page: 1 });
    priceVersion = 'v2';
    const r = await runCachedSearch({ classes: ['ninja'] }, { page: 1 });
    expect(r).toMatchObject({ cached: false });
    expect(mockSearch).toHaveBeenCalledTimes(2);
  });

  it('reports stored:true only when the Redis write succeeded', async () => {
    expect(await runCachedSearch({ classes: ['ninja'] }, { page: 1 })).toMatchObject({ stored: true });
    store.clear();
    mockRedisSet.mockRejectedValueOnce(new Error('redis down'));
    expect(await runCachedSearch({ classes: ['ninja'] }, { page: 1 })).toMatchObject({ cached: false, stored: false });
  });

  it('does not cache an empty result', async () => {
    mockSearch.mockResolvedValue(result(0));
    await runCachedSearch({ classes: ['ninja'] }, { page: 1 });
    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it('never touches Redis for a personalized search', async () => {
    await runCachedSearch({ facetTags: ['tutor'], facetTagsViewerId: 'u1' }, { page: 1 });
    expect(mockRedisGet).not.toHaveBeenCalled();
    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it('returns the service error without caching', async () => {
    mockSearch.mockResolvedValue({ success: false, error: 'boom' } as any);
    const r = await runCachedSearch({ classes: ['ninja'] }, { page: 1 });
    expect(r).toEqual({ success: false, error: 'boom' });
    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it('a warm-up run for an /opt URL fills the key the browser POST then reads', async () => {
    const warm = optQueryToSearchRequest('talents=draconic&sortBy=rarity')!;
    await runCachedSearch(warm.filters, warm.options);
    mockSearch.mockClear();

    // Body captured from the live /opt page for the same URL.
    const browserBody = '{"filters":{"talents":["draconic"],"classTalentUnion":true,"frontFaceOnly":true,"languages":["en"]},"options":{"page":1,"limit":60,"sortBy":"rarity","sortOrder":"asc","searchMode":"strict","groupByCard":true}}';
    const res = await POST(new NextRequest('http://localhost/api/printings/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: browserBody,
    }));
    expect(res.status).toBe(200);
    expect(mockSearch).not.toHaveBeenCalled(); // served from the warmed entry
  });
});
