/**
 * Integration tests: every game-results READ path returns the canonical
 * (starting) hero even when the stored row holds Talishar's end-of-game
 * transformed form. Rows are inserted exactly as prod holds them — e.g. the
 * Gherkin (Teklovossen) game of 2026-08-15 stored `opponent_hero =
 * arakni_redback` and most of that deck's games stored `player_hero =
 * teklovossen_the_mechropotent`. The DB is never rewritten; the service maps.
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
let deckId: string;
let deckPublicId: string;
let redbackGameId: string;

const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  deckId = crypto.randomUUID();
  deckPublicId = `t-${crypto.randomUUID().slice(0, 12)}`;
  redbackGameId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  await db.insert(decks).values({ id: deckId, publicId: deckPublicId, userId: testUserId, name: 'Gherkin', heroName: 'Teklovossen, Esteemed Magnate' });
  await db.insert(gameResults).values([
    // CC game: opponent transformed Marionette → Redback; we transformed → Mechropotent
    { id: redbackGameId, deckId, format: '0', playerHero: 'teklovossen_the_mechropotent', opponentHero: 'arakni_redback', result: 'loss', playedAt: at(1) },
    // Same opponent, untransformed at game end
    { id: crypto.randomUUID(), deckId, format: '0', playerHero: 'teklovossen_esteemed_magnate', opponentHero: 'arakni_marionette', result: 'win', playedAt: at(2) },
    // Silver Age game: the young forms
    { id: crypto.randomUUID(), deckId, format: '14', playerHero: 'teklovossen_the_mechropotent', opponentHero: 'arakni_black_widow', result: 'win', playedAt: at(3) },
  ]);
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('canonical hero on read', () => {
  it('getGameResultsForDeck maps transformed forms to the starting hero, per format', async () => {
    const res = await service.getGameResultsForDeck(deckId, { limit: 10 });
    if (!res.success) throw new Error(res.error);
    const byId = new Map(res.data.data.map((g) => [g.id, g]));
    expect(byId.get(redbackGameId)).toMatchObject({ playerHero: 'teklovossen_esteemed_magnate', opponentHero: 'arakni_marionette' });
    const heroes = res.data.data.map((g) => `${g.playerHero} vs ${g.opponentHero}`).sort();
    expect(heroes).toEqual([
      'teklovossen vs arakni_web_of_deceit',
      'teklovossen_esteemed_magnate vs arakni_marionette',
      'teklovossen_esteemed_magnate vs arakni_marionette',
    ]);
  });

  it('getGameResult (detail) maps both heroes', async () => {
    const res = await service.getGameResult(redbackGameId, deckId);
    if (!res.success) throw new Error(res.error);
    expect(res.data.playerHero).toBe('teklovossen_esteemed_magnate');
    expect(res.data.opponentHero).toBe('arakni_marionette');
  });

  it('getRecentGameResultsForUser maps both heroes', async () => {
    const res = await service.getRecentGameResultsForUser(testUserId, 10);
    if (!res.success) throw new Error(res.error);
    const g = res.data.find((r) => r.id === redbackGameId);
    expect(g).toMatchObject({ playerHero: 'teklovossen_esteemed_magnate', opponentHero: 'arakni_marionette' });
  });

  it('getDeckPerformanceForUser buckets Redback and Marionette as ONE matchup', async () => {
    const res = await service.getDeckPerformanceForUser(testUserId, { minMatchupGames: 2 });
    if (!res.success) throw new Error(res.error);
    const deck = res.data.find((d) => d.deckPublicId === deckPublicId);
    expect(deck).toBeDefined();
    // 1W-1L vs Marionette qualifies (2 games); the lone SA game vs Web of Deceit does not
    expect(deck!.bestMatchup).toEqual({ opponentHero: 'arakni_marionette', games: 2, wins: 1 });
  });
});
