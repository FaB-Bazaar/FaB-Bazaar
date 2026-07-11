import { db, pool } from '@/lib/postgres/db';
import { gameResults, gameResultPayloads, decks } from '@/lib/postgres/schema';
import { eq, and, desc, sql, gte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { normalizeTalisharId } from '@/lib/talishar/cardId';
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
  turnLog?: [number, string, string][] | null;
  opponentCardResults?: unknown;
  opponentTurnLog?: [number, string, string][] | null;
  playedAt: Date;
  createdAt: Date;
}

// Full-detail shape returned by getGameResult — same fields as the original
// GameResultDTO plus the resolved imageUrls map. Used when a game row is
// expanded and needs turn-log data.
export interface GameResultDetailDTO extends GameResultDTO {
  imageUrls: Record<string, string>;
}

// Summary shape returned by getGameResultsForDeck. Strips the turn-log fields
// (only needed when a game is expanded — fetched separately by id) and
// attaches a pre-resolved cardId → imageUrl map so the deck Results tab can
// paint without a second client round-trip.
export interface GameResultSummaryDTO {
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
  opponentCardResults?: unknown;
  imageUrls: Record<string, string>;
  playedAt: Date;
  createdAt: Date;
}

// A recent game across ALL of a user's decks — each row carries its deck so the
// caller can pick a game without already knowing the deck name.
export interface RecentGameResultDTO {
  id: string;
  deckId: string;
  deckPublicId: string;
  deckName: string;
  format?: string | null;
  playerHero?: string | null;
  opponentHero?: string | null;
  result: 'win' | 'loss';
  conceded: boolean;
  firstPlayer?: boolean | null;
  totalTurns?: number | null;
  playedAt: Date;
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
  turnLog?: [number, string, string][];
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

// Turn-log entries are `[turn, cardId, action]` tuples. Skip HIT markers
// (duplicate of the attacker entry) and any malformed tuples.
function extractTurnLogCardIds(blob: unknown): string[] {
  if (!Array.isArray(blob)) return [];
  const out: string[] = [];
  for (const entry of blob) {
    if (Array.isArray(entry) && typeof entry[1] === 'string' && entry[2] !== 'HIT') {
      out.push(entry[1]);
    }
  }
  return out;
}

// Card entries inside card_results / opponent_card_results carry a cardId
// (Talishar's identifier) plus stat counters. Coerce the JSONB blob into a
// minimal shape we can iterate without trusting the rest of the structure.
function extractCardEntries(blob: unknown): Array<{ cardId: string }> {
  if (!Array.isArray(blob)) return [];
  const out: Array<{ cardId: string }> = [];
  for (const entry of blob) {
    if (entry && typeof entry === 'object' && typeof (entry as { cardId?: unknown }).cardId === 'string') {
      out.push({ cardId: (entry as { cardId: string }).cardId });
    }
  }
  return out;
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
    turnLog: row.turnLog as [number, string, string][] | null ?? null,
    opponentCardResults: row.opponentCardResults,
    opponentTurnLog: row.opponentTurnLog as [number, string, string][] | null ?? null,
    playedAt: row.playedAt,
    createdAt: row.createdAt,
  };
}

/**
 * Per-deck aggregate for "how are my decks performing?" — one compact row
 * per deck with games in the window, sized for LLM/tool consumption.
 */
export interface DeckPerformanceDTO {
  deckPublicId: string;
  deckName: string;
  heroName?: string | null;
  format?: string | null;
  games: number;
  wins: number;
  losses: number;
  /** Rounded 0–100. */
  winRatePct: number;
  lastPlayedAt: Date;
  /** Last up-to-10 results, newest first. */
  recentForm: ('W' | 'L')[];
  /** Highest win-rate opponent hero with >= minMatchupGames games. */
  bestMatchup: { opponentHero: string; games: number; wins: number } | null;
  /** Lowest win-rate opponent hero (null when it would repeat bestMatchup). */
  worstMatchup: { opponentHero: string; games: number; wins: number } | null;
}

