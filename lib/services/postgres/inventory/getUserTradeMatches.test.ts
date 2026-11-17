/**
 * Integration tests for PostgresInventoryService.getUserTradeMatches — the
 * 1:1 trade view behind Discord /trade and /profile/[username]/trade.
 * Tradeable = forTrade item in a binder with allowInMatching (same rule as
 * store matching). Quantities = min(wanted, for trade).
 * exact = same printing; loose = any printing of the same card.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { users, binders, inventoryItems, wantsItems, printings } from '@/lib/postgres/schema';
import { PostgresInventoryService } from './PostgresInventoryService';

const service = new PostgresInventoryService();

let p1: string; // card A
let p2: string; // card A, other printing
let q1: string; // card B
const testPrintingIds: string[] = [];

let me: string;
let them: string;

beforeAll(async () => {
  const cardsRows = await db.selectDistinct({ cardUniqueId: printings.cardUniqueId }).from(printings).limit(2);
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
  me = crypto.randomUUID();
  them = crypto.randomUUID();
  await db.insert(users).values([
    { id: me, username: `test-${me}` },
    { id: them, username: `test-${them}` },
  ]);
});

afterEach(async () => {
  await db.delete(users).where(inArray(users.id, [me, them]));
});

async function binder(
  userId: string,
  opts: { allowInMatching?: boolean; visibilityLevel?: 'public' | 'private' | 'unlisted' } = {}
) {
  const id = nanoid(21);
  await db.insert(binders).values({
    id, userId, name: `B ${id}`,
    allowInMatching: opts.allowInMatching ?? true,
    visibilityLevel: opts.visibilityLevel ?? 'public',
    isPublic: (opts.visibilityLevel ?? 'public') !== 'private',
  });
  return id;
}
const stock = (userId: string, binderId: string, printingId: string, quantity: number, forTrade = true) =>
  db.insert(inventoryItems).values({ id: nanoid(21), userId, binderId, printingId, quantity, forTrade });
const want = (userId: string, printingId: string, quantity: number) =>
  db.insert(wantsItems).values({ id: nanoid(21), userId, printingId, quantity });

async function matches(mode: 'exact' | 'loose') {
  const res = await service.getUserTradeMatches(me, them, mode);
  expect(res.success).toBe(true);
  if (!res.success) throw new Error(res.error);
  return res.data;
}
const pairs = (rows: Array<{ printingId: string; quantity: number }>) => rows.map((r) => [r.printingId, r.quantity]);

describe('PostgresInventoryService.getUserTradeMatches', () => {
  it('exact: they have what I want, capped at what I want', async () => {
    const b = await binder(them);
    await stock(them, b, p1, 3);
    await stock(them, b, p2, 3);
    await want(me, p1, 2);
    const data = await matches('exact');
    expect(pairs(data.theyHaveYouWant)).toEqual([[p1, 2]]);
    expect(data.theyHaveYouWant[0]).toMatchObject({ binderId: b, binderViewable: true });
    expect(data.theyWantYouHave).toEqual([]);
  });

  it('loose: any printing of a wanted card counts, wants summed per card', async () => {
    const b = await binder(them);
    await stock(them, b, p2, 5);
    await want(me, p1, 1);
    await want(me, p2, 1);
    expect(pairs((await matches('loose')).theyHaveYouWant)).toEqual([[p2, 2]]);
  });

  it('they want what I have, capped at what I have for trade', async () => {
    const mine = await binder(me);
    await stock(me, mine, q1, 1);
    await want(them, q1, 3);
    expect(pairs((await matches('exact')).theyWantYouHave)).toEqual([[q1, 1]]);
  });

  it('ignores items not for trade and binders excluded from matching', async () => {
    const open = await binder(them);
    const hidden = await binder(them, { allowInMatching: false });
    await stock(them, open, p1, 2, false);
    await stock(them, hidden, p1, 2);
    await want(me, p1, 1);
    expect((await matches('exact')).theyHaveYouWant).toEqual([]);
  });

  it('flags a private binder so the page does not link to it', async () => {
    const b = await binder(them, { visibilityLevel: 'private' });
    await stock(them, b, p1, 1);
    await want(me, p1, 1);
    expect((await matches('exact')).theyHaveYouWant[0]).toMatchObject({ binderViewable: false });
  });
});
