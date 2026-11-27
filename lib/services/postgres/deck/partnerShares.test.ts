/**
 * Integration tests: sending decks to connected apps (partner game clients
 * such as Cintari) — migration 0135 — and the matchup writes the partner play
 * API uses.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { users, decks, deckCards, printings, cards, oauthClients } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let fixture: { printingId: string; collectorNumber: string | null };
let ownerId: string;
let coOwnerId: string;
let strangerId: string;
let appA: string;
let appB: string;
const deckIds: string[] = [];

beforeAll(async () => {
  [fixture] = await db
    .select({ printingId: printings.printingId, collectorNumber: printings.collectorNumber })
    .from(printings)
    .innerJoin(cards, eq(cards.cardUniqueId, printings.cardUniqueId))
    .where(and(eq(printings.language, 'en'), isNotNull(printings.collectorNumber)))
    .orderBy(printings.printingId)
    .limit(1);
  expect(fixture).toBeTruthy();
});

async function makeDeck(name: string, over: Partial<typeof decks.$inferInsert> = {}) {
  const id = nanoid(21);
  const publicId = nanoid(21);
  deckIds.push(id);
  await db.insert(decks).values({
    id, publicId, userId: ownerId, name, slug: `slug-${publicId}`,
    format: 'Classic Constructed', heroName: 'Test Hero', visibility: 'private', coOwners: [coOwnerId],
    ...over,
  });
  return { id, publicId };
}

beforeEach(async () => {
  [ownerId, coOwnerId, strangerId] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  await db.insert(users).values([ownerId, coOwnerId, strangerId].map(id => ({ id, username: `test-${id}` })));
  [appA, appB] = [`test-app-${nanoid(10)}`, `test-app-${nanoid(10)}`];
  await db.insert(oauthClients).values([appA, appB].map(clientId => ({
    id: nanoid(21), clientId, clientSecret: 'x', clientName: clientId, clientIdIssuedAt: 0,
  })));
});

afterEach(async () => {
  await db.delete(users).where(inArray(users.id, [ownerId, coOwnerId, strangerId]));
  await db.delete(oauthClients).where(inArray(oauthClients.clientId, [appA, appB]));
  deckIds.length = 0;
});

describe('deck sharing with connected apps', () => {
  it('a deck is sent to no app until its owner turns one on', async () => {
    const { publicId } = await makeDeck('Kano');
    expect(await service.listDeckPartnerShares(publicId, ownerId)).toEqual({ success: true, data: [] });
  });

  it('turns an app on and off for one deck, without touching other apps', async () => {
    const { publicId } = await makeDeck('Kano');
    expect(await service.setDeckPartnerShare(publicId, ownerId, appA, true)).toEqual({ success: true, data: { shared: true } });
    await service.setDeckPartnerShare(publicId, ownerId, appB, true);
    await service.setDeckPartnerShare(publicId, ownerId, appA, true); // twice is fine
    expect((await service.listDeckPartnerShares(publicId, ownerId) as any).data.sort()).toEqual([appA, appB].sort());

    expect(await service.setDeckPartnerShare(publicId, ownerId, appA, false)).toEqual({ success: true, data: { shared: false } });
    expect((await service.listDeckPartnerShares(publicId, ownerId) as any).data).toEqual([appB]);
  });

  it('lets a co-owner change it but not someone else', async () => {
    const { publicId } = await makeDeck('Kano');
    expect((await service.setDeckPartnerShare(publicId, coOwnerId, appA, true)).success).toBe(true);
    expect((await service.setDeckPartnerShare(publicId, strangerId, appA, true)).success).toBe(false);
    expect((await service.listDeckPartnerShares(publicId, strangerId)).success).toBe(false);
  });

  it('refuses an app that does not exist', async () => {
    const { publicId } = await makeDeck('Kano');
    expect((await service.setDeckPartnerShare(publicId, ownerId, 'no-such-app', true)).success).toBe(false);
  });
});

describe('listPartnerDecks', () => {
  it("lists only the caller's decks shared with that app, newest first, with hero card and size", async () => {
    const old = await makeDeck('Old', { updatedAt: new Date('2026-01-01') });
    const recent = await makeDeck('Recent', { updatedAt: new Date('2026-06-01'), format: 'Blitz' });
    const notShared = await makeDeck('Not shared');
    const otherApp = await makeDeck('Other app');
    await db.insert(deckCards).values([
      { id: nanoid(21), deckId: recent.id, printingId: fixture.printingId, quantity: 1, category: 'hero' },
      { id: nanoid(21), deckId: recent.id, printingId: fixture.printingId, quantity: 3, category: 'maindeck' },
      { id: nanoid(21), deckId: recent.id, printingId: fixture.printingId, quantity: 2, category: 'inventory' },
      { id: nanoid(21), deckId: recent.id, printingId: fixture.printingId, quantity: 5, category: 'benched' },
    ]);
    await service.setDeckPartnerShare(old.publicId, ownerId, appA, true);
    await service.setDeckPartnerShare(recent.publicId, ownerId, appA, true);
    await service.setDeckPartnerShare(otherApp.publicId, ownerId, appB, true);

    const r = await service.listPartnerDecks(ownerId, appA, { limit: 50, offset: 0 });
    expect(r.success).toBe(true);
    const { decks: list, total } = (r as any).data;
    expect(total).toBe(2);
    expect(list.map((d: any) => d.name)).toEqual(['Recent', 'Old']);
    expect(list[0]).toMatchObject({
      publicId: recent.publicId, format: 'Blitz', heroName: 'Test Hero',
      heroCardId: fixture.collectorNumber, totalCards: 5, // main deck + inventory; hero and bench not counted
    });
    expect(list[1]).toMatchObject({ publicId: old.publicId, heroCardId: null, totalCards: 0 });
    expect(list.map((d: any) => d.publicId)).not.toContain(notShared.publicId);
  });

  it('filters by format and pages', async () => {
    for (const [i, format] of ['Blitz', 'Classic Constructed', 'Blitz', 'Blitz'].entries()) {
      const d = await makeDeck(`D${i}`, { format, updatedAt: new Date(2026, 0, i + 1) });
      await service.setDeckPartnerShare(d.publicId, ownerId, appA, true);
    }
    const blitz = (await service.listPartnerDecks(ownerId, appA, { format: 'Blitz', limit: 2, offset: 0 }) as any).data;
    expect(blitz.total).toBe(3);
    expect(blitz.decks.map((d: any) => d.name)).toEqual(['D3', 'D2']);
    const page2 = (await service.listPartnerDecks(ownerId, appA, { format: 'Blitz', limit: 2, offset: 2 }) as any).data;
    expect(page2.decks.map((d: any) => d.name)).toEqual(['D0']);
  });

  it("never lists another player's decks", async () => {
    const d = await makeDeck('Mine');
    await service.setDeckPartnerShare(d.publicId, ownerId, appA, true);
    expect((await service.listPartnerDecks(strangerId, appA, { limit: 50, offset: 0 }) as any).data).toEqual({ decks: [], total: 0 });
  });
});

describe('findPartnerTalisharDeck', () => {
  it('gives the playable list only when the deck is shared with that app', async () => {
    const d = await makeDeck('Kano');
    await db.insert(deckCards).values({ id: nanoid(21), deckId: d.id, printingId: fixture.printingId, quantity: 3, category: 'maindeck' });
    expect(await service.findPartnerTalisharDeck(d.publicId, ownerId, appA)).toEqual({ success: true, data: null });

    await service.setDeckPartnerShare(d.publicId, ownerId, appA, true);
    const shared = await service.findPartnerTalisharDeck(d.publicId, ownerId, appA);
    expect((shared as any).data.maindeck.map((c: any) => c.quantity)).toEqual([3]);
    expect(await service.findPartnerTalisharDeck(d.publicId, ownerId, appB)).toEqual({ success: true, data: null });
    expect(await service.findPartnerTalisharDeck(d.publicId, strangerId, appA)).toEqual({ success: true, data: null });
  });

  it('follows the version picked for Talishar', async () => {
    const d = await makeDeck('Kano');
    await db.insert(deckCards).values({ id: nanoid(21), deckId: d.id, printingId: fixture.printingId, quantity: 3, category: 'maindeck' });
    await service.saveDeckVersion(d.publicId, ownerId, {});
    await db.update(deckCards).set({ quantity: 1 }).where(eq(deckCards.deckId, d.id));
    await service.setTalisharVersion(d.publicId, ownerId, 1);
    await service.setDeckPartnerShare(d.publicId, ownerId, appA, true);

    const r = await service.findPartnerTalisharDeck(d.publicId, ownerId, appA);
    expect((r as any).data.maindeck.map((c: any) => c.quantity)).toEqual([3]);
  });
});

describe('saveDeckMatchup / deleteDeckMatchup', () => {
  const plan = (heroId: string, notes = 'n') => ({ heroId, preferredTurnOrder: 'First' as const, notes, sideboard: { in: [], out: [] } });
  const stored = async (id: string) => (await db.select({ m: decks.metadata }).from(decks).where(eq(decks.id, id)))[0]?.m as any;

  it('adds a plan, replaces it by hero, and keeps the rest of the metadata', async () => {
    const d = await makeDeck('Kano', { metadata: { ratios: [{ id: 'r' }], matchups: [plan('briar')] } });
    expect(await service.saveDeckMatchup(d.publicId, ownerId, plan('kano'))).toEqual({ success: true, data: { matchup: plan('kano'), created: true } });
    expect(await service.saveDeckMatchup(d.publicId, ownerId, plan('briar', 'changed'))).toEqual({ success: true, data: { matchup: plan('briar', 'changed'), created: false } });

    const m = await stored(d.id);
    expect(m.ratios).toEqual([{ id: 'r' }]);
    expect(m.matchups).toEqual([plan('briar', 'changed'), plan('kano')]);
  });

  it('deletes one plan, and says when there was none', async () => {
    const d = await makeDeck('Kano', { metadata: { matchups: [plan('briar'), plan('kano')] } });
    expect(await service.deleteDeckMatchup(d.publicId, ownerId, 'briar')).toEqual({ success: true, data: { deleted: true } });
    expect(await service.deleteDeckMatchup(d.publicId, ownerId, 'briar')).toEqual({ success: true, data: { deleted: false } });
    expect((await stored(d.id)).matchups).toEqual([plan('kano')]);
  });

  it('only the owner or a co-owner can change plans', async () => {
    const d = await makeDeck('Kano');
    expect((await service.saveDeckMatchup(d.publicId, coOwnerId, plan('kano'))).success).toBe(true);
    expect((await service.saveDeckMatchup(d.publicId, strangerId, plan('briar'))).success).toBe(false);
    expect((await service.deleteDeckMatchup(d.publicId, strangerId, 'kano')).success).toBe(false);
  });

  it('two saves at once both land', async () => {
    const d = await makeDeck('Kano');
    await Promise.all(['a', 'b', 'c', 'd'].map(h => service.saveDeckMatchup(d.publicId, ownerId, plan(h))));
    expect((await stored(d.id)).matchups.map((m: any) => m.heroId).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});
