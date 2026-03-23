// app/api/mcp/tool/createDeck.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';
import { printingsService } from '@/lib/services';
import { sortPrintings } from '@/lib/fab-constants/sets';
import { isHeroLivingLegend } from '@/lib/fab-banned-cards';

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
  description: `🆕 CREATE DECK: Create a new deck with a name, format, and hero.

  📋 REQUIRED (always ask for all three together):
  - name: deck name (e.g. "Fai Aggro")
  - format: exact enum value — see formats below
  - heroName: hero card name
    • CC / Living Legend: use the full adult name  (e.g. "Fai, Rising Rebellion")
    • Silver Age / Blitz: use the short young name (e.g. "Fai")

  🎯 FORMATS (exact values required):
  Classic Constructed | Silver Age | Blitz | Commoner | Living Legend | Limited | Ultimate Pit Fight | Casual

  🔒 VISIBILITY (default: unlisted):
  - "private"   — only you can see it
  - "unlisted"  — anyone with the link can view, not listed publicly
  - "public"    — visible in community decks

  💡 WORKFLOW:
  Step 1: create_deck — name + format + heroName (all three at once)
  Step 2: add_cards_to_deck — add all cards by cardName + pitch`,

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
      heroName: {
        type: 'string',
        description: 'Hero card name. For CC use the full adult name (e.g. "Fai, Rising Rebellion"). For Silver Age / Blitz use the short young name (e.g. "Fai"). Auto-resolves to the correct legal printing.',
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
        description: 'Optional explicit printing ID override (from search_printings). Use instead of heroName when a specific printing matters.',
      },
    },
    required: ['name', 'format', 'heroName'],
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    const API_BASE_URL = getMcpApiBaseUrl();

    try {
      const tokenToUse = authenticatedUser?.mcpToken || token;
      if (!tokenToUse) {
        return { success: false, error: 'Authentication failed: No token found.' };
      }

      const { name, format, visibility, description, heroPrintingId: explicitId, heroName } = params;

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

      // Resolve hero name → printingId
      let heroPrintingId: string | undefined = explicitId?.trim() || undefined;

      if (!heroPrintingId && heroName?.trim()) {
        const result = await printingsService.searchPrintings(
          { name: heroName.trim(), exact: true },
          { limit: 50 }
        );

        if (!result.success || !(result.data as any[])?.length) {
          return { success: false, error: `Hero "${heroName}" not found. Check the spelling or use heroPrintingId instead.` };
        }

        const isBlitzOrSA = ['Blitz', 'Silver Age'].includes(format);
        const legalityField = isBlitzOrSA ? 'blitz_legal' : 'cc_legal';

        const eligible = (result.data as any[]).filter((p: any) => {
          if (!p[legalityField]) return false;
          if (p.card_unique_id && isHeroLivingLegend(p.card_unique_id, format)) return false;
          return true;
        });

        if (!eligible.length) {
          return { success: false, error: `Hero "${heroName}" has no legal printing in ${format} (may be Living Legend status).` };
        }

        heroPrintingId = sortPrintings(eligible)[0].printing_id;
      }

      const body: Record<string, string> = {
        name: name.trim(),
        format,
        visibility: visibility || 'unlisted',
      };
      if (description?.trim()) body.description = description.trim();
      if (heroPrintingId) body.heroPrintingId = heroPrintingId;

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
      const heroLabel = heroName?.trim() || (heroPrintingId ? `printing ${heroPrintingId}` : 'no hero');
      return {
        success: true,
        message: `Deck "${deck.name}" created (${deck.format}, ${deck.visibility}). Hero: ${heroLabel}. Use add_cards_to_deck to populate it.`,
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
