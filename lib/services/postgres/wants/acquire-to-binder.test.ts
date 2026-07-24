/**
 * Integration tests for PostgresWantsService.acquireWantsToBinder
 *
 * These tests run against the real local PostgreSQL database.
 * Requires POSTGRES_URL in .env.local (loaded by vitest.setup.ts via loadEnvConfig).
 *
 * Each test creates isolated data with unique IDs and cleans up after itself.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, binders, inventoryItems, wantsItems, printings } from '@/lib/postgres/schema';
import { PostgresWantsService } from './PostgresWantsService';

const service = new PostgresWantsService();

// IDs scoped to this test run — reset in beforeEach
let testUserId: string;
let targetBinderId: string;
let wantsRowId: string;

// A real printingId from the DB — fetched once in beforeAll
let realPrintingId: string;

beforeAll(async () => {
  const [printing] = await db.select({ printingId: printings.printingId }).from(printings).limit(1);
  if (!printing) throw new Error('No printings found in DB — cannot run acquire tests');
  realPrintingId = printing.printingId;
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  targetBinderId = crypto.randomUUID();
  wantsRowId = crypto.randomUUID();

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });

  await db.insert(binders).values({ id: targetBinderId, userId: testUserId, name: `Target ${targetBinderId}` });

  await db.insert(wantsItems).values({
    id: wantsRowId,
    userId: testUserId,
    printingId: realPrintingId,
    quantity: 3,
    priority: 'high',
  });
});

afterEach(async () => {
  // Cascade: deleting user removes binders → inventory items, and wants items
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('PostgresWantsService.acquireWantsToBinder', () => {
  it('fully acquires a card — wants row deleted, binder item created', async () => {
    const result = await service.acquireWantsToBinder(testUserId, targetBinderId, [
      { printingId: realPrintingId, quantity: 3 },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.summary.successful).toBe(1);
    expect(result.data.summary.fullyAcquired).toBe(1);
    expect(result.data.summary.totalQuantityAcquired).toBe(3);
    expect(result.data.results[0].action).toBe('acquired');
    expect(result.data.results[0].remainingWanted).toBe(0);

    // Wants row should be gone
    const [wantsRow] = await db.select().from(wantsItems).where(eq(wantsItems.id, wantsRowId));
    expect(wantsRow).toBeUndefined();

    // Binder item should exist with quantity 3
    const [binderItem] = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.binderId, targetBinderId));
    expect(binderItem).toBeDefined();
    expect(binderItem.quantity).toBe(3);
    expect(binderItem.printingId).toBe(realPrintingId);
    expect(binderItem.condition).toBe('NM');
  });

  it('partially acquires a card — wants quantity reduced, binder item created', async () => {
    const result = await service.acquireWantsToBinder(testUserId, targetBinderId, [
      { printingId: realPrintingId, quantity: 1 },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.summary.partiallyAcquired).toBe(1);
    expect(result.data.summary.totalQuantityAcquired).toBe(1);
    expect(result.data.results[0].action).toBe('partial_acquire');
    expect(result.data.results[0].remainingWanted).toBe(2);

    // Wants row still exists with 2 remaining
    const [wantsRow] = await db.select().from(wantsItems).where(eq(wantsItems.id, wantsRowId));
    expect(wantsRow).toBeDefined();
    expect(wantsRow.quantity).toBe(2);

    // Binder item created with 1
    const [binderItem] = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.binderId, targetBinderId));
    expect(binderItem.quantity).toBe(1);
  });

  it('clamps the acquire quantity to the wanted quantity', async () => {
    const result = await service.acquireWantsToBinder(testUserId, targetBinderId, [
      { printingId: realPrintingId, quantity: 99 },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.summary.totalQuantityAcquired).toBe(3);
    expect(result.data.results[0].quantity).toBe(3);

    const [binderItem] = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.binderId, targetBinderId));
    expect(binderItem.quantity).toBe(3);
  });

  it('merges into an existing NM/EN binder row for the same printing', async () => {
    const existingItemId = crypto.randomUUID();
    await db.insert(inventoryItems).values({
      id: existingItemId,
      userId: testUserId,
      binderId: targetBinderId,
      printingId: realPrintingId,
      quantity: 2,
      condition: 'NM',
      language: 'EN',
      forTrade: false,
      forSale: false,
    });

    const result = await service.acquireWantsToBinder(testUserId, targetBinderId, [
      { printingId: realPrintingId, quantity: 3 },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.summary.mergedInBinder).toBe(1);
    expect(result.data.results[0].mergedInBinder).toBe(true);
    expect(result.data.results[0].binderQuantity).toBe(5); // 2 existing + 3 acquired

    const [binderItem] = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, existingItemId));
    expect(binderItem.quantity).toBe(5);

    // No duplicate row was created
    const allItems = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.binderId, targetBinderId));
    expect(allItems.length).toBe(1);
  });

  it('rejects acquiring into a binder the user does not own', async () => {
    const otherUserId = crypto.randomUUID();
    const otherBinderId = crypto.randomUUID();
    await db.insert(users).values({ id: otherUserId, username: `test-${otherUserId}` });
    await db.insert(binders).values({ id: otherBinderId, userId: otherUserId, name: 'Not Yours' });

    try {
      const result = await service.acquireWantsToBinder(testUserId, otherBinderId, [
        { printingId: realPrintingId, quantity: 1 },
      ]);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toMatch(/not found|access denied/i);

      // Wants row untouched
      const [wantsRow] = await db.select().from(wantsItems).where(eq(wantsItems.id, wantsRowId));
      expect(wantsRow.quantity).toBe(3);
    } finally {
      await db.delete(users).where(eq(users.id, otherUserId));
    }
  });

  it('marks a card as failed when not on the wants list, still processes other cards', async () => {
    // A second real printing that is NOT on the wants list
    const [otherPrinting] = await db
      .select({ printingId: printings.printingId })
      .from(printings)
      .where(eq(printings.printingId, realPrintingId))
      .limit(1);

    const fakePrintingId = `missing-${crypto.randomUUID()}`;
    const result = await service.acquireWantsToBinder(testUserId, targetBinderId, [
      { printingId: fakePrintingId, quantity: 1 }, // not wanted
      { printingId: otherPrinting.printingId, quantity: 1 }, // valid wants row
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.summary.failed).toBe(1);
    expect(result.data.summary.successful).toBe(1);

    const failedResult = result.data.results.find((r) => r.printingId === fakePrintingId);
    expect(failedResult?.success).toBe(false);
    expect(failedResult?.error).toMatch(/not found/i);
  });

  it('marks the binder for a stats update after a successful acquire', async () => {
    await db
      .update(binders)
      .set({ statsNeedUpdate: false })
      .where(eq(binders.id, targetBinderId));

    const result = await service.acquireWantsToBinder(testUserId, targetBinderId, [
      { printingId: realPrintingId, quantity: 1 },
    ]);

    expect(result.success).toBe(true);

    const binderRow = await db.query.binders.findFirst({
      where: and(eq(binders.id, targetBinderId), eq(binders.userId, testUserId)),
    });
    expect(binderRow?.statsNeedUpdate).toBe(true);
  });
});
