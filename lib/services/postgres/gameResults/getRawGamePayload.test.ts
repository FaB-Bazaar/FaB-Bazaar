/**
 * Integration tests for PostgresGameResultsService.getRawGamePayload — reads the
 * archived raw blob back out of game_result_payloads, scoped to a deck.
 *
 * Runs against the real local Postgres (requires POSTGRES_URL in .env.local).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, decks, gameResults } from '@/lib/postgres/schema';
import { PostgresGameResultsService } from './PostgresGameResultsService';
import type { TalisharGamePayload, TalisharDeckPayload } from './PostgresGameResultsService';

const service = new PostgresGameResultsService();

let testUserId: string;
let deckId: string;

async function setupDeck(opts: { isAdmin?: boolean } = {}) {
  testUserId = crypto.randomUUID();
  deckId = crypto.randomUUID();
  await db.insert(users).values({
    id: testUserId,
    username: `test-${testUserId}`,
    isAdmin: opts.isAdmin ?? false,
  });
  await db.insert(decks).values({
    id: deckId,
    publicId: `t-${crypto.randomUUID().slice(0, 8)}`,
    userId: testUserId,
    name: 'Test Deck',
  });
}

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

function makeGame() {
  const self: TalisharDeckPayload = {
    result: 1,
    playerHero: 'dash_io',
    opposingHero: 'briar',
    cardResults: [{ cardId: 'boom_grenade_red', played: 1 }],
  } as TalisharDeckPayload;
  const opp = { result: 0, cardResults: [{ cardId: 'x', played: 1 }] } as TalisharDeckPayload;
  const payload: TalisharGamePayload = {
    gameID: 'g', gameGUID: crypto.randomUUID(), format: '1', conceded: false, deck1: self, deck2: opp,
  };
  return { payload, self, opp };
}

describe('PostgresGameResultsService.getRawGamePayload', () => {
  it('returns the archived blob for an admin-owned result', async () => {
    await setupDeck({ isAdmin: true });
    const { payload, self, opp } = makeGame();
    const created = await service.createGameResult(deckId, payload, self, opp);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const res = await service.getRawGamePayload(created.data.id, deckId);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).not.toBeNull();
    expect((res.data!.self as { playerHero?: string }).playerHero).toBe('dash_io');
  });

  it('returns null for a result that has no archived payload', async () => {
    await setupDeck({ isAdmin: true });
    const bareId = crypto.randomUUID();
    await db.insert(gameResults).values({ id: bareId, deckId, result: 'win', conceded: false });

    const res = await service.getRawGamePayload(bareId, deckId);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toBeNull();
  });

  it('does not return an archive scoped to a different deck', async () => {
    await setupDeck({ isAdmin: true });
    const { payload, self, opp } = makeGame();
    const created = await service.createGameResult(deckId, payload, self, opp);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const res = await service.getRawGamePayload(created.data.id, crypto.randomUUID());
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toBeNull();
  });
});
