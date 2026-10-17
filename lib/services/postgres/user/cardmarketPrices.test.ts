/**
 * users.cardmarket_prices (migration 0126): the account-wide choice to see
 * Cardmarket € instead of TCGplayer $ everywhere. Default off.
 *
 * Runs against the real local PostgreSQL database (POSTGRES_URL in .env.local).
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

describe('cardmarketPrices preference', () => {
  it('is off for a new user', async () => {
    const result = await service.getProfile(userId);
    expect(result.success && result.data?.cardmarketPrices).toBe(false);
  });

  it('is saved by updateProfile and read back by getProfile', async () => {
    expect((await service.updateProfile(userId, { cardmarketPrices: true })).success).toBe(true);
    const result = await service.getProfile(userId);
    expect(result.success && result.data?.cardmarketPrices).toBe(true);
  });

  it('is left alone by updates that do not mention it', async () => {
    await service.updateProfile(userId, { cardmarketPrices: true });
    await service.updateProfile(userId, { landingPage: '/decks' });
    const result = await service.getProfile(userId);
    expect(result.success && result.data?.cardmarketPrices).toBe(true);
  });
});
