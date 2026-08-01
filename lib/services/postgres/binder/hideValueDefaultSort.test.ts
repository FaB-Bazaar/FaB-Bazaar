/**
 * Integration tests for the hide_value / default_sort columns on binders.
 *
 * hideValue: owner privacy flag — value aggregates are stripped for non-owner
 * viewers at the route layer; the service only persists and surfaces the flag.
 * defaultSort: per-binder initial sort for the binder page; validated against
 * the sort options the binder page actually offers.
 *
 * Runs against the local Postgres DB. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users } from '@/lib/postgres/schema';
import { PostgresBinderService } from './PostgresBinderService';

const service = new PostgresBinderService();

let testUserId: string;

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('binders hideValue / defaultSort', () => {
  it('createBinder defaults to hideValue: false and no defaultSort', async () => {
    const result = await service.createBinder(testUserId, {
      name: `Defaults ${crypto.randomUUID()}`,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.hideValue).toBe(false);
    expect(result.data.defaultSort).toBeUndefined();
  });

  it('updateBinder persists hideValue and getBinder returns it', async () => {
    const created = await service.createBinder(testUserId, {
      name: `Hidden ${crypto.randomUUID()}`,
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const updated = await service.updateBinder(created.data._id, testUserId, {
      hideValue: true,
    });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.hideValue).toBe(true);

    const fetched = await service.getBinder(created.data._id, testUserId);
    expect(fetched.success).toBe(true);
    if (!fetched.success || !fetched.data) return;
    expect(fetched.data.hideValue).toBe(true);
  });

  it('updateBinder persists defaultSort and getBinder returns it', async () => {
    const created = await service.createBinder(testUserId, {
      name: `Sorted ${crypto.randomUUID()}`,
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const updated = await service.updateBinder(created.data._id, testUserId, {
      defaultSort: 'name',
    });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.defaultSort).toBe('name');

    const fetched = await service.getBinder(created.data._id, testUserId);
    expect(fetched.success).toBe(true);
    if (!fetched.success || !fetched.data) return;
    expect(fetched.data.defaultSort).toBe('name');
  });

  it('updateBinder rejects an unknown defaultSort value', async () => {
    const created = await service.createBinder(testUserId, {
      name: `BadSort ${crypto.randomUUID()}`,
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const updated = await service.updateBinder(created.data._id, testUserId, {
      defaultSort: 'DROP TABLE binders' as any,
    });
    expect(updated.success).toBe(false);
  });

  it('updateBinder clears defaultSort with null', async () => {
    const created = await service.createBinder(testUserId, {
      name: `ClearSort ${crypto.randomUUID()}`,
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const set = await service.updateBinder(created.data._id, testUserId, {
      defaultSort: 'quantity-desc',
    });
    expect(set.success).toBe(true);

    const cleared = await service.updateBinder(created.data._id, testUserId, {
      defaultSort: null,
    });
    expect(cleared.success).toBe(true);
    if (!cleared.success) return;
    expect(cleared.data.defaultSort).toBeUndefined();
  });

  it('updateBinder leaves both fields untouched when omitted', async () => {
    const created = await service.createBinder(testUserId, {
      name: `Keep ${crypto.randomUUID()}`,
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    await service.updateBinder(created.data._id, testUserId, {
      hideValue: true,
      defaultSort: 'name',
    });

    const updated = await service.updateBinder(created.data._id, testUserId, {
      description: 'unrelated change',
    });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.hideValue).toBe(true);
    expect(updated.data.defaultSort).toBe('name');
  });

  it('getUserBindersWithStats surfaces hideValue on each binder DTO (profile strip path)', async () => {
    const created = await service.createBinder(testUserId, {
      name: `Profile ${crypto.randomUUID()}`,
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    await service.updateBinder(created.data._id, testUserId, { hideValue: true });

    const result = await service.getUserBindersWithStats(testUserId);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const b = result.data.find(x => x._id === created.data._id);
    expect((b as any)?.hideValue).toBe(true);
  });
});
