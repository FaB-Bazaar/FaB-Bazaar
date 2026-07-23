/**
 * Integration test: the Community listing (listPublicDecks) must NOT include
 * the superadmin-owned "Decks to Beat" reference decks (isSystemDeck) — they
 * have their own section. They stay reachable through the featured filter,
 * which is how the Decks to Beat page, the Volzar to-beat picker, and the
 * archetype consensus all ask for them.
 *
 * Runs against the local Postgres DB. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, decks } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let testUserId: string;
let communityDeckId: string;
let systemDeckId: string;
// Unique name so filters scope to this test's fixtures only.
const token = `zzsystest${crypto.randomUUID().slice(0, 8)}`;

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  communityDeckId = crypto.randomUUID();
  systemDeckId = crypto.randomUUID();

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  // 'Living Legend' bypasses the plausible-card-count HAVING gate (it only
  // covers CC / Silver Age / Blitz), so zero-card fixtures list normally.
  await db.insert(decks).values([
    {
      id: communityDeckId, publicId: `cm-${crypto.randomUUID().slice(0, 8)}`, userId: testUserId,
      name: `${token} community`, visibility: 'public', format: 'Living Legend',
    },
    {
      id: systemDeckId, publicId: `sy-${crypto.randomUUID().slice(0, 8)}`, userId: testUserId,
      name: `${token} to-beat`, visibility: 'public', format: 'Living Legend', isSystemDeck: true, featured: true,
    },
  ]);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('listPublicDecks system-deck exclusion', () => {
  it('excludes system decks from the default (community) listing', async () => {
    const result = await service.listPublicDecks({ search: token }, { limit: 20 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const ids = result.data.decks.map(d => d._id ?? (d as any).id);
    expect(ids).toContain(communityDeckId);
    expect(ids).not.toContain(systemDeckId);
    expect(result.data.total).toBe(1);
  });

  it('still returns system decks through the featured filter (Decks to Beat)', async () => {
    const result = await service.listPublicDecks({ search: token, featured: true }, { limit: 20 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const ids = result.data.decks.map(d => d._id ?? (d as any).id);
    expect(ids).toContain(systemDeckId);
  });

  it('includeSystemDecks: true opts back into everything', async () => {
    const result = await service.listPublicDecks({ search: token, includeSystemDecks: true }, { limit: 20 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.decks).toHaveLength(2);
  });
});
