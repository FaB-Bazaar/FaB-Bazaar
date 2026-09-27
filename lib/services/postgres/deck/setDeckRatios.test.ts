/**
 * Integration tests: PostgresDeckService.setDeckRatios writes ONLY
 * decks.metadata.ratios (atomic jsonb_set — matchups and other metadata keys
 * survive), for the owner or a co-owner.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { users, decks } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();
const RATIOS = [{ id: 'r1', a: { kind: 'text' as const, value: 'discard' }, b: { kind: 'text' as const, value: 'gate' } }];
const MATCHUPS = [{ heroId: 'briar_warden_of_thorns', preferredTurnOrder: null, notes: null, sideboard: { in: [], out: [] } }];

let ownerId: string;
let coOwnerId: string;
let strangerId: string;
let publicId: string;

beforeEach(async () => {
  [ownerId, coOwnerId, strangerId] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  await db.insert(users).values([ownerId, coOwnerId, strangerId].map(id => ({ id, username: `test-${id}` })));
  publicId = nanoid(21);
  await db.insert(decks).values({
    id: nanoid(21), publicId, userId: ownerId, name: `Ratios ${publicId}`, slug: `slug-${publicId}`,
    format: 'Classic Constructed', visibility: 'private', coOwners: [coOwnerId],
    metadata: { matchups: MATCHUPS, other: 'kept' },
  });
});

afterEach(async () => {
  await db.delete(users).where(inArray(users.id, [ownerId, coOwnerId, strangerId]));
});

const metadataOf = async () => (await db.select({ m: decks.metadata }).from(decks).where(eq(decks.publicId, publicId)))[0]?.m as any;

describe('setDeckRatios', () => {
  it('saves ratios for the owner and leaves matchups and other metadata alone', async () => {
    const r = await service.setDeckRatios(publicId, ownerId, RATIOS);
    expect(r.success).toBe(true);
    const m = await metadataOf();
    expect(m.ratios).toEqual(RATIOS);
    expect(m.matchups).toEqual(MATCHUPS);
    expect(m.other).toBe('kept');
  });

  it('lets a co-owner save', async () => {
    expect((await service.setDeckRatios(publicId, coOwnerId, RATIOS)).success).toBe(true);
    expect((await metadataOf()).ratios).toEqual(RATIOS);
  });

  it('refuses anyone else and leaves the deck untouched', async () => {
    const r = await service.setDeckRatios(publicId, strangerId, RATIOS);
    expect(r.success).toBe(false);
    expect((await metadataOf()).ratios).toBeUndefined();
  });

  it('an empty list clears the ratios', async () => {
    await service.setDeckRatios(publicId, ownerId, RATIOS);
    await service.setDeckRatios(publicId, ownerId, []);
    expect((await metadataOf()).ratios).toEqual([]);
  });
});
