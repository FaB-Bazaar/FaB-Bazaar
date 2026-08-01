/**
 * Integration tests for PostgresDeckService card deck-usage lookups:
 *
 *  - getCardDeckUsageSummary(userId, cardUniqueIds[]) — per-card aggregate for
 *    binder tiles: how many of MY decks use this card, the max quantity any
 *    single deck needs (you play one deck at a time — coverage is max, not sum),
 *    and how many copies I own across ALL my binders (any printing).
 *  - getCardDeckUsage(userId, cardUniqueId) — the on-demand per-deck list for
 *    the popover: deck name/publicId/hero/format + quantity.
 *
 * Both match at the card level (card_unique_id): a deck listing a different
 * printing of the same card still counts. System decks and other users' decks
 * never count. Scratch categories (inventory/benched/tokens) never count.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, binders, inventoryItems, printings, decks, deckCards } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let cardUniqueId: string;
let printingA: string; // one printing of the card
let printingB: string; // a DIFFERENT printing of the same card
let otherCardUniqueId: string; // a card the user owns but no deck uses
let otherPrinting: string;

let testUserId: string;
let otherUserId: string;
let binder1Id: string;
let binder2Id: string;

async function makeDeck(userId: string, name: string, opts?: { isSystemDeck?: boolean; heroName?: string; format?: string }) {
  const id = crypto.randomUUID();
  const publicId = `t-${crypto.randomUUID().slice(0, 12)}`;
  await db.insert(decks).values({
    id,
    publicId,
    userId,
    name,
    isSystemDeck: opts?.isSystemDeck ?? false,
    heroName: opts?.heroName,
    format: opts?.format,
  });
  return { id, publicId };
}

beforeAll(async () => {
  // Two distinct cards, the first with 2+ printings so card-level matching is provable.
  const grp = await db
    .select({ cuid: printings.cardUniqueId })
    .from(printings)
    .groupBy(printings.cardUniqueId)
    .having(sql`count(*) >= 2`)
    .orderBy(sql`${printings.cardUniqueId} asc`)
    .limit(2);
  if (grp.length < 2) throw new Error('Need 2 cards with 2+ printings in DB');

  const psA = await db
    .select({ printingId: printings.printingId })
    .from(printings)
    .where(eq(printings.cardUniqueId, grp[0].cuid!))
    .limit(2);
  cardUniqueId = grp[0].cuid!;
  printingA = psA[0].printingId;
  printingB = psA[1].printingId;

  const psB = await db
    .select({ printingId: printings.printingId })
    .from(printings)
    .where(eq(printings.cardUniqueId, grp[1].cuid!))
    .limit(1);
  otherCardUniqueId = grp[1].cuid!;
  otherPrinting = psB[0].printingId;
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  otherUserId = crypto.randomUUID();
  binder1Id = crypto.randomUUID();
  binder2Id = crypto.randomUUID();

  await db.insert(users).values([
    { id: testUserId, username: `test-${testUserId}` },
    { id: otherUserId, username: `test-${otherUserId}` },
  ]);
  await db.insert(binders).values([
    { id: binder1Id, userId: testUserId, name: `B1-${binder1Id}` },
    { id: binder2Id, userId: testUserId, name: `B2-${binder2Id}` },
  ]);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
  await db.delete(users).where(eq(users.id, otherUserId));
});

describe('getCardDeckUsageSummary', () => {
  it('aggregates deck count, MAX single-deck quantity, and owned copies across all binders', async () => {
    const d1 = await makeDeck(testUserId, 'Deck One');
    const d2 = await makeDeck(testUserId, 'Deck Two');
    const d3 = await makeDeck(testUserId, 'Deck Three');
    await db.insert(deckCards).values([
      { id: crypto.randomUUID(), deckId: d1.id, printingId: printingA, quantity: 3, category: 'maindeck' },
      { id: crypto.randomUUID(), deckId: d2.id, printingId: printingA, quantity: 2, category: 'maindeck' },
      { id: crypto.randomUUID(), deckId: d3.id, printingId: printingA, quantity: 3, category: 'maindeck' },
    ]);
    // Owned: 2 copies in binder1 + 1 copy (different printing) in binder2 = 3 total.
    await db.insert(inventoryItems).values([
      { id: crypto.randomUUID(), userId: testUserId, binderId: binder1Id, printingId: printingA, quantity: 2 },
      { id: crypto.randomUUID(), userId: testUserId, binderId: binder2Id, printingId: printingB, quantity: 1 },
    ]);

    const res = await service.getCardDeckUsageSummary(testUserId, [cardUniqueId, otherCardUniqueId]);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const summary = res.data[cardUniqueId];
    expect(summary).toBeTruthy();
    expect(summary.deckCount).toBe(3);
    expect(summary.maxDeckQuantity).toBe(3); // max per deck, NOT the sum (8)
    expect(summary.ownedQuantity).toBe(3); // across both binders, both printings

    // Card used by no deck → absent from the map entirely.
    expect(res.data[otherCardUniqueId]).toBeUndefined();
  });

  it('counts a deck listing a DIFFERENT printing of the same card (card-level match)', async () => {
    const d1 = await makeDeck(testUserId, 'Other-Printing Deck');
    await db.insert(deckCards).values({
      id: crypto.randomUUID(), deckId: d1.id, printingId: printingB, quantity: 2, category: 'maindeck',
    });

    const res = await service.getCardDeckUsageSummary(testUserId, [cardUniqueId]);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data[cardUniqueId]?.deckCount).toBe(1);
    expect(res.data[cardUniqueId]?.maxDeckQuantity).toBe(2);
  });

  it('sums quantities across printings/categories WITHIN one deck for its max', async () => {
    const d1 = await makeDeck(testUserId, 'Split-Printing Deck');
    await db.insert(deckCards).values([
      { id: crypto.randomUUID(), deckId: d1.id, printingId: printingA, quantity: 2, category: 'maindeck' },
      { id: crypto.randomUUID(), deckId: d1.id, printingId: printingB, quantity: 1, category: 'maindeck' },
    ]);

    const res = await service.getCardDeckUsageSummary(testUserId, [cardUniqueId]);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data[cardUniqueId]?.deckCount).toBe(1);
    expect(res.data[cardUniqueId]?.maxDeckQuantity).toBe(3); // 2 + 1 in the same deck
  });

  it('ignores system decks, other users\' decks, and scratch categories', async () => {
    // System deck owned by the user (Decks to Beat pattern).
    const sys = await makeDeck(testUserId, 'System Deck', { isSystemDeck: true });
    await db.insert(deckCards).values({
      id: crypto.randomUUID(), deckId: sys.id, printingId: printingA, quantity: 3, category: 'maindeck',
    });
    // Another user's deck.
    const theirs = await makeDeck(otherUserId, 'Their Deck');
    await db.insert(deckCards).values({
      id: crypto.randomUUID(), deckId: theirs.id, printingId: printingA, quantity: 3, category: 'maindeck',
    });
    // User's real deck, but the card only sits in scratch categories.
    const scratch = await makeDeck(testUserId, 'Scratch Deck');
    await db.insert(deckCards).values([
      { id: crypto.randomUUID(), deckId: scratch.id, printingId: printingA, quantity: 3, category: 'inventory' },
      { id: crypto.randomUUID(), deckId: scratch.id, printingId: printingA, quantity: 2, category: 'benched' },
    ]);

    const res = await service.getCardDeckUsageSummary(testUserId, [cardUniqueId]);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data[cardUniqueId]).toBeUndefined();
  });

  it('returns an empty map for an empty id list', async () => {
    const res = await service.getCardDeckUsageSummary(testUserId, []);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toEqual({});
  });
});

describe('getCardDeckUsage', () => {
  it('lists the user\'s decks using the card with per-deck quantity, highest first', async () => {
    const d1 = await makeDeck(testUserId, 'Alpha', { heroName: 'Kayo, Armed and Dangerous', format: 'Blitz' });
    const d2 = await makeDeck(testUserId, 'Bravo');
    await db.insert(deckCards).values([
      { id: crypto.randomUUID(), deckId: d1.id, printingId: printingA, quantity: 2, category: 'maindeck' },
      // d2 uses a different printing AND splits across two rows: 3 total.
      { id: crypto.randomUUID(), deckId: d2.id, printingId: printingB, quantity: 2, category: 'maindeck' },
      { id: crypto.randomUUID(), deckId: d2.id, printingId: printingA, quantity: 1, category: 'equipment' },
    ]);

    const res = await service.getCardDeckUsage(testUserId, cardUniqueId);
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.length).toBe(2);
    expect(res.data[0]).toMatchObject({ publicId: d2.publicId, name: 'Bravo', quantity: 3 });
    expect(res.data[1]).toMatchObject({
      publicId: d1.publicId,
      name: 'Alpha',
      quantity: 2,
      heroName: 'Kayo, Armed and Dangerous',
      format: 'Blitz',
    });
  });

  it('excludes system decks and other users\' decks', async () => {
    const sys = await makeDeck(testUserId, 'System Deck', { isSystemDeck: true });
    const theirs = await makeDeck(otherUserId, 'Their Deck');
    await db.insert(deckCards).values([
      { id: crypto.randomUUID(), deckId: sys.id, printingId: printingA, quantity: 3, category: 'maindeck' },
      { id: crypto.randomUUID(), deckId: theirs.id, printingId: printingA, quantity: 3, category: 'maindeck' },
    ]);

    const res = await service.getCardDeckUsage(testUserId, cardUniqueId);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toEqual([]);
  });
});
