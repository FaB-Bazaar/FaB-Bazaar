/**
 * Integration test: getLatestFeaturedMonth returns the most recent month that
 * actually has featured public decks — so the Decks to Beat page can default to
 * a month with content instead of an empty current calendar month.
 *
 * Uses far-future eventDates (year 2099) so these rows are deterministically the
 * global latest regardless of whatever real data exists in the local DB.
 *
 * Runs against the local Postgres DB. Requires POSTGRES_URL in .env.local.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, decks } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let testUserId: string;

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });

  const mk = (overrides: Record<string, unknown>) => ({
    id: crypto.randomUUID(),
    publicId: `lfm-${crypto.randomUUID().slice(0, 8)}`,
    userId: testUserId,
    name: `LFM ${crypto.randomUUID().slice(0, 6)}`,
    visibility: 'public' as const,
    featured: true,
    ...overrides,
  });

  await db.insert(decks).values([
    mk({ format: 'Classic Constructed', eventDate: '2099-05-10' }),
    mk({ format: 'Classic Constructed', eventDate: '2099-06-20' }), // latest CC
    mk({ format: 'Silver Age', eventDate: '2099-07-05' }),          // latest overall
    // Ignored: not featured, and not public — must NOT win despite later dates
    mk({ format: 'Classic Constructed', eventDate: '2099-08-01', featured: false }),
    mk({ format: 'Classic Constructed', eventDate: '2099-09-01', visibility: 'unlisted' }),
  ]);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('getLatestFeaturedMonth', () => {
  it('returns the latest month across all formats (featured + public only)', async () => {
    const result = await service.getLatestFeaturedMonth();
    expect(result.success).toBe(true);
    if (!result.success) return;
    // July 2099 (Silver Age) beats June; Aug/Sep are non-featured / non-public.
    expect(result.data).toEqual({ year: 2099, month: 7 });
  });

  it('is format-aware: returns the latest month that has that format', async () => {
    const result = await service.getLatestFeaturedMonth('Classic Constructed');
    expect(result.success).toBe(true);
    if (!result.success) return;
    // Latest CC is June 2099 — the July Silver Age deck must not leak in.
    expect(result.data).toEqual({ year: 2099, month: 6 });
  });
});
