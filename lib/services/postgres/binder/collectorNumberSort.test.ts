/**
 * Integration tests for PostgresBinderService.getBinderCards collector-number sorts.
 *
 * Two variants:
 *  - 'collector-release'  — set release order (sets.release_order) first, then
 *    collector number within the set. A set missing from the sets table sorts last.
 *  - 'collector-absolute' — plain ascending collector number across all sets,
 *    ignoring release chronology entirely.
 *
 * Runs against the real local PostgreSQL database.
 * Requires POSTGRES_URL in .env.local (loaded by vitest.setup.ts via loadEnvConfig).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { users, binders, inventoryItems, printings, sets } from '@/lib/postgres/schema';
import { PostgresBinderService } from './PostgresBinderService';

const service = new PostgresBinderService();

// Set codes chosen so alphabetical order CONTRADICTS release order:
// earlySet released first but sorts last alphabetically (the WTR-vs-ARC case).
const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toLowerCase();
const earlySetCode = `zy${rand}`; // released FIRST, alphabetically LAST
const lateSetCode = `zx${rand}`;  // released SECOND, alphabetically earlier
const unknownSetCode = `zw${rand}`; // no sets row at all, alphabetically first

const cnEarly001 = `${earlySetCode.toUpperCase()}001`;
const cnEarly010 = `${earlySetCode.toUpperCase()}010`;
const cnLate005 = `${lateSetCode.toUpperCase()}005`;
const cnUnknown001 = `${unknownSetCode.toUpperCase()}001`;

const testPrintingIds: string[] = [];
let testUserId: string;
let binderId: string;

beforeAll(async () => {
  const [card] = await db.select({ cardUniqueId: printings.cardUniqueId }).from(printings).limit(1);
  if (!card) throw new Error('Need ≥1 printing in DB to run collector-number sort tests');

  // release_order / display_order are globally unique — pick a random high base
  const releaseBase = 500_000 + Math.floor(Math.random() * 1_000_000);
  await db.insert(sets).values([
    {
      code: earlySetCode, displayCode: earlySetCode.toUpperCase(), name: `Test Early ${rand}`,
      releaseOrder: releaseBase, displayOrder: releaseBase, category: 'excluded',
    },
    {
      code: lateSetCode, displayCode: lateSetCode.toUpperCase(), name: `Test Late ${rand}`,
      releaseOrder: releaseBase + 1, displayOrder: releaseBase + 1, category: 'excluded',
    },
  ]);

  const mk = async (set: string, collectorNumber: string) => {
    const id = nanoid(21);
    await db.insert(printings).values({
      printingId: id,
      cardUniqueId: card.cardUniqueId,
      set,
      collectorNumber,
      edition: 'N',
      foiling: 'S',
      rarity: 'C',
    });
    testPrintingIds.push(id);
    return id;
  };
  // Insertion order deliberately matches NEITHER expected output, so a
  // fallback-to-physical-order can't pass by accident
  await mk(lateSetCode, cnLate005);
  await mk(unknownSetCode, cnUnknown001);
  await mk(earlySetCode, cnEarly010);
  await mk(earlySetCode, cnEarly001);
});

afterAll(async () => {
  await db.delete(printings).where(inArray(printings.printingId, testPrintingIds));
  await db.delete(sets).where(inArray(sets.code, [earlySetCode, lateSetCode]));
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  binderId = crypto.randomUUID();

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  await db.insert(binders).values({ id: binderId, userId: testUserId, name: `Binder ${binderId}` });
  await db.insert(inventoryItems).values(
    testPrintingIds.map((printingId) => ({
      id: crypto.randomUUID(), userId: testUserId, binderId, printingId,
      quantity: 1, condition: 'NM' as const, language: 'EN', forTrade: false, forSale: false,
    }))
  );
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('PostgresBinderService.getBinderCards collector-number sorts', () => {
  it('collector-release orders by set release order, then collector number; unknown sets last', async () => {
    const result = await service.getBinderCards(binderId, {}, { page: 1, limit: 48, sortBy: 'collector-release' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.cards.map((c) => c.collector_number)).toEqual([
      cnEarly001, cnEarly010, // earlier release, despite sorting last alphabetically
      cnLate005,
      cnUnknown001, // no sets row → release order NULL → last
    ]);
  });

  it('collector-absolute orders purely alphabetically, ignoring release order', async () => {
    const result = await service.getBinderCards(binderId, {}, { page: 1, limit: 48, sortBy: 'collector-absolute' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.cards.map((c) => c.collector_number)).toEqual([
      cnUnknown001, cnLate005, cnEarly001, cnEarly010,
    ]);
  });
});
