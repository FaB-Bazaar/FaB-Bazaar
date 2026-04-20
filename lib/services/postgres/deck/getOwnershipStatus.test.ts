/**
 * Integration tests for PostgresDeckService.getOwnershipStatus.
 *
 * Covers the refactored path that now delegates to the shared
 * ownership-queries helpers (sumOwnedByPrintingId + sumForTradeByPrintingId).
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, binders, inventoryItems, printings } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let testUserId: string;
let binderA: string;
let binderB: string;
let printingIdA: string;
let printingIdB: string;

beforeAll(async () => {
  const rows = await db.select({ printingId: printings.printingId }).from(printings).limit(2);
  if (rows.length < 2) throw new Error('Need at least 2 printings in DB');
  printingIdA = rows[0].printingId;
  printingIdB = rows[1].printingId;
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  binderA = crypto.randomUUID();
  binderB = crypto.randomUUID();

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  await db.insert(binders).values([
    { id: binderA, userId: testUserId, name: `A-${binderA}` },
    { id: binderB, userId: testUserId, name: `B-${binderB}` },
  ]);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('PostgresDeckService.getOwnershipStatus', () => {
  it('sums owned quantity across binders for a printing', async () => {
    await db.insert(inventoryItems).values([
      { id: crypto.randomUUID(), userId: testUserId, binderId: binderA, printingId: printingIdA, quantity: 2, forTrade: false },
      { id: crypto.randomUUID(), userId: testUserId, binderId: binderB, printingId: printingIdA, quantity: 3, forTrade: false },
    ]);

    const result = await service.getOwnershipStatus(testUserId, [printingIdA]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual([
      { printingId: printingIdA, owned: 5, forTrade: 0, conditions: [], binderNames: [] },
    ]);
  });

  it('counts forTrade quantity independently from owned', async () => {
    await db.insert(inventoryItems).values([
      { id: crypto.randomUUID(), userId: testUserId, binderId: binderA, printingId: printingIdA, quantity: 2, forTrade: true },
      { id: crypto.randomUUID(), userId: testUserId, binderId: binderB, printingId: printingIdA, quantity: 1, forTrade: false },
    ]);

    const result = await service.getOwnershipStatus(testUserId, [printingIdA]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[0]).toEqual({
      printingId: printingIdA,
      owned: 3,
      forTrade: 2,
      conditions: [],
      binderNames: [],
    });
  });

  it('returns a zero-owned entry for each printing the user does not own', async () => {
    await db.insert(inventoryItems).values({
      id: crypto.randomUUID(),
      userId: testUserId,
      binderId: binderA,
      printingId: printingIdA,
      quantity: 4,
      forTrade: false,
    });

    const result = await service.getOwnershipStatus(testUserId, [printingIdA, printingIdB]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const byId = Object.fromEntries(result.data.map(s => [s.printingId, s]));
    expect(byId[printingIdA].owned).toBe(4);
    expect(byId[printingIdA].forTrade).toBe(0);
    expect(byId[printingIdB].owned).toBe(0);
    expect(byId[printingIdB].forTrade).toBe(0);
    expect(result.data).toHaveLength(2);
  });

  it('does not leak inventory from other users', async () => {
    const otherUserId = crypto.randomUUID();
    const otherBinderId = crypto.randomUUID();
    await db.insert(users).values({ id: otherUserId, username: `other-${otherUserId}` });
    await db.insert(binders).values({ id: otherBinderId, userId: otherUserId, name: 'Other' });
    await db.insert(inventoryItems).values({
      id: crypto.randomUUID(),
      userId: otherUserId,
      binderId: otherBinderId,
      printingId: printingIdA,
      quantity: 99,
      forTrade: true,
    });

    try {
      const result = await service.getOwnershipStatus(testUserId, [printingIdA]);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toEqual([
        { printingId: printingIdA, owned: 0, forTrade: 0, conditions: [], binderNames: [] },
      ]);
    } finally {
      await db.delete(users).where(eq(users.id, otherUserId));
    }
  });

  it('returns empty array when printingIds is empty', async () => {
    const result = await service.getOwnershipStatus(testUserId, []);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual([]);
  });
});
