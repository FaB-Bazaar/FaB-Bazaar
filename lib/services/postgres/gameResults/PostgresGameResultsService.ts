import { db, pool } from '@/lib/postgres/db';
import { gameResults } from '@/lib/postgres/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { AsyncResult } from '../../contracts/common';

export interface GameResultDTO {
  id: string;
  deckId: string;
  talisharGameId?: string | null;
  talisharGameGuid?: string | null;
  format?: string | null;
  playerHero?: string | null;
  opponentHero?: string | null;
  result: 'win' | 'loss';
  conceded: boolean;
  firstPlayer?: boolean | null;
  totalTurns?: number | null;
  cardResults?: unknown;
  turnResults?: unknown;
  playedAt: Date;
  createdAt: Date;
}

export interface TalisharDeckPayload {
  gameId?: string;
  gameName?: string;
  deckId?: string;
  turns?: number;
  result?: number;
  firstPlayer?: number;
  playerHero?: string;
  opposingHero?: string;
  cardResults?: unknown;
  turnResults?: unknown;
}

export interface TalisharGamePayload {
  gameID?: string;
  gameName?: string;
  gameGUID?: string;
  format?: string;
  conceded?: boolean;
  deck1?: TalisharDeckPayload;
  deck2?: TalisharDeckPayload;
}

function toDTO(row: typeof gameResults.$inferSelect): GameResultDTO {
  return {
    id: row.id,
    deckId: row.deckId,
    talisharGameId: row.talisharGameId,
    talisharGameGuid: row.talisharGameGuid,
    format: row.format,
    playerHero: row.playerHero,
    opponentHero: row.opponentHero,
    result: row.result,
    conceded: row.conceded,
    firstPlayer: row.firstPlayer,
    totalTurns: row.totalTurns,
    cardResults: row.cardResults,
    turnResults: row.turnResults,
    playedAt: row.playedAt,
    createdAt: row.createdAt,
  };
}

export class PostgresGameResultsService {
  async createGameResult(
    deckId: string,
    payload: TalisharGamePayload,
    deckEntry: TalisharDeckPayload
  ): Promise<AsyncResult<GameResultDTO>> {
    try {
      const result = deckEntry.result === 1 ? 'win' : 'loss';

      const [row] = await db
        .insert(gameResults)
        .values({
          id: nanoid(),
          deckId,
          talisharGameId: payload.gameID ?? null,
          talisharGameGuid: payload.gameGUID ?? null,
          format: payload.format != null ? String(payload.format) : null,
          playerHero: deckEntry.playerHero ?? null,
          opponentHero: deckEntry.opposingHero ?? null,
          result,
          conceded: payload.conceded ?? false,
          firstPlayer: deckEntry.firstPlayer === 1 ? true : deckEntry.firstPlayer === 0 ? false : null,
          totalTurns: deckEntry.turns ?? null,
          cardResults: deckEntry.cardResults ?? null,
          turnResults: deckEntry.turnResults ?? null,
        })
        .onConflictDoNothing()
        .returning();

      if (!row) {
        // Duplicate gameGUID — already recorded
        return { success: true, data: null as unknown as GameResultDTO };
      }

      return { success: true, data: toDTO(row) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const cause = (error as any)?.cause;
      console.error('[GameResults] Insert failed:', message, cause ? `\ncause: ${cause}` : '');
      return { success: false, error: message };
    }
  }

  async getGameResultsForDeck(
    deckId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<AsyncResult<{ data: GameResultDTO[]; total: number }>> {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;
    try {
      const [countResult, rowsResult] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS total FROM game_results WHERE deck_id = $1`, [deckId]),
        pool.query(
          `SELECT id, deck_id, talishar_game_id, talishar_game_guid, format,
                  player_hero, opponent_hero, result::text, conceded, first_player,
                  total_turns, card_results, turn_results, played_at, created_at
           FROM game_results
           WHERE deck_id = $1
           ORDER BY played_at DESC
           LIMIT $2 OFFSET $3`,
          [deckId, limit, offset]
        ),
      ]);

      const total = countResult.rows[0].total as number;
      const data = rowsResult.rows.map((row: any) => ({
        id: row.id,
        deckId: row.deck_id,
        talisharGameId: row.talishar_game_id ?? null,
        talisharGameGuid: row.talishar_game_guid ?? null,
        format: row.format ?? null,
        playerHero: row.player_hero ?? null,
        opponentHero: row.opponent_hero ?? null,
        result: row.result as 'win' | 'loss',
        conceded: row.conceded,
        firstPlayer: row.first_player ?? null,
        totalTurns: row.total_turns ?? null,
        cardResults: row.card_results ?? null,
        turnResults: row.turn_results ?? null,
        playedAt: row.played_at,
        createdAt: row.created_at,
      }));

      return { success: true, data: { data, total } };
    } catch (error) {
      const e = error as any;
      console.error('[GameResults] Select failed:', e?.message, {
        code: e?.code,
        detail: e?.detail,
        hint: e?.hint,
      });
      return { success: false, error: e?.message ?? String(error) };
    }
  }
}
