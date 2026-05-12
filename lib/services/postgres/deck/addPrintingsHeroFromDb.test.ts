/**
 * Regression test for the hero-talent legality bug where add-card validation
 * read hero classes/talents from the hand-maintained static roster
 * (`getHeroInfo`) which had stale entries — e.g. `'arakni, web of deceit'`
 * stored `talents: []` even though the actual hero card in the DB has
 * `types = ['chaos', 'assassin', 'hero', 'young']`. Adding a chaos card to a
 * Web-of-Deceit deck was rejected with "talent 'chaos' not legal".
 *
 * The fix resolves hero classes/talents from the `cards` row keyed on
 * `deck.heroName`, falling back to `getHeroInfo` only when the row is missing.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { users, decks, cards, printings } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let testUserId: string;
let chaosAssassinPrintingId: string;

beforeAll(async () => {
  // Need any non-hero (category != 'hero') printing whose card has both
  // 'chaos' in talents and 'assassin' in classes — the demi-hero Arakni
  // variants are the only such cards in the DB right now, and they slot
  // into the deck's 'inventory' category.
  const row = await db
    .select({ id: printings.printingId })
    .from(printings)
    .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
    .where(eq(cards.name, 'arakni, orb-weaver'))
    .limit(1);
  if (!row[0]) throw new Error('Need Arakni, Orb-Weaver in DB');
  chaosAssassinPrintingId = row[0].id;
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('PostgresDeckService.addPrintings — hero info resolved from DB, not the static roster', () => {
  it('accepts a chaos card on an Arakni, Web of Deceit deck even though the static roster has talents: []', async () => {
    const id = nanoid(21);
    const publicId = nanoid(21);
    await db.insert(decks).values({
      id,
      publicId,
      userId: testUserId,
      name: `WoD test ${publicId}`,
      slug: `slug-${publicId}`,
      format: 'Silver Age',
      heroName: 'arakni, web of deceit',
      visibility: 'private',
    });

    const result = await service.addPrintings(publicId, testUserId, [
      { printingId: chaosAssassinPrintingId, quantity: 1, category: 'inventory' },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const item = result.data.results[0];
    expect(item.success).toBe(true);
    expect(item.error).toBeUndefined();
    expect(result.data.summary.added).toBe(1);
    expect(result.data.summary.failed).toBe(0);
  });
});
