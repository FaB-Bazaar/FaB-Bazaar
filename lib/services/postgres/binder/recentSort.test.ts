/**
 * Integration tests for PostgresBinderService.getBinderCards recency sorts.
 *
 * Two variants:
 *  - 'recently-added'   — inventory_items.added_at DESC (when the row first
 *    entered the binder; adding copies to an existing stack does NOT move it)
 *  - 'recently-updated' — inventory_items.updated_at DESC (bumped by every
 *    write path: quantity changes, edits, transfers)
 *
 * Also covers updateBinder accepting the new values as a saved defaultSort
 * (BINDER_SORT_OPTIONS membership).
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
const testSetCode = `zr${rand}`; // no sets row needed for recency sorts

const cnA = `${testSetCode.toUpperCase()}001`;
const cnB = `${testSetCode.toUpperCase()}002`;
const cnC = `${testSetCode.toUpperCase()}003`;

const testPrintingIds: Record<'A' | 'B' | 'C', string> = { A: '', B: '', C: '' };
let testUserId: string;
let binderId: string;

const HOUR = 60 * 60 * 1000;
const now = Date.now();
// Recency fixtures — chosen so:
//  - addedAt order (C, B, A) differs from updatedAt order (A, C, B)
//  - physical insertion order (B, A, C) matches NEITHER, so a
//    fallback-to-physical-order can't pass by accident
const fixtures = {
  A: { addedAt: new Date(now - 72 * HOUR), updatedAt: new Date(now - 1 * HOUR) },  // old add, just updated
  B: { addedAt: new Date(now - 24 * HOUR), updatedAt: new Date(now - 24 * HOUR) }, // untouched since add
  C: { addedAt: new Date(now - 2 * HOUR), updatedAt: new Date(now - 2 * HOUR) },   // newest add
};

beforeAll(async () => {
  const [card] = await db.select({ cardUniqueId: printings.cardUniqueId }).from(printings).limit(1);
  if (!card) throw new Error('Need ≥1 printing in DB to run recency sort tests');

  const mk = async (collectorNumber: string) => {
    const id = nanoid(21);
    await db.insert(printings).values({
      printingId: id,
      cardUniqueId: card.cardUniqueId,
      set: testSetCode,
      collectorNumber,
      edition: 'N',
      foiling: 'S',
      rarity: 'C',
    });
    return id;
  };
  testPrintingIds.A = await mk(cnA);
  testPrintingIds.B = await mk(cnB);
  testPrintingIds.C = await mk(cnC);
});

afterAll(async () => {
  await db.delete(printings).where(inArray(printings.printingId, Object.values(testPrintingIds)));
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  binderId = crypto.randomUUID();

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  await db.insert(binders).values({ id: binderId, userId: testUserId, name: `Binder ${binderId}` });

  // Insertion order B, A, C — matches neither expected output
  for (const key of ['B', 'A', 'C'] as const) {
    await db.insert(inventoryItems).values({
      id: crypto.randomUUID(), userId: testUserId, binderId,
      printingId: testPrintingIds[key],
      quantity: 1, condition: 'NM' as const, language: 'EN', forTrade: false, forSale: false,
      addedAt: fixtures[key].addedAt, updatedAt: fixtures[key].updatedAt,
    });
  }
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('PostgresBinderService.getBinderCards recency sorts', () => {
  it('recently-added orders by added_at DESC (newest first)', async () => {
    const result = await service.getBinderCards(binderId, {}, { page: 1, limit: 48, sortBy: 'recently-added' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.cards.map((c) => c.collector_number)).toEqual([cnC, cnB, cnA]);
  });

  it('recently-updated orders by updated_at DESC (most recently touched first)', async () => {
    const result = await service.getBinderCards(binderId, {}, { page: 1, limit: 48, sortBy: 'recently-updated' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.cards.map((c) => c.collector_number)).toEqual([cnA, cnC, cnB]);
  });

  it('updateBinder accepts recently-added and recently-updated as defaultSort', async () => {
    for (const sort of ['recently-added', 'recently-updated'] as const) {
      const updated = await service.updateBinder(binderId, testUserId, { defaultSort: sort });
      expect(updated.success).toBe(true);
      if (!updated.success) continue;
      expect(updated.data.defaultSort).toBe(sort);
    }
  });
});
