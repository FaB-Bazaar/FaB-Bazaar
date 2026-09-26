/**
 * POST /api/cron/warm-search-cache — called by the nightly pipeline after the
 * price update. CRON_SECRET bearer; runs every warm target through the shared
 * cached search and reports what it did.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  setsService: { listSets: vi.fn() },
  printingsService: { getSetGroups: vi.fn() },
}));
vi.mock('@/lib/search/cached-search', () => ({ runCachedSearch: vi.fn() }));
const mockPing = vi.fn();
let redisClient: { ping: typeof mockPing } | null = { ping: mockPing };
vi.mock('@/lib/redis', () => ({ getRedisClient: vi.fn(() => redisClient) }));

import { POST } from './route';
import { setsService, printingsService } from '@/lib/services';
import { runCachedSearch } from '@/lib/search/cached-search';
import { buildWarmTargets } from '@/lib/search/warm-targets';
import { optQueryToSearchRequest } from '@/lib/search/opt-search-request';
import { NextRequest } from 'next/server';

const mockListSets = vi.mocked(setsService.listSets);
const mockGetSetGroups = vi.mocked(printingsService.getSetGroups);
const mockRun = vi.mocked(runCachedSearch);

const post = (body: unknown = { durationMs: 0 }, auth: string | null = 'Bearer s3cret') =>
  POST(new NextRequest('http://localhost/api/cron/warm-search-cache', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify(body),
  }));

const SETS = [
  { code: 'iar', displayCode: 'IAR', name: 'IAR', releaseDate: '2026-09-25', releaseOrder: 10, displayOrder: 10,
    category: 'standard', tier: 1, isCore: true, hasFirstEdition: false, unlimitedBeforeFirst: false, defaultRarity: null, imageId: null },
] as any;
const PACKS = [{ groupId: 24720, name: 'GEM Pack 5', count: 69 }] as any;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 's3cret';
  redisClient = { ping: mockPing };
  mockPing.mockResolvedValue('PONG');
  mockListSets.mockResolvedValue({ success: true, data: SETS });
  mockGetSetGroups.mockResolvedValue({ success: true, data: PACKS });
  mockRun.mockResolvedValue({ success: true, cached: false, stored: true, data: { total: 3 } } as any);
});
afterEach(() => { delete process.env.CRON_SECRET; });

describe('POST /api/cron/warm-search-cache', () => {
  it('rejects a missing or wrong bearer', async () => {
    expect((await post(undefined, null)).status).toBe(401);
    expect((await post(undefined, 'Bearer nope')).status).toBe(401);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('500s when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;
    expect((await post()).status).toBe(500);
  });

  it('runs every warm target through the cached search with the /opt page body', async () => {
    const res = await post();
    expect(res.status).toBe(200);
    const today = new Date().toISOString().slice(0, 10);
    const targets = buildWarmTargets({ sets: SETS, gemPacks: PACKS, today });
    expect(mockGetSetGroups).toHaveBeenCalledWith('gem');
    expect(mockRun).toHaveBeenCalledTimes(targets.length);
    const first = optQueryToSearchRequest(targets[0])!;
    expect(mockRun).toHaveBeenCalledWith(first.filters, first.options);

    const body = await res.json();
    expect(body).toMatchObject({ success: true, data: { targets: targets.length, warmed: targets.length, alreadyCached: 0, failed: [] } });
  });

  it('counts entries that were already cached separately', async () => {
    mockRun.mockResolvedValue({ success: true, cached: true, data: { total: 3 } } as any);
    const body = await (await post()).json();
    expect(body.data.alreadyCached).toBe(body.data.targets);
    expect(body.data.warmed).toBe(0);
  });

  it('reports a failed or empty search and keeps going', async () => {
    mockRun
      .mockResolvedValueOnce({ success: false, error: 'boom' })
      .mockResolvedValueOnce({ success: true, cached: false, data: { total: 0 } } as any);
    const body = await (await post()).json();
    expect(body.data.failed).toHaveLength(2);
    expect(body.data.failed[0]).toMatchObject({ error: 'boom' });
    expect(body.data.warmed).toBe(body.data.targets - 2);
  });

  it('counts a result the cache did not store as failed, not warmed', async () => {
    mockRun.mockResolvedValue({ success: true, cached: false, stored: false, data: { total: 3 } } as any);
    const body = await (await post()).json();
    expect(body.data.warmed).toBe(0);
    expect(body.data.failed[0]).toMatchObject({ error: 'not stored (cache unavailable)' });
  });

  it('503s without running searches when Redis is unreachable', async () => {
    mockPing.mockRejectedValue(new Error('ECONNREFUSED'));
    expect((await post()).status).toBe(503);
    redisClient = null;
    expect((await post()).status).toBe(503);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('still warms classes and talents when the sets lookups fail', async () => {
    mockListSets.mockResolvedValue({ success: false, error: 'db down' });
    mockGetSetGroups.mockResolvedValue({ success: false, error: 'db down' });
    const body = await (await post()).json();
    expect(body.success).toBe(true);
    expect(body.data.targets).toBeGreaterThan(50);
  });
});
