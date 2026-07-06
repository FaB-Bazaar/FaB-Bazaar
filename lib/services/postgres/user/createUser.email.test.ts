/**
 * Integration: new-user creation must encrypt the email at rest (AES) with a
 * sha256 emailHash for lookups — same invariant the login-update path upholds.
 * Regression guard for signups persisting plaintext emails.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '@/lib/postgres/db';
import { users } from '@/lib/postgres/schema';
import { decryptAddress } from '@/lib/encryption';
import { PostgresUserService } from './PostgresUserService';

const service = new PostgresUserService();

let createdId: string | undefined;
afterEach(async () => {
  if (createdId) await db.delete(users).where(eq(users.id, createdId));
  createdId = undefined;
});

const sha256 = (s: string) => crypto.createHash('sha256').update(s.toLowerCase()).digest('hex');

describe('PostgresUserService.createUser — email encryption', () => {
  it('stores the email AES-encrypted with an emailHash + IV, never plaintext', async () => {
    const email = `enc-${crypto.randomUUID()}@example.com`;
    const res = await service.createUser({ username: `enc-${crypto.randomUUID()}`, email } as any);
    expect(res.success).toBe(true);
    createdId = res.success ? res.data._id : undefined;

    const [row] = await db
      .select({ email: users.email, emailHash: users.emailHash, emailIV: users.emailIV })
      .from(users)
      .where(eq(users.id, createdId!));

    expect(row.email).not.toBe(email);          // not plaintext
    expect(row.email).toBeTruthy();
    expect(row.emailIV).toBeTruthy();
    expect(row.emailHash).toBe(sha256(email));   // deterministic lookup hash
    // round-trips back to the original address
    expect(decryptAddress({ encrypted: row.email!, iv: row.emailIV!, tag: '' })).toBe(email);
  });

  it('findByEmail locates the newly-created (encrypted) user by plaintext address', async () => {
    const email = `find-${crypto.randomUUID()}@example.com`;
    const res = await service.createUser({ username: `find-${crypto.randomUUID()}`, email } as any);
    createdId = res.success ? res.data._id : undefined;

    const found = await service.findByEmail(email);
    expect(found.success && found.data?._id).toBe(createdId);
  });

  it('leaves email fields null when no email is supplied', async () => {
    const res = await service.createUser({ username: `noemail-${crypto.randomUUID()}` } as any);
    expect(res.success).toBe(true);
    createdId = res.success ? res.data._id : undefined;

    const [row] = await db
      .select({ email: users.email, emailHash: users.emailHash, emailIV: users.emailIV })
      .from(users)
      .where(eq(users.id, createdId!));
    expect(row.email).toBeNull();
    expect(row.emailHash).toBeNull();
    expect(row.emailIV).toBeNull();
  });
});
