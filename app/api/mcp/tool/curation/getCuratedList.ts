// app/api/mcp/tool/curation/getCuratedList.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';
import { classifyIdentifier, resolveList, validateListIdentifierParams } from '../helpers';

export const getCuratedListTool = {
  name: 'get_curated_list',
  description: `📖 GET CURATED LIST: View a single curated list with all its cards

Returns the full list metadata plus an ordered list of cards with printing IDs,
display names, set codes, and image URLs.

📋 THREE WAYS TO IDENTIFY THE LIST (preferred order):
Option A — id (or listId): exact list ID (nanoid from list_curated_lists). PREFERRED.
Option B — listName + heroName: name scoped to one hero.
Option C — listName alone: only for generic lists. Errors on ambiguity.

Example workflow:
1. list_curated_lists() → find the list
2. get_curated_list({ id: "abc123" }) → view cards
3. add_card_to_list / remove_card_from_list → make changes`,

  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Curated list ID (nanoid from list_curated_lists). Alias: listId.'
      },
      listId: {
        type: 'string',
        description: 'Alias for id.'
      },
      listName: {
        type: 'string',
        description: 'Curated list name (case-insensitive). Pair with heroName when shared across heroes.'
      },
      heroName: {
        type: 'string',
        description: 'Hero to scope listName lookup.'
      }
    }
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();

    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) {
        return { success: false, error: 'Authentication required: no token found.' };
      }

      const rawId = params?.listId ?? params?.id;
      if (!rawId && !params?.listName) {
        return { success: false, error: 'Missing required parameter: id (listId) or listName' };
      }

      // If the caller passed a human-name-looking value into `id`, hint them.
      if (rawId) {
        const shape = classifyIdentifier(rawId);
        if (shape === 'humanName') {
          return {
            success: false,
            error: `"${rawId}" looks like a list name, not an ID. Retry with \`listName: "${rawId}"\` (add \`heroName\` to disambiguate if needed).`,
          };
        }
      } else {
        const shapeErr = validateListIdentifierParams({ listName: params.listName });
        if (shapeErr) return { success: false, error: shapeErr };
      }

      // Resolve via name+hero if id not given
      let resolvedId = rawId as string | undefined;
      if (!resolvedId) {
        const listResult = await resolveList(params.listName, tokenToUse, { heroName: params.heroName });
        if (!listResult.ok) return { success: false, error: listResult.error };
        resolvedId = listResult.list.id;
      }

      const response = await mcpFetch(`${API_BASE_URL}/api/curated-lists/${encodeURIComponent(resolvedId)}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
      });

      if (response.status === 404) {
        return { success: false, error: `List not found: ${resolvedId}. Call list_curated_lists() to see valid IDs.` };
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
