// app/api/mcp/tool/curation/removeCardFromList.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';
import { printingsService } from '@/lib/services';
import { sortPrintings } from '@/lib/fab-constants/sets';
import { resolveList, validateListIdentifierParams, validatePrintingIds, validateCardEntryIds } from '../helpers';

export const removeCardFromListTool = {
  name: 'remove_card_from_list',
  description: `➖ REMOVE CARD FROM LIST: Remove one or more cards from a curated list (curator/admin only)

No need to call get_curated_list first — this tool resolves card entry IDs internally.

📋 THREE WAYS TO IDENTIFY THE LIST (preferred order):
Option A — listId: exact list ID (nanoid). UNAMBIGUOUS.
Option B — listName + heroName: scoped to one hero — safe when the name is shared.
Option C — listName alone: only safe for generic (hero-less) lists. Errors on ambiguity.

🃏 THREE WAYS TO IDENTIFY CARDS TO REMOVE:
Option A — cardEntryIds: exact card entry row IDs (fastest, use if you already have them from add_card_to_list)
Option B — printingIds: printing IDs — resolves to entry IDs by fetching the list internally
Option C — cards: cardName + pitch — resolves printing ID then entry ID (no prior search needed)

Example (by printing ID — most common after add_card_to_list):
remove_card_from_list({ listName: "Rhinar Staples", printingIds: ["pid1", "pid2"] })

Example (by card name):
remove_card_from_list({ listName: "Rhinar Staples", cards: [
  { cardName: "Pummel", pitch: 1 },
  { cardName: "Sink Below", pitch: 2 }
]})

Example (by entry ID — fastest if already known):
remove_card_from_list({ listId: "abc123", cardEntryIds: ["eid1", "eid2"] })`,

  parameters: {
    type: 'object',
    properties: {
      listId: {
        type: 'string',
        description: 'Exact curated list ID (nanoid from list_curated_lists). PREFERRED — unambiguous.'
      },
      listName: {
        type: 'string',
        description: 'Curated list name (case-insensitive). Pair with heroName when the name is shared across heroes. Errors with all matches if ambiguous.'
      },
      heroName: {
        type: 'string',
        description: 'Hero to scope listName lookup (e.g. "Dorinthea Ironsong"). Use when multiple heroes share the same list name.'
      },
      cardEntryIds: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        description: 'Card entry row IDs to remove directly (from a previous add_card_to_list or get_curated_list response). Fastest option when IDs are already known.'
      },
      printingIds: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        description: 'Printing IDs to remove. The tool fetches the list to look up the matching entry IDs — no prior get_curated_list needed.'
      },
      cards: {
        type: 'array',
        description: 'Cards to remove by name+pitch — auto-resolves printing ID then entry ID.',
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

      const hasEntryIds  = Array.isArray(params.cardEntryIds)  && params.cardEntryIds.length > 0;
      const hasPrintIds  = Array.isArray(params.printingIds)   && params.printingIds.length > 0;
      const hasCardNames = Array.isArray(params.cards)         && params.cards.length > 0;

      if (!hasEntryIds && !hasPrintIds && !hasCardNames) {
        return { success: false, error: 'Missing required parameter: cardEntryIds, printingIds, or cards' };
      }

      const shapeErr = validateListIdentifierParams(params);
      if (shapeErr) return { success: false, error: shapeErr };
      const entryShapeErr = validateCardEntryIds(params.cardEntryIds);
      if (entryShapeErr) return { success: false, error: entryShapeErr };
      const printingShapeErr = validatePrintingIds(params.printingIds);
      if (printingShapeErr) return { success: false, error: printingShapeErr };

      // Resolve list (needed for name→ID, and for printingId/card-name → entry ID lookup)
      const listResult = await resolveList(
        params.listId ?? params.listName,
        tokenToUse,
        { heroName: params.heroName },
      );
      if (!listResult.ok) return { success: false, error: listResult.error };
      const { id: resolvedListId, name: resolvedListName, cards: listCards } = listResult.list;

      const resolutionFailures: string[] = [];
      let entryIdsToRemove: string[] = [...(params.cardEntryIds ?? [])];

      // Resolve printingIds → entry IDs
      if (hasPrintIds) {
        for (const pid of params.printingIds) {
          const entry = listCards.find(c => c.printingId === pid);
          if (!entry) {
            resolutionFailures.push(`Printing ID "${pid}" not found in list "${resolvedListName}" — skipped.`);
            continue;
          }
          entryIdsToRemove.push(entry.id);
        }
      }

      // Resolve card names → printing IDs → entry IDs (single bulk DB query)
      if (hasCardNames) {
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
            const resolved = bulkResult.data[i];
            const pitch = c.pitch ?? 0;
            if (!resolved.printings.length) {
              resolutionFailures.push(`No printings found for "${c.cardName}"${pitch > 0 ? ` (pitch ${pitch})` : ''} — skipped.`);
              continue;
            }
            const best = sortPrintings(resolved.printings)[0];
            const entry = listCards.find(lc => lc.printingId === best.printing_id);
            if (!entry) {
              resolutionFailures.push(`"${c.cardName}"${pitch > 0 ? ` (pitch ${pitch})` : ''} is not in list "${resolvedListName}" — skipped.`);
              continue;
            }
            entryIdsToRemove.push(entry.id);
          }
        }
      }

      // Deduplicate
      entryIdsToRemove = [...new Set(entryIdsToRemove)];

      if (entryIdsToRemove.length === 0) {
        return {
          success: false,
          error: `No cards could be resolved for removal.\n${resolutionFailures.join('\n')}`
        };
      }

      // Remove each entry
      const removed: string[] = [];
      const removeFailed: string[] = [];

      for (const cardEntryId of entryIdsToRemove) {
        const response = await mcpFetch(
          `${API_BASE_URL}/api/curated-lists/${encodeURIComponent(resolvedListId)}/cards/${encodeURIComponent(cardEntryId)}`,
          {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${tokenToUse}` }
          }
        );

        if (response.status === 403) {
          return { success: false, error: 'Access denied: curator or admin role required.' };
        }
        if (!response.ok) {
          removeFailed.push(cardEntryId);
          continue;
        }
        const result = await response.json();
        if (result.success) {
          removed.push(cardEntryId);
        } else {
          removeFailed.push(cardEntryId);
        }
      }

      const failureNote = resolutionFailures.length > 0
        ? `\n⚠️ Skipped (not resolved):\n${resolutionFailures.map(f => `  - ${f}`).join('\n')}`
        : '';

      const removedNames = removed.map(eid => {
        const card = listCards.find(c => c.id === eid);
        return card?.displayName ?? eid;
      });

      const message = `✅ Removed **${removed.length}** card(s) from "${resolvedListName}"`
        + (removedNames.length ? `\n${removedNames.map(n => `• ${n}`).join('\n')}` : '')
        + (removeFailed.length ? `\n❌ Failed to remove ${removeFailed.length} entry ID(s): ${removeFailed.join(', ')}` : '')
        + failureNote;

      return {
        success: true,
        message,
        removed,
        failed: removeFailed.length > 0 ? removeFailed : undefined,
        resolutionFailures: resolutionFailures.length > 0 ? resolutionFailures : undefined,
      };
    } catch (error) {
      console.error('[RemoveCardFromList] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};
