/**
 * Integration tests for the pinned_in_nav flag on decks.
 *
 * Covers:
 *  - listUserDecksBasic surfaces pinnedInNav on each summary DTO
 *  - updateDeck accepts pinnedInNav and persists it
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
let pinnedDeckId: string;
let pinnedPublicId: string;
let unpinnedDeckId: string;
let unpinnedPublicId: string;

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  pinnedDeckId = crypto.randomUUID();
  pinnedPublicId = `pin-${crypto.randomUUID().slice(0, 8)}`;
  unpinnedDeckId = crypto.randomUUID();
  unpinnedPublicId = `unp-${crypto.randomUUID().slice(0, 8)}`;

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });

  await db.insert(decks).values([
    {
      id: pinnedDeckId,
      publicId: pinnedPublicId,
      userId: testUserId,
      name: `Pinned ${pinnedDeckId}`,
      pinnedInNav: true,
    },
    {
      id: unpinnedDeckId,
      publicId: unpinnedPublicId,
      userId: testUserId,
      name: `Unpinned ${unpinnedDeckId}`,
    },
  ]);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('decks pinned_in_nav', () => {
  it('listUserDecksBasic returns pinnedInNav on each deck summary', async () => {
    const result = await service.listUserDecksBasic(testUserId);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const pinned = result.data.find(d => d._id === pinnedDeckId);
    const unpinned = result.data.find(d => d._id === unpinnedDeckId);

    expect(pinned?.pinnedInNav).toBe(true);
    expect(unpinned?.pinnedInNav).toBe(false);
  });

  it('updateDeck({ pinnedInNav: true }) persists the flag', async () => {
    const result = await service.updateDeck(unpinnedPublicId, testUserId, { pinnedInNav: true });
    expect(result.success).toBe(true);

    const [row] = await db
      .select({ pinnedInNav: decks.pinnedInNav })
      .from(decks)
      .where(eq(decks.id, unpinnedDeckId));
    expect(row.pinnedInNav).toBe(true);
  });

  it('updateDeck({ pinnedInNav: false }) clears the flag', async () => {
    const result = await service.updateDeck(pinnedPublicId, testUserId, { pinnedInNav: false });
    expect(result.success).toBe(true);

    const [row] = await db
      .select({ pinnedInNav: decks.pinnedInNav })
      .from(decks)
      .where(eq(decks.id, pinnedDeckId));
    expect(row.pinnedInNav).toBe(false);
  });
});
