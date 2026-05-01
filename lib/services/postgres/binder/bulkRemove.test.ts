/**
 * Integration tests for PostgresBinderService.bulkRemoveItems
 *
 * Runs against the real local PostgreSQL database.
 * Requires POSTGRES_URL in .env.local (loaded by vitest.setup.ts via loadEnvConfig).
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, binders, inventoryItems, printings } from '@/lib/postgres/schema';
import { PostgresBinderService } from './PostgresBinderService';

const service = new PostgresBinderService();

let testUserId: string;
let otherUserId: string;
let binderId: string;
let otherBinderId: string;
let itemId1: string;
let itemId2: string;
let itemId3: string;
let realPrintingId: string;

beforeAll(async () => {
  const [printing] = await db.select({ printingId: printings.printingId }).from(printings).limit(1);
  if (!printing) throw new Error('No printings found in DB — cannot run bulkRemove tests');
  realPrintingId = printing.printingId;
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  otherUserId = crypto.randomUUID();
  binderId = crypto.randomUUID();
  otherBinderId = crypto.randomUUID();
  itemId1 = crypto.randomUUID();
  itemId2 = crypto.randomUUID();
  itemId3 = crypto.randomUUID();

  await db.insert(users).values([
    { id: testUserId, username: `test-${testUserId}` },
    { id: otherUserId, username: `other-${otherUserId}` },
  ]);

  await db.insert(binders).values([
    { id: binderId, userId: testUserId, name: `Binder ${binderId}` },
    { id: otherBinderId, userId: otherUserId, name: `Other ${otherBinderId}` },
  ]);

  await db.insert(inventoryItems).values([
    { id: itemId1, userId: testUserId, binderId, printingId: realPrintingId, quantity: 1, condition: 'NM', language: 'EN', forTrade: false, forSale: false },
    { id: itemId2, userId: testUserId, binderId, printingId: realPrintingId, quantity: 1, condition: 'LP', language: 'EN', forTrade: false, forSale: false },
    { id: itemId3, userId: testUserId, binderId, printingId: realPrintingId, quantity: 1, condition: 'MP', language: 'EN', forTrade: false, forSale: false },
  ]);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
  await db.delete(users).where(eq(users.id, otherUserId));
});

describe('PostgresBinderService.bulkRemoveItems', () => {
  it('deletes specified items and returns count', async () => {
    const result = await service.bulkRemoveItems(binderId, testUserId, [itemId1, itemId2]);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.removed).toBe(2);

    const remaining = await db.select().from(inventoryItems).where(eq(inventoryItems.binderId, binderId));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(itemId3);
  });

  it('returns 0 removed when cardIds is empty', async () => {
    const result = await service.bulkRemoveItems(binderId, testUserId, []);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.removed).toBe(0);
  });

  it('rejects when binder does not belong to userId', async () => {
    const result = await service.bulkRemoveItems(binderId, otherUserId, [itemId1]);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found|access denied/i);

    // Items must be untouched
    const items = await db.select().from(inventoryItems).where(eq(inventoryItems.binderId, binderId));
    expect(items).toHaveLength(3);
  });

  it('only removes items that belong to the specified binder', async () => {
    // itemId1 belongs to binderId, not otherBinderId — passing wrong binder should delete 0
    const otherItemId = crypto.randomUUID();
    await db.insert(inventoryItems).values({
      id: otherItemId, userId: otherUserId, binderId: otherBinderId,
      printingId: realPrintingId, quantity: 1, condition: 'NM', language: 'EN', forTrade: false, forSale: false,
    });

    const result = await service.bulkRemoveItems(binderId, testUserId, [otherItemId]);

    expect(result.success).toBe(true);
    if (!result.success) return;
    // otherItemId is not in binderId, so 0 rows match
    expect(result.data.removed).toBe(0);
  });
});
