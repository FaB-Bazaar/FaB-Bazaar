/**
 * Integration tests: updateProfile persists the user's social handles
 * (users.social_links) and the public profile + own profile surface them.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users } from '@/lib/postgres/schema';
import { PostgresUserService } from './PostgresUserService';

const service = new PostgresUserService();

let userId: string;
let username: string;

beforeEach(async () => {
  userId = crypto.randomUUID();
  username = `test-${userId}`;
  await db.insert(users).values({ id: userId, username });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, userId));
});

describe('PostgresUserService — social links', () => {
  it('is empty for a fresh user', async () => {
    const profile = await service.getUserProfileWithStats(username);
    expect(profile.success && profile.data?.socialLinks).toEqual({});
  });

  it('persists handles and shows them on the public profile and own profile', async () => {
    const saved = await service.updateProfile(userId, { socialLinks: { nanza: 'danielwang', x: 'fabtcg' } });
    expect(saved.success).toBe(true);

    const pub = await service.getUserProfileWithStats(username);
    expect(pub.success && pub.data?.socialLinks).toEqual({ nanza: 'danielwang', x: 'fabtcg' });

    const own = await service.getProfile(userId);
    expect(own.success && own.data?.socialLinks).toEqual({ nanza: 'danielwang', x: 'fabtcg' });
  });

  it('replaces the whole set, so removing a handle clears it', async () => {
    await service.updateProfile(userId, { socialLinks: { nanza: 'danielwang', x: 'fabtcg' } });
    await service.updateProfile(userId, { socialLinks: { x: 'fabtcg' } });
    const pub = await service.getUserProfileWithStats(username);
    expect(pub.success && pub.data?.socialLinks).toEqual({ x: 'fabtcg' });
  });

  it('leaves the handles untouched when the update omits them', async () => {
    await service.updateProfile(userId, { socialLinks: { youtube: 'fab' } });
    await service.updateProfile(userId, { country: 'US' });
    const pub = await service.getUserProfileWithStats(username);
    expect(pub.success && pub.data?.socialLinks).toEqual({ youtube: 'fab' });
  });
});
