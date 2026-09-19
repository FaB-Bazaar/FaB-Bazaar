/**
 * addPrintings: when the caller names no zone, the stored category is inferred
 * from the card's types instead of defaulting to 'maindeck'.
 *
 * Repro: the MCP add tool and the add/bulk API routes defaulted to maindeck, so
 * a Maxx deck ended up with Galvanic Bender, Breaker Helm Protos and Cogwerx
 * Base Legs stored as maindeck rows (the present page showed them under
 * "No Pitch"). Evo equipment stays a maindeck card; an explicit zone still wins.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { users, decks, deckCards, cards, printings } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let testUserId: string;
let baseEquipmentId: string; // Galvanic Bender — mechanologist equipment, arms
let evoEquipmentId: string;  // Evo Circuit Breaker — equipment + evo (pitched library card)

async function printingFor(name: string): Promise<string> {
  const row = await db
    .select({ id: printings.printingId })
    .from(printings)
    .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
    .where(and(eq(cards.name, name), eq(printings.language, 'en')))
    .orderBy(printings.printingId)
    .limit(1);
  if (!row[0]) throw new Error(`Need "${name}" in DB`);
  return row[0].id;
}

beforeAll(async () => {
  baseEquipmentId = await printingFor('galvanic bender');
  evoEquipmentId = await printingFor('evo circuit breaker');
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

async function makeDeck(): Promise<{ id: string; publicId: string }> {
  const id = nanoid(21);
  const publicId = nanoid(21);
  await db.insert(decks).values({
    id,
    publicId,
    userId: testUserId,
    name: `infer test ${publicId}`,
    slug: `slug-${publicId}`,
    format: 'Classic Constructed',
    heroName: "maxx 'the hype' nitro",
    visibility: 'private',
  });
  return { id, publicId };
}

async function storedCategory(deckId: string, printingId: string): Promise<string | null> {
  const row = await db
    .select({ category: deckCards.category })
    .from(deckCards)
    .where(and(eq(deckCards.deckId, deckId), eq(deckCards.printingId, printingId)))
    .limit(1);
  return row[0]?.category ?? null;
}

describe('PostgresDeckService.addPrintings — category inferred from card types when omitted', () => {
  it('base equipment with no category is stored as equipment', async () => {
    const deck = await makeDeck();
    const result = await service.addPrintings(deck.publicId, testUserId, [{ printingId: baseEquipmentId, quantity: 1 }]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.results[0].success).toBe(true);
    expect(await storedCategory(deck.id, baseEquipmentId)).toBe('equipment');
  });

  it('evo equipment with no category is stored as maindeck', async () => {
    const deck = await makeDeck();
    const result = await service.addPrintings(deck.publicId, testUserId, [{ printingId: evoEquipmentId, quantity: 1 }]);
    expect(result.success).toBe(true);
    expect(await storedCategory(deck.id, evoEquipmentId)).toBe('maindeck');
  });

  it('an explicit category still wins', async () => {
    const deck = await makeDeck();
    const result = await service.addPrintings(deck.publicId, testUserId, [{ printingId: baseEquipmentId, quantity: 1, category: 'inventory' }]);
    expect(result.success).toBe(true);
    expect(await storedCategory(deck.id, baseEquipmentId)).toBe('inventory');
  });
});
