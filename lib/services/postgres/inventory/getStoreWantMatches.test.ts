/**
 * Integration tests for PostgresInventoryService.getStoreWantMatches.
 * Card-first "who at this store has what I want" view: for each card on the
 * viewer's wants list, the store followers who have it for trade.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import {
  users, binders, inventoryItems, wantsItems, locations, userFollowedStores, printings,
} from '@/lib/postgres/schema';
import { PostgresInventoryService } from './PostgresInventoryService';

const service = new PostgresInventoryService();

let wantedOwnedId: string; // printing the viewer wants AND a follower has for trade
let wantedUnownedId: string; // printing the viewer wants but nobody has

let me: string;        // viewer
let owner: string;     // store follower who has the card for trade
let stranger: string;  // owns the card for trade but does NOT follow the store
let storeId: string;

beforeAll(async () => {
  const rows = await db.select({ id: printings.printingId }).from(printings).limit(2);
  if (rows.length < 2) throw new Error('Need ≥2 printings in DB');
  wantedOwnedId = rows[0].id;
  wantedUnownedId = rows[1].id;
});

async function makeUser(): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(users).values({ id, username: `test-${id}` });
  return id;
}

/** Insert a binder + a for-trade inventory item for `userId`. */
async function giveForTrade(
  userId: string,
  printingId: string,
  opts: { allowInMatching?: boolean; forTrade?: boolean; quantity?: number } = {},
) {
  const binderId = nanoid(21);
  await db.insert(binders).values({
    id: binderId,
    userId,
    name: `Trade binder ${binderId}`,
    allowInMatching: opts.allowInMatching ?? true,
  });
  await db.insert(inventoryItems).values({
    id: nanoid(21),
    userId,
    binderId,
    printingId,
    quantity: opts.quantity ?? 1,
    forTrade: opts.forTrade ?? true,
  });
}

beforeEach(async () => {
  me = await makeUser();
  owner = await makeUser();
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
  // me + owner follow the store; stranger does not.
  await db.insert(userFollowedStores).values([
    { userId: me, locationId: storeId },
    { userId: owner, locationId: storeId },
  ]);
});

afterEach(async () => {
  await db.delete(users).where(inArray(users.id, [me, owner, stranger]));
  await db.delete(locations).where(eq(locations.id, storeId));
});

describe('PostgresInventoryService.getStoreWantMatches', () => {
  it('returns wanted cards that a store follower has for trade, with the owner', async () => {
    await db.insert(wantsItems).values({ id: nanoid(21), userId: me, printingId: wantedOwnedId, quantity: 2 });
    await giveForTrade(owner, wantedOwnedId, { quantity: 3 });

    const res = await service.getStoreWantMatches(storeId, me);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const entry = res.data.find((m) => m.printingId === wantedOwnedId);
    expect(entry).toBeDefined();
    expect(entry!.wantedQuantity).toBe(2);
    expect(entry!.owners.map((o) => o.userId)).toContain(owner);
    expect(entry!.owners.find((o) => o.userId === owner)!.quantity).toBe(3);
  });

  it('excludes a card nobody at the store has for trade', async () => {
    await db.insert(wantsItems).values({ id: nanoid(21), userId: me, printingId: wantedUnownedId, quantity: 1 });

    const res = await service.getStoreWantMatches(storeId, me);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.find((m) => m.printingId === wantedUnownedId)).toBeUndefined();
  });

  it('excludes owners who do not follow the store', async () => {
    await db.insert(wantsItems).values({ id: nanoid(21), userId: me, printingId: wantedOwnedId, quantity: 1 });
    await giveForTrade(stranger, wantedOwnedId); // stranger does not follow

    const res = await service.getStoreWantMatches(storeId, me);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.find((m) => m.printingId === wantedOwnedId)).toBeUndefined();
  });

  it('excludes items not for trade or in non-matching binders', async () => {
    await db.insert(wantsItems).values({ id: nanoid(21), userId: me, printingId: wantedOwnedId, quantity: 1 });
    await giveForTrade(owner, wantedOwnedId, { forTrade: false }); // not for trade
    await giveForTrade(owner, wantedOwnedId, { allowInMatching: false }); // binder excluded

    const res = await service.getStoreWantMatches(storeId, me);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.find((m) => m.printingId === wantedOwnedId)).toBeUndefined();
  });
});
