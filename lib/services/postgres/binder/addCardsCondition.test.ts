/**
 * Integration tests for PostgresBinderService.addCardsToBinder condition handling.
 *
 * Runs against the real local PostgreSQL database.
 * Requires POSTGRES_URL in .env.local (loaded by vitest.setup.ts via loadEnvConfig).
 *
 * Regression: the web "add to binder" flow sent the label "Near Mint" instead
 * of the enum code "NM", so every insert failed the `condition` enum cast while
 * the route still returned 200. The service must normalize labels → codes.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, binders, inventoryItems, printings } from '@/lib/postgres/schema';
import { PostgresBinderService } from './PostgresBinderService';

const service = new PostgresBinderService();

let testUserId: string;
let binderId: string;
let realPrintingId: string;

beforeAll(async () => {
  const [printing] = await db.select({ printingId: printings.printingId }).from(printings).limit(1);
  if (!printing) throw new Error('No printings found in DB — cannot run addCards condition tests');
  realPrintingId = printing.printingId;
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

describe('PostgresBinderService.addCardsToBinder — condition normalization', () => {
  it('accepts the "Near Mint" label and stores it as the "NM" code', async () => {
    const result = await service.addCardsToBinder(binderId, testUserId, [
      { printingId: realPrintingId, quantity: 1, condition: 'Near Mint', language: 'EN' },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.summary.added).toBe(1);
    expect(result.data.summary.failed).toBe(0);

    const [row] = await db.select().from(inventoryItems).where(eq(inventoryItems.binderId, binderId));
    expect(row).toBeTruthy();
    expect(row.condition).toBe('NM');
  });

  it('fails an unrecognized condition cleanly without inserting a row', async () => {
    const result = await service.addCardsToBinder(binderId, testUserId, [
      { printingId: realPrintingId, quantity: 1, condition: 'Pristine', language: 'EN' },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.summary.added).toBe(0);
    expect(result.data.summary.failed).toBe(1);
    expect(result.data.results[0].success).toBe(false);
    expect(result.data.results[0].error).toMatch(/condition/i);

    const rows = await db.select().from(inventoryItems).where(eq(inventoryItems.binderId, binderId));
    expect(rows).toHaveLength(0);
  });
});
