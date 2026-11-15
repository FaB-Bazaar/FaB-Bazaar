/**
 * Integration test: listPublicDecks' total must respect the same plausible-
 * card-count gate as the rows query. A CC deck with an implausible count is
 * hidden from the listing — counting it anyway produced "1 deck found" over
 * an empty "No public decks found" state on the Community page.
 *
 * Runs against the local Postgres DB. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, decks, deckCards, cards, printings } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let testUserId: string;
let emptyCcDeckId: string;
let validCcDeckId: string;
let tokensCcDeckId: string;
// Separate search token so this deck stays out of the count test above.
const sideToken = `zzgateside${crypto.randomUUID().slice(0, 8)}`;
const token = `zzcountgate${crypto.randomUUID().slice(0, 8)}`;
const cardId = `${token}-card`;
const printingId = `${token}-pr`;

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  emptyCcDeckId = crypto.randomUUID();
  validCcDeckId = crypto.randomUUID();
  tokensCcDeckId = crypto.randomUUID();

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  await db.insert(decks).values([
    // 0 cards in Classic Constructed — outside the 60-80 plausibility window,
    // so the listing's HAVING gate hides it. The count must hide it too.
    {
      id: emptyCcDeckId, publicId: `em-${crypto.randomUUID().slice(0, 8)}`, userId: testUserId,
      name: `${token} empty cc`, visibility: 'public', format: 'Classic Constructed',
    },
    {
      id: validCcDeckId, publicId: `va-${crypto.randomUUID().slice(0, 8)}`, userId: testUserId,
      name: `${token} valid cc`, visibility: 'public', format: 'Classic Constructed',
    },
  ]);
  // Give the valid deck a plausible 60-card maindeck (one row, quantity 60).
  await db.insert(cards).values({ cardUniqueId: cardId, name: `${token} filler`, displayName: `${token} filler` });
  await db.insert(printings).values({ printingId, cardUniqueId: cardId, set: 'wtr', edition: 'n', foiling: 's', rarity: 'c' });
  await db.insert(deckCards).values({ id: `${token}-dc`, deckId: validCcDeckId, printingId, category: 'maindeck', quantity: 60 });
  // A full 80-card CC deck (72 maindeck + 8 equipment) that also carries
  // tokens and a maybe-pile — neither is part of the playable deck.
  await db.insert(decks).values({
    id: tokensCcDeckId, publicId: `tk-${crypto.randomUUID().slice(0, 8)}`, userId: testUserId,
    name: `${sideToken} full cc with tokens`, visibility: 'public', format: 'Classic Constructed',
  });
  await db.insert(deckCards).values([
    { id: `${token}-t-main`, deckId: tokensCcDeckId, printingId, category: 'maindeck', quantity: 72 },
    { id: `${token}-t-eq`, deckId: tokensCcDeckId, printingId, category: 'equipment', quantity: 8 },
    { id: `${token}-t-tok`, deckId: tokensCcDeckId, printingId, category: 'tokens', quantity: 6 },
    { id: `${token}-t-bench`, deckId: tokensCcDeckId, printingId, category: 'benched', quantity: 4 },
  ]);
});

afterEach(async () => {
  // users cascades decks → deck_cards; printings must go before cards (FK).
  await db.delete(users).where(eq(users.id, testUserId));
  await db.delete(printings).where(eq(printings.printingId, printingId));
  await db.delete(cards).where(eq(cards.cardUniqueId, cardId));
});

describe('listPublicDecks count vs plausibility gate', () => {
  it('total counts only decks the listing actually returns', async () => {
    const result = await service.listPublicDecks({ search: token }, { limit: 20 });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const ids = result.data.decks.map(d => d._id ?? (d as any).id);
    expect(ids).toContain(validCcDeckId);
    expect(ids).not.toContain(emptyCcDeckId);
    // The bug: total said 1 more than the rows ever render.
    expect(result.data.total).toBe(result.data.decks.length);
    expect(result.data.total).toBe(1);
  });

  // Calling: Sydney (2026-11): eight 80-card decks were hidden from Decks to
  // Beat because their 2-6 token cards pushed the gate's count past 80.
  it('does not count tokens or benched cards toward the deck size', async () => {
    const result = await service.listPublicDecks({ search: sideToken }, { limit: 20 });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const ids = result.data.decks.map(d => d._id ?? (d as any).id);
    expect(ids).toContain(tokensCcDeckId);
    expect(result.data.total).toBe(1);
  });
});
