/**
 * Integration tests: which list Talishar gets for a deck.
 * setTalisharVersion picks it (NULL = the live deck, or a saved version);
 * findTalisharDeck is what the Talishar export reads.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { users, decks, deckCards, printings, cards } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

// Opposite end of the table from deckVersions.test.ts's fixtures.
let fixtures: Array<{ printingId: string; cardUniqueId: string }>;
let ownerId: string;
let coOwnerId: string;
let strangerId: string;
let deckId: string;
let publicId: string;

beforeAll(async () => {
  fixtures = await db
    .selectDistinctOn([printings.cardUniqueId], { printingId: printings.printingId, cardUniqueId: printings.cardUniqueId })
    .from(printings)
    .innerJoin(cards, eq(cards.cardUniqueId, printings.cardUniqueId))
    .where(and(eq(printings.language, 'en'), isNotNull(cards.pitch)))
    .orderBy(printings.cardUniqueId, printings.printingId)
    .limit(3);
  expect(fixtures).toHaveLength(3);
});

beforeEach(async () => {
  [ownerId, coOwnerId, strangerId] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  await db.insert(users).values([ownerId, coOwnerId, strangerId].map(id => ({ id, username: `test-${id}` })));
  deckId = nanoid(21);
  publicId = nanoid(21);
  await db.insert(decks).values({
    id: deckId, publicId, userId: ownerId, name: 'Talishar deck', slug: `slug-${publicId}`,
    format: 'Classic Constructed', heroName: 'Test Hero', visibility: 'public', coOwners: [coOwnerId],
    metadata: { matchups: [{ heroId: 'x' }] },
  });
  // Version 1: 3 copies of card A. Then the live deck moves on to 1 copy of A + 2 of B.
  await db.insert(deckCards).values({ id: nanoid(21), deckId, printingId: fixtures[0].printingId, quantity: 3, category: 'maindeck' });
  await service.saveDeckVersion(publicId, ownerId, { label: 'registered list' });
  await db.update(deckCards).set({ quantity: 1 }).where(and(eq(deckCards.deckId, deckId), eq(deckCards.printingId, fixtures[0].printingId)));
  await db.insert(deckCards).values({ id: nanoid(21), deckId, printingId: fixtures[1].printingId, quantity: 2, category: 'maindeck' });
});

afterEach(async () => {
  await db.delete(users).where(inArray(users.id, [ownerId, coOwnerId, strangerId]));
});

const stored = async () => (await db.select({ v: decks.talisharVersion }).from(decks).where(eq(decks.id, deckId)))[0]?.v;
const main = (deck: any) => deck.maindeck.map((c: any) => [c.printingId, c.quantity]).sort();
const LIVE = () => [[fixtures[0].printingId, 1], [fixtures[1].printingId, 2]].sort();
const VERSION_1 = () => [[fixtures[0].printingId, 3]];

describe('setTalisharVersion', () => {
  it('a new deck gives Talishar the live deck', async () => {
    expect(await stored()).toBeNull();
  });

  it('picks a saved version for the owner', async () => {
    const r = await service.setTalisharVersion(publicId, ownerId, 1);
    expect(r).toEqual({ success: true, data: { talisharVersion: 1 } });
    expect(await stored()).toBe(1);
  });

  it('goes back to the live deck with null', async () => {
    await service.setTalisharVersion(publicId, ownerId, 1);
    const r = await service.setTalisharVersion(publicId, ownerId, null);
    expect(r).toEqual({ success: true, data: { talisharVersion: null } });
    expect(await stored()).toBeNull();
  });

  it('lets a co-owner pick', async () => {
    expect((await service.setTalisharVersion(publicId, coOwnerId, 1)).success).toBe(true);
    expect(await stored()).toBe(1);
  });

  it('refuses a version the deck does not have, and changes nothing', async () => {
    const r = await service.setTalisharVersion(publicId, ownerId, 9);
    expect(r.success).toBe(false);
    expect(await stored()).toBeNull();
  });

  it('refuses anyone else, and changes nothing', async () => {
    const r = await service.setTalisharVersion(publicId, strangerId, 1);
    expect(r.success).toBe(false);
    expect(await stored()).toBeNull();
  });

  it('does not touch the deck\'s cards or its other settings', async () => {
    await service.setTalisharVersion(publicId, ownerId, 1);
    const live = await service.findByPublicId(publicId);
    expect(live.success && main(live.data)).toEqual(LIVE());
    expect(live.success && live.data?.metadata).toEqual({ matchups: [{ heroId: 'x' }] });
  });
});

describe('the deck reports which list Talishar gets', () => {
  it('talisharVersion is null by default and the picked number once set', async () => {
    const before = await service.findByPublicId(publicId);
    expect(before.success && before.data?.talisharVersion).toBeNull();
    await service.setTalisharVersion(publicId, ownerId, 1);
    const after = await service.findByPublicId(publicId);
    expect(after.success && after.data?.talisharVersion).toBe(1);
  });
});

describe('findTalisharDeck', () => {
  it('gives the live deck when no version is picked', async () => {
    const r = await service.findTalisharDeck(publicId);
    expect(r.success && main(r.data)).toEqual(LIVE());
  });

  it('gives the picked version\'s cards, with the deck\'s own name and matchups', async () => {
    await service.setTalisharVersion(publicId, ownerId, 1);
    const r = await service.findTalisharDeck(publicId);
    if (!r.success || !r.data) throw new Error('no deck');
    expect(main(r.data)).toEqual(VERSION_1());
    expect(r.data.publicId).toBe(publicId);
    expect(r.data.name).toBe('Talishar deck');
    expect(r.data.metadata).toEqual({ matchups: [{ heroId: 'x' }] });
    expect(r.data.maindeck[0].printingDetails?.card_unique_id).toBe(fixtures[0].cardUniqueId);
  });

  it('keeps giving that version while the live deck keeps changing', async () => {
    await service.setTalisharVersion(publicId, ownerId, 1);
    await db.insert(deckCards).values({ id: nanoid(21), deckId, printingId: fixtures[2].printingId, quantity: 3, category: 'maindeck' });
    const r = await service.findTalisharDeck(publicId);
    expect(r.success && main(r.data)).toEqual(VERSION_1());
  });

  it('falls back to the live deck when the picked number has no version behind it', async () => {
    await db.update(decks).set({ talisharVersion: 42 }).where(eq(decks.id, deckId));
    const r = await service.findTalisharDeck(publicId);
    expect(r.success && main(r.data)).toEqual(LIVE());
  });

  it('follows the same access rule as findByPublicId: with a user id, only that user\'s deck', async () => {
    expect((await service.findTalisharDeck(publicId, strangerId)).success && (await service.findTalisharDeck(publicId, strangerId) as any).data).toBeNull();
    const own = await service.findTalisharDeck(publicId, ownerId);
    expect(own.success && own.data?.publicId).toBe(publicId);
  });

  it('is null for an unknown deck', async () => {
    const r = await service.findTalisharDeck('no-such-deck');
    expect(r.success && r.data).toBeNull();
  });
});
