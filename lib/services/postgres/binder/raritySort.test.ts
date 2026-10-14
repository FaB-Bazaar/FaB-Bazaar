/**
 * Integration test for PostgresBinderService.getBinderCards sortBy 'rarity':
 * rarity rank (RARITY_SORT_ORDER — Promo → Fabled → Marvel → Legendary →
 * Majestic → … → Token) first, then tcg_low high → low with unpriced copies
 * last WITHIN their rarity. The point: foreign printings TCGplayer doesn't price
 * stay with their rarity instead of sinking to the bottom like a price sort.
 *
 * Runs against the real local PostgreSQL database.
 * Requires POSTGRES_URL in .env.local (loaded by vitest.setup.ts via loadEnvConfig).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { users, binders, inventoryItems, printings } from '@/lib/postgres/schema';
import { PostgresBinderService } from './PostgresBinderService';

const service = new PostgresBinderService();

const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toLowerCase();
const setCode = `zr${rand}`;

const ids: Record<string, string> = {};
let testUserId: string;
let binderId: string;

beforeAll(async () => {
  const [card] = await db.select({ cardUniqueId: printings.cardUniqueId }).from(printings).limit(1);
  if (!card) throw new Error('Need ≥1 printing in DB to run the rarity sort test');

  const mk = async (key: string, rarity: string, tcgLow: number | null, n: number) => {
    const id = nanoid(21);
    await db.insert(printings).values({
      printingId: id, cardUniqueId: card.cardUniqueId, set: setCode,
      collectorNumber: `${setCode.toUpperCase()}${String(n).padStart(3, '0')}`,
      edition: 'N', foiling: 'S', rarity, tcgLow,
    });
    ids[key] = id;
  };
  // Insertion order matches neither the expected output nor a pure price sort.
  await mk('commonPricey', 'c', 5, 1);
  await mk('majesticUnpriced', 'm', null, 2);
  await mk('rareUnpriced', 'r', null, 3);
  await mk('majesticCheap', 'm', 2, 4);
  await mk('legendaryCheap', 'l', 1, 5);
});

afterAll(async () => {
  await db.delete(printings).where(inArray(printings.printingId, Object.values(ids)));
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  binderId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  await db.insert(binders).values({ id: binderId, userId: testUserId, name: `Binder ${binderId}` });
  await db.insert(inventoryItems).values(
    Object.values(ids).map((printingId) => ({
      id: crypto.randomUUID(), userId: testUserId, binderId, printingId,
      quantity: 1, condition: 'NM' as const, language: 'EN', forTrade: false, forSale: false,
    })),
  );
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('getBinderCards sortBy rarity', () => {
  it('orders by rarity rank, then tcg_low desc with unpriced last within the rarity', async () => {
    const result = await service.getBinderCards(binderId, {}, { page: 1, limit: 48, sortBy: 'rarity' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const byId = Object.fromEntries(Object.entries(ids).map(([k, v]) => [v, k]));
    const order = result.data.cards.map((c: any) => byId[c.printing_id ?? c.printingId]);
    expect(order).toEqual(['legendaryCheap', 'majesticCheap', 'majesticUnpriced', 'rareUnpriced', 'commonPricey']);
  });
});
