/**
 * Filter model for the deck editor's mobile Cards tab.
 *
 * The curated starter kits are ONE source filter — the default when the hero
 * has kits — rather than a separate mode: `kits` scopes every search to the
 * kits' printings, `all` searches the hero+format-legal pool. Pitch/type chips
 * apply in both sources. Pure so the scoping rules stay unit-testable.
 */
import { TYPE_CHIPS, GENERIC_CHIP } from '@/lib/search/card-filter-chips';

export interface MobileSearchFilterState {
  source: 'kits' | 'all';
  /** Multi-select pitch (1 red / 2 yellow / 3 blue). */
  pitches: number[];
  /** TYPE_CHIPS value ('attack', 'non-attack-action', …), GENERIC_CHIP's 'generic', or null. */
  type: string | null;
}

export function hasChipFilters(state: MobileSearchFilterState): boolean {
  return state.pitches.length > 0 || state.type !== null;
}

/** The curated kit-browse grid shows only for the untouched default state. */
export function isKitBrowse(state: MobileSearchFilterState, query: string, hasKits: boolean): boolean {
  return hasKits && state.source === 'kits' && !query.trim() && !hasChipFilters(state);
}

export function buildMobileSearchFilters(opts: {
  state: MobileSearchFilterState;
  // `filters` is whatever the shorthand parser produced (PrintingsSearchFilters
  // has no index signature, so a plain object type keeps callers cast-free).
  parsed: { filters: object; nameText: string };
  kitPrintingIds: string[];
  heroFilter: { heroClasses: string[]; heroTalents: string[]; heroEssences: string[] } | null;
  formatCode?: string;
}): Record<string, unknown> {
  const { state, parsed, kitPrintingIds, heroFilter, formatCode } = opts;
  const f: Record<string, unknown> = { ...parsed.filters };
  if (parsed.nameText.trim()) f.name = parsed.nameText.trim();

  if (state.pitches.length > 0) f.pitch = state.pitches;
  if (state.type) {
    if (state.type === GENERIC_CHIP.value) {
      f.isGenericOnly = true;
    } else {
      const chip = TYPE_CHIPS.find((c) => c.value === state.type);
      if (chip) f.types = [chip.apiType];
    }
  }

  if (state.source === 'kits') {
    // The kit pool is already curated for this hero — printingIds is the
    // whole scope; hero/format constraints could only wrongly exclude rows.
    f.printingIds = kitPrintingIds;
  } else {
    if (heroFilter) {
      f.heroClasses = heroFilter.heroClasses;
      f.heroTalents = heroFilter.heroTalents;
      if (heroFilter.heroEssences.length > 0) f.heroEssences = heroFilter.heroEssences;
    }
    if (formatCode) f.format = formatCode;
  }

  f.isHero = false;
  return f;
}
