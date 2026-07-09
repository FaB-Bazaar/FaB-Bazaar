/**
 * Integration test for PostgresGameResultsService.getDeckPerformanceForUser —
 * the per-deck W/L + matchup aggregate behind the get_deck_performance MCP
 * tool ("how are my decks performing in my recent games?").
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, decks, gameResults } from '@/lib/postgres/schema';
import { PostgresGameResultsService } from './PostgresGameResultsService';

const service = new PostgresGameResultsService();

let testUserId: string;
let otherUserId: string;
let activeDeckPublicId: string;
let quietDeckPublicId: string;

const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

const game = (deckId: string, result: 'win' | 'loss', opponentHero: string, daysAgo: number) => ({
  id: crypto.randomUUID(),
  deckId,
  result,
  opponentHero,
  playedAt: at(daysAgo),
});

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  otherUserId = crypto.randomUUID();
  const activeDeckId = crypto.randomUUID();
  const quietDeckId = crypto.randomUUID();
  const otherDeckId = crypto.randomUUID();
  activeDeckPublicId = `t-${crypto.randomUUID().slice(0, 12)}`;
  quietDeckPublicId = `t-${crypto.randomUUID().slice(0, 12)}`;

  await db.insert(users).values([
    { id: testUserId, username: `test-${testUserId}` },
    { id: otherUserId, username: `test-${otherUserId}` },
  ]);
  await db.insert(decks).values([
    { id: activeDeckId, publicId: activeDeckPublicId, userId: testUserId, name: 'Active Deck', heroName: 'Bravo' },
    { id: quietDeckId, publicId: quietDeckPublicId, userId: testUserId, name: 'Quiet Deck' },
    { id: otherDeckId, publicId: `t-${crypto.randomUUID().slice(0, 12)}`, userId: otherUserId, name: 'Not Mine' },
  ]);

  await db.insert(gameResults).values([
    // Active Deck: 2W-1L vs kano, 0W-2L vs katsu → 5 games, 40% overall
    game(activeDeckId, 'win', 'kano', 1),
    game(activeDeckId, 'loss', 'kano', 2),
    game(activeDeckId, 'win', 'kano', 3),
    game(activeDeckId, 'loss', 'katsu', 4),
    game(activeDeckId, 'loss', 'katsu', 5),
    // Quiet Deck: one old win (played BEFORE all Active Deck games)
    game(quietDeckId, 'win', 'bravo', 30),
    // Another user's games must not leak in
    game(otherDeckId, 'win', 'kano', 1),
  ]);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
  await db.delete(users).where(eq(users.id, otherUserId));
});

describe('getDeckPerformanceForUser', () => {
  it('aggregates per-deck W/L, win rate, form, and best/worst matchups', async () => {
    const res = await service.getDeckPerformanceForUser(testUserId);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toHaveLength(2);

    // most recently played deck first
    const [active, quiet] = res.data;
    expect(active.deckPublicId).toBe(activeDeckPublicId);
    expect(active.deckName).toBe('Active Deck');
    expect(active.heroName).toBe('Bravo');
    expect(active.games).toBe(5);
    expect(active.wins).toBe(2);
    expect(active.losses).toBe(3);
    expect(active.winRatePct).toBe(40);
    // newest first: W(kano) L(kano) W(kano) L(katsu) L(katsu)
    expect(active.recentForm).toEqual(['W', 'L', 'W', 'L', 'L']);
    // matchups need >= 2 games: kano 2/3 best, katsu 0/2 worst
    expect(active.bestMatchup).toMatchObject({ opponentHero: 'kano', games: 3, wins: 2 });
    expect(active.worstMatchup).toMatchObject({ opponentHero: 'katsu', games: 2, wins: 0 });

    expect(quiet.deckPublicId).toBe(quietDeckPublicId);
    expect(quiet.games).toBe(1);
    expect(quiet.winRatePct).toBe(100);
    // single game → not enough data for matchup call-outs
    expect(quiet.bestMatchup).toBeNull();
    expect(quiet.worstMatchup).toBeNull();
  });

  it('returns an empty list for a user with no games', async () => {
    const res = await service.getDeckPerformanceForUser(otherUserId);
    expect(res.success).toBe(true);
    if (!res.success) return;
    // otherUser has one deck with one game — scoped to THEIR data only
    expect(res.data).toHaveLength(1);
    expect(res.data[0].deckName).toBe('Not Mine');

    const nobody = await service.getDeckPerformanceForUser(crypto.randomUUID());
    expect(nobody.success).toBe(true);
    if (!nobody.success) return;
    expect(nobody.data).toHaveLength(0);
  });

  it('honors sinceDays to window the aggregate', async () => {
    const res = await service.getDeckPerformanceForUser(testUserId, { sinceDays: 7 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    // the 30-day-old Quiet Deck game falls outside the window
    expect(res.data).toHaveLength(1);
    expect(res.data[0].deckPublicId).toBe(activeDeckPublicId);
  });
});
