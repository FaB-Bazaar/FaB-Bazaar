// app/api/mcp/tool/getDecksToBeat.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const getDecksToBeatTool = {
  name: 'get_decks_to_beat',
  description: `🏆 GET DECKS TO BEAT: Browse curated reference decklists for the current meta

  Returns featured community decks for a given month and year. These are tournament-proven
  builds that represent the strongest archetypes in the current or historical meta.

  No authentication required — this is public data.

  🖥️ DISPLAY INSTRUCTIONS (IMPORTANT):
  Group results by event name. For each event show the event name and date as a heading,
  then a markdown table with columns:
    Place | Deck Name | Hero | Format | Cards | Creator | Link

  Example:
  ### Battle Hardened: Sydney (2026-03-15)
  | Place | Deck Name       | Hero    | Format | Cards | Creator   | Link              |
  |-------|-----------------|---------|--------|-------|-----------|-------------------|
  | 1st   | Bravo Control   | Bravo   | CC     | 60    | playerOne | [View Deck](url)  |
  | 2nd   | Katsu Aggro     | Katsu   | CC     | 60    | playerTwo | [View Deck](url)  |

  For decks with no event (standalone featured decks), group them under "Featured Decks".
  Use placing numbers as ordinal (1st, 2nd, 3rd, 4th, etc.).
  Always include the View Deck link using https://fabbazaar.app/decks/{publicId}.

  💡 WORKFLOW:
  Use get_decks_to_beat to research the meta before building or updating a deck.`,

  parameters: {
    type: 'object',
    properties: {
      month: {
        type: 'number',
        description: 'Month number (1–12). Defaults to current month.'
      },
      year: {
        type: 'number',
        description: 'Year (e.g. 2026). Defaults to current year.'
      },
      format: {
        type: 'string',
        description: 'Optional filter by format (e.g. "Classic Constructed", "Blitz", "Silver Age")'
      },
      heroName: {
        type: 'string',
        description: 'Optional filter by hero name (e.g. "Bravo", "Katsu")'
      },
      eventName: {
        type: 'string',
        description: 'Optional filter by exact event name'
      }
    }
  },

  async handler(params: any) {
    const API_BASE_URL = getMcpApiBaseUrl();

    try {
      const now = new Date();
      const month = params.month ?? (now.getMonth() + 1);
      const year = params.year ?? now.getFullYear();

      const queryParams = new URLSearchParams({
        featured: 'true',
        limit: '50',
        month: String(month),
        year: String(year)
      });
      if (params.format) queryParams.set('format', params.format);
      if (params.heroName) queryParams.set('heroName', params.heroName);
      if (params.eventName) queryParams.set('eventName', params.eventName);

      const response = await mcpFetch(`${API_BASE_URL}/api/decks/community?${queryParams}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[GetDecksToBeat] API failed with status ${response.status}:`, errorText);
        return { success: false, error: `Failed to fetch Decks to Beat (HTTP ${response.status}).` };
      }

      const result = await response.json();
      if (!result.success) {
        return { success: false, error: result.error || 'API returned an error.' };
      }

      const decks = result.data?.decks || [];
      const total = result.data?.total ?? decks.length;

      const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' });

      if (decks.length === 0) {
        return {
          success: true,
          message: `📭 No Decks to Beat found for ${monthName} ${year}.`,
          decks: []
        };
      }

      // Group by eventName
      const groups = new Map<string, any[]>();
      for (const deck of decks) {
        const key = deck.eventName || '__featured__';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(deck);
      }

      let message = `🏆 **Decks to Beat — ${monthName} ${year}** (${total} total)\n\n`;

      for (const [groupKey, groupDecks] of groups.entries()) {
        const firstDeck = groupDecks[0];
        const eventDate = firstDeck.eventDate ? ` (${firstDeck.eventDate})` : '';
        const heading = groupKey === '__featured__' ? 'Featured Decks' : `${groupKey}${eventDate}`;
        message += `### ${heading}\n`;
        message += `| Place | Deck Name | Hero | Format | Cards | Creator | Link |\n`;
        message += `|-------|-----------|------|--------|-------|---------|------|\n`;
        for (const deck of groupDecks) {
          const placing = deck.placing ? ordinal(deck.placing) : '—';
          const url = `https://fabbazaar.app/decks/${deck.publicId}`;
          const creator = deck.creatorDisplayUsername || deck.creatorUsername || '—';
          message += `| ${placing} | ${deck.name} | ${deck.heroName || '—'} | ${deck.format || '—'} | ${deck.totalCards || 0} | ${creator} | [View Deck](${url}) |\n`;
        }
        message += '\n';
      }

      return {
        success: true,
        message,
        decks: decks.map((d: any) => ({
          publicId: d.publicId,
          name: d.name,
          heroName: d.heroName,
          format: d.format,
          totalCards: d.totalCards || 0,
          placing: d.placing,
          eventName: d.eventName,
          eventDate: d.eventDate,
          creatorDisplayUsername: d.creatorDisplayUsername || d.creatorUsername,
          url: `https://fabbazaar.app/decks/${d.publicId}`
        }))
      };

    } catch (error) {
      console.error('[GetDecksToBeat] Unexpected error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
