/**
 * Integration tests for PostgresInventoryService.getOwnedCountsByPrintingId
 * and getOwnedCountsByCardUniqueId.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, binders, inventoryItems, printings } from '@/lib/postgres/schema';
import { PostgresInventoryService } from './PostgresInventoryService';

const service = new PostgresInventoryService();

let testUserId: string;
let binderA: string;
let binderB: string;
let printingIdA: string;
let printingIdB: string;
let cardUniqueIdA: string;
let cardUniqueIdB: string;

beforeAll(async () => {
  const rows = await db.select().from(printings).limit(50);
  if (rows.length < 2) throw new Error('Need at least 2 printings in DB');
  // Pick two printings with different cardUniqueIds
  const first = rows[0];
  const second = rows.find(r => r.cardUniqueId !== first.cardUniqueId);
  if (!second) throw new Error('Could not find two printings with distinct cardUniqueIds');
  printingIdA = first.printingId;
  cardUniqueIdA = first.cardUniqueId;
  printingIdB = second.printingId;
  cardUniqueIdB = second.cardUniqueId;
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

describe('PostgresInventoryService.getOwnedCountsByPrintingId', () => {
  it('sums quantities per printingId across binders for the user', async () => {
    await db.insert(inventoryItems).values([
      { id: crypto.randomUUID(), userId: testUserId, binderId: binderA, printingId: printingIdA, quantity: 2 },
      { id: crypto.randomUUID(), userId: testUserId, binderId: binderB, printingId: printingIdA, quantity: 3 },
      { id: crypto.randomUUID(), userId: testUserId, binderId: binderA, printingId: printingIdB, quantity: 1 },
    ]);

    const result = await service.getOwnedCountsByPrintingId(testUserId, [printingIdA, printingIdB]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[printingIdA]).toBe(5);
    expect(result.data[printingIdB]).toBe(1);
  });

  it('returns an empty record when user has no inventory', async () => {
    const result = await service.getOwnedCountsByPrintingId(testUserId, [printingIdA]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({});
  });

  it('only includes printings that were requested', async () => {
    await db.insert(inventoryItems).values([
      { id: crypto.randomUUID(), userId: testUserId, binderId: binderA, printingId: printingIdA, quantity: 2 },
      { id: crypto.randomUUID(), userId: testUserId, binderId: binderA, printingId: printingIdB, quantity: 4 },
    ]);

    const result = await service.getOwnedCountsByPrintingId(testUserId, [printingIdA]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ [printingIdA]: 2 });
  });

  it('returns empty record for empty request (no DB call needed)', async () => {
    const result = await service.getOwnedCountsByPrintingId(testUserId, []);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({});
  });
});

describe('PostgresInventoryService.getOwnedCountsByCardUniqueId', () => {
  it('sums quantities per cardUniqueId across all printings for the user', async () => {
    await db.insert(inventoryItems).values([
      { id: crypto.randomUUID(), userId: testUserId, binderId: binderA, printingId: printingIdA, quantity: 2 },
      { id: crypto.randomUUID(), userId: testUserId, binderId: binderB, printingId: printingIdA, quantity: 1 },
      { id: crypto.randomUUID(), userId: testUserId, binderId: binderA, printingId: printingIdB, quantity: 4 },
    ]);

    const result = await service.getOwnedCountsByCardUniqueId(testUserId, [cardUniqueIdA, cardUniqueIdB]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[cardUniqueIdA]).toBe(3);
    expect(result.data[cardUniqueIdB]).toBe(4);
  });

  it('returns empty record when user has no inventory', async () => {
    const result = await service.getOwnedCountsByCardUniqueId(testUserId, [cardUniqueIdA]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({});
  });

  it('returns empty record for empty request', async () => {
    const result = await service.getOwnedCountsByCardUniqueId(testUserId, []);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({});
  });

  it('does not leak inventory from other users', async () => {
    const otherUserId = crypto.randomUUID();
    const otherBinderId = crypto.randomUUID();
    await db.insert(users).values({ id: otherUserId, username: `other-${otherUserId}` });
    await db.insert(binders).values({ id: otherBinderId, userId: otherUserId, name: `Other` });
    await db.insert(inventoryItems).values({
      id: crypto.randomUUID(),
      userId: otherUserId,
      binderId: otherBinderId,
      printingId: printingIdA,
      quantity: 99,
    });

    try {
      const result = await service.getOwnedCountsByCardUniqueId(testUserId, [cardUniqueIdA]);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toEqual({});
    } finally {
      await db.delete(users).where(eq(users.id, otherUserId));
    }
  });
});
