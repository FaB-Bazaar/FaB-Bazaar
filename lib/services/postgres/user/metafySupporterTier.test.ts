/**
 * Integration tests: supporter-tier persistence + the access read used by the
 * Fabby Chat gates. setMetafySupporterTier writes users.metafy_supporter_tier;
 * getFabbyChatAccess reads it back with isSuperAdmin; unlinkMetafyAccount
 * revokes the tier to 'free'.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, metafyCommunities } from '@/lib/postgres/schema';
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

const readTier = async () => {
  const [row] = await db
    .select({ tier: users.metafySupporterTier })
    .from(users)
    .where(eq(users.id, userId));
  return row.tier;
};

describe('PostgresUserService — Metafy supporter tier', () => {
  it('defaults a new user to the free tier', async () => {
    expect(await readTier()).toBe('free');
  });

  it('setMetafySupporterTier persists paid, and back to free', async () => {
    expect((await service.setMetafySupporterTier(userId, 'paid')).success).toBe(true);
    expect(await readTier()).toBe('paid');

    expect((await service.setMetafySupporterTier(userId, 'free')).success).toBe(true);
    expect(await readTier()).toBe('free');
  });

  it('setMetafySupporterTier fails for an unknown user', async () => {
    const res = await service.setMetafySupporterTier(crypto.randomUUID(), 'paid');
    expect(res.success).toBe(false);
  });

  it('getFabbyChatAccess returns the persisted tier + admin flag', async () => {
    await service.setMetafySupporterTier(userId, 'paid');
    const res = await service.getFabbyChatAccess(userId);
    expect(res.success).toBe(true);
    expect(res.success && res.data).toEqual({ isSuperAdmin: false, metafySupporterTier: 'paid' });
  });

  it('getFabbyChatAccess returns null for an unknown user', async () => {
    const res = await service.getFabbyChatAccess(crypto.randomUUID());
    expect(res.success && res.data).toBeNull();
  });

  it('unlinkMetafyAccount revokes a paid tier back to free', async () => {
    await service.setMetafySupporterTier(userId, 'paid');
    expect((await service.unlinkMetafyAccount(userId)).success).toBe(true);
    expect(await readTier()).toBe('free');
  });
});

describe('PostgresUserService.getSupporterSyncContext', () => {
  it('reports not-linked with no sync time for a bare user', async () => {
    const res = await service.getSupporterSyncContext(userId);
    expect(res.success && res.data).toEqual({ linked: false, syncedAt: null });
  });

  it('reports linked with the newest community synced_at', async () => {
    await db.update(users).set({ metafyId: `mf-${userId}` }).where(eq(users.id, userId));
    await db.insert(metafyCommunities).values({
      userId,
      communityId: `c-${userId}`,
      title: 'FaB Bazaar Community',
      tiers: [{ id: 't1', name: 'Core Contributor' }],
    });

    const res = await service.getSupporterSyncContext(userId);
    expect(res.success).toBe(true);
    expect(res.success && res.data?.linked).toBe(true);
    expect(res.success && res.data?.syncedAt).toBeInstanceOf(Date);
  });

  it('returns null for an unknown user', async () => {
    const res = await service.getSupporterSyncContext(crypto.randomUUID());
    expect(res.success && res.data).toBeNull();
  });
});
