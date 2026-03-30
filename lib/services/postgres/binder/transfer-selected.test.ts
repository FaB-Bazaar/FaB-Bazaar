/**
 * Integration tests for PostgresBinderService.transferSelectedCards
 *
 * These tests run against the real local PostgreSQL database.
 * Requires POSTGRES_URL in .env.local (loaded by vitest.setup.ts via loadEnvConfig).
 *
 * Each test creates isolated data with unique IDs and cleans up after itself.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, binders, inventoryItems, printings } from '@/lib/postgres/schema';
import { PostgresBinderService } from './PostgresBinderService';

const service = new PostgresBinderService();

// IDs scoped to this test run — reset in beforeEach
let testUserId: string;
let sourceBinderId: string;
let targetBinderId: string;
let sourceItemId: string;

// A real printingId from the DB — fetched once in beforeAll
let realPrintingId: string;

beforeAll(async () => {
  const [printing] = await db.select({ printingId: printings.printingId }).from(printings).limit(1);
  if (!printing) throw new Error('No printings found in DB — cannot run transfer tests');
  realPrintingId = printing.printingId;
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  sourceBinderId = crypto.randomUUID();
  targetBinderId = crypto.randomUUID();
  sourceItemId = crypto.randomUUID();

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });

  await db.insert(binders).values([
    { id: sourceBinderId, userId: testUserId, name: `Source ${sourceBinderId}` },
    { id: targetBinderId, userId: testUserId, name: `Target ${targetBinderId}` },
  ]);

  await db.insert(inventoryItems).values({
    id: sourceItemId,
    userId: testUserId,
    binderId: sourceBinderId,
    printingId: realPrintingId,
    quantity: 3,
    condition: 'NM',
    language: 'EN',
    forTrade: false,
    forSale: false,
  });
});

afterEach(async () => {
  // Cascade: deleting user removes binders → inventory items
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('PostgresBinderService.transferSelectedCards', () => {
  it('fully transfers a card — source item deleted, target item created', async () => {
    const result = await service.transferSelectedCards(
      sourceBinderId,
      targetBinderId,
      testUserId,
      [{ cardId: sourceItemId, quantity: 3 }]
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.summary.successful).toBe(1);
    expect(result.data.summary.fullyTransferred).toBe(1);
    expect(result.data.summary.totalQuantityTransferred).toBe(3);
    expect(result.data.results[0].action).toBe('transferred');
    expect(result.data.results[0].remainingInSource).toBe(0);

    // Source item should be gone
    const [sourceItem] = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, sourceItemId));
    expect(sourceItem).toBeUndefined();

    // Target item should exist with quantity 3
    const [targetItem] = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.binderId, targetBinderId));
    expect(targetItem).toBeDefined();
    expect(targetItem.quantity).toBe(3);
    expect(targetItem.printingId).toBe(realPrintingId);
  });

  it('partially transfers a card — source quantity reduced, target item created', async () => {
    const result = await service.transferSelectedCards(
      sourceBinderId,
      targetBinderId,
      testUserId,
      [{ cardId: sourceItemId, quantity: 1 }]
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.summary.partiallyTransferred).toBe(1);
    expect(result.data.summary.totalQuantityTransferred).toBe(1);
    expect(result.data.results[0].action).toBe('partial_transfer');
    expect(result.data.results[0].remainingInSource).toBe(2);

    // Source item still exists with 2 remaining
    const [sourceItem] = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, sourceItemId));
    expect(sourceItem).toBeDefined();
    expect(sourceItem.quantity).toBe(2);

    // Target item created with 1
    const [targetItem] = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.binderId, targetBinderId));
    expect(targetItem.quantity).toBe(1);
  });

  it('merges into existing target card — target quantity incremented', async () => {
    // Pre-insert a card in the target with the same printing/condition/language
    const existingTargetItemId = crypto.randomUUID();
    await db.insert(inventoryItems).values({
      id: existingTargetItemId,
      userId: testUserId,
      binderId: targetBinderId,
      printingId: realPrintingId,
      quantity: 2,
      condition: 'NM',
      language: 'EN',
      forTrade: false,
      forSale: false,
    });

    const result = await service.transferSelectedCards(
      sourceBinderId,
      targetBinderId,
      testUserId,
      [{ cardId: sourceItemId, quantity: 3 }]
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.summary.mergedInTarget).toBe(1);
    expect(result.data.results[0].mergedInTarget).toBe(true);
    expect(result.data.results[0].targetQuantity).toBe(5); // 2 existing + 3 transferred

    // Existing target item should now have quantity 5
    const [targetItem] = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, existingTargetItemId));
    expect(targetItem.quantity).toBe(5);
  });

  it('rejects transfer when user does not own the source binder', async () => {
    const otherUserId = `other-${crypto.randomUUID()}`;

    const result = await service.transferSelectedCards(
      sourceBinderId,
      targetBinderId,
      otherUserId,  // wrong user
      [{ cardId: sourceItemId, quantity: 1 }]
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/not found|access denied/i);
  });

  it('marks card as failed when cardId not found in source, still processes other cards', async () => {
    const secondItemId = crypto.randomUUID();
    await db.insert(inventoryItems).values({
      id: secondItemId,
      userId: testUserId,
      binderId: sourceBinderId,
      printingId: realPrintingId,
      quantity: 1,
      condition: 'LP', // different condition → different unique slot
      language: 'EN',
      forTrade: false,
      forSale: false,
    });

    const fakeId = crypto.randomUUID();
    const result = await service.transferSelectedCards(
      sourceBinderId,
      targetBinderId,
      testUserId,
      [
        { cardId: fakeId, quantity: 1 },    // doesn't exist
        { cardId: secondItemId, quantity: 1 }, // valid
      ]
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.summary.failed).toBe(1);
    expect(result.data.summary.successful).toBe(1);

    const failedResult = result.data.results.find(r => r.cardId === fakeId);
    expect(failedResult?.success).toBe(false);
    expect(failedResult?.error).toMatch(/not found/i);
  });
});
