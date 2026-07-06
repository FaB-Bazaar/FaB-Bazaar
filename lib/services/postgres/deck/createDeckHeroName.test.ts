/**
 * Integration tests for PostgresDeckService.createDeck hero_name canonicalization.
 *
 * hero_name must always be the deck's hero CARD canonical display_name — the full
 * adult name for an adult hero, the full young name for a young hero — regardless
 * of the raw string a caller passes (MCP create_deck enum, FaBrary "Hero:" line)
 * and regardless of path (direct create OR copyFromDeckId).
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { users, decks, deckCards, printings, cards } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let testUserId: string;
let adultHero: { printingId: string; canonical: string };
let youngHero: { printingId: string; canonical: string };

async function findHero(youngWanted: boolean) {
  const cond = youngWanted
    ? sql`'hero' = ANY(${cards.types}) AND 'young' = ANY(${cards.types})`
    : sql`'hero' = ANY(${cards.types}) AND NOT ('young' = ANY(${cards.types}))`;
  const [row] = await db
    .select({ printingId: printings.printingId, displayName: cards.displayName, name: cards.name })
    .from(printings)
    .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
    .where(cond)
    .limit(1);
  if (!row) throw new Error(`No ${youngWanted ? 'young' : 'adult'} hero printing in DB`);
  return { printingId: row.printingId, canonical: row.displayName || row.name };
}

beforeAll(async () => {
  adultHero = await findHero(false);
  youngHero = await findHero(true);
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

async function storedHeroName(publicId: string): Promise<string | null> {
  const [row] = await db.select({ heroName: decks.heroName }).from(decks).where(eq(decks.publicId, publicId)).limit(1);
  return row.heroName ?? null;
}

describe('PostgresDeckService.createDeck — hero_name canonicalization', () => {
  it('stores the full adult name when the hero card is an adult hero, overriding a non-canonical input', async () => {
    const result = await service.createDeck(testUserId, {
      name: `Adult ${Date.now()}`,
      format: 'Classic Constructed',
      heroName: 'not-the-canonical-name',
      heroPrintingId: adultHero.printingId,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(await storedHeroName(result.data.publicId)).toBe(adultHero.canonical);
    expect(result.data.heroName).toBe(adultHero.canonical);
  });

  it('stores the full young name when the hero card is a young hero, overriding a non-canonical input', async () => {
    const result = await service.createDeck(testUserId, {
      name: `Young ${Date.now()}`,
      format: 'Classic Constructed',
      heroName: 'wrong',
      heroPrintingId: youngHero.printingId,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(await storedHeroName(result.data.publicId)).toBe(youngHero.canonical);
  });

  it('still backfills hero_name from the card when the caller provides none', async () => {
    const result = await service.createDeck(testUserId, {
      name: `Backfill ${Date.now()}`,
      format: 'Classic Constructed',
      heroPrintingId: adultHero.printingId,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(await storedHeroName(result.data.publicId)).toBe(adultHero.canonical);
  });

  it('canonicalizes hero_name on a copied deck from its copied hero card', async () => {
    // Insert a source deck directly with a deliberately non-canonical hero_name
    // plus the real hero card, then copy it. The copy must derive hero_name from
    // the hero card, not inherit the source's bad string.
    const srcId = nanoid(21);
    const srcPublic = nanoid(21);
    await db.insert(decks).values({
      id: srcId,
      publicId: srcPublic,
      userId: testUserId,
      name: `Src ${Date.now()}`,
      slug: `slug-${srcPublic}`,
      format: 'Classic Constructed',
      heroName: 'bad-short-name',
      visibility: 'unlisted',
    });
    await db.insert(deckCards).values({
      id: nanoid(21),
      deckId: srcId,
      printingId: adultHero.printingId,
      quantity: 1,
      category: 'hero',
      addedAt: new Date(),
    });

    const result = await service.createDeck(testUserId, {
      name: `Copy ${Date.now()}`,
      format: 'Classic Constructed',
      copyFromDeckId: srcPublic,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(await storedHeroName(result.data.publicId)).toBe(adultHero.canonical);
  });
});
