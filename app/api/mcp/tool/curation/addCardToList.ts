// app/api/mcp/tool/curation/addCardToList.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';
import { printingsService } from '@/lib/services';
import { sortPrintings } from '@/lib/fab-constants/sets';

export const addCardToListTool = {
  name: 'add_card_to_list',
  description: `➕ ADD CARD TO LIST: Add one or many card printings to a curated list (curator/admin only)

Supports bulk adds — pass printingIds (array) to add multiple cards in one call.

🃏 TWO WAYS TO IDENTIFY CARDS:
Option A — printingId(s): exact printing ID from search_printings or fab://card-index
Option B — cards array with cardName + pitch: auto-resolves to the default printing
           (same priority as deck editor: main set → oldest → non-foil → standard edition)

💡 BULK CURATION WORKFLOW (recommended for staple lists):
1. Read fab://card-index resource once per session — pre-built name+pitch → printingId map
2. Look up printing IDs from the index for common generics/heroes
3. add_card_to_list({ listId: "abc123", printingIds: ["id1", "id2", ...] })
4. For cards not in the index, use search_printings or pass cardName+pitch

The response includes card entry IDs — save these if you may need to remove cards later
(remove_card_from_list uses the card entry ID, not the printing ID).

Example workflow (by name, bulk):
add_card_to_list({ listId: "abc123", cards: [
  { cardName: "Pummel", pitch: 1 },
  { cardName: "Pummel", pitch: 2 },
  { cardName: "Sink Below", pitch: 1 }
]})

Example workflow (by printing ID, bulk):
add_card_to_list({ listId: "abc123", printingIds: ["id1", "id2", "id3"] })`,

  parameters: {
    type: 'object',
    properties: {
      listId: {
        type: 'string',
        description: 'The curated list ID to add the card(s) to'
      },
      printingId: {
        type: 'string',
        description: 'Single printing ID to add (use printingIds or cards for bulk)'
      },
      printingIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of printing IDs to add in bulk (preferred when you already have IDs from search_printings or fab://card-index)'
      },
      cards: {
        type: 'array',
        description: 'Cards to add by name — auto-resolves to default printing. Use when you have card names but not printing IDs.',
        items: {
          type: 'object',
          properties: {
            cardName: { type: 'string', description: 'Card name (e.g. "Pummel", "Sink Below")' },
            pitch: {
              type: 'number',
              enum: [0, 1, 2, 3],
              default: 0,
              description: 'Pitch value: 0=no pitch, 1=red, 2=yellow, 3=blue'
            }
          },
          required: ['cardName']
        }
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

      // Resolve cardName+pitch entries to printingIds
      let resolvedIds: string[] = [];
      const resolutionFailures: string[] = [];

      if (Array.isArray(params.cards) && params.cards.length > 0) {
        for (const c of params.cards) {
          if (!c.cardName) {
            resolutionFailures.push('An item in cards[] is missing cardName — skipped.');
            continue;
          }
          const pitch = c.pitch ?? 0;
          const searchResult = await printingsService.searchPrintings(
            { name: c.cardName, exact: true, ...(pitch > 0 ? { pitch } : {}) },
            { limit: 50 }
          );
          if (!searchResult.success || !searchResult.data?.printings?.length) {
            resolutionFailures.push(`No printings found for "${c.cardName}"${pitch > 0 ? ` (pitch ${pitch})` : ''} — skipped.`);
            continue;
          }
          const best = sortPrintings(searchResult.data.printings)[0];
          resolvedIds.push(best.printing_id);
        }
      }

      const isBulk = (Array.isArray(params.printingIds) && params.printingIds.length > 0) || resolvedIds.length > 1;
      const allIds = [...(params.printingIds ?? []), ...resolvedIds];

      if (allIds.length === 0 && !params?.printingId) {
        if (resolutionFailures.length > 0) {
          return { success: false, error: `All cards failed to resolve:\n${resolutionFailures.join('\n')}` };
        }
        return { success: false, error: 'Missing required parameter: printingId, printingIds, or cards' };
      }

      const body = (isBulk || allIds.length > 0)
        ? { printingIds: allIds.length > 0 ? allIds : undefined, printingId: allIds.length === 0 ? params.printingId : undefined }
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

      const failureNote = resolutionFailures.length > 0
        ? `\n\n⚠️ Skipped (name resolution failed):\n${resolutionFailures.map(f => `  - ${f}`).join('\n')}`
        : '';

      if (isBulk || allIds.length > 1) {
        const cards = result.data as any[];
        const message = `✅ Added **${cards.length} cards** to list\n`
          + cards.map(c => `• ${c.displayName || c.printingId} (entry ID: \`${c.id}\`)`).join('\n')
          + failureNote;
        return { success: true, message, cards, resolutionFailures: resolutionFailures.length > 0 ? resolutionFailures : undefined };
      }

      const card = result.data;
      const message = `✅ Added **${card.displayName || card.printingId}** to list\n`
        + `Set: ${card.setCode || '?'} | Card entry ID: \`${card.id}\`\n`
        + `Use remove_card_from_list({ cardId: "${card.id}" }) to remove it.`
        + failureNote;

      return { success: true, message, card };
    } catch (error) {
      console.error('[AddCardToList] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};
