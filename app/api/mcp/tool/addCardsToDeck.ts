// app/api/mcp/tool/addCardsToDeck.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const addCardsToDeckTool = {
  name: 'add_cards_to_deck',
  description: `🃏 ADD CARDS TO DECK: Add one or more cards to one of your decks

  Adds printings to a deck by name. Supports all deck categories.

  💡 WORKFLOW:
  Step 1: list_decks — find your deck name
  Step 2: search_printings — find printingId values for the cards you want
  Step 3: add_cards_to_deck — add them

  📦 CATEGORIES:
  - "maindeck"   — main library (most cards go here)
  - "equipment"  — equipment/weapon slots
  - "hero"       — hero card (usually set at deck creation)
  - "sideboard"  — sideboard / inventory bench
  - "tokens"     — token cards

  📖 EXAMPLES:
  Single card:
    deckName: "My Deck", printings: [{ printingId: "abc123", quantity: 3, category: "maindeck" }]
  Multiple cards:
    deckName: "My Deck", printings: [
      { printingId: "abc123", quantity: 3, category: "maindeck" },
      { printingId: "def456", quantity: 1, category: "equipment" }
    ]

  ⚠️ printingId is the unique internal ID (from search_printings), NOT a collector number like WTR001.`,

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
              description: 'The unique printing ID from search_printings results'
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
      const listRes = await mcpFetch(`${API_BASE_URL}/api/decks/list?limit=100`, {
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

      // Add cards
      const res = await mcpFetch(`${API_BASE_URL}/api/decks/${deck.publicId}/printings/add`, {
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
      if (!data.success) return { success: false, error: data.error || 'Failed to add cards.' };

      const { summary, results } = data;
      const lines = (results || []).map((r: any) =>
        r.success
          ? `  + ${r.quantity}x ${r.cardName || r.printingId} → ${r.category}`
          : `  ! ${r.printingId}: ${r.error}`
      ).join('\n');

      return {
        success: true,
        message: `Added ${summary.totalCardsAdded} card(s) to "${deck.name}" (${summary.added} succeeded, ${summary.failed} failed):\n${lines}`,
        summary,
        deckName: deck.name,
        publicId: deck.publicId,
      };

    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};
