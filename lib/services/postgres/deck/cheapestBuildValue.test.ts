/**
 * Integration test: `cheapestValue` on public deck summaries.
 *
 * `estimatedValue` prices the EXACT printings the deck lists (a cold-foil
 * Adaptive Plating counts as a cold-foil Adaptive Plating). "What would it cost
 * me to build this?" is a different question: the cheapest printing of each
 * card, whatever set/edition/foiling it comes from. Both sum tcg_low.
 *
 * Runs against the local Postgres DB. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, decks, deckCards } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let testUserId: string;
let testDeckId: string;
let deckName: string;

// A card with at least two priced printings whose cheapest is far below the
// dearest — the deck lists the dearest one.
let dearPrintingId: string;
let dearLow: number;
let cheapestLow: number;

const QUANTITY = 2;

beforeAll(async () => {
  const pick = await db.execute(sql`
    SELECT p.printing_id AS dear_id, p.tcg_low AS dear_low, m.min_low
    FROM printings p
    JOIN (
      SELECT card_unique_id, MIN(tcg_low) AS min_low, MAX(tcg_low) AS max_low
      FROM printings
      WHERE tcg_low > 0
      GROUP BY card_unique_id
      HAVING MIN(tcg_low) * 2 < MAX(tcg_low)
    ) m ON m.card_unique_id = p.card_unique_id AND p.tcg_low = m.max_low
    LIMIT 1`);
  if (!pick.rows.length) throw new Error('Need a card with divergent printing prices in DB');
  dearPrintingId = pick.rows[0].dear_id as string;
  dearLow = Number(pick.rows[0].dear_low);
  cheapestLow = Number(pick.rows[0].min_low);
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  testDeckId = crypto.randomUUID();
  deckName = `CheapestBuild ${testDeckId}`;

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  await db.insert(decks).values({
    id: testDeckId,
    publicId: `cb-${crypto.randomUUID().slice(0, 8)}`,
    userId: testUserId,
    name: deckName,
    // A format outside the plausible-card-count gate in listPublicDecks, so a
    // one-card fixture deck still shows up in the listing.
    format: 'Casual',
    visibility: 'public',
  });
  await db.insert(deckCards).values({
    id: crypto.randomUUID(),
    deckId: testDeckId,
    printingId: dearPrintingId,
    quantity: QUANTITY,
    category: 'maindeck',
  });
});

afterEach(async () => {
  // deckCards cascade with the deck, decks cascade with the user.
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('listPublicDecks cheapestValue', () => {
  it('prices every card at its cheapest printing, not the one the deck lists', async () => {
    const result = await service.listPublicDecks({ search: deckName });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const deck = result.data.decks.find(d => d._id === testDeckId);
    expect(deck, 'fixture deck missing from listPublicDecks').toBeTruthy();

    // The as-listed value still prices the exact printing.
    expect(deck!.estimatedValue).toBeCloseTo(dearLow * QUANTITY, 2);
    // The build cost drops to the cheapest printing of the same card.
    expect(deck!.cheapestValue).toBeCloseTo(cheapestLow * QUANTITY, 2);
    expect(deck!.cheapestValue!).toBeLessThan(deck!.estimatedValue!);
  });
});
