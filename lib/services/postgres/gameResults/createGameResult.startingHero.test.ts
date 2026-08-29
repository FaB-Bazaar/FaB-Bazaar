/**
 * Integration test: createGameResult stores the hero each player STARTED as,
 * not the form Talishar snapshots at game end.
 *
 * Regression for Gherkin (Teklovossen) vs Arakni, Marionette on 2026-08-15:
 * the opponent became Orb-Weaver / Redback via Marionette's end-phase trigger,
 * Talishar reported `opposingHero: arakni_redback`, and the results tab listed
 * a demi-hero nobody can start a game as. Same mechanism split the player's own
 * Teklovossen games into esteemed_magnate vs the_mechropotent.
 *
 * Runs against the real local Postgres (requires POSTGRES_URL in .env.local).
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, decks } from '@/lib/postgres/schema';
import { PostgresGameResultsService } from './PostgresGameResultsService';
import type { TalisharGamePayload, TalisharDeckPayload } from './PostgresGameResultsService';

const service = new PostgresGameResultsService();

let testUserId: string;
let deckId: string;

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  deckId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  await db.insert(decks).values({
    id: deckId,
    publicId: `t-${crypto.randomUUID().slice(0, 8)}`,
    userId: testUserId,
    name: 'Gherkin',
  });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

function makePayload(self: TalisharDeckPayload, opponent: TalisharDeckPayload): TalisharGamePayload {
  return {
    gameID: '2007528',
    gameGUID: crypto.randomUUID(),
    format: '1',
    conceded: false,
    deck1: self,
    deck2: opponent,
  };
}

describe('createGameResult — starting hero', () => {
  it('stores the starting hero card for both players when Talishar reports a transformed form', async () => {
    const self = {
      result: 0,
      playerHero: 'teklovossen_the_mechropotent',
      opposingHero: 'arakni_redback',
      character: [{ cardId: 'teklovossen_esteemed_magnate', cardName: 'Teklovossen, Esteemed Magnate', numCopies: 1 }],
      cardResults: [{ cardId: 'evo_recall_blue', played: 1 }],
    } as TalisharDeckPayload;
    const opponent = {
      result: 1,
      playerHero: 'arakni_redback',
      opposingHero: 'teklovossen_the_mechropotent',
      character: [
        { cardId: 'arakni_marionette', cardName: 'Arakni, Marionette', numCopies: 1 },
        { cardId: 'hunters_klaive', cardName: "Hunter's Klaive", numCopies: 1 },
      ],
      cardResults: [{ cardId: 'kiss_of_death_red', played: 3 }],
    } as TalisharDeckPayload;

    const res = await service.createGameResult(deckId, makePayload(self, opponent), self, opponent);
    if (!res.success) throw new Error(res.error);
    expect(res.data.playerHero).toBe('teklovossen_esteemed_magnate');
    expect(res.data.opponentHero).toBe('arakni_marionette');
  });

  it('resolves the opponent starting hero even when they opted out of sharing card data', async () => {
    const self = {
      result: 1,
      playerHero: 'dash_io',
      opposingHero: 'blasmophet_levia_consumed',
      character: [{ cardId: 'dash_io', numCopies: 1 }],
      cardResults: [{ cardId: 'boom_grenade_red', played: 1 }],
    } as TalisharDeckPayload;
    const opponent = {
      result: 0,
      playerHero: 'blasmophet_levia_consumed',
      character: [{ cardId: 'levia_shadowborn_abomination', numCopies: 1 }],
      cardResults: [], // opted out
    } as TalisharDeckPayload;

    const res = await service.createGameResult(deckId, makePayload(self, opponent), self, opponent);
    if (!res.success) throw new Error(res.error);
    expect(res.data.opponentHero).toBe('levia_shadowborn_abomination');
    expect(res.data.opponentCardResults).toBeNull();
  });

  it('falls back to playerHero / opposingHero when the payload has no character array', async () => {
    const self = { result: 1, playerHero: 'dash_io', opposingHero: 'briar', cardResults: [{ cardId: 'x', played: 1 }] } as TalisharDeckPayload;
    const opponent = { result: 0, playerHero: 'briar', cardResults: [] } as TalisharDeckPayload;

    const res = await service.createGameResult(deckId, makePayload(self, opponent), self, opponent);
    if (!res.success) throw new Error(res.error);
    expect(res.data.playerHero).toBe('dash_io');
    expect(res.data.opponentHero).toBe('briar');
  });
});
