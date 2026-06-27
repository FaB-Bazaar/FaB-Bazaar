/**
 * Integration tests for PostgresGameResultsService.createGameResult — the
 * admin-gated raw-payload archive into the `game_result_payloads` sidecar table.
 *
 * The archive captures the full Talishar deck blob (everything Talishar sends,
 * including the fields the typed game_results columns drop: arenaCardResults,
 * tokenResults, character, and the precomputed aggregates) but ONLY when the
 * deck owner is an admin/superadmin. Opponent data is consent-gated, mirroring
 * the opponent_card_results behaviour of the main row.
 *
 * Runs against the real local Postgres (requires POSTGRES_URL in .env.local).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, pool } from '@/lib/postgres/db';
import { users, decks } from '@/lib/postgres/schema';
import { PostgresGameResultsService } from './PostgresGameResultsService';
import type { TalisharGamePayload, TalisharDeckPayload } from './PostgresGameResultsService';

const service = new PostgresGameResultsService();

let testUserId: string;
let deckId: string;

async function setupDeck(opts: { isAdmin?: boolean; isSuperAdmin?: boolean } = {}) {
  testUserId = crypto.randomUUID();
  deckId = crypto.randomUUID();
  await db.insert(users).values({
    id: testUserId,
    username: `test-${testUserId}`,
    isAdmin: opts.isAdmin ?? false,
    isSuperAdmin: opts.isSuperAdmin ?? false,
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

function makeGame(opponentConsents = true): {
  payload: TalisharGamePayload;
  self: TalisharDeckPayload;
  opponent: TalisharDeckPayload;
} {
  const self: TalisharDeckPayload = {
    deckId: 'self-deck',
    turns: 5,
    result: 1,
    firstPlayer: 1,
    playerHero: 'dash_io',
    opposingHero: 'briar',
    cardResults: [{ cardId: 'boom_grenade_red', played: 1 }],
    turnLog: [[1, 'boom_grenade_red', 'M']],
    // a field the typed columns drop — proves the raw archive keeps the whole blob
    arenaCardResults: [{ cardId: 'teklo_plasma_pistol', activated: 2 }],
  } as TalisharDeckPayload;

  const opponent: TalisharDeckPayload = {
    deckId: 'opp-deck',
    result: 0,
    playerHero: 'briar',
    cardResults: opponentConsents ? [{ cardId: 'spreading_flames_red', played: 1 }] : [],
    turnLog: [[1, 'spreading_flames_red', 'M']],
  } as TalisharDeckPayload;

  const payload: TalisharGamePayload = {
    gameID: 'game-1',
    gameGUID: crypto.randomUUID(),
    format: '1',
    conceded: false,
    deck1: self,
    deck2: opponent,
  };

  return { payload, self, opponent };
}

async function fetchArchive(resultId: string): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query<{ payload: Record<string, unknown> }>(
    'SELECT payload FROM game_result_payloads WHERE result_id = $1',
    [resultId]
  );
  return rows[0]?.payload ?? null;
}

describe('PostgresGameResultsService.createGameResult — raw payload archive', () => {
  it('archives the full deck blob for an admin-owned deck', async () => {
    await setupDeck({ isAdmin: true });
    const { payload, self, opponent } = makeGame();

    const res = await service.createGameResult(deckId, payload, self, opponent);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const archived = await fetchArchive(res.data.id);
    expect(archived).not.toBeNull();
    // top-level game metadata is preserved
    expect(archived!.gameID).toBe('game-1');
    expect(archived!.format).toBe('1');
    // the full self entry is preserved, including fields the typed columns drop
    const archivedSelf = archived!.self as Record<string, unknown>;
    expect(archivedSelf.playerHero).toBe('dash_io');
    expect(archivedSelf.arenaCardResults).toEqual([{ cardId: 'teklo_plasma_pistol', activated: 2 }]);
    // opponent (consented) is preserved
    const archivedOpp = archived!.opponent as Record<string, unknown>;
    expect(archivedOpp.playerHero).toBe('briar');
  });

  it('archives for a superadmin-owned deck', async () => {
    await setupDeck({ isSuperAdmin: true });
    const { payload, self, opponent } = makeGame();

    const res = await service.createGameResult(deckId, payload, self, opponent);
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(await fetchArchive(res.data.id)).not.toBeNull();
  });

  it('archives for any owner regardless of role (admin gate removed)', async () => {
    await setupDeck({ isAdmin: false, isSuperAdmin: false });
    const { payload, self, opponent } = makeGame();

    const res = await service.createGameResult(deckId, payload, self, opponent);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const archived = await fetchArchive(res.data.id);
    expect(archived).not.toBeNull();
    expect((archived!.self as Record<string, unknown>).playerHero).toBe('dash_io');
  });

  it('nulls the opponent entry when the opponent did not consent', async () => {
    await setupDeck({ isAdmin: true });
    const { payload, self, opponent } = makeGame(false);

    const res = await service.createGameResult(deckId, payload, self, opponent);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const archived = await fetchArchive(res.data.id);
    expect(archived).not.toBeNull();
    // self is still archived in full…
    expect((archived!.self as Record<string, unknown>).playerHero).toBe('dash_io');
    // …but the non-consenting opponent is dropped
    expect(archived!.opponent).toBeNull();
  });
});
