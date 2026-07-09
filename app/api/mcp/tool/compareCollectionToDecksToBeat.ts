// app/api/mcp/tool/compareCollectionToDecksToBeat.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const compareCollectionToDecksToBeatTool = {
  name: 'compare_collection_to_decks_to_beat',
  description: `🧮 COMPARE COLLECTION TO DECKS TO BEAT: which featured meta decks could you build?

  One call answers "which Decks to Beat could I build mostly from my collection?" —
  the coverage math runs server-side in SQL, so do NOT fetch decklists and binders
  to compute this yourself.

  Returns one compact row per featured deck, ranked most-buildable first:
    coveragePct (0–100), totalOwned/totalNeeded, missingCards, missingCost
    (tcgLow to buy the gaps), topMissing (most expensive gaps first).
  Any owned printing of a card counts toward its slot (matchBy card).

  Requires authentication (compares against YOUR collection).

  🖥️ DISPLAY INSTRUCTIONS:
  Lead with the 2–3 most buildable decks in prose (name, hero, coverage %, cost
  to finish), then a table:
    Deck | Hero | Event / Place | Coverage | Missing cards | Cost to finish | Link
  Always include the deck link https://fabbazaar.app/decks/{publicId}.

  💡 WORKFLOW:
  Defaults to the latest month with featured decks. To drill into one deck's
  full missing list, call get_deck with its publicId.`,

  parameters: {
    type: 'object',
    properties: {
      month: { type: 'number', description: 'Month number (1–12). Defaults to the latest month with featured decks.' },
      year: { type: 'number', description: 'Year (e.g. 2026). Defaults to the latest month with featured decks.' },
      format: { type: 'string', description: 'Optional format filter, e.g. "Classic Constructed" or "Blitz".' },
    },
    required: [],
  },

  async handler(params: any, _user?: { id?: string } | null, token?: string) {
    if (!token) {
      return { success: false, error: 'Authentication required — this tool compares featured decks against YOUR collection.' };
    }
    const API_BASE_URL = getMcpApiBaseUrl();

    try {
      // Resolve the latest month that actually has featured decks (mirrors
      // get_decks_to_beat: the current calendar month is often still empty).
      let month = params.month;
      let year = params.year;
      if (month == null && year == null) {
        try {
          const latestParams = new URLSearchParams();
          if (params.format) latestParams.set('format', params.format);
          const latestRes = await mcpFetch(
            `${API_BASE_URL}/api/decks/featured-latest-month${latestParams.size ? `?${latestParams}` : ''}`,
            { method: 'GET' },
          );
          const latestBody = latestRes.ok ? await latestRes.json() : null;
          if (latestBody?.success && latestBody.data?.year && latestBody.data?.month) {
            year = latestBody.data.year;
            month = latestBody.data.month;
          }
        } catch { /* fall through to current month */ }
      }
      const now = new Date();
      month = month ?? (now.getMonth() + 1);
      year = year ?? now.getFullYear();
      const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' });

      const queryParams = new URLSearchParams({
        featured: 'true',
        limit: '30', // coverage endpoint caps the batch at 30
        month: String(month),
        year: String(year),
      });
      if (params.format) queryParams.set('format', params.format);

      const featRes = await mcpFetch(`${API_BASE_URL}/api/decks/community?${queryParams}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!featRes.ok) {
        return { success: false, error: `Failed to fetch Decks to Beat (HTTP ${featRes.status}).` };
      }
      const featBody = await featRes.json();
      if (!featBody.success) {
        return { success: false, error: featBody.error || 'Failed to fetch Decks to Beat.' };
      }
      const featured: any[] = featBody.data?.decks || [];
      if (featured.length === 0) {
        return { success: true, message: `📭 No Decks to Beat found for ${monthName} ${year}.`, decks: [] };
      }
      const metaByPublicId = new Map(featured.map((d) => [d.publicId, d]));

      const covRes = await mcpFetch(`${API_BASE_URL}/api/decks/coverage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ deckIds: featured.map((d) => d.publicId) }),
      });
      const covBody = await covRes.json().catch(() => null);
      if (!covRes.ok || !covBody?.success) {
        return { success: false, error: covBody?.error || `Coverage lookup failed (HTTP ${covRes.status}).` };
      }

      // Already ranked most-buildable first by the service; merge event context.
      const rows = (covBody.data as any[]).map((c) => {
        const meta = metaByPublicId.get(c.publicId) ?? {};
        return { ...c, eventName: meta.eventName ?? null, placing: meta.placing ?? null };
      });

      let message = `🧮 **Decks to Beat you could build — ${monthName} ${year}** (vs your collection, any printing counts)\n\n`;
      message += `| Deck | Hero | Coverage | Missing | Cost to finish | Link |\n`;
      message += `|------|------|----------|---------|----------------|------|\n`;
      for (const r of rows) {
        const cost = r.missingCards === 0 ? '—' : `$${Number(r.missingCost).toFixed(2)}`;
        message += `| ${r.deckName} | ${r.heroName || '—'} | ${r.coveragePct}% (${r.totalOwned}/${r.totalNeeded}) | ${r.missingCards} cards | ${cost} | [View](https://fabbazaar.app/decks/${r.publicId}) |\n`;
      }

      return { success: true, message, decks: rows };
    } catch (error) {
      console.error('[CompareCollectionToDecksToBeat] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to compare collection to Decks to Beat.' };
    }
  },
};
