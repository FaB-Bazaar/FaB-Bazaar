/**
 * Integration tests for the binder metadata priceUpdatedAt source.
 *
 * The "Prices updated X" label must reflect the nightly price sync's
 * completion time (site_settings.prices_last_run_at, written by pipeline
 * step 006), NOT MAX(printings.price_updated_at) — the MAX only moves when a
 * price CHANGES, so one repriced card made the whole binder read "today"
 * while unchanged-but-checked prices read stale. MAX remains the fallback
 * when the pipeline has never recorded a run.
 *
 * Runs against the real local PostgreSQL database (POSTGRES_URL in .env.local).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, binders, inventoryItems, printings, siteSettings } from '@/lib/postgres/schema';
import { PostgresBinderService } from './PostgresBinderService';

const service = new PostgresBinderService();
const KEY = 'prices_last_run_at';

let testUserId: string;
let binderId: string;
let printingId: string;
let printingPriceUpdatedAt: Date | null;
let savedValue: unknown | undefined; // pre-test key value, restored afterAll

beforeAll(async () => {
  const [row] = await db
    .select({ printingId: printings.printingId, ts: printings.priceUpdatedAt })
    .from(printings)
    .where(isNotNull(printings.priceUpdatedAt))
    .limit(1);
  if (!row) throw new Error('Need a printing with price_updated_at to run these tests');
  printingId = row.printingId;
  printingPriceUpdatedAt = row.ts;

  const existing = await db.select().from(siteSettings).where(eq(siteSettings.key, KEY)).limit(1);
  savedValue = existing[0]?.value;
});

afterAll(async () => {
  // Put the local instance back the way we found it.
  await db.delete(siteSettings).where(eq(siteSettings.key, KEY));
  if (savedValue !== undefined) {
    await db.insert(siteSettings).values({ key: KEY, value: savedValue });
  }
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  binderId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  await db.insert(binders).values({ id: binderId, userId: testUserId, name: `Binder ${binderId}` });
  await db.insert(inventoryItems).values([
    { id: crypto.randomUUID(), userId: testUserId, binderId, printingId, quantity: 1, condition: 'NM', language: 'EN', forTrade: false, forSale: false },
  ]);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('binder metadata priceUpdatedAt', () => {
  it('reports the pipeline run time from site_settings when present', async () => {
    // Stored the way the pipeline writes it: to_jsonb(now()) → JSON string.
    const runTs = '2020-01-02T03:04:05.000Z';
    await db.insert(siteSettings)
      .values({ key: KEY, value: runTs })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: runTs, updatedAt: new Date() } });

    const result = await service.getBinderCards(binderId, {}, { page: 1, limit: 10 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.metadata.priceUpdatedAt).toBeInstanceOf(Date);
    expect(result.data.metadata.priceUpdatedAt!.toISOString()).toBe(runTs);
  });

  it('falls back to MAX(printings.price_updated_at) when the key is absent', async () => {
    await db.delete(siteSettings).where(eq(siteSettings.key, KEY));

    const result = await service.getBinderCards(binderId, {}, { page: 1, limit: 10 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.metadata.priceUpdatedAt?.getTime()).toBe(printingPriceUpdatedAt?.getTime());
  });

  it('falls back to MAX when the stored value is not a parseable timestamp', async () => {
    await db.insert(siteSettings)
      .values({ key: KEY, value: { bogus: true } })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: { bogus: true }, updatedAt: new Date() } });

    const result = await service.getBinderCards(binderId, {}, { page: 1, limit: 10 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.metadata.priceUpdatedAt?.getTime()).toBe(printingPriceUpdatedAt?.getTime());
  });
});
