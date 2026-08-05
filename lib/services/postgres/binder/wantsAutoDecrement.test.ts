/**
 * Integration tests for PostgresBinderService.addCardsToBinder wants auto-decrement.
 *
 * Runs against the real local PostgreSQL database.
 * Requires POSTGRES_URL in .env.local (loaded by vitest.setup.ts via loadEnvConfig).
 *
 * Behavior: adding copies of a printing to a binder decrements the SAME
 * printing on the user's wants list by the quantity added (floored at zero —
 * a fully-satisfied want row is deleted). Wants for a different printing of
 * the same card are untouched.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, binders, wantsItems, printings } from '@/lib/postgres/schema';
import { PostgresBinderService } from './PostgresBinderService';

const service = new PostgresBinderService();

let testUserId: string;
let binderId: string;
let printingA: string; // the wanted printing
let printingB: string; // a DIFFERENT printing of the SAME card

beforeAll(async () => {
  // Find a card with at least two printings so we can prove printing-exactness.
  const [pair] = await db.execute(sql`
    SELECT array_agg(printing_id ORDER BY printing_id) AS ids
    FROM printings
    GROUP BY card_unique_id
    HAVING count(*) >= 2
    LIMIT 1
  `).then((r) => r.rows as { ids: string[] }[]);
  if (!pair) throw new Error('No card with 2+ printings found — cannot run wants auto-decrement tests');
  [printingA, printingB] = pair.ids;
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  binderId = crypto.randomUUID();

  await db.insert(users).values([{ id: testUserId, username: `test-${testUserId}` }]);
  await db.insert(binders).values([{ id: binderId, userId: testUserId, name: `Binder ${binderId}` }]);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

async function wantsRow(printingId: string) {
  const rows = await db
    .select()
    .from(wantsItems)
    .where(and(eq(wantsItems.userId, testUserId), eq(wantsItems.printingId, printingId)));
  return rows[0] ?? null;
}

async function seedWant(printingId: string, quantity: number) {
  await db.insert(wantsItems).values({
    id: crypto.randomUUID(),
    userId: testUserId,
    printingId,
    quantity,
  });
}

describe('PostgresBinderService.addCardsToBinder — wants auto-decrement', () => {
  it('adding 1 copy of a wanted printing decrements that want by 1', async () => {
    await seedWant(printingA, 3);

    const result = await service.addCardsToBinder(binderId, testUserId, [
      { printingId: printingA, quantity: 1, condition: 'NM', language: 'EN' },
    ]);
    expect(result.success).toBe(true);

    const row = await wantsRow(printingA);
    expect(row).toBeTruthy();
    expect(row!.quantity).toBe(2);
  });

  it('adding 2 copies when 2 are wanted removes the want row entirely', async () => {
    await seedWant(printingA, 2);

    const result = await service.addCardsToBinder(binderId, testUserId, [
      { printingId: printingA, quantity: 2, condition: 'NM', language: 'EN' },
    ]);
    expect(result.success).toBe(true);

    expect(await wantsRow(printingA)).toBeNull();
  });

  it('adding more copies than wanted deletes the row (never negative)', async () => {
    await seedWant(printingA, 2);

    const result = await service.addCardsToBinder(binderId, testUserId, [
      { printingId: printingA, quantity: 5, condition: 'NM', language: 'EN' },
    ]);
    expect(result.success).toBe(true);

    expect(await wantsRow(printingA)).toBeNull();
  });

  it('adding a DIFFERENT printing of the same card leaves the want untouched', async () => {
    await seedWant(printingA, 2);

    const result = await service.addCardsToBinder(binderId, testUserId, [
      { printingId: printingB, quantity: 2, condition: 'NM', language: 'EN' },
    ]);
    expect(result.success).toBe(true);

    const row = await wantsRow(printingA);
    expect(row).toBeTruthy();
    expect(row!.quantity).toBe(2);
  });

  it('adding a printing with no matching want succeeds and creates no want row', async () => {
    const result = await service.addCardsToBinder(binderId, testUserId, [
      { printingId: printingA, quantity: 1, condition: 'NM', language: 'EN' },
    ]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.summary.added).toBe(1);

    expect(await wantsRow(printingA)).toBeNull();
  });

  it('a FAILED add (invalid condition) does not touch the want', async () => {
    await seedWant(printingA, 2);

    const result = await service.addCardsToBinder(binderId, testUserId, [
      { printingId: printingA, quantity: 2, condition: 'Pristine', language: 'EN' },
    ]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.summary.failed).toBe(1);

    const row = await wantsRow(printingA);
    expect(row).toBeTruthy();
    expect(row!.quantity).toBe(2);
  });

  it('adding the same printing twice in one call (different conditions) decrements by the total', async () => {
    await seedWant(printingA, 3);

    const result = await service.addCardsToBinder(binderId, testUserId, [
      { printingId: printingA, quantity: 1, condition: 'NM', language: 'EN' },
      { printingId: printingA, quantity: 1, condition: 'LP', language: 'EN' },
    ]);
    expect(result.success).toBe(true);

    const row = await wantsRow(printingA);
    expect(row).toBeTruthy();
    expect(row!.quantity).toBe(1);
  });
});
