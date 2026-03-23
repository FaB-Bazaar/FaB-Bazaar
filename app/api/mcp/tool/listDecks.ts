// app/api/mcp/tool/listDecks.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const listDecksTool = {
  name: 'list_decks',
  description: `🃏 LIST ALL DECKS: View all your saved decks

  Shows a summary of all decks in your account.

  This tool works independently - no setup required.

  🖥️ DISPLAY INSTRUCTIONS (IMPORTANT):
  Always present results as a markdown table with these columns:
    # | Name | Hero | Format | Cards | Visibility | Last Updated

  Example:
  | # | Name            | Hero          | Format | Cards | Visibility | Updated     |
  |---|-----------------|---------------|--------|-------|------------|-------------|
  | 1 | Katsu Aggro     | Katsu         | CC     | 60    | Public     | 2 days ago  |
  | 2 | Bravo Control   | Bravo         | Blitz  | 40    | Private    | 1 week ago  |

  Then follow with a tip: "Use get_deck with a deck name to view the full decklist."

  💡 WORKFLOW:
  Step 1: list_decks (see what decks you have)
  Step 2: get_deck (view full decklist using the name from step 1)`,

  parameters: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        description: 'Optional filter by format (e.g. "CC", "Blitz", "Commoner")'
      }
    }
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();

    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) {
        return { success: false, error: 'Authentication failed: No token was found.' };
      }

      const queryParams = new URLSearchParams({ limit: '100', sortBy: 'updatedAt', sortOrder: 'desc' });
      if (params.format) queryParams.set('format', params.format);

      const response = await mcpFetch(`${API_BASE_URL}/api/decks?${queryParams}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenToUse}` }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ListDecks] API failed with status ${response.status}:`, errorText);
        return { success: false, error: `Failed to fetch decks (HTTP ${response.status}).` };
      }

      const result = await response.json();
      if (!result.success) {
        return { success: false, error: result.error || 'API returned an error.' };
      }

      const decks = result.decks || [];

      if (decks.length === 0) {
        return { success: true, message: '📭 No decks found.', decks: [] };
      }

      let message = `🃏 **Your Decks** (${decks.length} total)\n\n`;
      decks.forEach((deck: any, index: number) => {
        const updatedAt = deck.updatedAt ? new Date(deck.updatedAt) : null;
        const diffMs = updatedAt ? Date.now() - updatedAt.getTime() : 0;
        const diffDays = Math.floor(diffMs / 86400000);
        const timeAgo = diffDays === 0
          ? `${Math.floor(diffMs / 3600000)}h ago`
          : diffDays === 1 ? 'yesterday'
          : diffDays < 30 ? `${diffDays} days ago`
          : `${Math.floor(diffDays / 30)} months ago`;

        message += `${index + 1}. **${deck.name}** | ${deck.heroName || '—'} | ${deck.format || '—'} | ${deck.totalCards || 0} cards | ${deck.isPublic ? 'Public' : 'Private'} | ${timeAgo}\n`;
      });

      return {
        success: true,
        message,
        decks: decks.map((d: any) => ({
          name: d.name,
          publicId: d.publicId,
          heroName: d.heroName,
          format: d.format,
          totalCards: d.totalCards || 0,
          isPublic: d.isPublic,
          updatedAt: d.updatedAt
        }))
      };

    } catch (error) {
      console.error('[ListDecks] Unexpected error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};
