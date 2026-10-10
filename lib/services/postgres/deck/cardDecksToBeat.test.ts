/**
 * Integration tests for PostgresDeckService.getCardDecksToBeat(cardUniqueId) —
 * the card-details lightbox "Decks to Beat" panel: which Decks to Beat play
 * this card (Decks tab) plus per-format Decks-to-Beat totals (Meta tab
 * denominator), fetched once on click.
 *
 * A Deck to Beat is what the /decks/to-beat page lists: featured AND public.
 * Matching is card-level (any printing of the card_unique_id), counting only
 * playable categories (hero/equipment/maindeck), same as getCardDeckUsage.
 *
 * Totals are asserted under a per-run unique `format` string so real
 * Decks to Beat in the shared DB can't shift them.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, printings, decks, deckCards } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let cardUniqueId: string;
let printingA: string;
let printingB: string; // a different printing of the same card

let testUserId: string;
let format: string; // unique per test → isolated totals

async function makeDeck(name: string, opts: {
  featured?: boolean;
  visibility?: 'public' | 'unlisted' | 'private';
  eventName?: string;
  eventDate?: string;
  placing?: number;
  heroName?: string;
  format?: string;
} = {}) {
  const id = crypto.randomUUID();
  const publicId = `t-${crypto.randomUUID().slice(0, 12)}`;
  await db.insert(decks).values({
    id,
    publicId,
    userId: testUserId,
    name,
    isSystemDeck: true,
    featured: opts.featured ?? true,
    visibility: opts.visibility ?? 'public',
    eventName: opts.eventName,
    eventDate: opts.eventDate,
    placing: opts.placing,
    heroName: opts.heroName,
    format: opts.format ?? format,
  });
  return { id, publicId };
}

async function addCard(deckId: string, printingId: string, quantity: number, category: 'hero' | 'equipment' | 'maindeck' | 'inventory' | 'benched' | 'tokens' = 'maindeck') {
  await db.insert(deckCards).values({ id: crypto.randomUUID(), deckId, printingId, quantity, category });
}

beforeAll(async () => {
  const [grp] = await db
    .select({ cuid: printings.cardUniqueId })
    .from(printings)
    .groupBy(printings.cardUniqueId)
    .having(sql`count(*) >= 2`)
    .orderBy(sql`${printings.cardUniqueId} desc`)
    .limit(1);
  if (!grp) throw new Error('Need a card with 2+ printings in DB');
  const ps = await db
    .select({ printingId: printings.printingId })
    .from(printings)
    .where(eq(printings.cardUniqueId, grp.cuid!))
    .limit(2);
  cardUniqueId = grp.cuid!;
  printingA = ps[0].printingId;
  printingB = ps[1].printingId;
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  format = `zz-test-format-${crypto.randomUUID().slice(0, 8)}`;
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

/** Only this test's rows — real Decks to Beat may also play the card. */
function mine<T extends { format?: string }>(rows: T[]) {
  return rows.filter((r) => r.format === format);
}

describe('getCardDecksToBeat', () => {
  it('returns featured public decks that play any printing of the card, with event metadata', async () => {
    const d1 = await makeDeck('Winner', { heroName: 'Dorinthea Ironsong', eventName: 'Calling: Test', eventDate: '2026-07-19', placing: 3 });
    const d2 = await makeDeck('Other printing');
    await addCard(d1.id, printingA, 2);
    await addCard(d1.id, printingB, 1); // same card, different printing → summed
    await addCard(d2.id, printingB, 3, 'equipment');

    const res = await service.getCardDecksToBeat(cardUniqueId);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const rows = mine(res.data.decks);
    expect(rows).toHaveLength(2);
    const winner = rows.find((r) => r.publicId === d1.publicId)!;
    expect(winner).toMatchObject({
      name: 'Winner',
      heroName: 'Dorinthea Ironsong',
      format,
      eventName: 'Calling: Test',
      eventDate: '2026-07-19',
      placing: 3,
      quantity: 3,
    });
    expect(rows.find((r) => r.publicId === d2.publicId)!.quantity).toBe(3);
  });

  it('excludes decks that are not featured, not public, or only list the card in scratch zones', async () => {
    const notFeatured = await makeDeck('Not featured', { featured: false });
    const unlisted = await makeDeck('Unlisted', { visibility: 'unlisted' });
    const sideOnly = await makeDeck('Bench only');
    await addCard(notFeatured.id, printingA, 1);
    await addCard(unlisted.id, printingA, 1);
    await addCard(sideOnly.id, printingA, 1, 'benched');
    await addCard(sideOnly.id, printingA, 1, 'tokens');

    const res = await service.getCardDecksToBeat(cardUniqueId);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(mine(res.data.decks)).toHaveLength(0);
  });

  it('orders newest event first, then best placing, with undated decks last', async () => {
    const undated = await makeDeck('Undated');
    const older = await makeDeck('Older', { eventDate: '2026-04-10', placing: 1 });
    const newer5th = await makeDeck('Newer 5th', { eventDate: '2026-08-23', placing: 5 });
    const newer3rd = await makeDeck('Newer 3rd', { eventDate: '2026-08-23', placing: 3 });
    for (const d of [undated, older, newer5th, newer3rd]) await addCard(d.id, printingA, 1);

    const res = await service.getCardDecksToBeat(cardUniqueId);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(mine(res.data.decks).map((r) => r.name)).toEqual(['Newer 3rd', 'Newer 5th', 'Older', 'Undated']);
  });

  it('totals every Deck to Beat per format, including ones that do not play the card', async () => {
    const plays = await makeDeck('Plays it');
    await makeDeck('Does not play it');
    await makeDeck('Not featured', { featured: false });
    await addCard(plays.id, printingA, 1);

    const res = await service.getCardDecksToBeat(cardUniqueId);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.totalsByFormat[format]).toBe(2);
  });
});
