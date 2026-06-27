// app/api/mcp/tool/listResults.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

function prettyHero(slug?: string | null): string {
  if (!slug) return 'Unknown';
  return slug.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Resolve a deck name to its publicId among the caller's OWN decks. The
// /api/decks list is owner-scoped, so this also enforces "your decks only".
export async function resolveOwnedDeck(
  apiBase: string,
  token: string,
  deckName: string
): Promise<{ ok: true; publicId: string; name: string } | { ok: false; error: string }> {
  const res = await mcpFetch(`${apiBase}/api/decks?limit=100`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { ok: false, error: `Failed to fetch deck list (HTTP ${res.status}).` };
  const body = await res.json();
  if (!body.success) return { ok: false, error: body.error || 'Could not load deck list.' };
  const match = (body.decks || []).find((d: any) => d.name?.toLowerCase() === deckName.toLowerCase());
  if (!match) {
    return { ok: false, error: `No deck named "${deckName}" found in your decks. Use list_decks to see exact names.` };
  }
  return { ok: true, publicId: match.publicId, name: match.name };
}

export const listResultsTool = {
  name: 'list_results',
  description: `📊 LIST GAME RESULTS: your recent recorded games for one of your decks.

  Returns the last N games (default 10) you played with a deck, synced from Talishar.
  Use it to pick a game, then call get_results with the gameNumber (or resultId) for the full data.

  🔒 Your own decks only.

  📋 CALL FORMAT: { "deckName": "Dash Nitro Mechanoid" }
  📋 CALL FORMAT — fewer: { "deckName": "Dash Nitro Mechanoid", "limit": 5 }

  🖥️ DISPLAY: present as a numbered list — # | W/L | vs Opponent | Format | Turns | Date —
  then tip: "Use get_results with a gameNumber to see the full game."`,

  parameters: {
    type: 'object',
    properties: {
      deckName: { type: 'string', description: 'Name of the deck (case-insensitive exact match).' },
      limit: { type: 'number', description: 'How many recent games to list (default 10, max 50).' },
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
      const limit = Math.min(Math.max(parseInt(String(params.limit ?? 10), 10) || 10, 1), 50);

      const deck = await resolveOwnedDeck(API_BASE_URL, tokenToUse, deckName);
      if (!deck.ok) return { success: false, error: deck.error };

      const res = await mcpFetch(`${API_BASE_URL}/api/decks/${deck.publicId}/results?limit=${limit}&offset=0`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenToUse}` },
      });
      if (!res.ok) return { success: false, error: `Failed to fetch results (HTTP ${res.status}).` };
      const body = await res.json();
      if (!body.success) return { success: false, error: body.error || 'Could not load results.' };

      const games: any[] = body.data || [];
      if (games.length === 0) {
        return { success: true, message: `📭 No recorded games for "${deck.name}".`, deckName: deck.name, results: [] };
      }

      let message = `📊 **Last ${games.length} games — ${deck.name}** (of ${body.total ?? games.length})\n\n`;
      games.forEach((g, i) => {
        const date = g.playedAt ? new Date(g.playedAt).toISOString().slice(0, 10) : '—';
        const wl = g.result === 'win' ? 'W' : 'L';
        message += `${i + 1}. ${wl} vs ${prettyHero(g.opponentHero)} | ${g.format ?? '—'} | ${g.totalTurns ?? '?'} turns | ${date}${g.conceded ? ' (conceded)' : ''}\n`;
      });
      message += `\nUse get_results with deckName + gameNumber (or resultId) to see the full game data.`;

      return {
        success: true,
        message,
        deckName: deck.name,
        deckPublicId: deck.publicId,
        results: games.map((g, i) => ({
          gameNumber: i + 1,
          resultId: g.id,
          result: g.result,
          playerHero: g.playerHero ?? null,
          opponentHero: g.opponentHero ?? null,
          format: g.format ?? null,
          totalTurns: g.totalTurns ?? null,
          firstPlayer: g.firstPlayer ?? null,
          conceded: g.conceded ?? false,
          playedAt: g.playedAt ?? null,
        })),
      };
    } catch (error) {
      console.error('[ListResults] Unexpected error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  },
};
