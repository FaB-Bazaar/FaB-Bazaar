// app/api/mcp/tool/curation/removeCardFromList.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const removeCardFromListTool = {
  name: 'remove_card_from_list',
  description: `➖ REMOVE CARD FROM LIST: Remove a card entry from a curated list (curator/admin only)

Removes a card by its card entry ID (the ID of the row in the list, not the printing ID).
Use get_curated_list to see card entry IDs — they appear as "Card entry ID" next to each card.

Note: The cardId here is the curated_list_cards row ID, not the printing ID.`,

  parameters: {
    type: 'object',
    properties: {
      listId: {
        type: 'string',
        description: 'The curated list ID the card belongs to'
      },
      cardId: {
        type: 'string',
        description: 'The card entry ID to remove (from get_curated_list output, labeled "Card entry ID")'
      }
    },
    required: ['listId', 'cardId']
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
      if (!params?.cardId) {
        return { success: false, error: 'Missing required parameter: cardId' };
      }

      const response = await mcpFetch(
        `${API_BASE_URL}/api/curated-lists/${encodeURIComponent(params.listId)}/cards/${encodeURIComponent(params.cardId)}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${tokenToUse}` }
        }
      );

      if (response.status === 403) {
        return { success: false, error: 'Access denied: curator or admin role required.' };
      }
      if (response.status === 404) {
        return { success: false, error: `Card entry not found: ${params.cardId}` };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Failed to remove card (HTTP ${response.status}): ${errorText}` };
      }

      const result = await response.json();
      if (!result.success) {
        return { success: false, error: result.error || 'API returned an error.' };
      }

      return {
        success: true,
        message: `✅ Removed card entry \`${params.cardId}\` from list \`${params.listId}\`.`
      };
    } catch (error) {
      console.error('[RemoveCardFromList] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};
