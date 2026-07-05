/**
 * Integration test for PostgresDeckService.getInventoryComparison matchBy modes.
 *
 * Proves that 'card' mode (the deckbuilding semantic) counts ANY printing of a
 * card you own toward the deck's requirement, whereas the default 'printing'
 * mode only accepts the exact printing the deck lists.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, binders, inventoryItems, printings, decks, deckCards } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let printingA: string; // the printing the deck lists
let printingB: string; // a DIFFERENT printing of the same card

let testUserId: string;
let binderId: string;
let deckId: string;
let deckPublicId: string;

beforeAll(async () => {
  // A card (card_unique_id) that has at least two distinct printings.
  const grp = await db
    .select({ cuid: printings.cardUniqueId })
    .from(printings)
    .groupBy(printings.cardUniqueId)
    .having(sql`count(*) >= 2`)
    .limit(1);
  if (grp.length === 0) throw new Error('Need a card with 2+ printings in DB');
  const ps = await db
    .select({ printingId: printings.printingId })
    .from(printings)
    .where(eq(printings.cardUniqueId, grp[0].cuid!))
    .limit(2);
  printingA = ps[0].printingId;
  printingB = ps[1].printingId;
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  binderId = crypto.randomUUID();
  deckId = crypto.randomUUID();
  deckPublicId = `t-${crypto.randomUUID().slice(0, 12)}`;

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  await db.insert(binders).values({ id: binderId, userId: testUserId, name: `B-${binderId}` });
  await db.insert(decks).values({ id: deckId, publicId: deckPublicId, userId: testUserId, name: 'Test Deck' });
  await db.insert(deckCards).values({ id: crypto.randomUUID(), deckId, printingId: printingA, quantity: 1, category: 'maindeck' });

  // The user owns printingB — a DIFFERENT printing of the same card.
  await db.insert(inventoryItems).values({
    id: crypto.randomUUID(), userId: testUserId, binderId, printingId: printingB, quantity: 1, forTrade: false,
  });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('getInventoryComparison matchBy', () => {
  it("default 'printing' mode: a different printing does NOT satisfy the slot (card is missing)", async () => {
    const res = await service.getInventoryComparison(deckPublicId, testUserId);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.missing.some((m) => m.printingId === printingA)).toBe(true);
    expect(res.data.owned.length).toBe(0);
  });

  it("'card' mode: owning any printing of the card satisfies the slot (card is owned)", async () => {
    const res = await service.getInventoryComparison(deckPublicId, testUserId, { matchBy: 'card' });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.missing.length).toBe(0);
    // Representative printing = the one the deck lists.
    expect(res.data.owned.some((o) => o.printingId === printingA)).toBe(true);
  });
});
