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
let testUserId: string;
let binderId: string;

beforeAll(async () => {
  const rows = await db
    .select({ printingId: printings.printingId })
    .from(printings)
    .limit(2);
  if (rows.length < 2) throw new Error('need at least 2 printings in DB to run these tests');
  printingA = rows[0].printingId;
  printingB = rows[1].printingId;
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
});
