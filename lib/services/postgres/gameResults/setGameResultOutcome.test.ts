/**
 * Integration tests for PostgresGameResultsService.setGameResultOutcome — the
 * deck owner's manual win/loss correction (e.g. a game conceded after a
 * take-back that was then played out and won). Talishar sync inserts with
 * ON CONFLICT DO NOTHING, so a corrected row is never overwritten by a re-sync.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, decks, gameResults } from '@/lib/postgres/schema';
import { PostgresGameResultsService } from './PostgresGameResultsService';

const service = new PostgresGameResultsService();

let testUserId: string;
let deckId: string;
let otherDeckId: string;
let resultId: string;

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  deckId = crypto.randomUUID();
  otherDeckId = crypto.randomUUID();
  resultId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  await db.insert(decks).values([
    { id: deckId, publicId: `t-${crypto.randomUUID().slice(0, 8)}`, userId: testUserId, name: 'Test Deck' },
    { id: otherDeckId, publicId: `o-${crypto.randomUUID().slice(0, 8)}`, userId: testUserId, name: 'Other Deck' },
  ]);
  await db.insert(gameResults).values({
    id: resultId,
    deckId,
    talisharGameGuid: `guid-${resultId}`,
    result: 'loss',
    conceded: true,
  });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

const row = async () => (await db.select().from(gameResults).where(eq(gameResults.id, resultId)))[0];

describe('PostgresGameResultsService.setGameResultOutcome', () => {
  it('turns a conceded loss into a win, clears the concession and marks it edited', async () => {
    const res = await service.setGameResultOutcome(resultId, deckId, 'win');
    expect(res.success).toBe(true);

    const r = await row();
    expect(r.result).toBe('win');
    expect(r.conceded).toBe(false);
    expect(r.resultEditedAt).toBeInstanceOf(Date);
  });

  it('can be changed back to a loss', async () => {
    await service.setGameResultOutcome(resultId, deckId, 'win');
    await service.setGameResultOutcome(resultId, deckId, 'loss');
    expect((await row()).result).toBe('loss');
  });

  it('shows the edit on the deck results list', async () => {
    await service.setGameResultOutcome(resultId, deckId, 'win');
    const list = await service.getGameResultsForDeck(deckId);
    if (!list.success) throw new Error(list.error);
    const game = list.data.data.find((g) => g.id === resultId);
    expect(game).toMatchObject({ result: 'win', resultEdited: true });
  });

  it('survives a Talishar re-sync of the same game', async () => {
    await service.setGameResultOutcome(resultId, deckId, 'win');
    const self = { result: 0, playerHero: 'dash_io', opposingHero: 'dorinthea', character: [], cardResults: [] } as any;
    await service.createGameResult(
      deckId,
      { gameID: '1', gameGUID: `guid-${resultId}`, format: '1', conceded: true, deck1: self, deck2: self } as any,
      self,
    );
    const r = await row();
    expect(r.result).toBe('win');
    expect(r.conceded).toBe(false);
  });

  it('refuses a result that belongs to another deck', async () => {
    const res = await service.setGameResultOutcome(resultId, otherDeckId, 'win');
    expect(res.success).toBe(false);
    expect((await row()).result).toBe('loss');
  });

  it('rejects anything but win or loss', async () => {
    const res = await service.setGameResultOutcome(resultId, deckId, 'draw' as any);
    expect(res.success).toBe(false);
  });
});