export class PostgresGameResultsService {
  async createGameResult(
    deckId: string,
    payload: TalisharGamePayload,
    deckEntry: TalisharDeckPayload,
    opponentEntry?: TalisharDeckPayload
  ): Promise<AsyncResult<GameResultDTO>> {
    try {
      const result = deckEntry.result === 1 ? 'win' : 'loss';

      // Only store opponent card data if they consented (cardResults present and non-empty).
      // Talishar strips cardResults when a player opts out (functions.inc.php:968-972).
      const opponentConsented =
        Array.isArray(opponentEntry?.cardResults) && opponentEntry.cardResults.length > 0;

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
          turnLog: deckEntry.turnLog ?? null,
          opponentCardResults: opponentConsented ? opponentEntry!.cardResults ?? null : null,
          opponentTurnLog: opponentConsented ? opponentEntry!.turnLog ?? null : null,
        })
        .onConflictDoNothing()
        .returning();

      if (!row) {
        // Duplicate gameGUID — already recorded
        return { success: true, data: null as unknown as GameResultDTO };
      }

      // Archive the full raw deck blob (consent-gated opponent). Best-effort —
      // never blocks the result from being saved.
      await this.archiveRawPayload(
        row.id,
        payload,
        deckEntry,
        opponentConsented ? opponentEntry : undefined
      );

