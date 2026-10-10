/**
 * Filter builder for the deck-builder Add Card dialog: the /opt UI state
 * (OptUiState) plus deck legality context → structured server filters.
 *
 * Legality (heroClasses/heroTalents/heroEssences + deck format) is baked into
 * every search; the target zone forces types for the hero/equipment pickers.
 * The UI's selectedFormat is deliberately ignored — the deck's format is the
 * only format source, so no chip can add or clear it.
 */

import { buildServerFilters } from '@/lib/search/build-server-filters';
import { getApiFormatCode } from '@/lib/format-constants';
import type { OptUiState } from '@/lib/search/opt-url-state';
import type { HeroFilter } from '@/lib/deck/resolve-hero-filter';
import type { PrintingsSearchFilters } from '@/lib/services/contracts/IPrintingsService';
import type { DeckCategory } from '@/lib/services/contracts/IDeckService';

export interface DeckAddContext {
  /** null = no hero context (no hero set, or the curation dialog) → no legality filter. */
  hero: HeroFilter | null;
  /** Deck format display name (e.g. "Classic Constructed"); unknown names are omitted. */
  deckFormat?: string;
  targetCategory: DeckCategory;
  /** Deck hero's full name — other heroes' specialization cards drop out. */
  heroName?: string;
}

export function buildDeckAddFilters(
  state: OptUiState,
  debouncedQuery: string,
  ctx: DeckAddContext,
): PrintingsSearchFilters {
  const f = buildServerFilters({
    ...state,
    query: debouncedQuery,
    selectedTcgGroups: [],
    selectedFormat: null,
  });

  if (ctx.targetCategory === 'hero') {
    // Hero picker: list heroes only, unrestricted by the current hero's pool.
    f.types = ['hero'];
    delete f.subtypes;
    delete f.heroClasses;
    delete f.heroTalents;
    delete f.heroEssences;
  } else {
    if (ctx.targetCategory === 'equipment') f.types = ['equipment', 'weapon'];
    if (ctx.heroName) f.specializationHero = ctx.heroName;
    if (ctx.hero) {
      if (ctx.hero.heroClasses.length) f.heroClasses = ctx.hero.heroClasses;
      if (ctx.hero.heroTalents.length) f.heroTalents = ctx.hero.heroTalents;
      if (ctx.hero.heroEssences.length) f.heroEssences = ctx.hero.heroEssences;
    }
  }

  const formatCode = getApiFormatCode(ctx.deckFormat);
  if (formatCode) f.format = formatCode as PrintingsSearchFilters['format'];

  // A double-faced back (Bank Breaker, Viserai, Usurper) isn't a deck card —
  // Talishar validates the front. Only alongside a real filter, so an empty
  // object still means "nothing to search" and the dialog idles.
  if (Object.keys(f).length) f.frontFaceOnly = true;

  return f;
}
