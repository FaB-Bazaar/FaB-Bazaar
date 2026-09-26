/**
 * Integration test: a user's streaming deck (users.streaming_deck_id, migration 0120) —
 * the deck the profile-level stream overlay (/overlay/u/<username>/deck) renders.
 * Only a deck the user owns or co-owns can be chosen, and only one that is link-viewable
 * (public/unlisted, not Metafy-gated), because OBS fetches the overlay with no session.
 *
 * Runs against the local Postgres DB. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, decks } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let ownerId: string;
let otherId: string;
let ownerName: string;
const deckIds: Record<string, string> = {};
const publicIds: Record<string, string> = {};

async function insertDeck(key: string, userId: string, fields: Partial<typeof decks.$inferInsert> = {}) {
  deckIds[key] = crypto.randomUUID();
  publicIds[key] = `strm-${key}-${crypto.randomUUID().slice(0, 8)}`;
  await db.insert(decks).values({
    id: deckIds[key],
    publicId: publicIds[key],
    userId,
    name: `Streaming ${key}`,
    visibility: 'unlisted',
    ...fields,
  });
}

beforeEach(async () => {
  ownerId = crypto.randomUUID();
  otherId = crypto.randomUUID();
  ownerName = `Streamer-${ownerId.slice(0, 8)}`;
  await db.insert(users).values([
    { id: ownerId, username: ownerName },
    { id: otherId, username: `test-${otherId}` },
  ]);
  await insertDeck('unlisted', ownerId);
  await insertDeck('public', ownerId, { visibility: 'public' });
  await insertDeck('private', ownerId, { visibility: 'private' });
  await insertDeck('friends', ownerId, { visibility: 'friends' });
  await insertDeck('gated', ownerId, { visibility: 'public', metafyGuideId: 'guide-1' });
  await insertDeck('others', otherId);
  await insertDeck('coowned', otherId, { coOwners: [ownerId] });
});

afterEach(async () => {
  await db.delete(users).where(inArray(users.id, [ownerId, otherId]));
});

describe('streaming deck', () => {
  it('starts unset', async () => {
    const res = await service.getStreamingDeckPublicId(ownerId);
    expect(res).toEqual({ success: true, data: null });
  });

  it('sets an owned unlisted deck and reads it back', async () => {
    const set = await service.setStreamingDeck(ownerId, publicIds.unlisted);
    expect(set).toEqual({ success: true, data: { deckPublicId: publicIds.unlisted } });
    expect(await service.getStreamingDeckPublicId(ownerId)).toEqual({ success: true, data: publicIds.unlisted });
  });

  it('switching decks replaces the previous choice', async () => {
    await service.setStreamingDeck(ownerId, publicIds.unlisted);
    await service.setStreamingDeck(ownerId, publicIds.public);
    expect(await service.getStreamingDeckPublicId(ownerId)).toEqual({ success: true, data: publicIds.public });
  });

  it('clears with null', async () => {
    await service.setStreamingDeck(ownerId, publicIds.unlisted);
    const cleared = await service.setStreamingDeck(ownerId, null);
    expect(cleared).toEqual({ success: true, data: { deckPublicId: null } });
    expect(await service.getStreamingDeckPublicId(ownerId)).toEqual({ success: true, data: null });
  });

  it('allows a co-owned deck', async () => {
    const set = await service.setStreamingDeck(ownerId, publicIds.coowned);
    expect(set.success).toBe(true);
  });

  it("refuses someone else's deck as not found", async () => {
    const set = await service.setStreamingDeck(ownerId, publicIds.others);
    expect(set).toMatchObject({ success: false, code: 'NOT_FOUND' });
  });

  it('refuses a deck id that does not exist', async () => {
    const set = await service.setStreamingDeck(ownerId, 'does-not-exist');
    expect(set).toMatchObject({ success: false, code: 'NOT_FOUND' });
  });

  it.each(['private', 'friends', 'gated'])('refuses a %s deck — the overlay could never show it', async key => {
    const set = await service.setStreamingDeck(ownerId, publicIds[key]);
    expect(set).toMatchObject({ success: false, code: 'NOT_STREAMABLE' });
    expect(await service.getStreamingDeckPublicId(ownerId)).toEqual({ success: true, data: null });
  });

  it('deleting the deck clears the choice', async () => {
    await service.setStreamingDeck(ownerId, publicIds.unlisted);
    await db.delete(decks).where(eq(decks.id, deckIds.unlisted));
    expect(await service.getStreamingDeckPublicId(ownerId)).toEqual({ success: true, data: null });
  });

  describe('findStreamingDeckByUsername', () => {
    it('returns the full deck for the username, case-insensitively', async () => {
      await service.setStreamingDeck(ownerId, publicIds.public);
      const res = await service.findStreamingDeckByUsername(ownerName.toLowerCase());
      expect(res.success).toBe(true);
      if (!res.success) return;
      expect(res.data?.publicId).toBe(publicIds.public);
      expect(res.data?.name).toBe('Streaming public');
    });

    it('returns null when the user has no streaming deck', async () => {
      expect(await service.findStreamingDeckByUsername(ownerName)).toEqual({ success: true, data: null });
    });

    it('returns null for an unknown username', async () => {
      expect(await service.findStreamingDeckByUsername('nobody-here-xyz')).toEqual({ success: true, data: null });
    });
  });
});
