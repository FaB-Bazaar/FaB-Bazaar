/**
 * Integration tests for PostgresDeckService.createDeck with copyFromDeckId +
 * copyLanguage. Copying a deck in a target language should convert each card to
 * its closest printing in that language, retaining the original printing when
 * the card has no printing in that language.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { users, decks, deckCards, printings } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let testUserId: string;
let sourcePublicId: string;
let enWithFrId: string; // en printing whose card HAS a fr printing
let enNoFrId: string;   // en printing whose card has NO fr printing

beforeAll(async () => {
  const pair = await db.execute(sql`
    SELECT en.printing_id AS en
    FROM printings en JOIN printings fr ON en.card_unique_id = fr.card_unique_id
    WHERE en.language = 'en' AND fr.language = 'fr' LIMIT 1`);
  if (!pair.rows.length) throw new Error('Need an en card with a fr printing in DB');
  enWithFrId = pair.rows[0].en as string;

  const noFr = await db.execute(sql`
    SELECT en.printing_id AS en FROM printings en
    WHERE en.language = 'en'
      AND NOT EXISTS (SELECT 1 FROM printings f WHERE f.card_unique_id = en.card_unique_id AND f.language = 'fr')
    LIMIT 1`);
  if (!noFr.rows.length) throw new Error('Need an en printing with no fr variant in DB');
  enNoFrId = noFr.rows[0].en as string;
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  const internalId = nanoid(21);
  sourcePublicId = nanoid(21);
  await db.insert(decks).values({
    id: internalId,
    publicId: sourcePublicId,
    userId: testUserId,
    name: `Source ${sourcePublicId}`,
    slug: `slug-${sourcePublicId}`,
    format: 'Classic Constructed',
    visibility: 'unlisted',
  });
  await db.insert(deckCards).values([
    { id: nanoid(21), deckId: internalId, printingId: enWithFrId, quantity: 1, category: 'maindeck', addedAt: new Date() },
    { id: nanoid(21), deckId: internalId, printingId: enNoFrId, quantity: 2, category: 'maindeck', addedAt: new Date() },
  ]);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

async function copiedCards(copyPublicId: string) {
  const row = await db.select({ id: decks.id }).from(decks).where(eq(decks.publicId, copyPublicId)).limit(1);
  return db
    .select({ printingId: deckCards.printingId, quantity: deckCards.quantity, language: printings.language })
    .from(deckCards)
    .leftJoin(printings, eq(deckCards.printingId, printings.printingId))
    .where(eq(deckCards.deckId, row[0].id));
}

describe('PostgresDeckService.createDeck — copyFromDeckId + copyLanguage', () => {
  it('converts cards to the target language where a printing exists', async () => {
    const result = await service.createDeck(testUserId, {
      name: `Copy fr ${sourcePublicId}`,
      format: 'Classic Constructed',
      copyFromDeckId: sourcePublicId,
      copyLanguage: 'fr',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const cards = await copiedCards(result.data.publicId);
    expect(cards.length).toBe(2);

    // The card with a fr printing is now in French.
    const fr = cards.find((c) => c.language === 'fr');
    expect(fr).toBeDefined();
    expect(fr!.printingId).not.toBe(enWithFrId);
  });

  it('retains the original printing for cards with no target-language printing', async () => {
    const result = await service.createDeck(testUserId, {
      name: `Copy fr keep ${sourcePublicId}`,
      format: 'Classic Constructed',
      copyFromDeckId: sourcePublicId,
      copyLanguage: 'fr',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const cards = await copiedCards(result.data.publicId);
    const kept = cards.find((c) => c.printingId === enNoFrId);
    expect(kept).toBeDefined();
    expect(kept!.quantity).toBe(2); // quantity preserved
  });

  it('copies verbatim when copyLanguage is omitted', async () => {
    const result = await service.createDeck(testUserId, {
      name: `Copy en ${sourcePublicId}`,
      format: 'Classic Constructed',
      copyFromDeckId: sourcePublicId,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const cards = await copiedCards(result.data.publicId);
    const ids = cards.map((c) => c.printingId).sort();
    expect(ids).toEqual([enWithFrId, enNoFrId].sort());
  });
});
