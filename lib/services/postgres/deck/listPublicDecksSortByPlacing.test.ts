/**
 * Integration test: listPublicDecks({ sortBy: 'placing' }) orders a
 * Decks-to-Beat listing from 1st place down — placing ASC, unplaced rows
 * last, ties broken by updated_at DESC (the default "recent" order).
 *
 * Without it the page shows the batch-insert order (updated_at DESC), which
 * puts four 5th-place decks before the 3rds and the winner wherever it landed.
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
const token = `zzplacing${crypto.randomUUID().slice(0, 8)}`;
const ids = { first: '', third: '', fifthOld: '', fifthNew: '', unplaced: '' };

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  for (const k of Object.keys(ids) as (keyof typeof ids)[]) ids[k] = crypto.randomUUID();

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  const base = {
    userId: testUserId, visibility: 'public' as const, format: 'Living Legend' as const,
    featured: true, isSystemDeck: true, eventName: `${token} event`, eventDate: '2026-08-30',
  };
  const t = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000);
  // Insert order deliberately scrambled and updated_at set so the default
  // (recent-first) order is: fifthNew, unplaced, first, third, fifthOld.
  await db.insert(decks).values([
    { ...base, id: ids.fifthOld, publicId: `p5o-${ids.fifthOld.slice(0, 8)}`, name: `${token} 5th old`, placing: 5, updatedAt: t(50) },
    { ...base, id: ids.third, publicId: `p3-${ids.third.slice(0, 8)}`, name: `${token} 3rd`, placing: 3, updatedAt: t(40) },
    { ...base, id: ids.first, publicId: `p1-${ids.first.slice(0, 8)}`, name: `${token} 1st`, placing: 1, updatedAt: t(30) },
    { ...base, id: ids.unplaced, publicId: `pn-${ids.unplaced.slice(0, 8)}`, name: `${token} unplaced`, placing: null, updatedAt: t(20) },
    { ...base, id: ids.fifthNew, publicId: `p5n-${ids.fifthNew.slice(0, 8)}`, name: `${token} 5th new`, placing: 5, updatedAt: t(10) },
  ]);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

const listIds = async (sortBy?: 'recent' | 'placing') => {
  const result = await service.listPublicDecks(
    { featured: true, eventName: `${token} event`, ...(sortBy && { sortBy }) },
    { limit: 20 },
  );
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(result.error);
  return result.data.decks.map(d => d._id ?? (d as any).id);
};

describe('listPublicDecks sortBy', () => {
  it("sortBy: 'placing' orders 1st → last, unplaced at the end, ties most-recent first", async () => {
    expect(await listIds('placing')).toEqual([ids.first, ids.third, ids.fifthNew, ids.fifthOld, ids.unplaced]);
  });

  it('default (no sortBy) keeps the recent-first order', async () => {
    expect(await listIds()).toEqual([ids.fifthNew, ids.unplaced, ids.first, ids.third, ids.fifthOld]);
  });
});
