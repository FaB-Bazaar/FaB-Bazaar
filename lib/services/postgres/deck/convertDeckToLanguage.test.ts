/**
 * Integration tests for PostgresDeckService.convertDeckToLanguage.
 * Plans (does not apply) the exact-variant language swaps for a deck.
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
let deckPublicId: string;
let swapEnId: string; // en printing that has a same-variant fr printing
let swapFrId: string; // the matching fr printing
let skipEnId: string; // en printing whose card has NO fr printing

beforeAll(async () => {
  const pair = await db.execute(sql`
    SELECT en.printing_id AS en, fr.printing_id AS fr
    FROM printings en JOIN printings fr
      ON en.card_unique_id = fr.card_unique_id AND en.set = fr.set
         AND en.edition = fr.edition AND en.foiling = fr.foiling
    WHERE en.language = 'en' AND fr.language = 'fr' LIMIT 1`);
  if (!pair.rows.length) throw new Error('Need an en/fr same-variant pair in DB');
  swapEnId = pair.rows[0].en as string;
  swapFrId = pair.rows[0].fr as string;

  const skip = await db.execute(sql`
    SELECT en.printing_id AS en FROM printings en
    WHERE en.language = 'en'
      AND NOT EXISTS (SELECT 1 FROM printings f WHERE f.card_unique_id = en.card_unique_id AND f.language = 'fr')
    LIMIT 1`);
  if (!skip.rows.length) throw new Error('Need an en printing with no fr variant in DB');
  skipEnId = skip.rows[0].en as string;
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  const internalId = nanoid();
  deckPublicId = nanoid();
  await db.insert(decks).values({ id: internalId, userId: testUserId, name: 'lang test', publicId: deckPublicId });
  await db.insert(deckCards).values([
    { id: nanoid(), deckId: internalId, printingId: swapEnId, quantity: 1, category: 'maindeck' },
    { id: nanoid(), deckId: internalId, printingId: skipEnId, quantity: 1, category: 'maindeck' },
  ]);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('PostgresDeckService.convertDeckToLanguage', () => {
  it('plans a swap to the same-variant printing in the target language', async () => {
    const res = await service.convertDeckToLanguage(deckPublicId, testUserId, 'fr');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.swaps).toContainEqual(
      expect.objectContaining({ currentPrintingId: swapEnId, newPrintingId: swapFrId }),
    );
  });

  it('skips a card with no printing in the target language (leaves it as-is)', async () => {
    const res = await service.convertDeckToLanguage(deckPublicId, testUserId, 'fr');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.skipped.map((s) => s.printingId)).toContain(skipEnId);
    expect(res.data.swaps.map((s) => s.currentPrintingId)).not.toContain(skipEnId);
  });
});
