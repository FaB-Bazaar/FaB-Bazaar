/**
 * Integration tests for PostgresInventoryService.getTradeableCards privacy scoping.
 *
 * getTradeableCards backs the PUBLIC /users/[userId]/tradeable-cards endpoint.
 * It must only surface for-trade cards from binders the owner has made public &
 * trade-discoverable (isPublic + allowWhoHas) — same gate as the "who has" query —
 * UNLESS the requester is the owner, who sees all their own for-trade cards.
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
let publicBinder: string;
let privateBinder: string;
let optedOutBinder: string;
let printingId: string;

beforeAll(async () => {
  const [row] = await db.select().from(printings).limit(1);
  if (!row) throw new Error('Need at least 1 printing in DB');
  printingId = row.printingId;
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  publicBinder = crypto.randomUUID();
  privateBinder = crypto.randomUUID();
  optedOutBinder = crypto.randomUUID();

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  await db.insert(binders).values([
    // public + trade-discoverable (defaults)
    { id: publicBinder, userId: testUserId, name: `pub-${publicBinder}` },
    // private binder — must never surface to non-owners
    { id: privateBinder, userId: testUserId, name: `priv-${privateBinder}`, isPublic: false },
    // public but opted out of who-has/trade discovery
    { id: optedOutBinder, userId: testUserId, name: `opt-${optedOutBinder}`, allowWhoHas: false },
  ]);

  // One for-trade copy of the same printing in each binder
  await db.insert(inventoryItems).values([
    { id: crypto.randomUUID(), userId: testUserId, binderId: publicBinder, printingId, quantity: 1, forTrade: true },
    { id: crypto.randomUUID(), userId: testUserId, binderId: privateBinder, printingId, quantity: 1, forTrade: true },
    { id: crypto.randomUUID(), userId: testUserId, binderId: optedOutBinder, printingId, quantity: 1, forTrade: true },
  ]);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('PostgresInventoryService.getTradeableCards privacy scoping', () => {
  it('excludes for-trade cards from private binders for a non-owner requester', async () => {
    const result = await service.getTradeableCards(testUserId, {
      limit: 50,
      requestingUserId: crypto.randomUUID(), // someone else
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    // Only the public + allowWhoHas binder should surface
    expect(result.data.total).toBe(1);
    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0].binderId).toBe(publicBinder);
  });

  it('excludes binders that opted out of trade discovery (allowWhoHas=false)', async () => {
    const result = await service.getTradeableCards(testUserId, { limit: 50 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    const binderIds = result.data.items.map((i) => i.binderId);
    expect(binderIds).not.toContain(optedOutBinder);
    expect(binderIds).not.toContain(privateBinder);
  });

  it('shows the owner all their own for-trade cards, including private binders', async () => {
    const result = await service.getTradeableCards(testUserId, {
      limit: 50,
      requestingUserId: testUserId, // owner
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.total).toBe(3);
    const binderIds = result.data.items.map((i) => i.binderId).sort();
    expect(binderIds).toEqual([publicBinder, privateBinder, optedOutBinder].sort());
  });
});
