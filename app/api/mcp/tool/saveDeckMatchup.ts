// app/api/mcp/tool/saveDeckMatchup.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const saveDeckMatchupTool = {
  name: 'save_deck_matchup',
  description: `⚔️ SAVE DECK MATCHUP: Create or update a sideboard plan for a specific opponent hero

  Saves a matchup configuration to a deck: which cards to swap in/out against a specific hero,
  preferred turn order, and strategy notes.

  Use heroId "core" for a special baseline/stripped-down list configuration (no specific opponent).

  💡 WORKFLOW:
  Step 1: get_deck — view the decklist (maindeck cards can go in "out", inventory/sideboard cards go in "in")
  Step 2: save_deck_matchup — save the sideboard plan

  📦 HERO IDs use Talishar format (lowercase, underscores):
  Examples: "briar_warden_of_thorns", "fai_rising_rebellion", "iyslander_stormbind"
  Special:  "core" — baseline list (no opponent hero)

  📖 EXAMPLE:
  {
    deckName: "My Deck",
    heroId: "briar_warden_of_thorns",
    preferredTurnOrder: "Second",
    notes: "Defend early aggression, watch for Embodiment of Earth",
    sideboardIn: ["unmovable_red", "unmovable_red"],
    sideboardOut: ["pummel_red", "pummel_yellow"]
  }

  ⚠️ Card IDs in sideboardIn/Out use Talishar format: "{card_name}_{pitch_color}"
  e.g. "sink_below_red", "pummel_yellow", "command_and_conquer_blue"
  Non-pitched cards use just the name: "fyendal_spring_tunic"

  If a matchup for this heroId already exists it will be updated (not duplicated).`,

  parameters: {
    type: 'object',
    properties: {
      deckName: {
        type: 'string',
        description: 'Name of the deck (case-insensitive match)'
      },
      heroId: {
        type: 'string',
        description: 'Opponent hero in Talishar format, or "core" for the baseline list'
      },
      preferredTurnOrder: {
        type: 'string',
        enum: ['First', 'Second', 'NoPreference'],
        description: 'Preferred turn order for this matchup'
      },
      notes: {
        type: 'string',
        description: 'Strategy notes for this matchup (max 500 characters)'
      },
      sideboardIn: {
        type: 'array',
        items: { type: 'string' },
        description: 'Card IDs to bring in from inventory/sideboard (Talishar format)'
      },
      sideboardOut: {
        type: 'array',
        items: { type: 'string' },
        description: 'Card IDs to take out of the main deck (Talishar format)'
      }
    },
    required: ['deckName', 'heroId']
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();

    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) {
        return { success: false, error: 'Authentication failed: No token found.' };
      }

      const {
        deckName,
        heroId,
        preferredTurnOrder = null,
        notes = null,
        sideboardIn = [],
        sideboardOut = [],
      } = params;

      if (!deckName) return { success: false, error: 'deckName is required.' };
      if (!heroId) return { success: false, error: 'heroId is required.' };

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

      const matchupPayload = {
        matchup: {
          heroId,
          preferredTurnOrder: preferredTurnOrder || null,
          notes: notes || null,
          sideboard: {
            in: sideboardIn,
            out: sideboardOut,
          }
        }
      };

      // Try PUT (update) first, fall back to POST (create)
      const putRes = await mcpFetch(`${API_BASE_URL}/api/decks/${deck.publicId}/matchups/${heroId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenToUse}` },
        body: JSON.stringify(matchupPayload)
      });

      let data = await putRes.json();

      if (!putRes.ok || !data.success) {
        // If not found (404), create it
        if (putRes.status === 404) {
          const postRes = await mcpFetch(`${API_BASE_URL}/api/decks/${deck.publicId}/matchups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenToUse}` },
            body: JSON.stringify(matchupPayload)
          });
          data = await postRes.json();
          if (!postRes.ok || !data.success) {
            return { success: false, error: data.error || `Failed to create matchup (HTTP ${postRes.status}).` };
          }
        } else {
          return { success: false, error: data.error || `Failed to save matchup (HTTP ${putRes.status}).` };
        }
      }

      const heroLabel = heroId === 'core' ? 'Core (Baseline)' : heroId;
      const swapSummary = sideboardIn.length > 0 || sideboardOut.length > 0
        ? `${sideboardOut.length} out, ${sideboardIn.length} in`
        : 'no sideboard changes';

      return {
        success: true,
        message: `Saved matchup for "${heroLabel}" on deck "${deck.name}" (${swapSummary})${notes ? `\nNotes: ${notes}` : ''}`,
        deckName: deck.name,
        publicId: deck.publicId,
        heroId,
      };

    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};
