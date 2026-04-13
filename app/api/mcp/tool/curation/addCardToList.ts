// app/api/mcp/tool/curation/addCardToList.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const addCardToListTool = {
  name: 'add_card_to_list',
  description: `➕ ADD CARD TO LIST: Add one or many card printings to a curated list (curator/admin only)

Supports bulk adds — pass printingIds (array) to add multiple cards in one call.
Use search_printings to find printing IDs before calling this tool.

The response includes card entry IDs — save these if you may need to remove cards later
(remove_card_from_list uses the card entry ID, not the printing ID).

Example workflow (bulk):
1. search_printings to collect all printing IDs you need
2. add_card_to_list({ listId: "abc123", printingIds: ["id1", "id2", "id3"] })
   → all cards added in one request

Example workflow (single):
1. add_card_to_list({ listId: "abc123", printingId: "WTR001" })`,

  parameters: {
    type: 'object',
    properties: {
      listId: {
        type: 'string',
        description: 'The curated list ID to add the card(s) to'
      },
      printingId: {
        type: 'string',
        description: 'Single printing ID to add (use printingIds for bulk)'
      },
      printingIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of printing IDs to add in bulk (preferred over repeated single calls)'
      }
    },
    required: ['listId']
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

      const isBulk = Array.isArray(params.printingIds) && params.printingIds.length > 0;
      if (!isBulk && !params?.printingId) {
        return { success: false, error: 'Missing required parameter: printingId or printingIds' };
      }

      const body = isBulk
        ? { printingIds: params.printingIds }
        : { printingId: params.printingId };

      const response = await mcpFetch(
        `${API_BASE_URL}/api/curated-lists/${encodeURIComponent(params.listId)}/cards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenToUse}`
          },
          body: JSON.stringify(body)
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
        return { success: false, error: `Failed to add card(s) (HTTP ${response.status}): ${errorText}` };
      }

      const result = await response.json();
      if (!result.success) {
        return { success: false, error: result.error || 'API returned an error.' };
      }

      if (isBulk) {
        const cards = result.data as any[];
        const message = `✅ Added **${cards.length} cards** to list\n`
          + cards.map(c => `• ${c.displayName || c.printingId} (entry ID: \`${c.id}\`)`).join('\n');
        return { success: true, message, cards };
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
