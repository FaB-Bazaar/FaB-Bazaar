// app/api/mcp/tool/curation/getCuratedList.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const getCuratedListTool = {
  name: 'get_curated_list',
  description: `📖 GET CURATED LIST: View a single curated list with all its cards

Returns the full list metadata plus an ordered list of cards with printing IDs,
display names, set codes, and image URLs.

Use list_curated_lists first to find the list ID.

Example workflow:
1. list_curated_lists() → find the list
2. get_curated_list({ id: "abc123" }) → view cards
3. add_card_to_list / remove_card_from_list → make changes`,

  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'The curated list ID (from list_curated_lists)'
      }
    },
    required: ['id']
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();

    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) {
        return { success: false, error: 'Authentication required: no token found.' };
      }

      if (!params?.id) {
        return { success: false, error: 'Missing required parameter: id' };
      }

      const response = await mcpFetch(`${API_BASE_URL}/api/curated-lists/${encodeURIComponent(params.id)}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
      });

      if (response.status === 404) {
        return { success: false, error: `List not found: ${params.id}` };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Failed to fetch list (HTTP ${response.status}): ${errorText}` };
      }

      const result = await response.json();
      if (!result.success) {
        return { success: false, error: result.error || 'API returned an error.' };
      }

      const list = result.data;
      const scope = list.heroName ? `Hero: ${list.heroName}` : list.className ? `Class: ${list.className}` : 'General';
      const status = list.isPublished ? '✅ Published' : '📝 Draft';

      let message = `📖 **${list.name}**\n`;
      message += `Scope: ${scope} | Format: ${list.format || 'CC'} | Status: ${status}\n`;
      if (list.description) message += `Description: ${list.description}\n`;
      if (list.variantType) message += `Variant: ${list.variantType}\n`;
      if (list.tags?.length) message += `Tags: ${list.tags.join(', ')}\n`;
      message += `ID: \`${list.id}\`\n\n`;

      const cards = list.cards || [];
      if (cards.length === 0) {
        message += `No cards in this list yet. Use add_card_to_list to populate it.`;
      } else {
        message += `**Cards** (${cards.length} total):\n`;
        cards.forEach((card: any, i: number) => {
          message += `${i + 1}. ${card.displayName || 'Unknown'} | Set: ${card.setCode || '?'} | Printing ID: \`${card.printingId}\` | Card Entry ID: \`${card.id}\`\n`;
        });
        message += `\nUse card entry IDs (not printing IDs) with remove_card_from_list.`;
      }

      return { success: true, message, list };
    } catch (error) {
      console.error('[GetCuratedList] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};
