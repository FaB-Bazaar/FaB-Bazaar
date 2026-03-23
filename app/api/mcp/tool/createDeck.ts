// app/api/mcp/tool/createDeck.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';

const VALID_FORMATS = [
  'Classic Constructed',
  'Silver Age',
  'Blitz',
  'Commoner',
  'Living Legend',
  'Limited',
  'Ultimate Pit Fight',
  'Casual',
] as const;

const VALID_VISIBILITIES = ['private', 'unlisted', 'public'] as const;

export const createDeckTool = {
  name: 'create_deck',
  description: `🆕 CREATE DECK: Create a new empty deck with a name, format, and visibility.

  Creates a deck for the authenticated user. After creation, use add_cards_to_deck to populate it.

  📋 REQUIRED:
  - name: deck name (e.g. "Fai Aggro")
  - format: must be one of the exact enum values below

  🔒 VISIBILITY (default: unlisted):
  - "private"   — only you can see it
  - "unlisted"  — anyone with the link can view, not listed publicly
  - "public"    — visible in community decks

  🎯 FORMATS (exact values required):
  Classic Constructed | Silver Age | Blitz | Commoner | Living Legend | Limited | Ultimate Pit Fight | Casual

  🦸 HERO (optional):
  - heroPrintingId: use search_printings to find the hero's printingId
  - If provided, the hero card is automatically added to the hero slot

  💡 WORKFLOW:
  Step 1: (optional) search_printings — find your hero's printingId
  Step 2: create_deck — create the deck
  Step 3: add_cards_to_deck — add your cards`,

  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name for the new deck (e.g. "Fai Aggro", "Dorinthea Control")',
      },
      format: {
        type: 'string',
        enum: [...VALID_FORMATS],
        description: 'Game format — must be an exact enum value: Classic Constructed | Silver Age | Blitz | Commoner | Living Legend | Limited | Ultimate Pit Fight | Casual',
      },
      visibility: {
        type: 'string',
        enum: [...VALID_VISIBILITIES],
        default: 'unlisted',
        description: 'Who can see the deck. "private" = only you, "unlisted" = link-only, "public" = community listing. Defaults to "unlisted".',
      },
      description: {
        type: 'string',
        description: 'Optional deck description or notes',
      },
      heroPrintingId: {
        type: 'string',
        description: 'Optional printing ID of the hero card to add (from search_printings results)',
      },
    },
    required: ['name', 'format'],
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();

    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) {
        return { success: false, error: 'Authentication failed: No token found.' };
      }

      const { name, format, visibility, description, heroPrintingId } = params;

      if (!name?.trim()) {
        return { success: false, error: 'name is required and cannot be empty.' };
      }

      if (!VALID_FORMATS.includes(format)) {
        return {
          success: false,
          error: `Invalid format "${format}". Must be one of: ${VALID_FORMATS.join(', ')}`,
        };
      }

      if (visibility && !VALID_VISIBILITIES.includes(visibility)) {
        return {
          success: false,
          error: `Invalid visibility "${visibility}". Must be one of: ${VALID_VISIBILITIES.join(', ')}`,
        };
      }

      const body: Record<string, string> = {
        name: name.trim(),
        format,
        visibility: visibility || 'unlisted',
      };
      if (description?.trim()) body.description = description.trim();
      if (heroPrintingId?.trim()) body.heroPrintingId = heroPrintingId.trim();

      const res = await mcpFetch(`${API_BASE_URL}/api/decks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenToUse}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) {
        return { success: false, error: data.error || 'Failed to create deck.' };
      }

      const deck = data.data;
      return {
        success: true,
        message: `Deck "${deck.name}" created (${deck.format}, ${deck.visibility}).${heroPrintingId ? ' Hero card added.' : ''} Use add_cards_to_deck to populate it.`,
        publicId: deck.publicId,
        name: deck.name,
        format: deck.format,
        visibility: deck.visibility,
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  },
};
