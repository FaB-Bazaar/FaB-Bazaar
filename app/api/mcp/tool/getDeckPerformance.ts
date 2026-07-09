// app/api/mcp/tool/getDeckPerformance.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

function prettyHero(slug?: string | null): string {
  if (!slug) return 'Unknown';
  return slug.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export const getDeckPerformanceTool = {
  name: 'get_deck_performance',
  description: `📈 GET DECK PERFORMANCE: per-deck win rates across your recorded games.

  One call answers "how are my decks performing?" — the aggregation runs
  server-side in SQL, so do NOT fetch raw game lists and count wins yourself.

  Returns one row per deck (most recently played first): games, wins/losses,
  win rate %, recent form (last 10, newest first), and the best/worst matchup
  by opponent hero (only matchups with 2+ games).

  Requires authentication (your games only, synced from Talishar).

  🖥️ DISPLAY INSTRUCTIONS:
  Lead with a one-line takeaway (best and worst performing deck), then a table:
    Deck | Hero | Games | W–L | Win rate | Form | Best vs | Worst vs

  💡 WORKFLOW:
  Use sinceDays to window (e.g. 30 for the last month). To drill into WHY a
  matchup is bad, follow up with list_results / get_results on that deck.`,

  parameters: {
    type: 'object',
    properties: {
      sinceDays: { type: 'number', description: 'Only count games from the last N days. Omit for all recorded games.' },
    },
    required: [],
  },

  async handler(params: any, _user?: { id?: string } | null, token?: string) {
    if (!token) {
      return { success: false, error: 'Authentication required — deck performance covers YOUR recorded games.' };
    }
    const API_BASE_URL = getMcpApiBaseUrl();

    try {
      const qs = new URLSearchParams();
      const sinceDays = Number(params?.sinceDays);
      if (Number.isFinite(sinceDays) && sinceDays > 0) qs.set('sinceDays', String(Math.floor(sinceDays)));

      const res = await mcpFetch(`${API_BASE_URL}/api/results/performance${qs.size ? `?${qs}` : ''}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        return { success: false, error: body?.error || `Performance lookup failed (HTTP ${res.status}).` };
      }

      const rows: any[] = body.data || [];
      if (rows.length === 0) {
        const windowNote = qs.has('sinceDays') ? ` in the last ${qs.get('sinceDays')} days` : '';
        return {
          success: true,
          message: `📭 No recorded games${windowNote}. Games sync from Talishar automatically when you play with a FaB Bazaar deck.`,
          decks: [],
        };
      }

      const windowNote = qs.has('sinceDays') ? ` (last ${qs.get('sinceDays')} days)` : '';
      let message = `📈 **Your deck performance${windowNote}**\n\n`;
      message += `| Deck | Hero | Games | W–L | Win rate | Form | Best vs | Worst vs |\n`;
      message += `|------|------|-------|-----|----------|------|---------|----------|\n`;
      for (const r of rows) {
        const form = (r.recentForm || []).join(' ');
        const best = r.bestMatchup ? `${prettyHero(r.bestMatchup.opponentHero)} ${r.bestMatchup.wins}/${r.bestMatchup.games}` : '—';
        const worst = r.worstMatchup ? `${prettyHero(r.worstMatchup.opponentHero)} ${r.worstMatchup.wins}/${r.worstMatchup.games}` : '—';
        message += `| ${r.deckName} | ${r.heroName || '—'} | ${r.games} | ${r.wins}W–${r.losses}L | ${r.winRatePct}% | ${form} | ${best} | ${worst} |\n`;
      }

      return { success: true, message, decks: rows };
    } catch (error) {
      console.error('[GetDeckPerformance] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch deck performance.' };
    }
  },
};