      return { success: true, data: toDTO(row) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const cause = (error as any)?.cause;
      console.error('[GameResults] Insert failed:', message, cause ? `\ncause: ${cause}` : '');
      return { success: false, error: message };
    }
  }

  // Archive the full Talishar deck blob into the game_result_payloads sidecar.
  // The typed game_results columns drop several fields Talishar sends
  // (arenaCardResults, tokenResults, character, precomputed aggregates); this
  // keeps the lot verbatim. Opponent data is consent-gated by the caller, and
  // reads are owner/co-owner-gated at the route — so every player gets their own
  // game archived, but can only ever read their own.
  //
  // Best-effort: any failure is swallowed so it can never block ingestion (the
  // webhook must keep returning 200 to Talishar).
  private async archiveRawPayload(
    resultId: string,
    payload: TalisharGamePayload,
    deckEntry: TalisharDeckPayload,
    opponentEntry: TalisharDeckPayload | undefined
  ): Promise<void> {
    try {
      // Drop the raw deck1/deck2 (deck2 is the opponent's full, possibly
      // non-consented blob) and re-attach a consent-gated view instead.
      const { deck1: _deck1, deck2: _deck2, ...gameMeta } = payload as Record<string, unknown>;

      await db
        .insert(gameResultPayloads)
        .values({
          resultId,
          payload: { ...gameMeta, self: deckEntry, opponent: opponentEntry ?? null },
        })
        .onConflictDoNothing();
    } catch (error) {
      console.error(
        '[GameResults] Raw payload archive failed:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // Read the archived raw Talishar blob for a single result, scoped to its
  // deck. Returns null when no archive exists (non-admin-owned games never get
  // one) or the result doesn't belong to the deck. Authorization is the
  // caller's responsibility (route checks deck ownership).
  async getRawGamePayload(
    resultId: string,
    deckId: string
  ): Promise<AsyncResult<Record<string, unknown> | null>> {
    try {
      const { rows } = await pool.query<{ payload: Record<string, unknown> }>(
        `SELECT grp.payload
           FROM game_result_payloads grp
           JOIN game_results gr ON gr.id = grp.result_id
          WHERE grp.result_id = $1 AND gr.deck_id = $2
          LIMIT 1`,
        [resultId, deckId]
      );
      return { success: true, data: rows[0]?.payload ?? null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[GameResults] getRawGamePayload failed:', message);
      return { success: false, error: message };
    }
  }

  // Most recent games across ALL of the user's own decks (newest first), each
  // labeled with its deck. Powers "show me my last games when I don't remember
  // which deck" — the caller then picks a game and fetches it by deckName+id.
  async getRecentGameResultsForUser(
    userId: string,
    limit: number
  ): Promise<AsyncResult<RecentGameResultDTO[]>> {
    try {
      const { rows } = await pool.query(
        `SELECT gr.id, gr.deck_id, d.public_id AS deck_public_id, d.name AS deck_name,
                gr.format, gr.player_hero, gr.opponent_hero, gr.result::text AS result,
                gr.conceded, gr.first_player, gr.total_turns, gr.played_at
           FROM game_results gr
           JOIN decks d ON d.id = gr.deck_id
          WHERE d.user_id = $1
            -- mirror listUserDecks' personal scope: get_results resolves the
            -- deck by name through it, so system-deck games are unanalyzable
            AND d.is_system_deck = false
          ORDER BY gr.played_at DESC
          LIMIT $2`,
        [userId, limit]
      );
      const data: RecentGameResultDTO[] = rows.map((row: any) => ({
        id: row.id,
        deckId: row.deck_id,
        deckPublicId: row.deck_public_id,
        deckName: row.deck_name,
        format: row.format ?? null,
        playerHero: row.player_hero ?? null,
        opponentHero: row.opponent_hero ?? null,
        result: row.result as 'win' | 'loss',
        conceded: row.conceded,
        firstPlayer: row.first_player ?? null,
        totalTurns: row.total_turns ?? null,
        playedAt: row.played_at,
      }));
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[GameResults] getRecentGameResultsForUser failed:', message);
      return { success: false, error: message };
    }
  }

  async getDeckPerformanceForUser(
    userId: string,
    options?: { sinceDays?: number; minMatchupGames?: number }
  ): Promise<AsyncResult<DeckPerformanceDTO[]>> {
    const minMatchupGames = options?.minMatchupGames ?? 2;
    try {
      const params: unknown[] = [userId];
      let sinceClause = '';
      if (options?.sinceDays && options.sinceDays > 0) {
        params.push(Math.floor(options.sinceDays));
        sinceClause = ` AND gr.played_at >= NOW() - make_interval(days => $2::int)`;
      }
      const { rows } = await pool.query(
        `SELECT d.public_id AS deck_public_id, d.name AS deck_name, d.hero_name,
                d.format AS deck_format, gr.result::text AS result,
                gr.opponent_hero, gr.played_at
           FROM game_results gr
           JOIN decks d ON d.id = gr.deck_id
          WHERE d.user_id = $1
            AND d.is_system_deck = false${sinceClause}
          ORDER BY gr.played_at DESC`,
        params
      );

      // Rows are newest-first, so Map insertion order = decks by last played.
      type Row = {
        deck_public_id: string; deck_name: string; hero_name: string | null;
        deck_format: string | null; result: string; opponent_hero: string | null;
        played_at: Date;
      };
      const byDeck = new Map<string, Row[]>();
      for (const row of rows as Row[]) {
        const list = byDeck.get(row.deck_public_id);
        if (list) list.push(row);
        else byDeck.set(row.deck_public_id, [row]);
      }

      const data: DeckPerformanceDTO[] = [...byDeck.values()].map((games) => {
        const first = games[0];
        const wins = games.filter((g) => g.result === 'win').length;

        const matchups = new Map<string, { games: number; wins: number }>();
        for (const g of games) {
          if (!g.opponent_hero) continue;
          const m = matchups.get(g.opponent_hero) ?? { games: 0, wins: 0 };
          m.games += 1;
          if (g.result === 'win') m.wins += 1;
          matchups.set(g.opponent_hero, m);
        }
        const qualifying = [...matchups.entries()]
          .filter(([, m]) => m.games >= minMatchupGames)
          .map(([opponentHero, m]) => ({ opponentHero, games: m.games, wins: m.wins }))
          .sort((a, b) => (b.wins / b.games) - (a.wins / a.games) || b.games - a.games);
        const bestMatchup = qualifying[0] ?? null;
        // A lone qualifying matchup shouldn't read as both best AND worst.
        const worstMatchup = qualifying.length > 1 ? qualifying[qualifying.length - 1] : null;

        return {
          deckPublicId: first.deck_public_id,
          deckName: first.deck_name,
          heroName: first.hero_name ?? null,
          format: first.deck_format ?? null,
          games: games.length,
          wins,
          losses: games.length - wins,
          winRatePct: Math.round((wins / games.length) * 100),
          lastPlayedAt: first.played_at,
          recentForm: games.slice(0, 10).map((g) => (g.result === 'win' ? 'W' as const : 'L' as const)),
          bestMatchup,
          worstMatchup,
        };
      });

      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[GameResults] getDeckPerformanceForUser failed:', message);
      return { success: false, error: message };
    }
  }

  async getGameResultsForDeck(
    deckId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<AsyncResult<{ data: GameResultSummaryDTO[]; total: number }>> {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;
    try {
      // Note: turn_log / opponent_turn_log / turn_results are intentionally
      // omitted from this query. They are only needed when a game row is
      // expanded; the client fetches them via getGameResult(resultId, deckId).
      const [countResult, rowsResult] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS total FROM game_results WHERE deck_id = $1`, [deckId]),
        pool.query(
          `SELECT id, deck_id, talishar_game_id, talishar_game_guid, format,
                  player_hero, opponent_hero, result::text, conceded, first_player,
                  total_turns, card_results, opponent_card_results,
                  played_at, created_at
           FROM game_results
           WHERE deck_id = $1
           ORDER BY played_at DESC
           LIMIT $2 OFFSET $3`,
          [deckId, limit, offset]
        ),
      ]);

      const total = countResult.rows[0].total as number;

      // Collect every cardId referenced anywhere in this page of results so
      // we can resolve them all with one indexed lookup.
      const allCardIds = new Set<string>();
      for (const row of rowsResult.rows) {
        for (const cr of extractCardEntries(row.card_results)) allCardIds.add(cr.cardId);
        for (const cr of extractCardEntries(row.opponent_card_results)) allCardIds.add(cr.cardId);
      }

      const globalImageMap = await this.resolveImageUrls(Array.from(allCardIds));

      const data: GameResultSummaryDTO[] = rowsResult.rows.map((row: any) => {
        // Per-row map: only the cardIds this row actually references.
        const rowImages: Record<string, string> = {};
        for (const cr of extractCardEntries(row.card_results)) {
          const url = globalImageMap.get(cr.cardId);
          if (url) rowImages[cr.cardId] = url;
        }
        for (const cr of extractCardEntries(row.opponent_card_results)) {
          const url = globalImageMap.get(cr.cardId);
          if (url) rowImages[cr.cardId] = url;
        }

        return {
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
          opponentCardResults: row.opponent_card_results ?? null,
          imageUrls: rowImages,
          playedAt: row.played_at,
          createdAt: row.created_at,
        };
      });

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

  // Single-row detail lookup used to lazy-load turn-log data when the user
  // expands a game on the Results tab. Returns the full row plus an
  // imageUrls map covering card_results, opponent_card_results, turn_log,
  // and opponent_turn_log (the latter two after stripping Talishar's state
  // suffixes like _equip).
  async getGameResult(
    resultId: string,
    deckId: string
  ): Promise<AsyncResult<GameResultDetailDTO>> {
    try {
      const { rows } = await pool.query(
        `SELECT id, deck_id, talishar_game_id, talishar_game_guid, format,
                player_hero, opponent_hero, result::text, conceded, first_player,
                total_turns, card_results, turn_results, turn_log,
                opponent_card_results, opponent_turn_log,
                played_at, created_at
         FROM game_results
         WHERE id = $1 AND deck_id = $2`,
        [resultId, deckId]
      );

      if (rows.length === 0) return { success: false, error: 'Game result not found' };
      const row = rows[0];

      // Collect cardIds from every JSON source. Turn-log entries include
      // state suffixes (e.g. "_equip"), which we normalize before the DB
      // lookup; the resulting imageUrls map is keyed by the ORIGINAL cardId
      // so the client can index directly with what it has.
      const turnLogIds = extractTurnLogCardIds(row.turn_log);
      const oppTurnLogIds = extractTurnLogCardIds(row.opponent_turn_log);
      const cardResultIds = extractCardEntries(row.card_results).map(c => c.cardId);
      const oppCardResultIds = extractCardEntries(row.opponent_card_results).map(c => c.cardId);

      // Map original cardId → normalized lookup key.
      const lookupKeyByOriginal = new Map<string, string>();
      for (const id of [...cardResultIds, ...oppCardResultIds]) {
        if (!lookupKeyByOriginal.has(id)) lookupKeyByOriginal.set(id, id);
      }
      for (const id of [...turnLogIds, ...oppTurnLogIds]) {
        if (!lookupKeyByOriginal.has(id)) lookupKeyByOriginal.set(id, normalizeTalisharId(id));
      }

      const uniqueLookupKeys = Array.from(new Set(lookupKeyByOriginal.values()));
      const resolved = await this.resolveImageUrls(uniqueLookupKeys);

      const imageUrls: Record<string, string> = {};
      for (const [original, key] of lookupKeyByOriginal) {
        const url = resolved.get(key);
        if (url) imageUrls[original] = url;
      }

      return {
        success: true,
        data: {
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
          turnLog: row.turn_log ?? null,
          opponentCardResults: row.opponent_card_results ?? null,
          opponentTurnLog: row.opponent_turn_log ?? null,
          imageUrls,
          playedAt: row.played_at,
          createdAt: row.created_at,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[GameResults] getGameResult failed:', message);
      return { success: false, error: message };
    }
  }

  // Looks up image URLs for a set of canonical Talishar cardIds. Uses
  // DISTINCT ON to pick a single (cheapest by set/edition) printing per card.
  // Internal helper — exposed publicly so getGameResult() can reuse it.
  private async resolveImageUrls(cardIds: string[]): Promise<Map<string, string>> {
    if (cardIds.length === 0) return new Map();
    const { rows } = await pool.query<{ talishar_card_id: string; image_url: string | null }>(
      // Representative printing: has an image, English before other languages
      // (the chat/results UI is English — JP/FR faces read as a bug), then the
      // stable set/edition order.
      `SELECT DISTINCT ON (c.talishar_card_id)
              c.talishar_card_id, p.image_url
       FROM cards c
       LEFT JOIN printings p ON p.card_unique_id = c.card_unique_id
       WHERE c.talishar_card_id = ANY($1)
       ORDER BY c.talishar_card_id, (p.image_url IS NOT NULL) DESC, (p.language = 'en') DESC,
                p.set ASC NULLS LAST, p.edition ASC NULLS LAST`,
      [cardIds]
    );
    const map = new Map<string, string>();
    for (const r of rows) if (r.image_url) map.set(r.talishar_card_id, r.image_url);
    return map;
  }

  async deleteGameResult(
    resultId: string,
    deckId: string
  ): Promise<AsyncResult<void>> {
    try {
      const result = await db
        .delete(gameResults)
        .where(and(eq(gameResults.id, resultId), eq(gameResults.deckId, deckId)))
        .returning({ id: gameResults.id });

      if (result.length === 0) {
        return { success: false, error: 'Game result not found' };
      }
      return { success: true, data: undefined };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[GameResults] Delete failed:', message);
      return { success: false, error: message };
    }
  }
}
