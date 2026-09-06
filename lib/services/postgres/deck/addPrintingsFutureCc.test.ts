/**
 * Integration tests: PostgresDeckService.addPrintings on a Future Classic
 * Constructed deck accepts cards from future-dated sets that are not yet
 * cc_legal, while a plain CC deck still rejects them.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { users, decks, cards, printings, sets } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

const rand = crypto.randomUUID().slice(0, 6);
const futureSet = `zd${rand.slice(0, 3)}`;
const futureCardId = `test-fccdeck-${rand}`;
let futurePrintingId: string;
let testUserId: string;
let fccDeckPublicId: string;
let ccDeckPublicId: string;

beforeAll(async () => {
  const base = 800_000 + Math.floor(Math.random() * 1_000_000);
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 45);
  await db.insert(sets).values({
    code: futureSet, displayCode: futureSet.toUpperCase(), name: `Test Future Deck ${rand}`,
    releaseDate: d.toISOString().slice(0, 10), releaseOrder: base, displayOrder: base, category: 'standard',
  });
  await db.insert(cards).values({
    cardUniqueId: futureCardId, name: `test fcc deck card ${rand}`, displayName: `Test FCC Deck Card ${rand}`,
    types: ['action'], classes: ['warrior'], ccLegal: false, // warrior (Dorinthea's class) — NOT generic: sibling tests count generic cards live
  });
  futurePrintingId = nanoid(21);
  await db.insert(printings).values({
    printingId: futurePrintingId, cardUniqueId: futureCardId, set: futureSet,
    collectorNumber: `${futureSet.toUpperCase()}001`, edition: 'N', foiling: 'S', rarity: 'C',
  });
});

afterAll(async () => {
  await db.delete(printings).where(eq(printings.printingId, futurePrintingId));
  await db.delete(cards).where(eq(cards.cardUniqueId, futureCardId));
  await db.delete(sets).where(eq(sets.code, futureSet));
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  fccDeckPublicId = nanoid(21);
  ccDeckPublicId = nanoid(21);
  await db.insert(decks).values([
    { id: nanoid(21), publicId: fccDeckPublicId, userId: testUserId, name: `FCC ${fccDeckPublicId}`, slug: `slug-${fccDeckPublicId}`, format: 'Future Classic Constructed', heroName: 'dorinthea ironsong', visibility: 'private' },
    { id: nanoid(21), publicId: ccDeckPublicId, userId: testUserId, name: `CC ${ccDeckPublicId}`, slug: `slug-${ccDeckPublicId}`, format: 'Classic Constructed', heroName: 'dorinthea ironsong', visibility: 'private' },
  ]);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('addPrintings — Future Classic Constructed', () => {
  it('accepts a future-set card that is not cc_legal yet', async () => {
    const result = await service.addPrintings(fccDeckPublicId, testUserId, [
      { printingId: futurePrintingId, quantity: 3, category: 'maindeck' },
    ]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.results[0]).toMatchObject({ printingId: futurePrintingId, success: true });
  });

  it('a plain CC deck still rejects the same card', async () => {
    const result = await service.addPrintings(ccDeckPublicId, testUserId, [
      { printingId: futurePrintingId, quantity: 1, category: 'maindeck' },
    ]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.results[0].success).toBe(false);
    expect(result.data.results[0].error).toContain('not legal in Classic Constructed');
  });

  it('enforces the 3-copy limit', async () => {
    const result = await service.addPrintings(fccDeckPublicId, testUserId, [
      { printingId: futurePrintingId, quantity: 4, category: 'maindeck' },
    ]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.results[0].success).toBe(false);
  });
});
