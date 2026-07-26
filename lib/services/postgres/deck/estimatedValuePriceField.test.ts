/**
 * Integration test: deck `estimatedValue` must be summed from tcg_low, not
 * tcg_market.
 *
 * The rest of the app settled on TCG Low as the canonical displayed price
 * (search grid, printing detail page, binder totals, trade estimates). The deck
 * aggregates were still summing tcg_market, so /decks/[id]/analyze showed a
 * market-based "~$X" header directly above a low-based most-expensive-cards
 * list, and /decks totals disagreed with every other surface.
 *
 * Runs against the local Postgres DB. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq, and, gt, sql } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, decks, deckCards, printings } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let testUserId: string;
let testDeckId: string;

// A printing whose low and market diverge enough that summing the wrong column
// produces a clearly different total.
let printingId: string;
let low: number;
let market: number;

const QUANTITY = 3;

beforeAll(async () => {
  const [row] = await db
    .select({
      printingId: printings.printingId,
      tcgLow: printings.tcgLow,
      tcgMarket: printings.tcgMarket,
    })
    .from(printings)
    .where(
      and(
        gt(printings.tcgLow, 0),
        gt(printings.tcgMarket, 0),
        // require a real gap so the assertion discriminates between the columns
        sql`abs(${printings.tcgLow} - ${printings.tcgMarket}) > 1`
      )
    )
    .limit(1);

  expect(row, 'no printing with divergent tcg_low/tcg_market to test against').toBeTruthy();
  printingId = row.printingId;
  low = Number(row.tcgLow);
  market = Number(row.tcgMarket);
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  testDeckId = crypto.randomUUID();

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  await db.insert(decks).values({
    id: testDeckId,
    publicId: `ev-${crypto.randomUUID().slice(0, 8)}`,
    userId: testUserId,
    name: `EstValue ${testDeckId}`,
  });
  await db.insert(deckCards).values({
    id: crypto.randomUUID(),
    deckId: testDeckId,
    printingId,
    quantity: QUANTITY,
    category: 'maindeck',
  });
});

afterEach(async () => {
  // deckCards cascade with the deck, decks cascade with the user.
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('deck estimatedValue price field', () => {
  it('findById sums tcg_low, not tcg_market', async () => {
    const result = await service.findById(testDeckId, testUserId);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data, 'test deck not found by id').toBeTruthy();
    expect(result.data!.estimatedValue).toBeCloseTo(low * QUANTITY, 2);
    expect(result.data!.estimatedValue).not.toBeCloseTo(market * QUANTITY, 2);
  });

  it('listUserDecks sums tcg_low, not tcg_market', async () => {
    const result = await service.listUserDecks(testUserId);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const deck = result.data.decks.find(d => d._id === testDeckId);
    expect(deck, 'test deck missing from listUserDecks').toBeTruthy();
    expect(deck!.estimatedValue).toBeCloseTo(low * QUANTITY, 2);
    expect(deck!.estimatedValue).not.toBeCloseTo(market * QUANTITY, 2);
  });
});
