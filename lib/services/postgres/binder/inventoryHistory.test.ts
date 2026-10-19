/**
 * Integration tests for binder change history (inventory_operations, migration 0128).
 *
 * A transfer records ONE operation row in the same transaction as the move, with
 * the per-printing items that actually moved. Rows older than 30 days are pruned.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, binders, inventoryItems, printings, inventoryOperations } from '@/lib/postgres/schema';
import { PostgresBinderService } from './PostgresBinderService';
import { pruneInventoryOperations, INVENTORY_HISTORY_RETENTION_DAYS } from './inventory-history';

const service = new PostgresBinderService();

let testUserId: string;
let sourceBinderId: string;
let targetBinderId: string;
let sourceItemId: string;
let realPrintingId: string;

beforeAll(async () => {
  const [printing] = await db.select({ printingId: printings.printingId }).from(printings).limit(1);
  if (!printing) throw new Error('No printings found in DB');
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
  // Cascade: user → binders → inventory items, and user → inventory_operations
  await db.delete(users).where(eq(users.id, testUserId));
});

const opsForUser = () =>
  db.select().from(inventoryOperations).where(eq(inventoryOperations.userId, testUserId));

describe('transfer history', () => {
  it('records one transfer operation with the moved items', async () => {
    const result = await service.transferSelectedCards(sourceBinderId, targetBinderId, testUserId, [
      { cardId: sourceItemId, quantity: 2 },
    ]);
    expect(result.success).toBe(true);

    const ops = await opsForUser();
    expect(ops).toHaveLength(1);
    expect(ops[0].kind).toBe('transfer');
    expect(ops[0].sourceBinderId).toBe(sourceBinderId);
    expect(ops[0].targetBinderId).toBe(targetBinderId);
    expect(ops[0].items).toEqual([
      { printingId: realPrintingId, condition: 'NM', language: 'EN', quantity: 2 },
    ]);
  });

  it('records the full quantity when a card is merged into an existing target row', async () => {
    await db.insert(inventoryItems).values({
      id: crypto.randomUUID(),
      userId: testUserId,
      binderId: targetBinderId,
      printingId: realPrintingId,
      quantity: 5,
      condition: 'NM',
      language: 'EN',
      forTrade: false,
      forSale: false,
    });

    await service.transferSelectedCards(sourceBinderId, targetBinderId, testUserId, [
      { cardId: sourceItemId, quantity: 3 },
    ]);

    const [op] = await opsForUser();
    expect(op.items).toEqual([
      { printingId: realPrintingId, condition: 'NM', language: 'EN', quantity: 3 },
    ]);
  });

  it('records nothing when no card actually moved', async () => {
    await service.transferSelectedCards(sourceBinderId, targetBinderId, testUserId, [
      { cardId: crypto.randomUUID(), quantity: 1 },
    ]);

    expect(await opsForUser()).toHaveLength(0);
  });

  it('records nothing when the transfer is refused (binder not owned)', async () => {
    const result = await service.transferSelectedCards(sourceBinderId, crypto.randomUUID(), testUserId, [
      { cardId: sourceItemId, quantity: 1 },
    ]);
    expect(result.success).toBe(false);

    expect(await opsForUser()).toHaveLength(0);
  });

  it('records a transfer-all as one operation with every moved card', async () => {
    const result = await service.transferAllCards(sourceBinderId, targetBinderId, testUserId);
    expect(result.success).toBe(true);

    const ops = await opsForUser();
    expect(ops).toHaveLength(1);
    expect(ops[0].kind).toBe('transfer');
    expect(ops[0].sourceBinderId).toBe(sourceBinderId);
    expect(ops[0].targetBinderId).toBe(targetBinderId);
    expect(ops[0].items).toEqual([
      { printingId: realPrintingId, condition: 'NM', language: 'EN', quantity: 3 },
    ]);
  });

  it('records nothing for a transfer-all from an empty binder', async () => {
    await db.delete(inventoryItems).where(eq(inventoryItems.id, sourceItemId));
    await service.transferAllCards(sourceBinderId, targetBinderId, testUserId);

    expect(await opsForUser()).toHaveLength(0);
  });

  it('keeps history when a binder is later deleted', async () => {
    await service.transferSelectedCards(sourceBinderId, targetBinderId, testUserId, [
      { cardId: sourceItemId, quantity: 3 },
    ]);
    await db.delete(binders).where(eq(binders.id, sourceBinderId));

    const [op] = await opsForUser();
    expect(op.sourceBinderId).toBeNull();
    expect(op.items).toHaveLength(1);
  });
});

describe('pruneInventoryOperations', () => {
  it('keeps 30 days of history', () => {
    expect(INVENTORY_HISTORY_RETENTION_DAYS).toBe(30);
  });

  it('deletes operations older than the retention window and keeps newer ones', async () => {
    const item = [{ printingId: realPrintingId, condition: 'NM', language: 'EN', quantity: 1 }];
    const oldId = crypto.randomUUID();
    const recentId = crypto.randomUUID();
    await db.insert(inventoryOperations).values([
      { id: oldId, userId: testUserId, kind: 'transfer', items: item, createdAt: sql`now() - interval '31 days'` as any },
      { id: recentId, userId: testUserId, kind: 'transfer', items: item, createdAt: sql`now() - interval '29 days'` as any },
    ]);

    const deleted = await pruneInventoryOperations();
    expect(deleted).toBeGreaterThanOrEqual(1);

    const remaining = (await opsForUser()).map((o) => o.id);
    expect(remaining).toEqual([recentId]);
  });
});
