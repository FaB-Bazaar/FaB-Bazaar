/**
 * Regression tests for hero legality on the add-card path covering two
 * gaps left after the `addPrintingsHeroFromDb` fix:
 *
 *   1. Essence-granting heroes (Terra grants earth, Tuffnut grants the
 *      revered talent pool, etc.) were rejected because the DB-derived
 *      heroInfo path only set { classes, talents } and never populated
 *      essences. The cards.essences column is the source of truth.
 *
 *   2. The `revered` and `reviled` talents weren't in the OFFICIAL_TALENTS
 *      filter used to derive hero.talents from cards.types — so Tuffnut
 *      (talents={revered}) had hero.talents=[] and rejected every revered
 *      card. Reading `cards.talents` directly avoids the OFFICIAL_TALENTS
 *      filter entirely.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { users, decks, cards, printings } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let testUserId: string;
let earthGuardianPrintingId: string;
let reveredBrutePrintingId: string;

beforeAll(async () => {
  // Earth-talent generic card — should be legal on Terra (Guardian + earth essence).
  // Use Felling of the Crown: classes=['generic'], talents=['earth'].
  const earthRow = await db
    .select({ id: printings.printingId })
    .from(printings)
    .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
    .where(eq(cards.name, 'felling of the crown'))
    .limit(1);
  if (!earthRow[0]) throw new Error('Need Felling of the Crown in DB');
  earthGuardianPrintingId = earthRow[0].id;

  // Revered-talent brute card — should be legal on Tuffnut (Brute + revered talent).
  // Use Wind Up the Crowd: classes=['brute'], talents=['revered'].
  const reveredRow = await db
    .select({ id: printings.printingId })
    .from(printings)
    .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
    .where(eq(cards.name, 'wind up the crowd'))
    .limit(1);
  if (!reveredRow[0]) throw new Error('Need Wind Up the Crowd in DB');
  reveredBrutePrintingId = reveredRow[0].id;
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('PostgresDeckService.addPrintings — hero essences and full talent set from DB', () => {
  it('accepts an earth-talent card on a Terra deck (essence granted by hero keyword "essence of earth")', async () => {
    const id = nanoid(21);
    const publicId = nanoid(21);
    await db.insert(decks).values({
      id,
      publicId,
      userId: testUserId,
      name: `Terra test ${publicId}`,
      slug: `slug-${publicId}`,
      format: 'Blitz',
      heroName: 'terra',
      visibility: 'private',
    });

    const result = await service.addPrintings(publicId, testUserId, [
      { printingId: earthGuardianPrintingId, quantity: 1, category: 'maindeck' },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const item = result.data.results[0];
    expect(item.error).toBeUndefined();
    expect(item.success).toBe(true);
    expect(result.data.summary.added).toBe(1);
    expect(result.data.summary.failed).toBe(0);
  });

  it('accepts a revered-talent card on a Tuffnut deck (revered must be recognized as a talent)', async () => {
    const id = nanoid(21);
    const publicId = nanoid(21);
    await db.insert(decks).values({
      id,
      publicId,
      userId: testUserId,
      name: `Tuffnut test ${publicId}`,
      slug: `slug-${publicId}`,
      format: 'Blitz',
      heroName: 'tuffnut',
      visibility: 'private',
    });

    const result = await service.addPrintings(publicId, testUserId, [
      { printingId: reveredBrutePrintingId, quantity: 1, category: 'maindeck' },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const item = result.data.results[0];
    expect(item.error).toBeUndefined();
    expect(item.success).toBe(true);
    expect(result.data.summary.added).toBe(1);
    expect(result.data.summary.failed).toBe(0);
  });
});
