/**
 * Integration test for the concurrency safety of deck-card insertion.
 *
 * The naive "SELECT existing row → INSERT or UPDATE" pattern that
 * PostgresDeckService.addPrintings used races on the unique constraint
 * `(deck_id, printing_id, category)`. Two parallel calls (e.g. a quick
 * double-tap of the mobile `+` button, or a Discord bot adding alongside
 * a web-tab user) can both miss the existence check and both attempt INSERT;
 * the second hits the constraint, throws, and the route bubbles a 400 to the
 * client.
 *
 * The fix is `INSERT … ON CONFLICT (deck_id, printing_id, category) DO UPDATE
 * SET quantity = deck_cards.quantity + EXCLUDED.quantity`, which is atomic.
 *
 * Tests:
 *   1) (RED on naive pattern) Two parallel naive SELECT-INSERT inserts
 *      throw a duplicate-key error.
 *   2) The upsert pattern handles the same scenario without throwing and
 *      leaves quantity = 2.
 *   3) Two concurrent addPrintings calls produce no top-level failures
 *      and a single row.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { users, decks, cards, printings, deckCards } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let testUserId: string;
let testDeckPublicId: string;
let testDeckId: string;
let aetherQuickeningPrintingId: string;

beforeAll(async () => {
  const aq = await db
    .select({ id: printings.printingId })
    .from(printings)
    .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
    .where(eq(cards.name, 'aether quickening'))
    .limit(1);
  if (!aq[0]) throw new Error('Need Aether Quickening in DB');
  aetherQuickeningPrintingId = aq[0].id;
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });

  testDeckId = nanoid(21);
  testDeckPublicId = nanoid(21);
  await db.insert(decks).values({
    id: testDeckId,
    publicId: testDeckPublicId,
    userId: testUserId,
    name: `Race Test ${testDeckPublicId}`,
    slug: `slug-${testDeckPublicId}`,
    format: 'Silver Age',
    heroName: 'kano',
    visibility: 'private',
  });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('deck_cards concurrency safety', () => {
  it('the naive SELECT-then-INSERT pattern races on the unique constraint', async () => {
    // Replicates the pre-fix code path inside addPrintings. With both selects
    // returning [] before either insert commits, the second insert violates
    // unique_deck_cards_deck_printing_category.
    const naiveAdd = async () => {
      const existing = await db
        .select()
        .from(deckCards)
        .where(
          and(
            eq(deckCards.deckId, testDeckId),
            eq(deckCards.printingId, aetherQuickeningPrintingId),
            eq(deckCards.category, 'maindeck'),
          ),
        )
        .limit(1);

      // Hold both calls in the gap between SELECT and INSERT so both observe
      // the empty existence check. This is what HTTP/network latency does in
      // production; we simulate it deterministically here.
      await new Promise(r => setTimeout(r, 50));

      if (existing.length > 0) {
        await db
          .update(deckCards)
          .set({ quantity: sql`${deckCards.quantity} + 1` })
          .where(eq(deckCards.id, existing[0].id));
      } else {
        await db.insert(deckCards).values({
          id: nanoid(21),
          deckId: testDeckId,
          printingId: aetherQuickeningPrintingId,
          quantity: 1,
          category: 'maindeck',
          addedAt: new Date(),
          notes: '',
        });
      }
    };

    await expect(Promise.all([naiveAdd(), naiveAdd()])).rejects.toThrow(
      /insert into "deck_cards"/i,
    );
  });

  it('the upsert pattern handles the same race without throwing (qty becomes 2)', async () => {
    const upsertAdd = async () => {
      await db
        .insert(deckCards)
        .values({
          id: nanoid(21),
          deckId: testDeckId,
          printingId: aetherQuickeningPrintingId,
          quantity: 1,
          category: 'maindeck',
          addedAt: new Date(),
          notes: '',
        })
        .onConflictDoUpdate({
          target: [deckCards.deckId, deckCards.printingId, deckCards.category],
          set: { quantity: sql`${deckCards.quantity} + 1` },
        });
    };

    await Promise.all([upsertAdd(), upsertAdd()]);

    const rows = await db
      .select()
      .from(deckCards)
      .where(eq(deckCards.deckId, testDeckId));

    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(2);
  });

  it('addPrintings parallel calls produce no top-level failures and a single row', async () => {
    // Once addPrintings uses the upsert pattern, even if the existence check
    // races and both branches would have INSERTed, no call returns success:false.
    const printing = {
      printingId: aetherQuickeningPrintingId,
      quantity: 1,
      category: 'maindeck' as const,
    };

    const results = await Promise.all([
      service.addPrintings(testDeckPublicId, testUserId, [printing]),
      service.addPrintings(testDeckPublicId, testUserId, [printing]),
    ]);

    const topLevelFailures = results.filter(r => !r.success);
    expect(topLevelFailures, JSON.stringify(topLevelFailures, null, 2)).toHaveLength(0);

    const rows = await db
      .select()
      .from(deckCards)
      .where(eq(deckCards.deckId, testDeckId));
    expect(rows).toHaveLength(1);
  });
});
