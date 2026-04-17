// app/api/mcp/tool/saveDeckMatchup.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const saveDeckMatchupTool = {
  name: 'save_deck_matchup',
  description: `⚔️ SAVE DECK MATCHUP: Create or update a sideboard plan for a specific opponent hero

  📖 PREREQUISITE: Read resource fab://hero-ids to get the full list of valid heroId values before calling this tool.

  Saves a matchup configuration to a deck: which cards to swap in/out against a specific hero,
  preferred turn order, and strategy notes.

  Use heroId "core" for a special baseline/stripped-down list configuration (no specific opponent).
  Use heroId "aggro", "fatigue", "combo", or "midrange" for archetype/strategy-based matchup plans.

  💡 WORKFLOW:
  Step 1: get_deck — view the decklist (maindeck cards can go in "out", inventory/sideboard cards go in "in")
  Step 2: save_deck_matchup — save the sideboard plan

  📦 HERO IDs use Talishar format (lowercase, underscores):
  Examples: "briar_warden_of_thorns", "fai_rising_rebellion", "iyslander_stormbind"
  Special:  "core" — baseline list (no opponent hero)
            "aggro", "fatigue", "combo", "midrange" — archetype matchup plans

  📖 EXAMPLE:
  {
    deckName: "My Deck",
    heroId: "briar_warden_of_thorns",
    preferredTurnOrder: "Second",
    notes: "Defend early aggression, watch for Embodiment of Earth",
    sideboardIn: ["unmovable_red", "unmovable_red"],
    sideboardOut: ["pummel_red", "pummel_yellow"]
  }

  ⚠️ CRITICAL — sideboardIn and sideboardOut MUST be arrays of card ID strings, NOT prose text:
  ✅ CORRECT:   sideboardOut: ["pummel_red", "pummel_yellow"]
  ❌ WRONG:     sideboardOut: "-1x Pummel (red), -1x Pummel (yellow)"   ← never do this
  ❌ WRONG:     notes: "-2x Pummel, +1x Sink Below"                     ← notes is for strategy text only

  Card IDs use Talishar format: "{card_name}_{pitch_color}"
  e.g. "sink_below_red", "pummel_yellow", "command_and_conquer_blue"
  Non-pitched cards use just the name: "fyendal_spring_tunic"
  Repeat an ID multiple times to include multiple copies: ["pummel_red", "pummel_red"] = 2× Pummel (red)

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
        description: 'Opponent hero in Talishar format (e.g. "briar_warden_of_thorns"), or one of the special strategy identifiers: "core" (baseline list), "aggro", "fatigue", "combo", "midrange"'
      },
      preferredTurnOrder: {
        type: 'string',
        enum: ['First', 'Second', 'NoPreference'],
        description: 'Preferred turn order for this matchup'
      },
      notes: {
        type: 'string',
        description: 'Strategy notes for this matchup (max 500 characters). Plain text only — do NOT put card lists here; use sideboardIn/sideboardOut for card swaps.'
      },
      sideboardIn: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of card IDs to bring IN from inventory (Talishar format). Each element is one copy — repeat to include multiples: ["pummel_red","pummel_red"] = 2 copies. MUST be an array, never a string.'
      },
      sideboardOut: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of card IDs to take OUT of the main deck (Talishar format). Each element is one copy — repeat to include multiples. MUST be an array, never a string.'
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
        heroId: rawHeroId,
        preferredTurnOrder = null,
        notes: rawNotes = null,
        sideboardIn: rawSideboardIn = [],
        sideboardOut: rawSideboardOut = [],
      } = params;

      if (!deckName) return { success: false, error: 'deckName is required.' };
      if (!rawHeroId) return { success: false, error: 'heroId is required.' };

      // Normalize and validate heroId — only lowercase letters, digits, underscores allowed
      const heroId = String(rawHeroId).toLowerCase().trim();
      if (!/^[a-z0-9_]+$/.test(heroId)) {
        return { success: false, error: `Invalid heroId "${rawHeroId}". Use lowercase letters, numbers, and underscores only (e.g. "briar_warden_of_thorns", "aggro").` };
      }

      // Normalize sideboardIn/Out — coerce comma-separated strings into arrays, then sanitize each ID
      const normalizeCardList = (raw: unknown): string[] => {
        if (typeof raw === 'string' && raw.trim()) {
          return raw.split(',').map(s => s.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')).filter(Boolean);
        }
        if (Array.isArray(raw)) {
          return raw.map(s => String(s).trim().toLowerCase().replace(/[^a-z0-9_]/g, '')).filter(Boolean);
        }
        return [];
      };
      const sideboardIn = normalizeCardList(rawSideboardIn);
      const sideboardOut = normalizeCardList(rawSideboardOut);

      // Truncate notes to 500 chars
      const notes = rawNotes ? String(rawNotes).slice(0, 500) : null;

      // Validate valid turn order value
      const validTurnOrders = [null, 'First', 'Second', 'NoPreference'];
      const turnOrder = validTurnOrders.includes(preferredTurnOrder) ? preferredTurnOrder : null;

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

      // Validate publicId is safe before using in URL path
      const publicId = String(deck.publicId || '');
      if (!/^[a-zA-Z0-9_-]+$/.test(publicId)) {
        return { success: false, error: 'Unexpected deck ID format.' };
      }

      const matchupPayload = {
        matchup: {
          heroId,
          preferredTurnOrder: turnOrder,
          notes,
          sideboard: {
            in: sideboardIn,
            out: sideboardOut,
          }
        }
      };

      // Try PUT (update) first, fall back to POST (create)
      const putRes = await mcpFetch(`${API_BASE_URL}/api/decks/${publicId}/matchups/${heroId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenToUse}` },
        body: JSON.stringify(matchupPayload)
      });

      let data = await putRes.json();

      if (!putRes.ok || !data.success) {
        // If not found (404), create it
        if (putRes.status === 404) {
          const postRes = await mcpFetch(`${API_BASE_URL}/api/decks/${publicId}/matchups`, {
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
        publicId,
        heroId,
      };

    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};
