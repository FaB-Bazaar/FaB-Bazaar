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
  // A card (card_unique_id) with 2+ printings, whose representative printing
  // has a low price, a TCGplayer URL AND a stored image_url (so we can assert
  // those flow through).
  const grp = await db
    .select({ cuid: printings.cardUniqueId })
    .from(printings)
    .where(sql`${printings.tcgLow} is not null and ${printings.tcgplayerUrl} is not null and ${printings.imageUrl} is not null`)
    .groupBy(printings.cardUniqueId)
    .having(sql`count(*) >= 2`)
    .limit(1);
  if (grp.length === 0) throw new Error('Need a card with 2+ priced printings in DB');
  const ps = await db
    .select({ printingId: printings.printingId, tcgLow: printings.tcgLow, tcgplayerUrl: printings.tcgplayerUrl })
    .from(printings)
    .where(eq(printings.cardUniqueId, grp[0].cuid!))
    .orderBy(sql`${printings.tcgLow} is null, ${printings.tcgplayerUrl} is null`)
    .limit(2);
  printingA = ps[0].printingId; // priced representative
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
    const miss = res.data.missing.find((m) => m.printingId === printingA);
    expect(miss).toBeTruthy();
    expect(res.data.owned.length).toBe(0);
    // Missing entries carry low price + TCGplayer URL for the rail's buy link.
    expect(typeof miss!.tcgLow).toBe('number');
    expect(typeof miss!.tcgplayerUrl).toBe('string');
    // ...and the printing's stored image_url — Volzar renders it directly
    // (printing_id-keyed CDN URLs 404; images deleted 2026-07).
    expect(miss!.imageUrl).toMatch(/^http/);
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
