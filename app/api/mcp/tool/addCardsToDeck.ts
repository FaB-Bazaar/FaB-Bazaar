// app/api/mcp/tool/addCardsToDeck.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';
import { printingsService } from '@/lib/services';
import { sortPrintings } from '@/lib/fab-constants/sets';
import { resolveDeckByName } from './helpers';

export const addCardsToDeckTool = {
  name: 'add_cards_to_deck',
  description: `🃏 ADD CARDS TO DECK: Add one or more cards to one of your decks

  Adds printings to a deck. Each card can be identified by printingId OR by cardName+pitch.

  📦 CATEGORIES:
  - "maindeck"   — main library (most cards go here)
  - "equipment"  — equipment/weapon slots
  - "hero"       — hero card (usually set at deck creation)
  - "sideboard"  — sideboard / inventory bench
  - "tokens"     — token cards

  🎯 TWO WAYS TO IDENTIFY A CARD (per item):
  Option A — printingId: exact printing ID from search_printings (most precise)
  Option B — cardName + pitch: auto-resolves to the default printing using the same
             priority as the deck editor (main set → oldest → non-foil → standard edition)

  🎨 PITCH VALUES (for cardName mode):
  - pitch: 0 — no pitch (equipment, heroes, tokens, actions without pitch)
  - pitch: 1 — red
  - pitch: 2 — yellow
  - pitch: 3 — blue

  💡 DECKLIST IMPORT WORKFLOW:
  Step 1: Read fab://card-index resource (once per session) — gets pre-built name+pitch → printingId map
  Step 2: create_deck — create the deck with name, format, visibility
  Step 3: add_cards_to_deck — pass all cards by cardName+pitch (or use printingId from the index)

  📖 EXAMPLES:
  By printingId:
    { printingId: "abc123", quantity: 3, category: "maindeck" }
  By card name (auto-resolves default printing):
    { cardName: "Flic Flak", pitch: 1, quantity: 3, category: "maindeck" }
    { cardName: "Flic Flak", pitch: 2, quantity: 3, category: "maindeck" }
    { cardName: "Flic Flak", pitch: 3, quantity: 3, category: "maindeck" }
    { cardName: "Scar for a Scar", pitch: 0, quantity: 2, category: "maindeck" }

  ⚠️ For pitch cards, always specify pitch — "Flic Flak" without pitch defaults to pitch 0 (no match).`,

  parameters: {
    type: 'object',
    properties: {
      deckName: {
        type: 'string',
        description: 'The name of the deck to add cards to (case-insensitive match)'
      },
      printings: {
        type: 'array',
        description: 'One or more cards to add',
        items: {
          type: 'object',
          properties: {
            printingId: {
              type: 'string',
              description: 'Exact printing ID (from search_printings or fab://card-index). Use this OR cardName — not both.'
            },
            cardName: {
              type: 'string',
              description: 'Card name to auto-resolve to default printing (e.g. "Flic Flak"). Must be combined with pitch.'
            },
            pitch: {
              type: 'number',
              enum: [0, 1, 2, 3],
              default: 0,
              description: 'Pitch value when using cardName: 0=no pitch, 1=red, 2=yellow, 3=blue'
            },
            quantity: {
              type: 'number',
              default: 1,
              description: 'Number of copies to add'
            },
            category: {
              type: 'string',
              enum: ['maindeck', 'equipment', 'hero', 'sideboard', 'tokens'],
              default: 'maindeck',
              description: 'Deck zone to add the card to'
            }
          },
          required: []
        }
      }
    },
    required: ['deckName', 'printings']
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();

    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) {
        return { success: false, error: 'Authentication failed: No token found.' };
      }

      const { deckName, printings } = params;
      if (!deckName) return { success: false, error: 'deckName is required.' };
      if (!printings?.length) return { success: false, error: 'printings array is required and must not be empty.' };

      // Resolve deck by name
      const deckResult = await resolveDeckByName(deckName, tokenToUse);
      if (!deckResult.ok) return { success: false, error: deckResult.error };
      const deck = deckResult.deck;

      // Separate cards that already have printingIds from those needing name resolution
      const resolvedPrintings: Array<{ printingId: string; quantity: number; category: string; resolvedFrom?: string }> = [];
      const resolutionFailures: string[] = [];
      const needsResolution: Array<{ cardName: string; pitch: number; quantity: number; category: string }> = [];

      for (const p of printings) {
        if (p.printingId) {
          resolvedPrintings.push({ printingId: p.printingId, quantity: p.quantity || 1, category: p.category || 'maindeck' });
        } else if (p.cardName) {
          needsResolution.push({ cardName: p.cardName, pitch: p.pitch ?? 0, quantity: p.quantity || 1, category: p.category || 'maindeck' });
        } else {
          resolutionFailures.push(`An item is missing both printingId and cardName — skipped.`);
        }
      }

      // Bulk-resolve all name+pitch lookups in a single DB query
      if (needsResolution.length > 0) {
        const bulkResult = await printingsService.bulkResolveByName(
          needsResolution.map(p => ({ name: p.cardName, pitch: p.pitch || undefined }))
        );
        if (!bulkResult.success) {
          return { success: false, error: `Card name resolution failed: ${bulkResult.error}` };
        }
        for (let i = 0; i < needsResolution.length; i++) {
          const input = needsResolution[i];
          const entry = bulkResult.data[i];
          if (!entry.printings.length) {
            const pitchLabel = input.pitch === 1 ? ' (red)' : input.pitch === 2 ? ' (yellow)' : input.pitch === 3 ? ' (blue)' : '';
            resolutionFailures.push(`No printings found for "${input.cardName}"${pitchLabel} — skipped.`);
            continue;
          }
          const best = sortPrintings(entry.printings)[0];
          const pitchLabel = input.pitch === 1 ? ' (red)' : input.pitch === 2 ? ' (yellow)' : input.pitch === 3 ? ' (blue)' : '';
          resolvedPrintings.push({
            printingId: best.printing_id,
            quantity: input.quantity,
            category: input.category,
            resolvedFrom: `${input.cardName}${pitchLabel} → ${best.set} ${best.edition ?? ''} ${best.foiling ?? ''}`.trim(),
          });
        }
      }

      if (resolvedPrintings.length === 0) {
        return { success: false, error: `All cards failed to resolve. Issues:\n${resolutionFailures.join('\n')}` };
      }

      // Add cards
      const res = await mcpFetch(`${API_BASE_URL}/api/decks/${deck.publicId}/printings/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenToUse}` },
        body: JSON.stringify({
          printings: resolvedPrintings.map((p) => ({
            printingId: p.printingId,
            quantity: p.quantity,
            category: p.category,
          }))
        })
      });

      const data = await res.json();
      if (!data.success) return { success: false, error: data.error || 'Failed to add cards.' };

      const { summary, results } = data;

      // Build a map from printingId → resolved label for display
      const resolvedMap = new Map(resolvedPrintings.map((p) => [p.printingId, p.resolvedFrom]));

      const lines = (results || []).map((r: any) => {
        if (r.success) {
          const resolved = resolvedMap.get(r.printingId);
          const label = resolved ? `${r.cardName || r.printingId}  [${resolved}]` : (r.cardName || r.printingId);
          return `  + ${r.quantity}x ${label} → ${r.category}`;
        }
        return `  ! ${r.printingId}: ${r.error}`;
      }).join('\n');

      const failureNote = resolutionFailures.length > 0
        ? `\n\n⚠️ Skipped (name resolution failed):\n${resolutionFailures.map(f => `  - ${f}`).join('\n')}`
        : '';

      return {
        success: true,
        message: `Added ${summary.totalCardsAdded} card(s) to "${deck.name}" (${summary.added} succeeded, ${summary.failed} failed):\n${lines}${failureNote}`,
        summary,
        deckName: deck.name,
        publicId: deck.publicId,
        resolutionFailures: resolutionFailures.length > 0 ? resolutionFailures : undefined,
      };

    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};
