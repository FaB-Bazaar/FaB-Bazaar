// app/api/mcp/tool/curation/addCardToList.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';
import { printingsService } from '@/lib/services';
import { sortPrintings } from '@/lib/fab-constants/sets';
import { resolveList } from '../helpers';

export const addCardToListTool = {
  name: 'add_card_to_list',
  description: `➕ ADD CARD TO LIST: Add one or many card printings to a curated list (curator/admin only)

🃏 TWO WAYS TO IDENTIFY CARDS:
Option A — printingIds (array): exact printing IDs from search_printings or fab://card-index
           Single card: printingIds: ["one_id"]
Option B — cards array with cardName + pitch: auto-resolves to the default printing
           (same priority as deck editor: main set → oldest → non-foil → standard edition)

📋 TWO WAYS TO IDENTIFY THE LIST:
Option A — listId: exact UUID from list_curated_lists
Option B — listName: case-insensitive name match (resolves automatically — no prior list_curated_lists call needed)

💡 BULK CURATION WORKFLOW (recommended for staple lists):
1. Read fab://card-index resource once per session — pre-built name+pitch → printingId map
2. Look up printing IDs from the index for common generics/heroes
3. add_card_to_list({ listName: "Rhinar Staples", printingIds: ["id1", "id2", ...] })
4. For cards not in the index, use search_printings or pass cardName+pitch

The response includes card entry IDs — save these if you may need to remove cards later
(remove_card_from_list uses the card entry ID, not the printing ID).

Example workflow (by name, bulk):
add_card_to_list({ listName: "Rhinar Staples", cards: [
  { cardName: "Pummel", pitch: 1 },
  { cardName: "Pummel", pitch: 2 },
  { cardName: "Sink Below", pitch: 1 }
]})

Example workflow (by printing ID, bulk):
add_card_to_list({ listName: "Rhinar Staples", printingIds: ["id1", "id2", "id3"] })

Example workflow (by printing ID, single):
add_card_to_list({ listId: "abc123", printingIds: ["id1"] })`,

  parameters: {
    type: 'object',
    properties: {
      listId: {
        type: 'string',
        description: 'Exact curated list UUID. Use listName instead if you only know the name.'
      },
      listName: {
        type: 'string',
        description: 'Curated list name (case-insensitive). Resolves to the list automatically — no prior list_curated_lists call needed.'
      },
      printingIds: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        description: 'Array of printing IDs to add (use ["one_id"] for a single card). IDs come from search_printings or fab://card-index.'
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
    required: []
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();

    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) {
        return { success: false, error: 'Authentication required: no token found.' };
      }

      if (!params?.listId && !params?.listName) {
        return { success: false, error: 'Missing required parameter: listId or listName' };
      }

      // Resolve list (by ID or name)
      const listResult = await resolveList(params.listId ?? params.listName, tokenToUse);
      if (!listResult.ok) return { success: false, error: listResult.error };
      const { id: resolvedListId, name: resolvedListName } = listResult.list;

      // Resolve cardName+pitch entries to printingIds (single bulk DB query)
      const resolvedIds: string[] = [];
      const resolutionFailures: string[] = [];

      if (Array.isArray(params.cards) && params.cards.length > 0) {
        const validCards = params.cards.filter((c: any) => {
          if (!c.cardName) { resolutionFailures.push('An item in cards[] is missing cardName — skipped.'); return false; }
          return true;
        });

        if (validCards.length > 0) {
          const bulkResult = await printingsService.bulkResolveByName(
            validCards.map((c: any) => ({ name: c.cardName, pitch: (c.pitch ?? 0) || undefined }))
          );
          if (!bulkResult.success) {
            return { success: false, error: `Card name resolution failed: ${bulkResult.error}` };
          }
          for (let i = 0; i < validCards.length; i++) {
            const c = validCards[i];
            const entry = bulkResult.data[i];
            if (!entry.printings.length) {
              const pitch = c.pitch ?? 0;
              resolutionFailures.push(`No printings found for "${c.cardName}"${pitch > 0 ? ` (pitch ${pitch})` : ''} — skipped.`);
              continue;
            }
            resolvedIds.push(sortPrintings(entry.printings)[0].printing_id);
          }
        }
      }

      const allIds = [...(params.printingIds ?? []), ...resolvedIds];

      if (allIds.length === 0) {
        if (resolutionFailures.length > 0) {
          return { success: false, error: `All cards failed to resolve:\n${resolutionFailures.join('\n')}` };
        }
        return { success: false, error: 'Missing required parameter: printingIds (array) or cards' };
      }

      const response = await mcpFetch(
        `${API_BASE_URL}/api/curated-lists/${encodeURIComponent(resolvedListId)}/cards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenToUse}`
          },
          body: JSON.stringify({ printingIds: allIds })
        }
      );

      if (response.status === 403) {
        return { success: false, error: 'Access denied: curator or admin role required.' };
      }
      if (response.status === 404) {
        return { success: false, error: `List not found: ${resolvedListId}` };
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

      if (allIds.length > 1) {
        const cards = result.data as any[];
        const message = `✅ Added **${cards.length} cards** to "${resolvedListName}"\n`
          + cards.map(c => `• ${c.displayName || c.printingId} (entry ID: \`${c.id}\`)`).join('\n')
          + failureNote;
        return { success: true, message, cards, resolutionFailures: resolutionFailures.length > 0 ? resolutionFailures : undefined };
      }

      const card = Array.isArray(result.data) ? result.data[0] : result.data;
      const message = `✅ Added **${card.displayName || card.printingId}** to "${resolvedListName}"\n`
        + `Set: ${card.setCode || '?'} | Card entry ID: \`${card.id}\`\n`
        + `Use remove_card_from_list({ listName: "${resolvedListName}", printingIds: ["${card.printingId}"] }) to remove it.`
        + failureNote;

      return { success: true, message, card };
    } catch (error) {
      console.error('[AddCardToList] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};
