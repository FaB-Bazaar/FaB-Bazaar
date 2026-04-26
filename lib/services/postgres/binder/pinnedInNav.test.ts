/**
 * Integration tests for the pinned_in_nav flag on binders.
 *
 * Covers:
 *  - getUserBindersWithStats surfaces pinnedInNav on each DTO
 *  - updateBinder accepts pinnedInNav and persists it
 *
 * Runs against the local Postgres DB. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, binders } from '@/lib/postgres/schema';
import { PostgresBinderService } from './PostgresBinderService';

const service = new PostgresBinderService();

let testUserId: string;
let pinnedBinderId: string;
let unpinnedBinderId: string;

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  pinnedBinderId = crypto.randomUUID();
  unpinnedBinderId = crypto.randomUUID();

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });

  await db.insert(binders).values([
    { id: pinnedBinderId, userId: testUserId, name: `Pinned ${pinnedBinderId}`, pinnedInNav: true },
    { id: unpinnedBinderId, userId: testUserId, name: `Unpinned ${unpinnedBinderId}` },
  ]);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('binders pinned_in_nav', () => {
  it('getUserBindersWithStats returns pinnedInNav on each binder DTO', async () => {
    const result = await service.getUserBindersWithStats(testUserId);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const pinned = result.data.find(b => b._id === pinnedBinderId);
    const unpinned = result.data.find(b => b._id === unpinnedBinderId);

    expect(pinned?.pinnedInNav).toBe(true);
    expect(unpinned?.pinnedInNav).toBe(false);
  });

  it('updateBinder({ pinnedInNav: true }) persists the flag', async () => {
    const result = await service.updateBinder(unpinnedBinderId, testUserId, { pinnedInNav: true });
    expect(result.success).toBe(true);

    const [row] = await db
      .select({ pinnedInNav: binders.pinnedInNav })
      .from(binders)
      .where(eq(binders.id, unpinnedBinderId));
    expect(row.pinnedInNav).toBe(true);
  });

  it('updateBinder({ pinnedInNav: false }) clears the flag', async () => {
    const result = await service.updateBinder(pinnedBinderId, testUserId, { pinnedInNav: false });
    expect(result.success).toBe(true);

    const [row] = await db
      .select({ pinnedInNav: binders.pinnedInNav })
      .from(binders)
      .where(eq(binders.id, pinnedBinderId));
    expect(row.pinnedInNav).toBe(false);
  });
});
