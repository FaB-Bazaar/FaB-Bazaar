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
const token = `zzcountgate${crypto.randomUUID().slice(0, 8)}`;
const cardId = `${token}-card`;
const printingId = `${token}-pr`;

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  emptyCcDeckId = crypto.randomUUID();
  validCcDeckId = crypto.randomUUID();

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
});
