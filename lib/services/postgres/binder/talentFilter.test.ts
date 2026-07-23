/**
 * Integration tests for PostgresBinderService.getBinderCards talent filter
 *
 * Runs against the real local PostgreSQL database.
 * Requires POSTGRES_URL in .env.local (loaded by vitest.setup.ts via loadEnvConfig).
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, binders, inventoryItems, printings, cards } from '@/lib/postgres/schema';
import { PostgresBinderService } from './PostgresBinderService';

const service = new PostgresBinderService();

let testUserId: string;
let binderId: string;
let talent: string;
let talentedPrintingId: string;
let talentlessPrintingId: string;

beforeAll(async () => {
  // Any printing whose card carries at least one talent
  const [talented] = await db
    .select({ printingId: printings.printingId, talents: cards.talents })
    .from(printings)
    .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
    .where(sql`coalesce(array_length(${cards.talents}, 1), 0) > 0`)
    .orderBy(printings.printingId)
    .limit(1);
  // And one whose card has no talents at all
  const [talentless] = await db
    .select({ printingId: printings.printingId })
    .from(printings)
    .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
    .where(sql`coalesce(array_length(${cards.talents}, 1), 0) = 0`)
    .orderBy(sql`${printings.printingId} DESC`)
    .limit(1);
  if (!talented || !talentless) {
    throw new Error('Need both a talented and a talentless printing in DB to run talent filter tests');
  }
  talent = talented.talents![0];
  talentedPrintingId = talented.printingId;
  talentlessPrintingId = talentless.printingId;
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  binderId = crypto.randomUUID();

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  await db.insert(binders).values({ id: binderId, userId: testUserId, name: `Binder ${binderId}` });

  await db.insert(inventoryItems).values([
    { id: crypto.randomUUID(), userId: testUserId, binderId, printingId: talentedPrintingId, quantity: 2, condition: 'NM', language: 'EN', forTrade: true, forSale: false },
    { id: crypto.randomUUID(), userId: testUserId, binderId, printingId: talentlessPrintingId, quantity: 3, condition: 'NM', language: 'EN', forTrade: true, forSale: false },
  ]);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('PostgresBinderService.getBinderCards talent filter', () => {
  it('returns only cards carrying the requested talent', async () => {
    const result = await service.getBinderCards(binderId, { talent }, { page: 1, limit: 48 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.cards).toHaveLength(1);
    expect(result.data.cards[0].printingId).toBe(talentedPrintingId);
    expect(result.data.pagination.totalQuantity).toBe(2);
  });

  it('returns everything when no talent filter is set', async () => {
    const result = await service.getBinderCards(binderId, {}, { page: 1, limit: 48 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.cards).toHaveLength(2);
  });

  it('returns nothing for a talent no card in the binder has', async () => {
    // A binder containing only the talentless card can't match any talent
    await db.delete(inventoryItems).where(eq(inventoryItems.printingId, talentedPrintingId));
    const result = await service.getBinderCards(binderId, { talent }, { page: 1, limit: 48 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.cards).toHaveLength(0);
    expect(result.data.pagination.totalQuantity).toBe(0);
  });

  it('composes with other filters (forTrade)', async () => {
    const result = await service.getBinderCards(binderId, { talent, forTrade: false }, { page: 1, limit: 48 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.cards).toHaveLength(0);
  });
});
