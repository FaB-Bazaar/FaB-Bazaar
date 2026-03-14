import { db } from '@/lib/postgres/db';
import { gameResults } from '@/lib/postgres/schema';
import { eq, desc } from 'drizzle-orm';
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
          format: payload.format ?? null,
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
      return { success: false, error: String(error) };
    }
  }

  async getGameResultsForDeck(deckId: string): Promise<AsyncResult<GameResultDTO[]>> {
    try {
      const rows = await db
        .select()
        .from(gameResults)
        .where(eq(gameResults.deckId, deckId))
        .orderBy(desc(gameResults.playedAt));

      return { success: true, data: rows.map(toDTO) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}
