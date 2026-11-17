/**
 * Integration tests for PostgresBinderService.getWantedItemsInBinder — the
 * binder page's "Add my wants" button. Returns the binder's for-trade items the
 * viewer wants, each with the quantity to request: min(wanted, in binder).
 * exact = same printing; loose = any printing of the same card.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { users, binders, inventoryItems, wantsItems, printings } from '@/lib/postgres/schema';
import { PostgresBinderService } from './PostgresBinderService';

const service = new PostgresBinderService();

let p1: string; // card A, printing 1
let p2: string; // card A, printing 2
let q1: string; // card B
const testPrintingIds: string[] = [];

let owner: string;
let viewer: string;
let binderId: string;

beforeAll(async () => {
  const cardsRows = await db
    .selectDistinct({ cardUniqueId: printings.cardUniqueId })
    .from(printings)
    .limit(2);
  if (cardsRows.length < 2) throw new Error('Need ≥2 cards in DB');
  const mk = async (cardUniqueId: string, tcgLow: number) => {
    const id = nanoid(21);
    await db.insert(printings).values({
      printingId: id, cardUniqueId, set: 'tst', edition: 'N', foiling: 'S', rarity: 'C', tcgLow,
      lssPrintId: `test-${id}`, // provisional, so anchor-columns.test never counts it as an orphan
    });
    testPrintingIds.push(id);
    return id;
  };
  p1 = await mk(cardsRows[0].cardUniqueId, 1);
  p2 = await mk(cardsRows[0].cardUniqueId, 2);
  q1 = await mk(cardsRows[1].cardUniqueId, 3);
});

afterAll(async () => {
  await db.delete(printings).where(inArray(printings.printingId, testPrintingIds));
});

beforeEach(async () => {
  owner = crypto.randomUUID();
  viewer = crypto.randomUUID();
  binderId = nanoid(21);
  await db.insert(users).values([
    { id: owner, username: `test-${owner}` },
    { id: viewer, username: `test-${viewer}` },
  ]);
  await db.insert(binders).values({ id: binderId, userId: owner, name: `Binder ${binderId}` });
});

afterEach(async () => {
  await db.delete(users).where(inArray(users.id, [owner, viewer]));
});

const stock = (printingId: string, quantity: number, forTrade = true) =>
  db.insert(inventoryItems).values({ id: nanoid(21), userId: owner, binderId, printingId, quantity, forTrade });
const want = (printingId: string, quantity: number) =>
  db.insert(wantsItems).values({ id: nanoid(21), userId: viewer, printingId, quantity });

async function wanted(mode: 'exact' | 'loose') {
  const res = await service.getWantedItemsInBinder(binderId, viewer, mode);
  expect(res.success).toBe(true);
  if (!res.success) throw new Error(res.error);
  return res.data.map((c) => [c.printingId, c.requestQuantity]);
}

describe('PostgresBinderService.getWantedItemsInBinder', () => {
  it('exact: requests the wanted quantity of the same printing only', async () => {
    await stock(p1, 4);
    await stock(p2, 3);
    await want(p1, 2);
    expect(await wanted('exact')).toEqual([[p1, 2]]);
  });

  it('caps the request at what the binder has', async () => {
    await stock(p1, 1);
    await want(p1, 5);
    expect(await wanted('exact')).toEqual([[p1, 1]]);
  });

  it('loose: a want for one printing matches another printing of the same card', async () => {
    await stock(p2, 3);
    await stock(q1, 3);
    await want(p1, 2);
    expect(await wanted('loose')).toEqual([[p2, 2]]);
  });

  it('loose: wanted quantities of one card are summed across printings', async () => {
    await stock(p1, 5);
    await want(p1, 1);
    await want(p2, 2);
    expect(await wanted('loose')).toEqual([[p1, 3]]);
  });

  it('skips items the owner has not marked for trade', async () => {
    await stock(p1, 2, false);
    await want(p1, 1);
    expect(await wanted('exact')).toEqual([]);
  });

  it('returns nothing when the viewer has no wants', async () => {
    await stock(p1, 2);
    expect(await wanted('loose')).toEqual([]);
  });
});
