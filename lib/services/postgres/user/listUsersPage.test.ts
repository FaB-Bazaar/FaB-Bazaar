/**
 * listUsersPage: one page of users for /admin/user-access, plus the counts the
 * page header shows. The page used to load (and render) every user at once.
 *
 * Runs against the real local PostgreSQL database (POSTGRES_URL in .env.local).
 * Other test files insert users in parallel, so every assertion is scoped to
 * this file's unique search tag.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { inArray } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users } from '@/lib/postgres/schema';
import { PostgresUserService } from './PostgresUserService';

const service = new PostgresUserService();
let tag: string;
let ids: string[];

beforeEach(async () => {
  tag = `lup${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  ids = [];
  // Five users, user 0 oldest … user 4 newest.
  for (let i = 0; i < 5; i++) {
    const id = crypto.randomUUID();
    ids.push(id);
    await db.insert(users).values({
      id,
      username: `${tag}-user${i}`,
      email: i === 2 ? `${tag}-mail@example.test` : null,
      isCurator: i === 4,
      createdAt: new Date(Date.UTC(2020, 0, 1 + i)),
    });
  }
});

afterEach(async () => {
  await db.delete(users).where(inArray(users.id, ids));
});

describe('listUsersPage', () => {
  it('returns one page, newest first, with the matching total', async () => {
    const result = await service.listUsersPage({ searchTerm: tag, page: 1, pageSize: 2 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.users.map(u => u.username)).toEqual([`${tag}-user4`, `${tag}-user3`]);
    expect(result.data.total).toBe(5);
  });

  it('returns the remainder on the last page', async () => {
    const result = await service.listUsersPage({ searchTerm: tag, page: 3, pageSize: 2 });
    expect(result.success && result.data.users.map(u => u.username)).toEqual([`${tag}-user0`]);
    expect(result.success && result.data.total).toBe(5);
  });

  it('returns no users but still the total for a page past the end', async () => {
    const result = await service.listUsersPage({ searchTerm: tag, page: 9, pageSize: 2 });
    expect(result.success && result.data.users).toEqual([]);
    expect(result.success && result.data.total).toBe(5);
  });

  it('reports the count of all users separately from the search matches', async () => {
    const result = await service.listUsersPage({ searchTerm: tag, page: 1, pageSize: 2 });
    expect(result.success && result.data.totalUsers).toBeGreaterThan(5);
  });

  it('without a search term the total is every user', async () => {
    const result = await service.listUsersPage({ page: 1, pageSize: 1 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.users).toHaveLength(1);
    expect(result.data.total).toBeGreaterThanOrEqual(5);
  });

  it('matches the search term against email too', async () => {
    const result = await service.listUsersPage({ searchTerm: `${tag}-MAIL`, page: 1, pageSize: 10 });
    expect(result.success && result.data.users.map(u => u.username)).toEqual([`${tag}-user2`]);
  });

  it('treats % and _ in the search term as literal characters', async () => {
    const result = await service.listUsersPage({ searchTerm: `${tag}%user_`, page: 1, pageSize: 10 });
    expect(result.success && result.data.total).toBe(0);
  });

  it('includes the curator role, so its switch shows the stored value', async () => {
    const result = await service.listUsersPage({ searchTerm: tag, page: 1, pageSize: 5 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const byName = new Map(result.data.users.map(u => [u.username, u.roles?.isCurator]));
    expect(byName.get(`${tag}-user4`)).toBe(true);
    expect(byName.get(`${tag}-user0`)).toBe(false);
  });
});
