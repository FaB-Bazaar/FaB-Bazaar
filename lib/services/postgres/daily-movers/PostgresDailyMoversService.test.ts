/**
 * Integration tests for PostgresDailyMoversService.
 *
 * Runs against the real local PostgreSQL database. Requires POSTGRES_URL
 * in .env.local (loaded by vitest.setup.ts via loadEnvConfig).
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import {
  users,
  binders,
  inventoryItems,
  printings,
  decks,
  deckCards,
  dailyMovers,
} from '@/lib/postgres/schema';
import { PostgresDailyMoversService } from './PostgresDailyMoversService';

const service = new PostgresDailyMoversService();

// Use a unique-to-this-test as_of_date so we don't collide with real pipeline data.
const TEST_AS_OF = '2099-12-31';

let printingA: string;
let printingB: string;
let printingC: string;
let testUserId: string;
let binderId: string;
let extraUserIds: string[] = [];

beforeAll(async () => {
  const rows = await db
    .select({ printingId: printings.printingId })
    .from(printings)
    .limit(3);
  if (rows.length < 3) throw new Error('need at least 3 printings in DB to run these tests');
  printingA = rows[0].printingId;
  printingB = rows[1].printingId;
  printingC = rows[2].printingId;
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  binderId = crypto.randomUUID();

  await db.insert(users).values({ id: testUserId, username: `dm-test-${testUserId}` });
  await db.insert(binders).values({
    id: binderId,
    userId: testUserId,
    name: 'Daily Movers Test Binder',
  });
  await db.insert(inventoryItems).values({
    id: crypto.randomUUID(),
    userId: testUserId,
    binderId,
    printingId: printingA,
    quantity: 3,
    condition: 'NM',
    language: 'EN',
    forTrade: false,
    forSale: false,
  });

  // printingA — owned by user, gainer
  // printingB — NOT owned by user, decliner (must be excluded by service)
  await db.insert(dailyMovers).values([
    {
      asOfDate: TEST_AS_OF,
      signalType: 'top_gainer',
      printingId: printingA,
      pAtSignal: '12.50',
      refPrice: '10.00',
      dollarChange: '2.50',
      pctChange: '25.00',
      rankInSignal: 1,
    },
    {
      asOfDate: TEST_AS_OF,
      signalType: 'top_decliner',
      printingId: printingB,
      pAtSignal: '5.00',
      refPrice: '8.00',
      dollarChange: '-3.00',
      pctChange: '-37.50',
      rankInSignal: 1,
    },
  ]);
});

afterEach(async () => {
  // dailyMovers has no FK to users, so explicit cleanup needed.
  await db.delete(dailyMovers).where(eq(dailyMovers.asOfDate, TEST_AS_OF));
  await db.delete(users).where(eq(users.id, testUserId));
  for (const id of extraUserIds) {
    await db.delete(users).where(eq(users.id, id));
  }
  extraUserIds = [];
});

describe('PostgresDailyMoversService.getMoversInUserCollection', () => {
  it('returns only movers that intersect with the user inventory, grouped by signal type', async () => {
    const result = await service.getMoversInUserCollection(testUserId, TEST_AS_OF);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.asOfDate).toBe(TEST_AS_OF);
    expect(result.data.totalCount).toBe(1);

    // owned printing is the gainer
    expect(result.data.gainers).toHaveLength(1);
    expect(result.data.gainers[0].printingId).toBe(printingA);
    expect(result.data.gainers[0].signalType).toBe('top_gainer');
    expect(result.data.gainers[0].quantity).toBe(3);
    expect(result.data.gainers[0].binderId).toBe(binderId);
    expect(result.data.gainers[0].binderName).toBe('Daily Movers Test Binder');
    expect(result.data.gainers[0].pAtSignal).toBe(12.50);
    expect(result.data.gainers[0].dollarChange).toBe(2.50);

    // unowned printingB must NOT appear in any group
    expect(result.data.decliners).toHaveLength(0);
    expect(result.data.breakouts).toHaveLength(0);
    expect(result.data.steadyRisers).toHaveLength(0);
  });

  it('computes dollarImpact per row (dollarChange × quantity) and totalImpact', async () => {
    const result = await service.getMoversInUserCollection(testUserId, TEST_AS_OF);

    expect(result.success).toBe(true);
    if (!result.success) return;

    // gainer: +2.50 × 3 owned = +7.50
    expect(result.data.gainers[0].dollarImpact).toBe(7.5);
    expect(result.data.totalImpact).toBe(7.5);
  });

  it('does not double-count a printing appearing in two signals in totalImpact', async () => {
    // printingA also crosses its 30-day high the same day — same price move
    await db.insert(dailyMovers).values({
      asOfDate: TEST_AS_OF,
      signalType: 'breakout',
      printingId: printingA,
      pAtSignal: '12.50',
      refPrice: '10.00',
      dollarChange: '2.50',
      pctChange: '25.00',
      rankInSignal: 1,
    });

    const result = await service.getMoversInUserCollection(testUserId, TEST_AS_OF);

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Row appears in BOTH sections, each with its own dollarImpact…
    expect(result.data.gainers[0].dollarImpact).toBe(7.5);
    expect(result.data.breakouts[0].dollarImpact).toBe(7.5);
    // …but the physical copies moved only once.
    expect(result.data.totalImpact).toBe(7.5);
  });

  it('orders sections by absolute dollarImpact, not pipeline rank', async () => {
    // printingC: better pipeline rank (0) but smaller impact (+4.00 × 1 = 4.00
    // vs printingA's +2.50 × 3 = 7.50)
    await db.insert(inventoryItems).values({
      id: crypto.randomUUID(),
      userId: testUserId,
      binderId,
      printingId: printingC,
      quantity: 1,
      condition: 'NM',
      language: 'EN',
      forTrade: false,
      forSale: false,
    });
    await db.insert(dailyMovers).values({
      asOfDate: TEST_AS_OF,
      signalType: 'top_gainer',
      printingId: printingC,
      pAtSignal: '20.00',
      refPrice: '16.00',
      dollarChange: '4.00',
      pctChange: '25.00',
      rankInSignal: 0,
    });

    const result = await service.getMoversInUserCollection(testUserId, TEST_AS_OF);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.gainers.map((g) => g.printingId)).toEqual([printingA, printingC]);
    expect(result.data.totalImpact).toBe(11.5);
  });

  it('populates decks context from the user own non-system decks only', async () => {
    const otherUserId = crypto.randomUUID();
    extraUserIds.push(otherUserId);
    await db.insert(users).values({ id: otherUserId, username: `dm-test-${otherUserId}` });

    const myDeckId = crypto.randomUUID();
    const otherDeckId = crypto.randomUUID();
    const systemDeckId = crypto.randomUUID();
    await db.insert(decks).values([
      { id: myDeckId, publicId: crypto.randomUUID(), userId: testUserId, name: 'My Deck' },
      { id: otherDeckId, publicId: crypto.randomUUID(), userId: otherUserId, name: 'Not My Deck' },
      { id: systemDeckId, publicId: crypto.randomUUID(), userId: testUserId, name: 'System Deck', isSystemDeck: true },
    ]);
    // Two categories in my deck → deck must still appear exactly once
    await db.insert(deckCards).values([
      { id: crypto.randomUUID(), deckId: myDeckId, printingId: printingA, quantity: 3, category: 'maindeck' },
      { id: crypto.randomUUID(), deckId: myDeckId, printingId: printingA, quantity: 1, category: 'inventory' },
      { id: crypto.randomUUID(), deckId: otherDeckId, printingId: printingA, quantity: 3, category: 'maindeck' },
      { id: crypto.randomUUID(), deckId: systemDeckId, printingId: printingA, quantity: 3, category: 'maindeck' },
    ]);

    const result = await service.getMoversInUserCollection(testUserId, TEST_AS_OF);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.gainers[0].decks).toHaveLength(1);
    expect(result.data.gainers[0].decks[0].deckId).toBe(myDeckId);
    expect(result.data.gainers[0].decks[0].deckName).toBe('My Deck');
    expect(result.data.gainers[0].decks[0].publicId).toBeTruthy();
  });
});

describe('PostgresDailyMoversService.getMarketMovers', () => {
  it('returns ALL movers for the date grouped by signal, regardless of ownership', async () => {
    const result = await service.getMarketMovers(TEST_AS_OF);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.asOfDate).toBe(TEST_AS_OF);
    expect(result.data.totalCount).toBe(2);

    expect(result.data.gainers).toHaveLength(1);
    expect(result.data.gainers[0].printingId).toBe(printingA);
    expect(result.data.gainers[0].pAtSignal).toBe(12.5);
    expect(result.data.gainers[0].displayName).toBeTruthy();

    // unowned printingB IS present in the market view
    expect(result.data.decliners).toHaveLength(1);
    expect(result.data.decliners[0].printingId).toBe(printingB);
    expect(result.data.decliners[0].dollarChange).toBe(-3);
  });

  it('orders a market section by pipeline rank', async () => {
    await db.insert(dailyMovers).values({
      asOfDate: TEST_AS_OF,
      signalType: 'top_gainer',
      printingId: printingC,
      pAtSignal: '20.00',
      refPrice: '16.00',
      dollarChange: '4.00',
      pctChange: '25.00',
      rankInSignal: 0,
    });

    const result = await service.getMarketMovers(TEST_AS_OF);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.gainers.map((g) => g.printingId)).toEqual([printingC, printingA]);
  });
});
