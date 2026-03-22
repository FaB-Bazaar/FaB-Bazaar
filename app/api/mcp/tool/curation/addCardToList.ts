// app/api/mcp/tool/curation/addCardToList.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const addCardToListTool = {
  name: 'add_card_to_list',
  description: `➕ ADD CARD TO LIST: Add a card printing to a curated list (curator/admin only)

Adds a specific card printing to a curated list by its printing ID.
Use search_printings to find printing IDs before calling this tool.

The response includes a card entry ID — save this if you may need to remove the card later
(remove_card_from_list uses the card entry ID, not the printing ID).

Example workflow:
1. search_printings({ filters: { name: "Enlightened Strike" }, _resourcesConfirmed: true })
   → find the printing_id for the version you want
2. add_card_to_list({ listId: "abc123", printingId: "WTR001" })
   → card added, response includes card entry id
3. Repeat for each card to add`,

  parameters: {
    type: 'object',
    properties: {
      listId: {
        type: 'string',
        description: 'The curated list ID to add the card to'
      },
      printingId: {
        type: 'string',
        description: 'The printing ID of the card to add (e.g. "WTR001-CF" or internal UUID)'
      }
    },
    required: ['listId', 'printingId']
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();

    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) {
        return { success: false, error: 'Authentication required: no token found.' };
      }

      if (!params?.listId) {
        return { success: false, error: 'Missing required parameter: listId' };
      }
      if (!params?.printingId) {
        return { success: false, error: 'Missing required parameter: printingId' };
      }

      const response = await mcpFetch(
        `${API_BASE_URL}/api/curated-lists/${encodeURIComponent(params.listId)}/cards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenToUse}`
          },
          body: JSON.stringify({ printingId: params.printingId })
        }
      );

      if (response.status === 403) {
        return { success: false, error: 'Access denied: curator or admin role required.' };
      }
      if (response.status === 404) {
        return { success: false, error: `List not found: ${params.listId}` };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Failed to add card (HTTP ${response.status}): ${errorText}` };
      }

      const result = await response.json();
      if (!result.success) {
        return { success: false, error: result.error || 'API returned an error.' };
      }

      const card = result.data;
      const message = `✅ Added **${card.displayName || card.printingId}** to list\n`
        + `Set: ${card.setCode || '?'} | Card entry ID: \`${card.id}\`\n`
        + `Use remove_card_from_list({ cardId: "${card.id}" }) to remove it.`;

      return { success: true, message, card };
    } catch (error) {
      console.error('[AddCardToList] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};
