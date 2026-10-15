/**
 * Integration tests for PostgresGameResultsService.createManualGameResult — a
 * game logged by hand (no Talishar game id, no turn-by-turn data). Re-logging
 * the same game (deck + opponent + played-at) must not create a duplicate.
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

const game = {
  opponentHero: 'malice_domina_of_the_dead',
  playedAt: new Date('2026-10-15T00:49:00Z'),
  format: '1',
  firstPlayer: true,
  totalTurns: 7,
  result: 'win' as const,
};

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  deckId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  await db.insert(decks).values({ id: deckId, publicId: `t-${crypto.randomUUID().slice(0, 8)}`, userId: testUserId, name: 'Test Deck' });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('createManualGameResult', () => {
  it('stores the game in the same shape as a synced one, with no Talishar ids or turn data', async () => {
    const r = await service.createManualGameResult(deckId, 'jarl_vetreidi', game);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.created).toBe(true);

    const [row] = await db.select().from(gameResults).where(eq(gameResults.deckId, deckId));
    expect(row).toMatchObject({
      playerHero: 'jarl_vetreidi', opponentHero: 'malice_domina_of_the_dead', format: '1',
      result: 'win', firstPlayer: true, totalTurns: 7, conceded: false,
      talisharGameId: null, talisharGameGuid: null, cardResults: null, turnLog: null,
    });
    expect(row.playedAt.toISOString()).toBe('2026-10-15T00:49:00.000Z');
    expect(r.data.result.id).toBe(row.id);
  });

  it('does not duplicate a game logged twice (same deck, opponent and time)', async () => {
    const first = await service.createManualGameResult(deckId, 'jarl_vetreidi', game);
    const again = await service.createManualGameResult(deckId, 'jarl_vetreidi', { ...game, totalTurns: 8 });
    expect(again.success && again.data.created).toBe(false);
    expect(again.success && first.success && again.data.result.id).toBe(first.success && first.data.result.id);
    const rows = await db.select().from(gameResults).where(eq(gameResults.deckId, deckId));
    expect(rows).toHaveLength(1);
  });

  it('a different opponent at the same time is a different game', async () => {
    await service.createManualGameResult(deckId, null, game);
    const other = await service.createManualGameResult(deckId, null, { ...game, opponentHero: 'dorinthea_ironsong' });
    expect(other.success && other.data.created).toBe(true);
  });
});
