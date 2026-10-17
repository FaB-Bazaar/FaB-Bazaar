/**
 * Integration tests for Cardmarket (EUR) prices in binders (migration 0126).
 *
 * Viewers with users.cardmarket_prices see Cardmarket € instead of TCGplayer $.
 * The Cardmarket price of a printing is cardmarket_trend, else cardmarket_low
 * (rows written nightly by pipeline step 012). A card with neither has NO €
 * price: it sorts last and adds nothing to the € total — never its $ price.
 *
 * Uses printings that already carry Cardmarket data from a local pipeline run
 * (read-only), so no shared rows are modified.
 *
 * Runs against the real local PostgreSQL database (POSTGRES_URL in .env.local).
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, binders, inventoryItems } from '@/lib/postgres/schema';
import { PostgresBinderService } from './PostgresBinderService';

const service = new PostgresBinderService();

let trendPrinting: { id: string; trend: number; url: string };
let lowOnlyPrinting: { id: string; low: number };
let noCmPrinting: string;
let testUserId: string;
let binderId: string;

async function pick(where: string, order: string) {
  const r = await db.execute(sql.raw(
    `SELECT printing_id, cardmarket_trend::float AS trend, cardmarket_low::float AS low, cardmarket_url AS url
     FROM printings WHERE language = 'en' AND ${where} ORDER BY ${order} LIMIT 1`,
  ));
  return r.rows[0] as { printing_id: string; trend: number | null; low: number | null; url: string | null } | undefined;
}

beforeAll(async () => {
  const a = await pick('cardmarket_trend BETWEEN 5 AND 50', 'printing_id');
  const b = await pick('cardmarket_trend IS NULL AND cardmarket_low BETWEEN 0.01 AND 1', 'printing_id DESC');
  const c = await pick('cardmarket_product_id IS NULL AND tcg_low > 0', 'printing_id');
  if (!a || !b || !c) throw new Error('Need Cardmarket-priced printings: run pipeline step 012 locally first');
  trendPrinting = { id: a.printing_id, trend: a.trend!, url: a.url! };
  lowOnlyPrinting = { id: b.printing_id, low: b.low! };
  noCmPrinting = c.printing_id;
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  binderId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  await db.insert(binders).values({ id: binderId, userId: testUserId, name: `Binder ${binderId}` });
  const item = (printingId: string, quantity: number) => ({
    id: crypto.randomUUID(), userId: testUserId, binderId, printingId, quantity,
    condition: 'NM' as const, language: 'EN', forTrade: false, forSale: false,
  });
  await db.insert(inventoryItems).values([
    item(noCmPrinting, 1), item(lowOnlyPrinting.id, 3), item(trendPrinting.id, 2),
  ]);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('binder Cardmarket prices', () => {
  it('cards carry the Cardmarket price (trend, else low) and link', async () => {
    const result = await service.getBinderCards(binderId, {}, { page: 1, limit: 10 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const byId = Object.fromEntries(result.data.cards.map((c) => [c.printingId, c]));
    expect(byId[trendPrinting.id].cardmarket_price).toBe(trendPrinting.trend);
    expect(byId[trendPrinting.id].cardmarket_url).toBe(trendPrinting.url);
    expect(byId[lowOnlyPrinting.id].cardmarket_price).toBe(lowOnlyPrinting.low);
    expect(byId[noCmPrinting].cardmarket_price).toBeUndefined();
  });

  it('sorts by Cardmarket price with unpriced cards last', async () => {
    const result = await service.getBinderCards(binderId, {}, { page: 1, limit: 10, sortBy: 'cardmarket-desc' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.cards.map((c) => c.printingId)).toEqual([trendPrinting.id, lowOnlyPrinting.id, noCmPrinting]);
  });

  it('reports when the Cardmarket prices were generated (the price guide date)', async () => {
    const r = await db.execute(sql.raw(
      `SELECT max(cardmarket_price_updated_at) AS ts FROM printings
       WHERE printing_id IN ('${trendPrinting.id}', '${lowOnlyPrinting.id}', '${noCmPrinting}')`,
    ));
    const expected = new Date((r.rows[0] as { ts: string }).ts);
    const result = await service.getBinderCards(binderId, {}, { page: 1, limit: 10 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.metadata.cardmarketPriceUpdatedAt).toBeInstanceOf(Date);
    expect(result.data.metadata.cardmarketPriceUpdatedAt!.getTime()).toBe(expected.getTime());
  });

  it('totals € value and counts the copies without a Cardmarket price', async () => {
    const result = await service.getBinderCards(binderId, {}, { page: 1, limit: 10 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const stats = result.data.metadata.stats!;
    expect(stats.totalValue!.cardmarket).toBeCloseTo(2 * trendPrinting.trend + 3 * lowOnlyPrinting.low, 2);
    expect(stats.cardmarketUnpricedCards).toBe(1);
  });
});
