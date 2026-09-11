/** POST/GET /api/admin/scan/hashes — the no-SSH way to load the scanner index on prod. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  scanService: { upsertHashes: vi.fn(), filterKnownPrintingIds: vi.fn(), countHashes: vi.fn(), clearIndexCache: vi.fn() },
  userService: { hasRole: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { POST, GET } from './route';
import { scanService, userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockAuth = vi.mocked(authenticateRequest);
const mockHasRole = vi.mocked(userService.hasRole);
const mockUpsert = vi.mocked(scanService.upsertHashes);
const mockKnown = vi.mocked(scanService.filterKnownPrintingIds);
const mockCount = vi.mocked(scanService.countHashes);
const mockClear = vi.mocked(scanService.clearIndexCache);

const row = (printingId: string) => ({ printingId, phash: '0'.repeat(16), dhash: '1'.repeat(16), artHash: 'a'.repeat(16), imageUrl: 'u' });
const post = (body: unknown) => POST(new NextRequest('http://localhost/api/admin/scan/hashes', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }));
const get = () => GET(new NextRequest('http://localhost/api/admin/scan/hashes'));

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'admin' } as any);
  mockHasRole.mockResolvedValue({ success: true, data: true });
  mockKnown.mockImplementation(async (ids: string[]) => ({ success: true, data: new Set(ids.filter(id => id !== 'ghost')) }));
  mockUpsert.mockImplementation(async (rows: any[]) => ({ success: true, data: { upserted: rows.length } }));
  mockCount.mockResolvedValue({ success: true, data: { total: 3, withArt: 2, latestComputedAt: '2026-09-10T00:00:00.000Z' } });
});

describe('POST /api/admin/scan/hashes', () => {
  it('401s unauthenticated and 403s non-superadmins', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'nope' } as any);
    expect((await post({ rows: [row('a')] })).status).toBe(401);
    mockAuth.mockResolvedValue({ success: true, userId: 'u' } as any);
    mockHasRole.mockResolvedValue({ success: true, data: false });
    expect((await post({ rows: [row('a')] })).status).toBe(403);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
  it('400s invalid payloads', async () => {
    expect((await post({ rows: 'x' })).status).toBe(400);
    expect((await post({ rows: [] })).status).toBe(400);
    expect((await post({ rows: [{ ...row('a'), phash: 'zz' }] })).status).toBe(400);
    expect((await post({ rows: Array.from({ length: 1001 }, (_, i) => row('p' + i)) })).status).toBe(400);
  });
  it('upserts known rows, reports unknown printing ids instead of failing the batch, clears the index cache', async () => {
    const res = await post({ rows: [row('a'), row('ghost'), row('b')] });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, data: { dryRun: false, received: 3, upserted: 2, unknownCount: 1, unknownPrintingIds: ['ghost'] } });
    expect(mockUpsert.mock.calls[0][0].map((r: any) => r.printingId)).toEqual(['a', 'b']);
    expect(mockClear).toHaveBeenCalledTimes(1);
  });
  it('dryRun validates and splits but writes nothing', async () => {
    const res = await post({ rows: [row('a'), row('ghost')], dryRun: true });
    expect((await res.json()).data).toMatchObject({ dryRun: true, received: 2, upserted: 0, unknownCount: 1 });
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockClear).not.toHaveBeenCalled();
  });
  it('does not touch the cache when nothing was known', async () => {
    const res = await post({ rows: [row('ghost')] });
    expect((await res.json()).data.upserted).toBe(0);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockClear).not.toHaveBeenCalled();
  });
  it('500s when the upsert fails', async () => {
    mockUpsert.mockResolvedValue({ success: false, error: 'db down' });
    expect((await post({ rows: [row('a')] })).status).toBe(500);
  });
});

describe('GET /api/admin/scan/hashes', () => {
  it('401/403 like POST', async () => {
    mockHasRole.mockResolvedValue({ success: true, data: false });
    expect((await get()).status).toBe(403);
  });
  it('returns index counts (doubles as the migration probe)', async () => {
    const body = await (await get()).json();
    expect(body).toEqual({ success: true, data: { total: 3, withArt: 2, latestComputedAt: '2026-09-10T00:00:00.000Z' } });
  });
  it('hints at the missing migration when the table does not exist', async () => {
    mockCount.mockResolvedValue({ success: false, error: 'relation "printing_image_hashes" does not exist' });
    const res = await get();
    expect(res.status).toBe(500);
    expect((await res.json()).hint).toMatch(/0109/);
  });
});
