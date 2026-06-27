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
  description: `📊 LIST GAME RESULTS: your recorded games for one of your decks.

  Returns recent games (default last 10), synced from Talishar. Pass opponentHero
  to get EVERY game vs a matchup (scans a wider window) — then call get_results on
  each resultId and analyze the matchup across games (trends, what wins vs loses).

  🔒 Your own decks only.

  📋 CALL FORMAT: { "deckName": "Dash Nitro Mechanoid" }
  📋 CALL FORMAT — a matchup: { "deckName": "Dash Nitro Mechanoid", "opponentHero": "Kassai" }
  📋 CALL FORMAT — fewer: { "deckName": "Dash Nitro Mechanoid", "limit": 5 }

  🖥️ DISPLAY: numbered list — # | W/L | vs Opponent | Format | Turns | Date.
  To analyze a matchup, call get_results with each resultId, then compare the games.`,

  parameters: {
    type: 'object',
    properties: {
      deckName: { type: 'string', description: 'Name of the deck (case-insensitive exact match).' },
      opponentHero: { type: 'string', description: 'Optional matchup filter — e.g. "Kassai" or "kassai_of_the_golden_sand". Returns every game vs that hero.' },
      limit: { type: 'number', description: 'How many recent games to list when not filtering (default 10, max 50).' },
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
      const opponentHero = typeof params?.opponentHero === 'string' && params.opponentHero.trim() ? params.opponentHero.trim() : null;
      const limit = Math.min(Math.max(parseInt(String(params.limit ?? 10), 10) || 10, 1), 50);

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
