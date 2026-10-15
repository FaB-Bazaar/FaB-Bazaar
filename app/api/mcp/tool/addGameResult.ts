// app/api/mcp/tool/addGameResult.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';
import { resolveOwnedDeck } from './listResults';

export const addGameResultTool = {
  name: 'add_game_result',
  description: `📝 LOG GAMES BY HAND on one of your decks — games played outside Talishar, or
  history moved over from Fabrary. Talishar games sync on their own; don't re-log them.

  Each game: opponentHero (full hero name, e.g. "Dorinthea Ironsong"), playedAt (ISO
  date-time WITH timezone, e.g. "2026-10-14T20:49:00-04:00"), result ("win"/"loss").
  Optional: eventType ("Classic Constructed" | "Classic Constructed Competitive" |
  "Blitz" | "Silver Age" … — defaults to the deck's format), turnOrder ("first" |
  "second"), totalTurns. Turn-by-turn card data is never needed.

  • Up to 100 games per call. The batch is checked first; if any game is invalid,
    NOTHING is saved and each bad game is listed — fix those and resend all.
  • Re-sending a game already logged (same deck, opponent and time) is skipped, so a
    re-run is safe.
  • Pick the deck by deckId (the id in its /decks/<id> URL) or exact deckName.
  🔒 Your own decks only.

  📋 { "deckId": "abc123", "games": [{ "opponentHero": "Malice, Domina of the Dead",
       "playedAt": "2026-10-14T20:49:00-04:00", "eventType": "Classic Constructed Competitive",
       "turnOrder": "first", "totalTurns": 7, "result": "win" }] }`,

  parameters: {
    type: 'object',
    properties: {
      deckId: { type: 'string', description: 'The deck id from its /decks/<id> URL. Give this OR deckName.' },
      deckName: { type: 'string', description: 'Exact deck name (case-insensitive) among your decks. Give this OR deckId.' },
      games: {
        type: 'array',
        description: 'The games to log (1–100).',
        items: {
          type: 'object',
          properties: {
            opponentHero: { type: 'string', description: 'Opponent hero — full name, e.g. "Teklovossen, Esteemed Magnate".' },
            playedAt: { type: 'string', description: 'When it was played — ISO date-time with timezone offset.' },
            result: { type: 'string', enum: ['win', 'loss'] },
            eventType: { type: 'string', description: 'e.g. "Classic Constructed" or "Classic Constructed Competitive". Defaults to the deck format.' },
            turnOrder: { type: 'string', enum: ['first', 'second'], description: 'Whether you went first or second.' },
            totalTurns: { type: 'number', description: 'Number of turns the game lasted.' },
          },
          required: ['opponentHero', 'playedAt', 'result'],
        },
      },
    },
    required: ['games'],
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();
    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) return { success: false, error: 'Authentication failed: No token was found.' };

      const games = Array.isArray(params?.games) ? params.games : [];
      if (games.length === 0) return { success: false, error: 'Give at least one game in "games".' };

      let publicId = typeof params?.deckId === 'string' && params.deckId.trim() ? params.deckId.trim() : null;
      let deckLabel = publicId ?? '';
      if (!publicId) {
        if (typeof params?.deckName !== 'string' || !params.deckName.trim()) {
          return { success: false, error: 'Say which deck: give deckId (from its /decks/<id> URL) or deckName.' };
        }
        const deck = await resolveOwnedDeck(API_BASE_URL, tokenToUse, params.deckName.trim());
        if (!deck.ok) return { success: false, error: deck.error };
        publicId = deck.publicId;
        deckLabel = deck.name;
      }

      const res = await mcpFetch(`${API_BASE_URL}/api/decks/${encodeURIComponent(publicId)}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenToUse}` },
        body: JSON.stringify({ games }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        const perGame = Array.isArray(body.errors)
          ? '\n' + body.errors.map((e: any) => `• game ${Number(e.index) + 1}: ${e.error}`).join('\n')
          : '';
        return { success: false, error: `${body.error || `Could not log the games (HTTP ${res.status}).`}${perGame}` };
      }

      const { created = 0, skipped = 0 } = body.data ?? {};
      const parts = [`✅ ${created} game${created === 1 ? '' : 's'} logged on ${deckLabel}`];
      if (skipped) parts.push(`${skipped} already logged (skipped)`);
      return {
        success: true,
        message: `${parts.join(', ')}. They count in the deck's results and matchup stats.`,
        data: body.data,
      };
    } catch (error) {
      return { success: false, error: `Error logging games: ${error instanceof Error ? error.message : String(error)}` };
    }
  },
};
