// app/api/mcp/tool/listResults.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

function prettyHero(slug?: string | null): string {
  if (!slug) return 'Unknown';
  return slug.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function normHero(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Loose matchup match: "Kassai" or "kassai_of_the_golden_sand" both match the
// stored opponent slug.
function heroMatches(slug: string | null | undefined, query: string): boolean {
  if (!slug) return false;
  const a = normHero(slug);
  const b = normHero(query);
  return !!b && (a.includes(b) || b.includes(a));
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
  description: `📊 LIST GAME RESULTS: your recorded games, synced from Talishar.

  THREE MODES:
  • No deckName → your most recent games across ALL your decks, each labeled with its
    deck. Use this FIRST when you don't know / can't remember which deck a game is on.
    The user picks one; then call get_results with that game's deckName + resultId
    (both shown per row).
  • deckName → that deck's recent games (default last 10).
  • deckName + opponentHero → EVERY game vs that matchup (scans a wider window), for
    cross-game analysis.

  🔒 Your own games only.
  ⚠️ The id in a deck's /decks/<id> URL is the DECK id, NOT a game id. Game (result)
  ids come from THIS tool — never pass a deck/URL id to get_results as a resultId.

  📋 recent (all decks): {}
  📋 one deck:           { "deckName": "Dash Nitro Mechanoid" }
  📋 a matchup:          { "deckName": "Dash Nitro Mechanoid", "opponentHero": "Kassai" }

  🖥️ DISPLAY: numbered list — # | W/L | vs Opponent | Deck | Turns | Date.`,

  parameters: {
    type: 'object',
    properties: {
      deckName: { type: 'string', description: 'Deck name (case-insensitive exact match). OMIT to list recent games across ALL your decks.' },
      opponentHero: { type: 'string', description: 'Optional matchup filter (requires deckName) — e.g. "Kassai". Returns every game vs that hero.' },
      limit: { type: 'number', description: 'How many games to list (default 10, max 50).' },
    },
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();
    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) return { success: false, error: 'Authentication failed: No token was found.' };

      const deckName = params?.deckName;
      const opponentHero = typeof params?.opponentHero === 'string' && params.opponentHero.trim() ? params.opponentHero.trim() : null;
      const limit = Math.min(Math.max(parseInt(String(params.limit ?? 10), 10) || 10, 1), 50);
      const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenToUse}` };

      // No deck specified → most recent games across ALL the user's decks, so the
      // caller can pick one without knowing the deck name.
      if (!deckName) {
        const res = await mcpFetch(`${API_BASE_URL}/api/results/recent?limit=${limit}`, { method: 'GET', headers: authHeaders });
        if (!res.ok) return { success: false, error: `Failed to fetch recent games (HTTP ${res.status}).` };
        const body = await res.json();
        if (!body.success) return { success: false, error: body.error || 'Could not load recent games.' };
        const games: any[] = body.data || [];
        if (games.length === 0) {
          return { success: true, message: `📭 No recorded games on any of your decks yet.`, results: [] };
        }
        let message = `📊 **Your last ${games.length} games (all decks)**\n\n`;
        games.forEach((g, i) => {
          const date = g.playedAt ? new Date(g.playedAt).toISOString().slice(0, 10) : '—';
          const wl = g.result === 'win' ? 'W' : 'L';
          message += `${i + 1}. ${wl} vs ${prettyHero(g.opponentHero)} | ${g.deckName} | ${g.totalTurns ?? '?'} turns | ${date}${g.conceded ? ' (conceded)' : ''}\n`;
        });
        message += `\nTo dig into one, call get_results with that game's deckName + resultId (shown below).`;
        return {
          success: true,
          message,
          results: games.map((g, i) => ({
            gameNumber: i + 1,
            resultId: g.id,
            deckName: g.deckName,
            deckPublicId: g.deckPublicId,
            result: g.result,
            opponentHero: g.opponentHero,
            totalTurns: g.totalTurns,
            conceded: g.conceded,
            playedAt: g.playedAt,
          })),
        };
      }

      const deck = await resolveOwnedDeck(API_BASE_URL, tokenToUse, deckName);
      if (!deck.ok) return { success: false, error: deck.error };

      // When filtering by matchup, scan a wider window so we catch every game vs
      // that hero, not just within the last 10.
      const fetchLimit = opponentHero ? 100 : limit;
      const res = await mcpFetch(`${API_BASE_URL}/api/decks/${deck.publicId}/results?limit=${fetchLimit}&offset=0`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenToUse}` },
      });
      if (!res.ok) return { success: false, error: `Failed to fetch results (HTTP ${res.status}).` };
      const body = await res.json();
      if (!body.success) return { success: false, error: body.error || 'Could not load results.' };

      let games: any[] = body.data || [];
      if (opponentHero) games = games.filter((g) => heroMatches(g.opponentHero, opponentHero));

      if (games.length === 0) {
        const where = opponentHero ? ` vs ${prettyHero(normHero(opponentHero))}` : '';
        return { success: true, message: `📭 No recorded games${where} for "${deck.name}".`, deckName: deck.name, results: [] };
      }

      // Per-matchup win tally for the header, when filtering.
      const wins = games.filter((g) => g.result === 'win').length;
      let message = opponentHero
        ? `📊 **${deck.name} vs ${prettyHero(normHero(opponentHero))}** — ${games.length} games (${wins}W–${games.length - wins}L)\n\n`
        : `📊 **Last ${games.length} games — ${deck.name}** (of ${body.total ?? games.length})\n\n`;
      games.forEach((g, i) => {
        const date = g.playedAt ? new Date(g.playedAt).toISOString().slice(0, 10) : '—';
        const wl = g.result === 'win' ? 'W' : 'L';
        message += `${i + 1}. ${wl} vs ${prettyHero(g.opponentHero)} | ${g.format ?? '—'} | ${g.totalTurns ?? '?'} turns | ${date}${g.conceded ? ' (conceded)' : ''}\n`;
      });
      message += opponentHero
        ? `\nCall get_results with each resultId above to pull these games, then compare them to analyze the matchup.`
        : `\nUse get_results with deckName + gameNumber (or resultId) to see the full game data.`;

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
