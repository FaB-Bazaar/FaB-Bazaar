// app/api/mcp/tool/updateDeck.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

export const updateDeckTool = {
  name: 'update_deck',
  description: `✏️ UPDATE DECK: Rename a deck or change its metadata

  Updates deck-level settings like name, format, visibility, or notes.
  Does NOT change the cards in the deck — use add_cards_to_deck / remove_cards_from_deck for that.

  💡 WORKFLOW:
  Step 1: list_decks — find the deck name
  Step 2: update_deck — change whatever you need

  📖 EXAMPLES:
  Rename:      deckName: "Old Name", updates: { name: "New Name" }
  Make public: deckName: "My Deck", updates: { isPublic: true }
  Deck to Beat: deckName: "My Deck", updates: { isPublic: true, isSystemDeck: true, featured: true }  (superadmin only — isSystemDeck and featured are independent; both are required to actually appear on the Decks to Beat page)
  Add desc:    deckName: "My Deck", updates: { description: "Tournament deck for Spring 2026" }
  Set event:   deckName: "My Deck", updates: { eventName: "Pro Tour Indianapolis", eventDate: "2026-03-15", placing: 1 }
  Move to folder: deckName: "My Deck", updates: { folder: "Physical decks" }   (folder: "" or null = remove from folder)`,

  parameters: {
    type: 'object',
    properties: {
      deckName: {
        type: 'string',
        description: 'Current name of the deck to update (case-insensitive match)'
      },
      updates: {
        type: 'object',
        description: 'Fields to update on the deck',
        properties: {
          name: {
            type: 'string',
            description: 'New name for the deck'
          },
          format: {
            type: 'string',
            description: 'New format (e.g. "Classic Constructed", "Blitz", "Commoner")'
          },
          isPublic: {
            type: 'boolean',
            description: 'Whether the deck is publicly visible'
          },
          isSystemDeck: {
            type: 'boolean',
            description: 'Superadmin only. Flag (true) or unflag (false) — hides the deck from your personal views (navbar, decks page, Discord, Talishar sync). Independent of `featured`: this alone does NOT make the deck appear on the Decks to Beat page. Routed through the superadmin-only /featured endpoint; non-superadmins receive a 403. Pair with isPublic: true since Decks to Beat are public.'
          },
          featured: {
            type: 'boolean',
            description: 'Superadmin only. Flag (true) or unflag (false) — surfaces the deck on the "Decks to Beat" page. Independent of isSystemDeck; set both true for a normal Decks to Beat entry. Routed through the superadmin-only /featured endpoint; non-superadmins receive a 403. Pair with isPublic: true since Decks to Beat are public.'
          },
          description: {
            type: 'string',
            description: 'Deck description shown on the deck card (max 500 chars)'
          },
          eventName: {
            type: 'string',
            description: 'Tournament/event name (e.g. "Pro Tour Indianapolis", "Battle Hardened Sydney")'
          },
          eventDate: {
            type: 'string',
            description: 'Event date in ISO format (YYYY-MM-DD). Drives the Decks to Beat month filter.'
          },
          placing: {
            type: 'number',
            description: 'Finishing position at the event (1 = 1st place, 2 = 2nd, etc.)'
          },
          folder: {
            type: 'string',
            description: 'User-defined folder label to organize the deck on the /decks page (free-form, e.g. "Physical decks", "Brewing"; max 60 chars). Empty string or null removes it from any folder. Reuse an existing folder name from list_decks to group decks together.'
          }
        }
      }
    },
    required: ['deckName', 'updates']
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();

    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) {
        return { success: false, error: 'Authentication failed: No token found.' };
      }

      const { deckName } = params;
      let updates = params.updates;
      if (typeof updates === 'string') {
        try { updates = JSON.parse(updates); } catch { return { success: false, error: 'updates must be a valid JSON object.' }; }
      }
      if (!deckName) return { success: false, error: 'deckName is required.' };
      if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) return { success: false, error: 'updates object must not be empty.' };

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

      // isSystemDeck and featured are superadmin-gated and live on a separate
      // endpoint — the generic update route ignores them. They're independent
      // flags (isSystemDeck alone won't surface a deck on Decks to Beat; that's
      // what featured does). Split both out so the rest of the metadata goes
      // to the standard PATCH.
      const { isSystemDeck, featured, ...metadataUpdates } = updates;

      // Update deck metadata (skip if isSystemDeck was the only field provided)
      if (Object.keys(metadataUpdates).length > 0) {
        const res = await mcpFetch(`${API_BASE_URL}/api/decks/${deck.publicId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenToUse}` },
          body: JSON.stringify(metadataUpdates)
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          return { success: false, error: data.error || `Failed to update deck (HTTP ${res.status}).` };
        }
      }

      // Toggle isSystemDeck and/or featured via the superadmin-only endpoint.
      if (isSystemDeck !== undefined || featured !== undefined) {
        const featBody: Record<string, boolean> = {};
        if (isSystemDeck !== undefined) featBody.isSystemDeck = isSystemDeck;
        if (featured !== undefined) featBody.featured = featured;

        const featRes = await mcpFetch(`${API_BASE_URL}/api/decks/${deck.publicId}/featured`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenToUse}` },
          body: JSON.stringify(featBody)
        });
        const featData = await featRes.json().catch(() => ({}));
        if (!featRes.ok || !featData.success) {
          return { success: false, error: featData.error || `Failed to set Deck to Beat flag (HTTP ${featRes.status}).` };
        }
      }

      const changed = Object.entries(updates).map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`).join('\n');
      return {
        success: true,
        message: `Updated deck "${deckName}":\n${changed}`,
        publicId: deck.publicId,
        updatedFields: Object.keys(updates),
      };

    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  }
};
