/**
 * Integration tests for PostgresDeckService.listPublicDecks hero image resolution.
 *
 * Community/Decks-to-Beat tiles need the hero printing's stored image_url
 * (printing_id-keyed Cloudflare images were deleted 2026-07, so the client
 * cannot construct a URL from heroPrintingId). listPublicDecks must populate
 * heroImageUrl the same way listUserDecksBasic does for personal deck tiles.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq, isNotNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { users, decks, deckCards, printings } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let heroPrintingId: string;
let heroImageUrl: string;
let testUserId: string;
let deckWithHeroId: string;
let deckWithoutHeroId: string;

const HERO_NAME = 'zz-heroimage test hero';

beforeAll(async () => {
  // Any real printing with a stored image_url works as the deck's hero row —
  // listPublicDecks reads deck_cards.category, not the card's types.
  const [printing] = await db
    .select({ printingId: printings.printingId, imageUrl: printings.imageUrl })
    .from(printings)
    .where(isNotNull(printings.imageUrl))
    .limit(1);
  heroPrintingId = printing.printingId;
  heroImageUrl = printing.imageUrl!;
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  deckWithHeroId = crypto.randomUUID();
  deckWithoutHeroId = crypto.randomUUID();

  await db.insert(users).values({
    id: testUserId,
    username: `test_${testUserId.slice(0, 8)}`,
    email: `${testUserId.slice(0, 8)}@test.local`,
  } as any);

  // 'Casual' dodges the format-size HAVING clause (a hero-only CC deck is
  // filtered out of public listings as invalid).
  await db.insert(decks).values([
    {
      id: deckWithHeroId,
      publicId: nanoid(21),
      userId: testUserId,
      name: 'Hero image test deck',
      format: 'Casual',
      heroName: HERO_NAME,
      visibility: 'public',
    },
    {
      id: deckWithoutHeroId,
      publicId: nanoid(21),
      userId: testUserId,
      name: 'Heroless image test deck',
      format: 'Casual',
      heroName: HERO_NAME,
      visibility: 'public',
    },
  ] as any);

  await db.insert(deckCards).values({
    id: crypto.randomUUID(),
    deckId: deckWithHeroId,
    printingId: heroPrintingId,
    category: 'hero',
    quantity: 1,
  } as any);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId)); // cascade removes decks + deck_cards
});

describe('PostgresDeckService.listPublicDecks hero image', () => {
  it("returns the hero printing's stored image_url as heroImageUrl", async () => {
    const res = await service.listPublicDecks({ heroName: HERO_NAME }, { limit: 10 });
    expect(res.success).toBe(true);
    if (!res.success) return;

    const deck = res.data.decks.find((d) => d._id === deckWithHeroId);
    expect(deck).toBeDefined();
    expect(deck!.heroImageUrl).toBe(heroImageUrl);
    // heroPrintingId stays populated (public API field)
    expect(deck!.heroPrintingId).toBe(heroPrintingId);
  });

  it('leaves heroImageUrl undefined for a deck with no hero row', async () => {
    const res = await service.listPublicDecks({ heroName: HERO_NAME }, { limit: 10 });
    expect(res.success).toBe(true);
    if (!res.success) return;

    const deck = res.data.decks.find((d) => d._id === deckWithoutHeroId);
    expect(deck).toBeDefined();
    expect(deck!.heroImageUrl).toBeUndefined();
  });
});
