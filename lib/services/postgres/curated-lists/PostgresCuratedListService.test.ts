/**
 * Integration tests for PostgresCuratedListService.getAllPublished.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, curatedLists, curatedListCards, printings, cards } from '@/lib/postgres/schema';
import { PostgresCuratedListService } from './PostgresCuratedListService';

const service = new PostgresCuratedListService();

let testUserId: string;
let testListId: string;
let realPrintingId: string;
let realPrinting: typeof printings.$inferSelect;
let realCard: typeof cards.$inferSelect;

beforeAll(async () => {
  const [p] = await db.select().from(printings).limit(1);
  if (!p) throw new Error('No printings in DB — cannot run curated-list tests');
  realPrinting = p;
  realPrintingId = p.printingId;

  const [c] = await db.select().from(cards).where(eq(cards.cardUniqueId, p.cardUniqueId)).limit(1);
  if (!c) throw new Error('No card for printing — cannot run curated-list tests');
  realCard = c;
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  testListId = crypto.randomUUID();

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  await db.insert(curatedLists).values({
    id: testListId,
    name: `Test List ${testListId}`,
    format: 'Classic Constructed',
    heroName: 'katsu-the-wanderer',
    isPublished: true,
    createdBy: testUserId,
  });
  await db.insert(curatedListCards).values({
    id: crypto.randomUUID(),
    listId: testListId,
    printingId: realPrintingId,
    sortOrder: 0,
  });
});

afterEach(async () => {
  // Cascade: user → curatedLists.createdBy=set null, so delete list explicitly first
  await db.delete(curatedLists).where(eq(curatedLists.id, testListId));
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('PostgresCuratedListService.getAllPublished', () => {
  it('returns cardCount only by default (no cards array populated)', async () => {
    const result = await service.getAllPublished();
    expect(result.success).toBe(true);
    if (!result.success) return;

    const ours = result.data.find(l => l.id === testListId);
    expect(ours).toBeDefined();
    expect(ours!.cardCount).toBe(1);
    expect(ours!.cards).toBeUndefined();
  });

  it('populates the cards array when includeCards: true', async () => {
    const result = await service.getAllPublished({ includeCards: true });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const ours = result.data.find(l => l.id === testListId);
    expect(ours).toBeDefined();
    expect(ours!.cards).toBeDefined();
    expect(ours!.cards!.length).toBe(1);
    expect(ours!.cards![0].printingId).toBe(realPrintingId);
  });

  it('exposes collectorNumber sourced from printings.collector_number', async () => {
    const result = await service.getAllPublished({ includeCards: true });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const ours = result.data.find(l => l.id === testListId);
    const card = ours!.cards![0];
    if (realPrinting.collectorNumber === null) {
      expect(card.collectorNumber).toBeUndefined();
    } else {
      expect(card.collectorNumber).toBe(realPrinting.collectorNumber);
    }
  });

  it('plumbs printing fields: foiling, edition, pricing, tcgplayerUrl, art-style flags', async () => {
    const result = await service.getAllPublished({ includeCards: true });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const card = result.data.find(l => l.id === testListId)!.cards![0] as any;

    // Non-null columns on printings — must always propagate:
    expect(card.foiling).toBe(realPrinting.foiling);
    expect(card.edition).toBe(realPrinting.edition);
    expect(card.isExtendedArt).toBe(realPrinting.isExtendedArt);

    // Nullable columns — DTO uses `undefined` when DB is null, else equals DB value:
    const matchNullable = (dtoVal: unknown, dbVal: unknown) => {
      if (dbVal === null || dbVal === undefined) expect(dtoVal).toBeUndefined();
      else expect(dtoVal).toEqual(dbVal);
    };
    matchNullable(card.tcgLow, realPrinting.tcgLow);
    matchNullable(card.tcgMarket, realPrinting.tcgMarket);
    matchNullable(card.tcgMid, realPrinting.tcgMid);
    matchNullable(card.tcgHigh, realPrinting.tcgHigh);
    matchNullable(card.tcgplayerUrl, realPrinting.tcgplayerUrl);
    matchNullable(card.artVariations, realPrinting.artVariations);
    matchNullable(card.foilInsetTop, realPrinting.foilInsetTop);
    matchNullable(card.foilInsetRight, realPrinting.foilInsetRight);
    matchNullable(card.foilInsetBottom, realPrinting.foilInsetBottom);
    matchNullable(card.foilInsetLeft, realPrinting.foilInsetLeft);
    matchNullable(card.foilInsetRound, realPrinting.foilInsetRound);
  });

  it('plumbs card field typeTextDisplay from cards.type_text_display', async () => {
    const result = await service.getAllPublished({ includeCards: true });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const card = result.data.find(l => l.id === testListId)!.cards![0] as any;
    if (realCard.typeTextDisplay === null || realCard.typeTextDisplay === undefined) {
      expect(card.typeTextDisplay).toBeUndefined();
    } else {
      expect(card.typeTextDisplay).toBe(realCard.typeTextDisplay);
    }
  });
});

describe('getListById — card text for deck-recommendation grounding', () => {
  it('each card carries the rules text and pitch so the AI can quote real effects', async () => {
    // Pick a printing whose card HAS rules text (many tokens/vanilla cards do not)
    const [row] = await db
      .select({ printingId: printings.printingId, text: cards.text, pitch: cards.pitch })
      .from(printings)
      .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
      .where(eq(cards.pitch, 1))
      .limit(1);
    if (!row?.text) throw new Error('Need a card with text seeded');

    const textListId = crypto.randomUUID();
    await db.insert(curatedLists).values({
      id: textListId,
      name: `Text List ${textListId}`,
      format: 'Classic Constructed',
      heroName: 'katsu-the-wanderer',
      isPublished: true,
      createdBy: testUserId,
    });
    await db.insert(curatedListCards).values({
      id: crypto.randomUUID(),
      listId: textListId,
      printingId: row.printingId,
      sortOrder: 0,
    });

    try {
      const res = await service.getListById(textListId);
      expect(res.success).toBe(true);
      if (!res.success) return;
      const card = res.data.cards![0];
      expect(card.text).toBe(row.text);
      expect(card.pitch).toBe(row.pitch);
    } finally {
      await db.delete(curatedLists).where(eq(curatedLists.id, textListId));
    }
  });
});
