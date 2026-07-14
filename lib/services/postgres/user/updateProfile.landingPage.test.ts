/**
 * Integration tests: updateProfile persists the user's landing page
 * preference (users.landing_page) and getBasicInfo surfaces it.
 *
 * The preference drives where signed-in users land (app/page.tsx and
 * /auth/post-login); unset means the /volzar default.
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

beforeEach(async () => {
  userId = crypto.randomUUID();
  await db.insert(users).values({ id: userId, username: `test-${userId}` });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, userId));
});

describe('PostgresUserService — landing page preference', () => {
  it('persists, surfaces via getBasicInfo, and clears with an empty string', async () => {
    const set = await service.updateProfile(userId, { landingPage: 'collection' });
    expect(set.success).toBe(true);

    const info = await service.getBasicInfo(userId);
    expect(info.success && info.data?.landingPage).toBe('collection');

    const cleared = await service.updateProfile(userId, { landingPage: '' });
    expect(cleared.success).toBe(true);
    const info2 = await service.getBasicInfo(userId);
    expect(info2.success && info2.data?.landingPage).toBeUndefined();
  });

  it('is absent for a fresh user (default handled by resolveLandingPath)', async () => {
    const info = await service.getBasicInfo(userId);
    expect(info.success).toBe(true);
    expect(info.success && info.data?.landingPage).toBeUndefined();
  });

  it('leaves the preference untouched when the update omits it', async () => {
    await service.updateProfile(userId, { landingPage: 'decks' });
    await service.updateProfile(userId, { country: 'US' });
    const info = await service.getBasicInfo(userId);
    expect(info.success && info.data?.landingPage).toBe('decks');
  });
});
