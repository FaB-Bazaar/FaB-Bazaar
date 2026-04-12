// app/api/mcp/tool/getDeck.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

const FOILING_MAP: Record<string, string> = { s: 'NF', r: 'RF', c: 'CF', g: 'GF' };
const EDITION_MAP: Record<string, string> = { f: '1st', a: 'A', u: 'UNL', n: '' };
const PITCH_COLOR: Record<string, string> = { '1': 'Red', '2': 'Yellow', '3': 'Blue' };

function formatCardLine(card: any): string {
  const qty = card.quantity || 1;
  // Card fields are nested under printingDetails in the deck DTO
  const p = card.printingDetails || {};
  const name = p.display_name || p.name || card.display_name || card.name || 'Unknown';
  const foiling = FOILING_MAP[(p.foiling || card.foiling)?.toLowerCase()] ?? p.foiling ?? card.foiling ?? 'NF';
  const edition = EDITION_MAP[(p.edition || card.edition)?.toLowerCase()] ?? p.edition ?? card.edition ?? '';
  const pitch = String(p.pitch ?? card.pitch ?? '');
  const color = PITCH_COLOR[pitch] || '—';
  const types: string[] = p.types || card.types || [];
  const typeStr = Array.isArray(types) ? types.join(', ') : (types || '—');
  const collectorNum = p.collector_number || card.collector_number || '';
  const setCode = (p.set || card.set || '').toUpperCase();
  const cardId = collectorNum ? `${setCode}${collectorNum}` : '—';
  const editionDisplay = edition || '—';

  return `| ${qty} | ${name} | ${color} | ${typeStr || '—'} | ${foiling} | ${editionDisplay} | ${cardId} |`;
}

export const getDeckTool = {
  name: 'get_deck',
  description: `🃏 VIEW DECK CONTENTS: Get the full decklist for one of your decks

  Retrieves all cards in a deck organised by category (Hero, Equipment, Maindeck, etc.)
  Look up by deck name — no need to know internal IDs.

  This tool works independently - no setup required.

  🖥️ DISPLAY INSTRUCTIONS (IMPORTANT):
  Always render the full decklist as markdown tables grouped by category.
  Do NOT summarise — show every card row.

  **Hero** (1 card)
  | Qty | Name                          | Color | Types | Foiling | Edition | Card ID |
  |-----|-------------------------------|-------|-------|---------|---------|---------|
  | 1   | Teklovossen, Esteemed Magnate | —     | Hero  | NF      | —       | EVO001  |

  **Equipment** (X cards)
  | Qty | Name              | Color | Types     | Foiling | Edition | Card ID |
  |-----|-------------------|-------|-----------|---------|---------|---------|
  | 1   | Teklo Leveler     | —     | Equipment | NF      | —       | EVO045  |

  **Maindeck** (X cards)
  | Qty | Name              | Color  | Types           | Foiling | Edition | Card ID |
  |-----|-------------------|--------|-----------------|---------|---------|---------|
  | 3   | Sink Below        | Blue   | Defense Reaction | NF     | —       | CRU050  |

  Then show: "Total: X cards across Y unique entries."

  💡 WORKFLOW:
  Step 1: list_decks (find deck names)
  Step 2: get_deck with the deck name`,

  parameters: {
    type: 'object',
    properties: {
      deckName: {
        type: 'string',
        description: 'The name of the deck to retrieve (case-insensitive match)'
      }
    },
    required: ['deckName']
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();

    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) {
        return { success: false, error: 'Authentication failed: No token was found.' };
      }

      const { deckName } = params;
      if (!deckName) {
        return { success: false, error: 'deckName is required.' };
      }

      // Step 1: list decks to find the publicId matching this name
      const listResponse = await mcpFetch(`${API_BASE_URL}/api/decks?limit=100`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenToUse}` }
      });

      if (!listResponse.ok) {
        return { success: false, error: `Failed to fetch deck list (HTTP ${listResponse.status}).` };
      }

      const listResult = await listResponse.json();
      if (!listResult.success) {
        return { success: false, error: listResult.error || 'Could not load deck list.' };
      }

      const match = (listResult.decks || []).find(
        (d: any) => d.name?.toLowerCase() === deckName.toLowerCase()
      );

      if (!match) {
        const available = (listResult.decks || []).map((d: any) => d.name).join(', ');
        return {
          success: false,
          error: `No deck named "${deckName}" found. Available decks: ${available}`
        };
      }

      // Step 2: fetch deck detail by publicId
      const deckResponse = await mcpFetch(`${API_BASE_URL}/api/decks/${match.publicId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenToUse}` }
      });

      if (!deckResponse.ok) {
        return { success: false, error: `Failed to fetch deck (HTTP ${deckResponse.status}).` };
      }

      const deckResult = await deckResponse.json();
      if (!deckResult.success) {
        return { success: false, error: deckResult.error || 'Could not load deck.' };
      }

      const deck = deckResult.data;
      // Service returns category arrays as top-level properties (not nested under .categories)
      const categories: Record<string, any[]> = {
        hero: deck.hero || [],
        equipment: deck.equipment || [],
        maindeck: deck.maindeck || [],
        sideboard: deck.sideboard || [],
        inventory: deck.inventory || [],
        maybeboard: deck.maybeboard || [],
        tokens: deck.tokens || [],
      };

      // Build formatted message grouped by category
      const categoryOrder = ['hero', 'equipment', 'maindeck', 'sideboard', 'inventory', 'maybeboard', 'tokens'];
      const categoryLabels: Record<string, string> = {
        hero: 'Hero',
        equipment: 'Equipment',
        maindeck: 'Maindeck',
        sideboard: 'Sideboard',
        inventory: 'Inventory',
        maybeboard: 'Maybeboard',
        tokens: 'Tokens',
      };

      let message = `🃏 **${deck.name}**`;
      if (deck.heroName) message += ` — ${deck.heroName}`;
      if (deck.format) message += ` (${deck.format})`;
      message += '\n\n';
      if (deck.description) message += `📝 ${deck.description}\n\n`;
      if (deck.eventName) {
        message += `🏆 **${deck.eventName}**`;
        if (deck.eventDate) message += ` — ${deck.eventDate}`;
        if (deck.placing) message += ` | ${deck.placing}${['st','nd','rd'][((deck.placing+90)%100-10)%10-1]||'th'} place`;
        message += '\n\n';
      }

      let totalCards = 0;
      let totalUnique = 0;

      for (const cat of categoryOrder) {
        const cards: any[] = categories[cat] || [];
        if (cards.length === 0) continue;

        const catTotal = cards.reduce((s: number, c: any) => s + (c.quantity || 1), 0);
        totalCards += catTotal;
        totalUnique += cards.length;

        message += `**${categoryLabels[cat] || cat}** (${catTotal} cards)\n`;
        message += `| Qty | Name | Color | Types | Foiling | Edition | Card ID |\n`;
        message += `|-----|------|-------|-------|---------|---------|--------|\n`;
        cards.forEach((card: any) => {
          message += `${formatCardLine(card)}\n`;
        });
        message += '\n';
      }

      message += `_Total: ${totalCards} cards across ${totalUnique} unique entries._`;

      return {
        success: true,
        message,
        deck: {
          name: deck.name,
          publicId: deck.publicId,
          heroName: deck.heroName,
          format: deck.format,
          isPublic: deck.isPublic,
          description: deck.description ?? null,
          eventName: deck.eventName ?? null,
          eventDate: deck.eventDate ?? null,
          placing: deck.placing ?? null,
          totalCards,
          categories
        }
      };

    } catch (error) {
      console.error('[GetDeck] Unexpected error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};
