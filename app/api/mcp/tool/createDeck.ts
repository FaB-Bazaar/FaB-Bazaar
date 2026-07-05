// app/api/mcp/tool/createDeck.ts
import { mcpFetch, getMcpApiBaseUrl } from '@/lib/mcp-fetch';
import { printingsService, bannedCardsService } from '@/lib/services';
import { sortPrintings } from '@/lib/fab-constants/sets';
import type { BannedFormat } from '@/lib/services/contracts/IBannedCardsService';

// Maps deck format display names to banned_cards registry format keys.
// Returns null for formats that don't have a registry entry (Limited, Casual).
function toRegistryFormat(format: string): BannedFormat | null {
  switch (format) {
    case 'Classic Constructed': return 'classic_constructed';
    case 'Blitz': return 'blitz';
    case 'Silver Age': return 'silver_age';
    case 'Living Legend': return 'living_legend';
    case 'Commoner': return 'commoner';
    default: return null;
  }
}
import { HERO_INFO, YOUNG_HERO_INFO } from '@/lib/fab-constants';
import { validateHeroFormatLegality } from '@/lib/fab-constants/heroes';

// Map create_deck's display-name format to the snake_case key used by
// validateHeroFormatLegality (e.g. "Silver Age" → "silver_age").
function formatToSnake(format: string): string | undefined {
  switch (format) {
    case 'Silver Age': return 'silver_age';
    case 'Blitz': return 'blitz';
    case 'Commoner': return 'commoner';
    case 'Classic Constructed': return 'cc';
    case 'Living Legend': return 'll';
    default: return undefined;
  }
}
import { CURATED_GENERICS } from '@/app/api/mcp/resource/cardIndex';

