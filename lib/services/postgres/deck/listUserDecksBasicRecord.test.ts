/**
 * Integration test: listUserDecksBasic must surface each deck's game record
 * (wins/losses from game_results) so nav surfaces can show a W–L next to
 * pinned decks without a second fetch.
 *
 * Runs against the local Postgres DB. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, decks, gameResults } from '@/lib/postgres/schema';
import { PostgresDeckService } from './PostgresDeckService';

const service = new PostgresDeckService();

let testUserId: string;
let playedDeckId: string;
let freshDeckId: string;

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  playedDeckId = crypto.randomUUID();
  freshDeckId = crypto.randomUUID();

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });

  await db.insert(decks).values([
    { id: playedDeckId, publicId: `pl-${crypto.randomUUID().slice(0, 8)}`, userId: testUserId, name: `Played ${playedDeckId}` },
    { id: freshDeckId, publicId: `fr-${crypto.randomUUID().slice(0, 8)}`, userId: testUserId, name: `Fresh ${freshDeckId}` },
  ]);

  await db.insert(gameResults).values([
    { id: crypto.randomUUID(), deckId: playedDeckId, result: 'win' },
    { id: crypto.randomUUID(), deckId: playedDeckId, result: 'win' },
    { id: crypto.randomUUID(), deckId: playedDeckId, result: 'win' },
    { id: crypto.randomUUID(), deckId: playedDeckId, result: 'loss' },
  ]);
});

afterEach(async () => {
  // gameResults cascade with the deck, decks cascade with the user.
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('listUserDecksBasic game record', () => {
  it('returns wins/losses per deck, zero for decks with no games', async () => {
    const result = await service.listUserDecksBasic(testUserId);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const played = result.data.find(d => d._id === playedDeckId);
    const fresh = result.data.find(d => d._id === freshDeckId);

    expect(played?.wins).toBe(3);
    expect(played?.losses).toBe(1);
    expect(fresh?.wins).toBe(0);
    expect(fresh?.losses).toBe(0);
  });
});
