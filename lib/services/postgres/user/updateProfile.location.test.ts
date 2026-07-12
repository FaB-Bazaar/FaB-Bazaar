/**
 * Integration tests: updateProfile persists the user's self-set location.
 *
 * UpdateProfileDTO carries `country`/`state` (MongoDB-era names, kept for
 * the /api/user/complete-profile contract); they must map to the real
 * users.country_code / users.state_code columns — the old implementation
 * spread them into .set() where they silently died.
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

const readRow = async () => {
  const [row] = await db
    .select({ countryCode: users.countryCode, stateCode: users.stateCode, username: users.username })
    .from(users)
    .where(eq(users.id, userId));
  return row;
};

describe('PostgresUserService.updateProfile — location', () => {
  it('persists country and state to country_code / state_code', async () => {
    const res = await service.updateProfile(userId, { country: 'US', state: 'TX' });
    expect(res.success).toBe(true);

    const row = await readRow();
    expect(row.countryCode).toBe('US');
    expect(row.stateCode).toBe('TX');
  });

  it('clears state when the country changes without one (no stale region)', async () => {
    await service.updateProfile(userId, { country: 'US', state: 'TX' });
    const res = await service.updateProfile(userId, { country: 'NZ', state: '' });
    expect(res.success).toBe(true);

    const row = await readRow();
    expect(row.countryCode).toBe('NZ');
    expect(row.stateCode).toBeNull();
  });

  it('ignores dead legacy fields without failing', async () => {
    const res = await service.updateProfile(userId, {
      country: 'DE',
      city: 'Berlin',
      location: 'somewhere',
      bio: 'hi',
    } as any);
    expect(res.success).toBe(true);

    const row = await readRow();
    expect(row.countryCode).toBe('DE');
  });

  it('leaves location untouched when only the username changes', async () => {
    await service.updateProfile(userId, { country: 'US', state: 'TX' });
    const res = await service.updateProfile(userId, { username: `test2-${userId}` });
    expect(res.success).toBe(true);

    const row = await readRow();
    expect(row.username).toBe(`test2-${userId}`);
    expect(row.countryCode).toBe('US');
    expect(row.stateCode).toBe('TX');
  });
});

describe('PostgresUserService — preferred language (Volzar localization override)', () => {
  it('persists, surfaces via getBasicInfo, and clears with an empty string', async () => {
    const set = await service.updateProfile(userId, { preferredLanguage: 'fr' });
    expect(set.success).toBe(true);

    const info = await service.getBasicInfo(userId);
    expect(info.success && info.data?.preferredLanguage).toBe('fr');

    const cleared = await service.updateProfile(userId, { preferredLanguage: '' });
    expect(cleared.success).toBe(true);
    const info2 = await service.getBasicInfo(userId);
    expect(info2.success && info2.data?.preferredLanguage).toBeUndefined();
  });

  it('leaves the language untouched when the update omits it', async () => {
    await service.updateProfile(userId, { preferredLanguage: 'ja' });
    await service.updateProfile(userId, { country: 'US' });
    const info = await service.getBasicInfo(userId);
    expect(info.success && info.data?.preferredLanguage).toBe('ja');
  });
});
