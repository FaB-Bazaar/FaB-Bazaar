/**
 * Integration tests for the `followedStoreIds` filter on
 * PostgresInventoryService.getWhoHasPrintings.
 *
 * When `followedStoreIds` is provided, who-has results are restricted to owners
 * who follow at least one of those stores. An empty / omitted filter means no
 * restriction (show everyone).
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import {
  users, binders, inventoryItems, locations, userFollowedStores, printings,
} from '@/lib/postgres/schema';
import { PostgresInventoryService } from './PostgresInventoryService';

const service = new PostgresInventoryService();

let printingId: string;

let me: string;        // viewer (follows the store)
let follower: string;  // follows the store AND has the card for trade
let stranger: string;  // has the card for trade but does NOT follow the store
let storeId: string;

beforeAll(async () => {
  const rows = await db.select({ id: printings.printingId }).from(printings).limit(1);
  if (rows.length < 1) throw new Error('Need ≥1 printing in DB');
  printingId = rows[0].id;
});

async function makeUser(): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(users).values({ id, username: `test-${id}` });
  return id;
}

/** Insert a public, who-has-enabled binder + a for-trade inventory item. */
async function giveForTrade(userId: string, pid: string) {
  const binderId = nanoid(21);
  await db.insert(binders).values({
    id: binderId,
    userId,
    name: `Trade binder ${binderId}`,
    // isPublic + allowWhoHas default to true (required by the who-has query)
  });
  await db.insert(inventoryItems).values({
    id: nanoid(21),
    userId,
    binderId,
    printingId: pid,
    quantity: 1,
    forTrade: true,
  });
}

function ownerIds(data: { owners: Array<{ user_id: string }> }): string[] {
  return data.owners.map((o) => o.user_id);
}

beforeEach(async () => {
  me = await makeUser();
  follower = await makeUser();
  stranger = await makeUser();

  storeId = nanoid(21);
  await db.insert(locations).values({
    id: storeId,
    category: 'store',
    name: 'Test Store',
    addressLine1: '1 St',
    addressCity: 'Town',
    addressCountry: 'US',
  });
  // me + follower follow the store; stranger does not.
  await db.insert(userFollowedStores).values([
    { userId: me, locationId: storeId },
    { userId: follower, locationId: storeId },
  ]);
});

afterEach(async () => {
  await db.delete(users).where(inArray(users.id, [me, follower, stranger]));
  await db.delete(locations).where(eq(locations.id, storeId));
});

describe('PostgresInventoryService.getWhoHasPrintings — followedStoreIds filter', () => {
  it('restricts owners to those who follow one of the given stores', async () => {
    await giveForTrade(follower, printingId);
    await giveForTrade(stranger, printingId);

    const res = await service.getWhoHasPrintings([printingId], { followedStoreIds: [storeId] });
    expect(res.success).toBe(true);
    if (!res.success) return;

    const ids = ownerIds(res.data);
    expect(ids).toContain(follower);
    expect(ids).not.toContain(stranger);
  });

  it('shows everyone when no followedStoreIds filter is given', async () => {
    await giveForTrade(follower, printingId);
    await giveForTrade(stranger, printingId);

    const res = await service.getWhoHasPrintings([printingId], {});
    expect(res.success).toBe(true);
    if (!res.success) return;

    const ids = ownerIds(res.data);
    expect(ids).toContain(follower);
    expect(ids).toContain(stranger);
  });

  it('treats an empty followedStoreIds array as no restriction (show everyone)', async () => {
    await giveForTrade(follower, printingId);
    await giveForTrade(stranger, printingId);

    const res = await service.getWhoHasPrintings([printingId], { followedStoreIds: [] });
    expect(res.success).toBe(true);
    if (!res.success) return;

    const ids = ownerIds(res.data);
    expect(ids).toContain(follower);
    expect(ids).toContain(stranger);
  });
});
