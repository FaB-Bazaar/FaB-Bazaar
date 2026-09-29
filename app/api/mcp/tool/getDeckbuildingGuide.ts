// app/api/mcp/tool/getDeckbuildingGuide.ts
import { printingsService } from '@/lib/services';
import {
  buildDeckbuildingGuide,
  resolveGuideHero,
  GUIDE_FORMATS,
  type GuideHeroCard,
} from '@/lib/deck/deckbuilding-guide';

export const getDeckbuildingGuideTool = {
  name: 'get_deckbuilding_guide',
  description: `📐 DECKBUILDING GUIDE: Call BEFORE building, revising or suggesting cards for a deck.

  Returns the official construction rules for the format (deck size, card pool, copy limit),
  the hero's classes/talents and card text, the class-legality rule, a build method and a
  self-check list. Card names do not tell you what a card does. This guide explains how to
  read the text first.

  No authentication required.

  💡 WORKFLOW: get_deckbuilding_guide → create_deck → search_printings (heroLegal/format;
  text is included) → add_cards_to_deck → get_deck({ includeText: true }) to verify.`,

  parameters: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: [...GUIDE_FORMATS],
        description: 'Deck format (same values as create_deck).',
      },
      heroName: {
        type: 'string',
        description: 'Optional hero, lowercase canonical name as in create_deck (e.g. "dorinthea ironsong" for CC, "dorinthea" for Blitz/Silver Age).',
      },
    },
    required: ['format'],
  },

  async handler(params: { format?: string; heroName?: string }) {
    const format = params.format ?? '';
    const hero = params.heroName ? resolveGuideHero(params.heroName) : null;

    let heroCard: GuideHeroCard | null = null;
    if (hero?.info.cardUniqueId) {
      try {
        const res = await printingsService.searchPrintings(
          { cardUniqueId: hero.info.cardUniqueId },
          { limit: 1 },
        );
        const p = res.success ? res.data.printings[0] : undefined;
        if (p) heroCard = { text: p.text, health: p.health ?? null };
      } catch (error) {
        // The guide still works without the card — it tells the agent to read it.
        console.error('[get_deckbuilding_guide] hero card lookup failed:', error);
      }
    }

    const result = buildDeckbuildingGuide({ format, heroName: params.heroName, heroCard });
    if (!result.ok) return { success: false as const, error: result.error };
    return { success: true as const, message: result.text };
  },
};
