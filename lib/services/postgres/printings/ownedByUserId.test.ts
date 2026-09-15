/**
 * Integration tests for the `ownedByUserId` search filter: restrict results to
 * printings the user holds in their collection (inventory_items with quantity
 * > 0). Printing-level on purpose — the deck builder's "Your collection"
 * toggle should surface the exact printing you own, so a grouped search picks
 * its representative from the owned printings only.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, binders, inventoryItems } from '@/lib/postgres/schema';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();
const owner = `test-owned-${crypto.randomUUID()}`;
const stranger = `test-owned-stranger-${crypto.randomUUID()}`;
const binderId = crypto.randomUUID();
let ownedPrintingId: string;
let ownedCardId: string;
let zeroQtyPrintingId: string;

beforeAll(async () => {
  // A card with several English printings; own its LAST printing so the
  // grouped representative (normally the earliest set) must come from the
  // owned rows to be correct.
  const r = await db.execute(sql`
    SELECT p.printing_id, p.card_unique_id FROM printings p
    WHERE p.language = 'en' AND p.card_unique_id IN (
      SELECT card_unique_id FROM printings WHERE language = 'en' GROUP BY card_unique_id HAVING count(*) >= 3
    )
    ORDER BY p.card_unique_id ASC, p.set DESC, p.printing_id DESC LIMIT 1`);
  ownedPrintingId = (r.rows[0] as any).printing_id;
  ownedCardId = (r.rows[0] as any).card_unique_id;
  const z = await db.execute(sql`SELECT printing_id FROM printings WHERE language = 'en' AND card_unique_id <> ${ownedCardId} ORDER BY printing_id DESC LIMIT 1`);
  zeroQtyPrintingId = (z.rows[0] as any).printing_id;

  await db.insert(users).values([{ id: owner, username: owner }, { id: stranger, username: stranger }]);
  await db.insert(binders).values({ id: binderId, userId: owner, name: `Binder ${binderId}` });
  await db.insert(inventoryItems).values([
    { id: crypto.randomUUID(), userId: owner, binderId, printingId: ownedPrintingId, quantity: 2, condition: 'NM', language: 'EN', forTrade: false, forSale: false },
    { id: crypto.randomUUID(), userId: owner, binderId, printingId: zeroQtyPrintingId, quantity: 0, condition: 'NM', language: 'EN', forTrade: false, forSale: false },
  ]);
});

afterAll(async () => {
  await db.delete(users).where(eq(users.id, owner));
  await db.delete(users).where(eq(users.id, stranger));
});

describe('PostgresPrintingsService — ownedByUserId filter', () => {
  it('returns only printings in the user\'s collection', async () => {
    const res = await service.searchPrintings({ ownedByUserId: owner }, { limit: 50, groupByCard: false });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.total).toBe(1);
    expect(res.data.printings.map((p) => p.printing_id)).toEqual([ownedPrintingId]);
  });

  it('a zero-quantity inventory row does not count as owned', async () => {
    const res = await service.searchPrintings({ ownedByUserId: owner, printingIds: [zeroQtyPrintingId] } as any, { limit: 5, groupByCard: false });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.total).toBe(0);
  });

  it('a user with no collection gets nothing', async () => {
    const res = await service.searchPrintings({ ownedByUserId: stranger }, { limit: 5, groupByCard: false });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.total).toBe(0);
  });

  it('grouped search represents the card by the OWNED printing, not the canonical one', async () => {
    const res = await service.searchPrintings({ ownedByUserId: owner }, { limit: 5, groupByCard: true });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.printings).toHaveLength(1);
    expect(res.data.printings[0].card_unique_id).toBe(ownedCardId);
    expect(res.data.printings[0].printing_id).toBe(ownedPrintingId);
  });

  it('composes with other filters (a name that is not the owned card → empty)', async () => {
    const res = await service.searchPrintings({ ownedByUserId: owner, name: 'zzzz-no-such-card' }, { limit: 5, groupByCard: false });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.total).toBe(0);
  });
});
