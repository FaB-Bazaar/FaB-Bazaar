/**
 * Integration tests for PostgresInventoryService.getStoreTradeMatches.
 * Trader-first store matching: mutual matches rank first, then matches are
 * ordered by total matched tcg_low VALUE (not card count) — at an event the
 * person holding one $60 card you want beats someone with two bulk commons.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import {
  users, binders, inventoryItems, wantsItems, locations, userFollowedStores, printings,
} from '@/lib/postgres/schema';
import { PostgresInventoryService } from './PostgresInventoryService';

const service = new PostgresInventoryService();

// Hermetic printings with controlled prices (FK'd to a real card_unique_id)
let cheapA: string;   // $0.25
let cheapB: string;   // $0.75
let pricey: string;   // $60
let mutualCard: string; // $1
const testPrintingIds: string[] = [];

let me: string;
let bulkTrader: string;   // one-way: has 2 cheap cards I want (total $1.00)
let whaleTrader: string;  // one-way: has 1 pricey card I want (total $60)
let mutualTrader: string; // mutual: has 1 cheap card I want, wants 1 card I have
let storeId: string;

beforeAll(async () => {
  const [card] = await db.select({ cardUniqueId: printings.cardUniqueId }).from(printings).limit(1);
  if (!card) throw new Error('Need ≥1 printing in DB');

  const mk = async (tcgLow: number) => {
    const id = nanoid(21);
    await db.insert(printings).values({
      printingId: id,
      cardUniqueId: card.cardUniqueId,
      set: 'tst',
      edition: 'N',
      foiling: 'S',
      rarity: 'C',
      tcgLow,
    });
    testPrintingIds.push(id);
    return id;
  };
  cheapA = await mk(0.25);
  cheapB = await mk(0.75);
  pricey = await mk(60);
  mutualCard = await mk(1);
});

afterAll(async () => {
  await db.delete(printings).where(inArray(printings.printingId, testPrintingIds));
});

async function makeUser(): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(users).values({ id, username: `test-${id}` });
  return id;
}

async function giveForTrade(userId: string, printingId: string, quantity = 1) {
  const binderId = nanoid(21);
  await db.insert(binders).values({
    id: binderId, userId, name: `Trade binder ${binderId}`, allowInMatching: true,
  });
  await db.insert(inventoryItems).values({
    id: nanoid(21), userId, binderId, printingId, quantity, forTrade: true,
  });
}

const want = (userId: string, printingId: string, quantity = 1) =>
  db.insert(wantsItems).values({ id: nanoid(21), userId, printingId, quantity });

beforeEach(async () => {
  me = await makeUser();
  bulkTrader = await makeUser();
  whaleTrader = await makeUser();
  mutualTrader = await makeUser();

  storeId = nanoid(21);
  await db.insert(locations).values({
    id: storeId, category: 'store', name: 'Test Store',
    addressLine1: '1 St', addressCity: 'Town', addressCountry: 'US',
  });
  await db.insert(userFollowedStores).values(
    [me, bulkTrader, whaleTrader, mutualTrader].map((userId) => ({ userId, locationId: storeId }))
  );
});

afterEach(async () => {
  await db.delete(users).where(inArray(users.id, [me, bulkTrader, whaleTrader, mutualTrader]));
  await db.delete(locations).where(eq(locations.id, storeId));
});

describe('PostgresInventoryService.getStoreTradeMatches', () => {
  it('includes tcgLow on matched cards', async () => {
    await want(me, pricey);
    await giveForTrade(whaleTrader, pricey);

    const res = await service.getStoreTradeMatches(storeId, me);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const match = res.data.find((m) => m.userId === whaleTrader);
    expect(match).toBeDefined();
    expect(match!.theyHaveYouWant[0].tcgLow).toBe(60);
  });

  it('ranks one-way matches by total matched tcg_low value, not card count', async () => {
    // bulkTrader: 2 distinct cheap printings I want → 2 cards, $1.00 total
    await want(me, cheapA);
    await want(me, cheapB);
    await giveForTrade(bulkTrader, cheapA);
    await giveForTrade(bulkTrader, cheapB);
    // whaleTrader: 1 pricey printing I want → 1 card, $60 total
    await want(me, pricey);
    await giveForTrade(whaleTrader, pricey);

    const res = await service.getStoreTradeMatches(storeId, me);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const order = res.data.map((m) => m.userId);
    expect(order.indexOf(whaleTrader)).toBeLessThan(order.indexOf(bulkTrader));
  });

  it('still ranks mutual matches above higher-value one-way matches', async () => {
    // mutualTrader: has 1 cheap card I want AND wants 1 card I have ($1 + $0.25)
    await want(me, cheapA);
    await giveForTrade(mutualTrader, cheapA);
    await giveForTrade(me, mutualCard);
    await want(mutualTrader, mutualCard);
    // whaleTrader: one-way $60
    await want(me, pricey);
    await giveForTrade(whaleTrader, pricey);

    const res = await service.getStoreTradeMatches(storeId, me);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const order = res.data.map((m) => m.userId);
    expect(order.indexOf(mutualTrader)).toBeLessThan(order.indexOf(whaleTrader));
  });

  it('weights value by wanted quantity', async () => {
    // bulkTrader: 1 printing, I want ×3 of it at $0.75 → $2.25 total
    await want(me, cheapB, 3);
    await giveForTrade(bulkTrader, cheapB, 3);
    // whaleTrader: 1 printing, I want ×1 at $0.25 → $0.25 total... use cheapA
    await want(me, cheapA, 1);
    await giveForTrade(whaleTrader, cheapA);

    const res = await service.getStoreTradeMatches(storeId, me);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const order = res.data.map((m) => m.userId);
    expect(order.indexOf(bulkTrader)).toBeLessThan(order.indexOf(whaleTrader));
  });
});
