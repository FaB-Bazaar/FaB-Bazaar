// app/api/mcp/tool/getResults.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';
import { resolveOwnedDeck } from './listResults';

export const getResultsTool = {
  name: 'get_results',
  description: `📊 GET FULL GAME DATA: the complete raw game blob for one recorded game.

  Returns everything Talishar recorded — both players' card plays, the turn-by-turn
  log, per-card stats, and aggregates — uncurated, exactly as stored.

  Defaults to your MOST RECENT game with the deck (covers "show me my last game of deck X").
  To pick a specific game, call list_results first and pass its gameNumber or resultId.

  🔒 Your own games only.  ⚠️ Large response (~10KB) — only call when the user wants the full detail.

  📋 CALL FORMAT — last game:   { "deckName": "Dash Nitro Mechanoid" }
  📋 CALL FORMAT — pick one:    { "deckName": "Dash Nitro Mechanoid", "gameNumber": 2 }
  📋 CALL FORMAT — by id:       { "deckName": "Dash Nitro Mechanoid", "resultId": "<id from list_results>" }`,

  parameters: {
    type: 'object',
    properties: {
      deckName: { type: 'string', description: 'Name of the deck (case-insensitive exact match).' },
      gameNumber: { type: 'number', description: 'Which game from list_results (1 = most recent). Defaults to 1.' },
      resultId: { type: 'string', description: 'Exact result id from list_results. Overrides gameNumber.' },
    },
    required: ['deckName'],
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();
    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) return { success: false, error: 'Authentication failed: No token was found.' };

      const deckName = params?.deckName;
      if (!deckName) return { success: false, error: 'deckName is required.' };

      const deck = await resolveOwnedDeck(API_BASE_URL, tokenToUse, deckName);
      if (!deck.ok) return { success: false, error: deck.error };

      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenToUse}` };

      // Resolve which game: explicit resultId wins; otherwise the Nth most recent.
      let resultId: string | undefined = params?.resultId;
      if (!resultId) {
        const gameNumber = Math.max(parseInt(String(params.gameNumber ?? 1), 10) || 1, 1);
        const listRes = await mcpFetch(`${API_BASE_URL}/api/decks/${deck.publicId}/results?limit=${gameNumber}&offset=0`, {
          method: 'GET',
          headers,
        });
        if (!listRes.ok) return { success: false, error: `Failed to fetch results (HTTP ${listRes.status}).` };
        const listBody = await listRes.json();
        if (!listBody.success) return { success: false, error: listBody.error || 'Could not load results.' };
        const games: any[] = listBody.data || [];
        if (games.length === 0) {
          return { success: true, message: `📭 No recorded games for "${deck.name}".`, data: null };
        }
        const pick = games[gameNumber - 1];
        if (!pick) {
          return {
            success: false,
            error: `Only ${games.length} game(s) recorded for "${deck.name}"; gameNumber ${gameNumber} is out of range. Use list_results to see what's available.`,
          };
        }
        resultId = pick.id;
      }

      const rawRes = await mcpFetch(
        `${API_BASE_URL}/api/decks/${deck.publicId}/results/${resultId}/raw?shape=raw`,
        { method: 'GET', headers }
      );
      if (!rawRes.ok) return { success: false, error: `Failed to fetch game data (HTTP ${rawRes.status}).` };
      const rawBody = await rawRes.json();
      if (!rawBody.success) return { success: false, error: rawBody.error || 'Could not load game data.' };
      if (!rawBody.data) {
        return {
          success: true,
          message: `No detailed archive is stored for this game (only games recorded after archiving was enabled have one).`,
          data: null,
        };
      }

      return {
        success: true,
        message: `📊 Full game data for "${deck.name}" (result ${resultId}). This is the complete uncurated Talishar blob.`,
        deckName: deck.name,
        resultId,
        data: rawBody.data,
      };
    } catch (error) {
      console.error('[GetResults] Unexpected error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  },
};
