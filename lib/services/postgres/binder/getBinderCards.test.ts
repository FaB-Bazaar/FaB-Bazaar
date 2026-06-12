/**
 * Integration tests for PostgresBinderService.getBinderCards
 *
 * Runs against the real local PostgreSQL database.
 * Requires POSTGRES_URL in .env.local (loaded by vitest.setup.ts via loadEnvConfig).
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq, and, isNull, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, binders, inventoryItems, printings } from '@/lib/postgres/schema';
import { PostgresBinderService } from './PostgresBinderService';

const service = new PostgresBinderService();

let testUserId: string;
let binderId: string;
let pricedPrintingId: string;
let unpricedPrintingId: string;

beforeAll(async () => {
  const [priced] = await db
    .select({ printingId: printings.printingId })
    .from(printings)
    .where(and(isNotNull(printings.tcgLow), isNotNull(printings.tcgMarket)))
    .limit(1);
  const [unpriced] = await db
    .select({ printingId: printings.printingId })
    .from(printings)
    .where(and(isNull(printings.tcgLow), isNull(printings.tcgMarket)))
    .limit(1);
  if (!priced || !unpriced) {
    throw new Error('Need both a priced and an unpriced printing in DB to run getBinderCards tests');
  }
  pricedPrintingId = priced.printingId;
  unpricedPrintingId = unpriced.printingId;
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  binderId = crypto.randomUUID();

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  await db.insert(binders).values({ id: binderId, userId: testUserId, name: `Binder ${binderId}` });

  // 3 items: priced qty 2 (for trade), priced qty 3, unpriced qty 5 → total quantity 10
  await db.insert(inventoryItems).values([
    { id: crypto.randomUUID(), userId: testUserId, binderId, printingId: pricedPrintingId, quantity: 2, condition: 'NM', language: 'EN', forTrade: true, forSale: false },
    { id: crypto.randomUUID(), userId: testUserId, binderId, printingId: pricedPrintingId, quantity: 3, condition: 'LP', language: 'EN', forTrade: false, forSale: false },
    { id: crypto.randomUUID(), userId: testUserId, binderId, printingId: unpricedPrintingId, quantity: 5, condition: 'NM', language: 'EN', forTrade: false, forSale: false },
  ]);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('PostgresBinderService.getBinderCards pagination.totalQuantity', () => {
  it('reports the total quantity of ALL matching items, not just the current page', async () => {
    const result = await service.getBinderCards(binderId, {}, { page: 1, limit: 2 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.cards).toHaveLength(2);
    expect(result.data.pagination.total).toBe(3);
    expect(result.data.pagination.totalQuantity).toBe(10);
  });

  it('totalQuantity respects active filters', async () => {
    const result = await service.getBinderCards(binderId, { forTrade: true }, { page: 1, limit: 48 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.pagination.totalQuantity).toBe(2);
  });

  it('totalQuantity is 0 when nothing matches', async () => {
    const result = await service.getBinderCards(binderId, { search: 'zzz-no-such-card-zzz' }, { page: 1, limit: 48 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.pagination.totalQuantity).toBe(0);
  });
});

describe('PostgresBinderService.getBinderCards price sorts put unpriced cards last', () => {
  it('tcg-low-desc returns priced cards before NULL-priced cards', async () => {
    const result = await service.getBinderCards(binderId, {}, { page: 1, limit: 48, sortBy: 'tcg-low-desc' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.cards).toHaveLength(3);
    expect(result.data.cards[0].printingId).toBe(pricedPrintingId);
    expect(result.data.cards[1].printingId).toBe(pricedPrintingId);
    expect(result.data.cards[2].printingId).toBe(unpricedPrintingId);
  });

  it('tcg-market-desc returns priced cards before NULL-priced cards', async () => {
    const result = await service.getBinderCards(binderId, {}, { page: 1, limit: 48, sortBy: 'tcg-market-desc' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.cards).toHaveLength(3);
    expect(result.data.cards[0].printingId).toBe(pricedPrintingId);
    expect(result.data.cards[2].printingId).toBe(unpricedPrintingId);
  });
});
