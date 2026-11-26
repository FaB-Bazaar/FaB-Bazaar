/**
 * Integration tests: PostgresDeckService deck versions — saveDeckVersion /
 * listDeckVersions / getDeckVersion. A version is an immutable copy of the
 * deck's cards; the live deck (deck_cards) is never touched by saving one.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { users, decks, deckCards, deckVersions, printings, cards } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

// Three real printings of three different pitched cards (FK targets).
let fixtures: Array<{ printingId: string; cardUniqueId: string; name: string; pitch: number | null }>;

let ownerId: string;
let coOwnerId: string;
let strangerId: string;
let deckId: string;
let publicId: string;

beforeAll(async () => {
  fixtures = await db
    .selectDistinctOn([printings.cardUniqueId], {
      printingId: printings.printingId, cardUniqueId: printings.cardUniqueId, name: cards.displayName, pitch: cards.pitch,
    })
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
    id: deckId, publicId, userId: ownerId, name: 'Versioned', slug: `slug-${publicId}`,
    format: 'Classic Constructed', heroName: 'Test Hero', visibility: 'private', coOwners: [coOwnerId],
  });
  await db.insert(deckCards).values([
    { id: nanoid(21), deckId, printingId: fixtures[0].printingId, quantity: 3, category: 'maindeck' },
    { id: nanoid(21), deckId, printingId: fixtures[1].printingId, quantity: 2, category: 'inventory' },
  ]);
});

afterEach(async () => {
  await db.delete(users).where(inArray(users.id, [ownerId, coOwnerId, strangerId]));
});

const liveCards = () =>
  db.select({ printingId: deckCards.printingId, quantity: deckCards.quantity, category: deckCards.category })
    .from(deckCards).where(eq(deckCards.deckId, deckId)).orderBy(deckCards.printingId);
const setQuantity = (printingId: string, quantity: number) =>
  db.update(deckCards).set({ quantity }).where(and(eq(deckCards.deckId, deckId), eq(deckCards.printingId, printingId)));

describe('saveDeckVersion', () => {
  it('saves version 1 with the deck\'s cards, names and pitch, and leaves the live deck alone', async () => {
    const before = await liveCards();
    const r = await service.saveDeckVersion(publicId, ownerId, { label: 'Before the Calling' });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.created).toBe(true);
    expect(r.data.version.versionNumber).toBe(1);
    expect(r.data.version.label).toBe('Before the Calling');
    expect(r.data.version.counts).toMatchObject({ maindeck: 3, inventory: 2, equipment: 0 });

    const stored = await service.getDeckVersion(publicId, ownerId, 1);
    expect(stored.success && stored.data?.snapshot).toMatchObject({ name: 'Versioned', format: 'Classic Constructed', heroName: 'Test Hero' });
    const snapshotCards = stored.success ? stored.data!.snapshot.cards : [];
    expect(snapshotCards).toEqual(expect.arrayContaining([
      { printingId: fixtures[0].printingId, cardUniqueId: fixtures[0].cardUniqueId, name: fixtures[0].name, pitch: fixtures[0].pitch, quantity: 3, category: 'maindeck' },
      { printingId: fixtures[1].printingId, cardUniqueId: fixtures[1].cardUniqueId, name: fixtures[1].name, pitch: fixtures[1].pitch, quantity: 2, category: 'inventory' },
    ]));
    expect(snapshotCards).toHaveLength(2);
    expect(await liveCards()).toEqual(before);
  });

  it('numbers versions 1, 2, 3 as the deck changes', async () => {
    await service.saveDeckVersion(publicId, ownerId, {});
    await setQuantity(fixtures[0].printingId, 2);
    const second = await service.saveDeckVersion(publicId, ownerId, {});
    await db.insert(deckCards).values({ id: nanoid(21), deckId, printingId: fixtures[2].printingId, quantity: 1, category: 'maindeck' });
    const third = await service.saveDeckVersion(publicId, ownerId, {});
    expect(second.success && second.data.version.versionNumber).toBe(2);
    expect(third.success && third.data.version.versionNumber).toBe(3);
  });

  it('does not save a second copy when nothing changed since the last version', async () => {
    await service.saveDeckVersion(publicId, ownerId, { label: 'first' });
    const again = await service.saveDeckVersion(publicId, ownerId, { label: 'second' });
    expect(again.success).toBe(true);
    if (!again.success) return;
    expect(again.data.created).toBe(false);
    expect(again.data.version.versionNumber).toBe(1);
    expect(again.data.version.label).toBe('first');
    const rows = await db.select({ n: sql<number>`count(*)::int` }).from(deckVersions).where(eq(deckVersions.deckId, deckId));
    expect(rows[0].n).toBe(1);
  });

  it('saves again once the list goes back to an older one (only the latest version is compared)', async () => {
    await service.saveDeckVersion(publicId, ownerId, {});
    await setQuantity(fixtures[0].printingId, 2);
    await service.saveDeckVersion(publicId, ownerId, {});
    await setQuantity(fixtures[0].printingId, 3);
    const back = await service.saveDeckVersion(publicId, ownerId, {});
    expect(back.success && back.data.created).toBe(true);
    expect(back.success && back.data.version.versionNumber).toBe(3);
  });

  it('keeps an old version unchanged when the deck is edited afterwards', async () => {
    await service.saveDeckVersion(publicId, ownerId, {});
    await setQuantity(fixtures[0].printingId, 1);
    const v1 = await service.getDeckVersion(publicId, ownerId, 1);
    const card = v1.success ? v1.data!.snapshot.cards.find(c => c.printingId === fixtures[0].printingId) : null;
    expect(card?.quantity).toBe(3);
  });

  it('lets a co-owner save', async () => {
    const r = await service.saveDeckVersion(publicId, coOwnerId, {});
    expect(r.success && r.data.created).toBe(true);
  });

  it('refuses anyone else and saves nothing', async () => {
    const r = await service.saveDeckVersion(publicId, strangerId, {});
    expect(r.success).toBe(false);
    const rows = await db.select({ id: deckVersions.id }).from(deckVersions).where(eq(deckVersions.deckId, deckId));
    expect(rows).toHaveLength(0);
  });

  it('refuses an empty deck', async () => {
    await db.delete(deckCards).where(eq(deckCards.deckId, deckId));
    const r = await service.saveDeckVersion(publicId, ownerId, {});
    expect(r.success).toBe(false);
  });
});

describe('listDeckVersions', () => {
  it('lists newest first with counts, and without the card payload', async () => {
    await service.saveDeckVersion(publicId, ownerId, { label: 'one' });
    await setQuantity(fixtures[0].printingId, 2);
    await service.saveDeckVersion(publicId, ownerId, { label: 'two' });
    const r = await service.listDeckVersions(publicId, ownerId);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.map(v => [v.versionNumber, v.label, v.counts.maindeck])).toEqual([[2, 'two', 2], [1, 'one', 3]]);
    expect(r.data[0]).not.toHaveProperty('snapshot');
    expect(typeof r.data[0].createdAt).toBe('string');
  });

  it('is empty for a deck with no versions', async () => {
    const r = await service.listDeckVersions(publicId, ownerId);
    expect(r.success && r.data).toEqual([]);
  });

  it('refuses someone who cannot edit the deck', async () => {
    await service.saveDeckVersion(publicId, ownerId, {});
    expect((await service.listDeckVersions(publicId, strangerId)).success).toBe(false);
  });
});

describe('getDeckVersion', () => {
  it('returns null for a version number the deck does not have', async () => {
    const r = await service.getDeckVersion(publicId, ownerId, 7);
    expect(r.success && r.data).toBeNull();
  });

  it('refuses someone who cannot edit the deck', async () => {
    await service.saveDeckVersion(publicId, ownerId, {});
    expect((await service.getDeckVersion(publicId, strangerId, 1)).success).toBe(false);
  });
});

describe('deleting the deck', () => {
  it('removes its versions', async () => {
    await service.saveDeckVersion(publicId, ownerId, {});
    await db.delete(decks).where(eq(decks.id, deckId));
    const rows = await db.select({ id: deckVersions.id }).from(deckVersions).where(eq(deckVersions.deckId, deckId));
    expect(rows).toHaveLength(0);
  });
});