const ALL_HERO_NAMES = [...new Set([
  ...Object.keys(HERO_INFO),
  ...Object.keys(YOUNG_HERO_INFO),
])].sort() as string[];

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
  - heroName: pick from enum values (all lowercase)
    • CC / Living Legend: adult name  (e.g. "fai, rising rebellion")
    • Silver Age / Blitz: young name  (e.g. "fai")

  🎯 FORMATS (exact values required):
  Classic Constructed | Silver Age | Blitz | Commoner | Living Legend | Limited | Ultimate Pit Fight | Casual

  🔒 VISIBILITY (default: unlisted):
  - "private"   — only you can see it
  - "unlisted"  — anyone with the link can view, not listed publicly
  - "public"    — visible in community decks

  🏆 DECKS TO BEAT (superadmin only):
  - isSystemDeck and featured are TWO INDEPENDENT flags — pass BOTH as true to
    actually publish a Decks to Beat entry. isSystemDeck alone only hides the
    deck from your personal views (navbar, decks page, Discord, Talishar sync);
    it does NOT make the deck show up on the Decks to Beat page. featured alone
    (without isSystemDeck) still surfaces it but leaves it in your personal
    deck list too. Both force public visibility. Non-superadmins get a 403.

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
        enum: ALL_HERO_NAMES,
        description: 'Hero name — pick from enum. CC/LL: use adult name (e.g. "fai, rising rebellion"). Silver Age/Blitz: use young name (e.g. "fai").',
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
      isSystemDeck: {
        type: 'boolean',
        description: 'Superadmin only. Hides the deck from your personal views (navbar, decks page, Discord, Talishar sync) and forces public visibility. Independent of `featured` — set featured: true too if this should actually appear on the Decks to Beat page. Non-superadmins receive a 403.',
      },
      featured: {
        type: 'boolean',
        description: 'Superadmin only. Surfaces the deck on the "Decks to Beat" page (forces public visibility). Independent of isSystemDeck. Pass both isSystemDeck: true and featured: true together for a normal Decks to Beat entry. Non-superadmins receive a 403.',
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

      const { name, format, visibility, description, heroPrintingId: explicitId, heroName, isSystemDeck, featured } = params;

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

      // Hero/format mismatch guardrail — reject combos like adult-hero +
      // Silver Age or young-hero + Classic Constructed before any DB work.
      // Skipped for free-form formats (Limited / Casual / Ultimate Pit Fight).
      if (heroName?.trim()) {
        const formatSnake = formatToSnake(format);
        if (formatSnake) {
          const check = validateHeroFormatLegality(heroName.trim(), formatSnake);
          if (!check.ok) {
            return { success: false, error: check.error };
          }
        }
      }

      // Resolve hero name → printingId
      let heroPrintingId: string | undefined = explicitId?.trim() || undefined;

      if (!heroPrintingId && heroName?.trim()) {
        // Fast path: static map lookup (no DB call)
        const mapKey = `${heroName.trim().toLowerCase()}|0`;
        heroPrintingId = CURATED_GENERICS[mapKey];

        // Slow path: DB search fallback for heroes not yet in the static map
        if (!heroPrintingId) {
          const result = await printingsService.searchPrintings(
            { name: heroName.trim(), exact: true },
            { limit: 50 }
          );

          if (!result.success || !(result.data as any[])?.length) {
            return { success: false, error: `Hero "${heroName}" not found. Check the spelling or use heroPrintingId instead.` };
          }

          const legalityField =
            format === 'Silver Age' ? 'silver_age_legal' :
            format === 'Blitz' ? 'blitz_legal' :
            'cc_legal';

          // Pre-fetch the banned hero set from the registry once so the filter
          // stays synchronous. Sourcing from banned_cards keeps this consistent
          // with the deck-builder search and admin toggles.
          const registryFormat = toRegistryFormat(format);
          const bannedHeroIds = new Set<string>();
          if (registryFormat) {
            const bannedRes = await bannedCardsService.listExcludedHeroes(registryFormat);
            if (bannedRes.success) {
              for (const h of bannedRes.data) bannedHeroIds.add(h.cardUniqueId);
            }
          }

          const eligible = (result.data as any[]).filter((p: any) => {
            if (!p[legalityField]) return false;
            if (p.card_unique_id && bannedHeroIds.has(p.card_unique_id)) return false;
            return true;
          });

          if (!eligible.length) {
            return { success: false, error: `Hero "${heroName}" has no legal printing in ${format}.` };
          }

          heroPrintingId = sortPrintings(eligible)[0].printing_id;
        }
      }

      // "Decks to Beat" must be public — default to public when flagging a
      // system deck or featuring it, unless an explicit visibility was provided.
      const effectiveVisibility = visibility || (isSystemDeck || featured ? 'public' : 'unlisted');

      const body: Record<string, string> = {
        name: name.trim(),
        format,
        visibility: effectiveVisibility,
      };
      if (description?.trim()) body.description = description.trim();
      if (heroName?.trim()) body.hero = heroName.trim();
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

      // Flag isSystemDeck and/or featured. Both are gated to superadmins by
      // the /featured endpoint, so a non-superadmin caller gets a 403 here.
      // They're independent flags — isSystemDeck alone won't surface the deck
      // on the Decks to Beat page; featured is what does that.
      if (isSystemDeck || featured !== undefined) {
        const featBody: Record<string, boolean> = {};
        if (isSystemDeck !== undefined) featBody.isSystemDeck = isSystemDeck;
        if (featured !== undefined) featBody.featured = featured;

        const featRes = await mcpFetch(`${API_BASE_URL}/api/decks/${deck.publicId}/featured`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenToUse}`,
          },
          body: JSON.stringify(featBody),
        });
        const featData = await featRes.json().catch(() => ({}));
        if (!featRes.ok || !featData.success) {
          return {
            success: false,
            error: `Deck "${deck.name}" was created (${deck.visibility}) but could not be flagged: ${featData.error || `HTTP ${featRes.status}`}. Flag it via the UI, or retry with a superadmin token.`,
            publicId: deck.publicId,
          };
        }
      }

      const flagLabel = [isSystemDeck && 'system deck', featured && 'Decks to Beat'].filter(Boolean).join(' + ');

      return {
        success: true,
        message: `Deck "${deck.name}" created (${deck.format}, ${deck.visibility}${flagLabel ? `, ${flagLabel}` : ''}). Hero: ${heroLabel}. Use add_cards_to_deck to populate it.`,
        publicId: deck.publicId,
        name: deck.name,
        format: deck.format,
        visibility: deck.visibility,
        isSystemDeck: isSystemDeck === true,
        featured: featured === true,
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
    }
  },
};
