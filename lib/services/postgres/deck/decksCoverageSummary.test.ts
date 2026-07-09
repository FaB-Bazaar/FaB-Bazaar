/**
 * Integration test for PostgresDeckService.getDecksCoverageSummary — the batch
 * "which of these decks could I build from my collection?" aggregate behind
 * the compare_collection_to_decks_to_beat MCP tool.
 *
 * Seeds two decks against one small collection and asserts the compact
 * per-deck summaries (coverage %, missing count, missing cost, top missing),
 * ranked most-buildable first.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, binders, inventoryItems, printings, decks, deckCards } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let printingA: string; // the printing the decks list (priced)
let printingB: string; // a DIFFERENT printing of the same card (what the user owns)
let printingATcgLow: number;

let testUserId: string;
let binderId: string;
let fullDeckPublicId: string;   // needs 1, user owns 1 → 100%
let partialDeckPublicId: string; // needs 2, user owns 1 → 50%

beforeAll(async () => {
  const grp = await db
    .select({ cuid: printings.cardUniqueId })
    .from(printings)
    .where(sql`${printings.tcgLow} is not null and ${printings.tcgplayerUrl} is not null`)
    .groupBy(printings.cardUniqueId)
    .having(sql`count(*) >= 2`)
    .limit(1);
  if (grp.length === 0) throw new Error('Need a card with 2+ priced printings in DB');
  const ps = await db
    .select({ printingId: printings.printingId, tcgLow: printings.tcgLow })
    .from(printings)
    .where(eq(printings.cardUniqueId, grp[0].cuid!))
    .orderBy(sql`${printings.tcgLow} is null`)
    .limit(2);
  printingA = ps[0].printingId;
  printingB = ps[1].printingId;
  printingATcgLow = Number(ps[0].tcgLow);
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  binderId = crypto.randomUUID();
  const fullDeckId = crypto.randomUUID();
  const partialDeckId = crypto.randomUUID();
  fullDeckPublicId = `t-${crypto.randomUUID().slice(0, 12)}`;
  partialDeckPublicId = `t-${crypto.randomUUID().slice(0, 12)}`;

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  await db.insert(binders).values({ id: binderId, userId: testUserId, name: `B-${binderId}` });
  await db.insert(decks).values([
    { id: fullDeckId, publicId: fullDeckPublicId, userId: testUserId, name: 'Fully Buildable' },
    { id: partialDeckId, publicId: partialDeckPublicId, userId: testUserId, name: 'Half Buildable' },
  ]);
  await db.insert(deckCards).values([
    { id: crypto.randomUUID(), deckId: fullDeckId, printingId: printingA, quantity: 1, category: 'maindeck' },
    { id: crypto.randomUUID(), deckId: partialDeckId, printingId: printingA, quantity: 2, category: 'maindeck' },
  ]);
  // The user owns ONE copy of a different printing of the same card — with
  // matchBy 'card' that satisfies one copy of the deck slot.
  await db.insert(inventoryItems).values({
    id: crypto.randomUUID(), userId: testUserId, binderId, printingId: printingB, quantity: 1, forTrade: false,
  });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('getDecksCoverageSummary', () => {
  it('returns compact per-deck coverage ranked most-buildable first', async () => {
    const res = await service.getDecksCoverageSummary(
      [partialDeckPublicId, fullDeckPublicId],
      testUserId,
      { matchBy: 'card' },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toHaveLength(2);

    // ranked by coverage desc → the 100% deck first
    const [full, partial] = res.data;
    expect(full.publicId).toBe(fullDeckPublicId);
    expect(full.deckName).toBe('Fully Buildable');
    expect(full.totalNeeded).toBe(1);
    expect(full.totalOwned).toBe(1);
    expect(full.coveragePct).toBe(100);
    expect(full.missingCards).toBe(0);
    expect(full.topMissing).toHaveLength(0);

    expect(partial.publicId).toBe(partialDeckPublicId);
    expect(partial.totalNeeded).toBe(2);
    expect(partial.totalOwned).toBe(1);
    expect(partial.coveragePct).toBe(50);
    expect(partial.missingCards).toBe(1); // one slot short
    // shortage of 1 copy priced at the representative printing's tcgLow
    expect(partial.missingCost).toBeCloseTo(printingATcgLow, 2);
    expect(partial.topMissing.length).toBe(1);
    expect(partial.topMissing[0].shortage).toBe(1);
    expect(typeof partial.topMissing[0].cardName).toBe('string');
  });

  it('skips unknown publicIds instead of failing the batch', async () => {
    const res = await service.getDecksCoverageSummary(
      ['nonexistent-deck-id', fullDeckPublicId],
      testUserId,
      { matchBy: 'card' },
    );
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toHaveLength(1);
    expect(res.data[0].publicId).toBe(fullDeckPublicId);
  });

  it('rejects an empty id list', async () => {
    const res = await service.getDecksCoverageSummary([], testUserId, { matchBy: 'card' });
    expect(res.success).toBe(false);
  });
});
