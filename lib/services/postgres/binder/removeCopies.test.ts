/**
 * Integration tests (real local PostgreSQL) for the /scan "Added to … · Undo" flow:
 *  - addCardsToBinder reports the inventory item each card landed in (new row or the existing one it topped up);
 *  - removeCopies takes back exactly N copies of that item in one atomic step, deleting the row only at zero, so
 *    undoing one scan row never removes copies a later row (or the user) added.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, binders, inventoryItems, printings } from '@/lib/postgres/schema';
import { PostgresBinderService } from './PostgresBinderService';

const service = new PostgresBinderService();
let userId: string, otherUserId: string, binderId: string, printingId: string;

beforeAll(async () => {
  const [p] = await db.select({ printingId: printings.printingId }).from(printings).limit(1);
  if (!p) throw new Error('No printings in the DB');
  printingId = p.printingId;
});
beforeEach(async () => {
  userId = crypto.randomUUID(); otherUserId = crypto.randomUUID(); binderId = crypto.randomUUID();
  await db.insert(users).values([{ id: userId, username: `test-${userId}` }, { id: otherUserId, username: `test-${otherUserId}` }]);
  await db.insert(binders).values([{ id: binderId, userId, name: `Binder ${binderId}` }]);
});
afterEach(async () => {
  await db.delete(users).where(eq(users.id, userId));
  await db.delete(users).where(eq(users.id, otherUserId));
});

const rowsOf = () => db.select().from(inventoryItems).where(eq(inventoryItems.binderId, binderId));

describe('addCardsToBinder — reports the inventory item', () => {
  it('a new row and a top-up of the same row report the same inventory item id', async () => {
    const first = await service.addCardsToBinder(binderId, userId, [{ printingId, quantity: 1, condition: 'NM', language: 'EN' }]);
    const second = await service.addCardsToBinder(binderId, userId, [{ printingId, quantity: 2, condition: 'NM', language: 'EN' }]);
    if (!first.success || !second.success) throw new Error('add failed');
    const [row] = await rowsOf();
    expect(first.data.results[0].inventoryItemId).toBe(row.id);
    expect(second.data.results[0].inventoryItemId).toBe(row.id);
    expect(row.quantity).toBe(3);
  });
});

describe('removeCopies', () => {
  const addOne = async (quantity: number) => {
    const r = await service.addCardsToBinder(binderId, userId, [{ printingId, quantity, condition: 'NM', language: 'EN' }]);
    if (!r.success) throw new Error(r.error);
    return r.data.results[0].inventoryItemId!;
  };

  it('takes back only the copies asked for, leaving the rest', async () => {
    const id = await addOne(3);
    const r = await service.removeCopies(binderId, id, userId, 1);
    expect(r).toEqual({ success: true, data: { remaining: 2 } });
    expect((await rowsOf())[0].quantity).toBe(2);
  });

  it('deletes the row when no copies remain', async () => {
    const id = await addOne(1);
    expect(await service.removeCopies(binderId, id, userId, 1)).toEqual({ success: true, data: { remaining: 0 } });
    expect(await rowsOf()).toHaveLength(0);
  });

  it('never goes below zero (the user already removed some copies themselves)', async () => {
    const id = await addOne(1);
    expect(await service.removeCopies(binderId, id, userId, 3)).toEqual({ success: true, data: { remaining: 0 } });
    expect(await rowsOf()).toHaveLength(0);
  });

  it('refuses someone else’s binder and changes nothing', async () => {
    const id = await addOne(2);
    const r = await service.removeCopies(binderId, id, otherUserId, 1);
    expect(r.success).toBe(false);
    expect((await rowsOf())[0].quantity).toBe(2);
  });

  it('rejects a count below 1', async () => {
    const id = await addOne(2);
    expect((await service.removeCopies(binderId, id, userId, 0)).success).toBe(false);
    expect((await rowsOf())[0].quantity).toBe(2);
  });
});
