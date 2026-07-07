/**
 * Integration tests for PostgresGameResultsService.getRecentGameResultsForUser.
 *
 * The cross-deck recent-games feed drives the Volzar "Game results" table,
 * where every row gets a one-click Analyze. Analysis resolves the deck by
 * name through the user's PERSONAL deck list (listUserDecks excludes
 * is_system_deck) — so games belonging to system decks must not appear in
 * the feed, or the row renders but can never be analyzed.
 *
 * Runs against the real local Postgres (requires POSTGRES_URL in .env.local).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, decks, gameResults } from '@/lib/postgres/schema';
import { PostgresGameResultsService } from './PostgresGameResultsService';

const service = new PostgresGameResultsService();

let testUserId: string;
let personalDeckId: string;
let systemDeckId: string;

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  personalDeckId = crypto.randomUUID();
  systemDeckId = crypto.randomUUID();

  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  await db.insert(decks).values([
    { id: personalDeckId, publicId: `t-${crypto.randomUUID().slice(0, 8)}`, userId: testUserId, name: 'Personal Deck' },
    { id: systemDeckId, publicId: `t-${crypto.randomUUID().slice(0, 8)}`, userId: testUserId, name: 'System Deck', isSystemDeck: true },
  ]);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

function insertResult(deckId: string, playedAt: Date) {
  return db.insert(gameResults).values({
    id: crypto.randomUUID(),
    deckId,
    result: 'win',
    conceded: false,
    playedAt,
  });
}

describe('PostgresGameResultsService.getRecentGameResultsForUser', () => {
  it('excludes games from system decks — every row in the feed must be analyzable', async () => {
    await insertResult(personalDeckId, new Date('2026-07-01T12:00:00Z'));
    await insertResult(systemDeckId, new Date('2026-07-02T12:00:00Z'));

    const res = await service.getRecentGameResultsForUser(testUserId, 50);

    expect(res.success).toBe(true);
    if (!res.success) return;
    const deckNames = res.data.map((r) => r.deckName);
    expect(deckNames).toContain('Personal Deck');
    expect(deckNames).not.toContain('System Deck');
  });

  it('still returns personal-deck games newest first', async () => {
    await insertResult(personalDeckId, new Date('2026-06-01T12:00:00Z'));
    await insertResult(personalDeckId, new Date('2026-07-01T12:00:00Z'));

    const res = await service.getRecentGameResultsForUser(testUserId, 50);

    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toHaveLength(2);
    expect(new Date(res.data[0].playedAt!).getTime())
      .toBeGreaterThan(new Date(res.data[1].playedAt!).getTime());
  });
});
