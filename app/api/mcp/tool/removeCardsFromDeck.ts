// app/api/mcp/tool/removeCardsFromDeck.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const removeCardsFromDeckTool = {
  name: 'remove_cards_from_deck',
  description: `🗑️ REMOVE CARDS FROM DECK: Remove one or more cards from one of your decks

  Removes printings from a deck by name. You must specify the category the card lives in.

  💡 WORKFLOW:
  Step 1: get_deck — view current decklist and note printingId + category for cards to remove
  Step 2: remove_cards_from_deck — remove them

  📦 CATEGORIES:
  - "maindeck"   — main library cards
  - "equipment"  — equipment/weapon slots
  - "hero"       — hero card
  - "sideboard"  — sideboard / inventory bench
  - "tokens"     — token cards

  📖 EXAMPLES:
  Single card:
    deckName: "My Deck", printings: [{ printingId: "abc123", quantity: 1, category: "maindeck" }]
  Multiple cards:
    deckName: "My Deck", printings: [
      { printingId: "abc123", quantity: 3, category: "maindeck" },
      { printingId: "def456", quantity: 1, category: "equipment" }
    ]

  ⚠️ If quantity is less than the total copies in the deck, only that many are removed.
  ⚠️ printingId is the unique internal ID visible in get_deck output.`,

  parameters: {
    type: 'object',
    properties: {
      deckName: {
        type: 'string',
        description: 'The name of the deck to remove cards from (case-insensitive match)'
      },
      printings: {
        type: 'array',
        description: 'One or more cards to remove',
        items: {
          type: 'object',
          properties: {
            printingId: {
              type: 'string',
              description: 'The unique printing ID of the card to remove'
            },
            quantity: {
              type: 'number',
              default: 1,
              description: 'Number of copies to remove'
            },
            category: {
              type: 'string',
              enum: ['maindeck', 'equipment', 'hero', 'sideboard', 'tokens'],
              default: 'maindeck',
              description: 'Deck zone the card is currently in'
            }
          },
          required: ['printingId']
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
      const listRes = await mcpFetch(`${API_BASE_URL}/api/decks?limit=100`, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenToUse}` }
      });
      if (!listRes.ok) return { success: false, error: `Failed to fetch deck list (HTTP ${listRes.status}).` };
      const listData = await listRes.json();
      if (!listData.success) return { success: false, error: listData.error || 'Could not load deck list.' };

      const deck = (listData.decks || []).find((d: any) => d.name?.toLowerCase() === deckName.toLowerCase());
      if (!deck) {
        const available = (listData.decks || []).map((d: any) => d.name).join(', ');
        return { success: false, error: `No deck named "${deckName}" found. Available: ${available}` };
      }

      // Remove cards
      const res = await mcpFetch(`${API_BASE_URL}/api/decks/${deck.publicId}/printings/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenToUse}` },
        body: JSON.stringify({
          printings: printings.map((p: any) => ({
            printingId: p.printingId,
            quantity: p.quantity || 1,
            category: p.category || 'maindeck',
          }))
        })
      });

      const data = await res.json();
      if (!data.success) return { success: false, error: data.error || 'Failed to remove cards.' };

      const { summary, results } = data;
      const lines = (results || []).map((r: any) =>
        r.success
          ? `  - ${r.quantity}x ${r.printingId} from ${r.category}`
          : `  ! ${r.printingId}: ${r.error}`
      ).join('\n');

      return {
        success: true,
        message: `Removed ${summary.totalCardsRemoved} card(s) from "${deck.name}" (${summary.removed} succeeded, ${summary.failed} failed):\n${lines}`,
        summary,
        deckName: deck.name,
        publicId: deck.publicId,
      };

    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};
