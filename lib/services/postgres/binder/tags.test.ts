/**
 * Integration tests for the tags[] column on binders.
 *
 * Tags are flat, owner-defined labels used to group binders into sections on
 * the public profile. Covers:
 *  - createBinder persists tags and returns them on the DTO
 *  - createBinder defaults to an empty array when no tags are given
 *  - getUserBindersWithStats surfaces tags on each DTO (profile render path)
 *  - updateBinder accepts tags and persists them
 *  - updateBinder leaves existing tags untouched when tags is omitted
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

describe('binders tags[]', () => {
  it('createBinder persists tags and returns them on the DTO', async () => {
    const result = await service.createBinder(testUserId, {
      name: `Tagged ${crypto.randomUUID()}`,
      tags: ['inventory', 'nm'],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.tags).toEqual(['inventory', 'nm']);
  });

  it('createBinder defaults tags to an empty array when omitted', async () => {
    const result = await service.createBinder(testUserId, {
      name: `Untagged ${crypto.randomUUID()}`,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.tags).toEqual([]);
  });

  it('getUserBindersWithStats surfaces tags on each binder DTO', async () => {
    const tagged = await service.createBinder(testUserId, {
      name: `Inventory ${crypto.randomUUID()}`,
      tags: ['inventory'],
    });
    const untagged = await service.createBinder(testUserId, {
      name: `Scratch ${crypto.randomUUID()}`,
    });
    expect(tagged.success && untagged.success).toBe(true);
    if (!tagged.success || !untagged.success) return;

    const result = await service.getUserBindersWithStats(testUserId);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const a = result.data.find(b => b._id === tagged.data._id);
    const b = result.data.find(b => b._id === untagged.data._id);
    expect(a?.tags).toEqual(['inventory']);
    expect(b?.tags).toEqual([]);
  });

  it('updateBinder({ tags }) persists the new tags', async () => {
    const created = await service.createBinder(testUserId, {
      name: `ToRetag ${crypto.randomUUID()}`,
      tags: ['old'],
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const updated = await service.updateBinder(created.data._id, testUserId, {
      tags: ['trades', 'outgoing'],
    });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.tags).toEqual(['trades', 'outgoing']);
  });

  it('updateBinder leaves existing tags untouched when tags is omitted', async () => {
    const created = await service.createBinder(testUserId, {
      name: `Keep ${crypto.randomUUID()}`,
      tags: ['inventory'],
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const updated = await service.updateBinder(created.data._id, testUserId, {
      description: 'just a description change',
    });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.tags).toEqual(['inventory']);
  });
});
