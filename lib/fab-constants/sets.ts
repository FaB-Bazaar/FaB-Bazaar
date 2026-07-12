// lib/fab-constants/sets.ts
// Set codes, names, and metadata including release dates

// SET_MAP and SET_METADATA are GENERATED from the `sets` database table
// (source of truth; migration 0061). To add a set or fix metadata, update
// the table and run: npx tsx --env-file=.env.local scripts/generate-set-constants.ts
import { SET_MAP, SET_METADATA } from './sets-data.generated';
export { SET_MAP, SET_METADATA };

export type SetCode = keyof typeof SET_MAP;

/**
 * Ordered list of set codes shown in binder, search, wants, collection, and
 * deck-builder filter chips. Newest first by release date — matches the
 * `/sets` landing page ordering. Update this single list when new sets ship —
 * every filter component reads from it.
 */
export const CARD_FILTER_SETS = [
  'omn', 'pen', 'anq', 'sup', 'mpg', 'sea', 'hnt', 'ros', 'mst', 'hvy',
  'evo', 'dtd', 'out', 'dyn', 'upr', '1hp', 'evr', 'ele', 'mon', 'cru', 'arc', 'wtr',
] as const;

export type CardFilterSet = typeof CARD_FILTER_SETS[number];

/**
 * Common community/legacy set-code spellings → the canonical DB code.
 * History Pack reprints are written "1HP"/"2HP" in the DB, but trade posts and
 * older docs say "HP1"/"HP2" (and the MCP constants resource historically did
 * too). Normalize so either form resolves instead of returning 0 results.
 */
export const SET_CODE_ALIASES: Record<string, string> = {
  hp1: '1hp',
  hp2: '2hp',
};

/** Lowercase a set code and map known aliases (e.g. hp1 → 1hp) to the DB code. */
export function normalizeSetCode(code: string): string {
  const lc = code.trim().toLowerCase();
  return SET_CODE_ALIASES[lc] ?? lc;
}

// Set metadata including release dates
export interface SetMetadata {
  code: string;
  name: string;
  releaseDate: string; // YYYY-MM-DD format
  hasFirstEdition: boolean;
  category: 'standard' | 'armory' | 'non-standard' | 'excluded';
  defaultRarity?: string;
  /**
   * Printing display tier — coarse product grouping.
   * 1 = main booster sets (WTR, MON, OUT, SEA…)
   * 2 = standalone supplemental products (History Pack, Compendium, Antiquity…)
   * 3 = blitz / hero decks
   * 4 = armory decks
   * 5 = promos / non-standard
   */
  tier: 1 | 2 | 3 | 4 | 5;
  /**
   * Curated printing-display ranking (lower = earlier) — the set-level sort
   * key for printing carousels/pickers. Stored on the `sets` DB row (seeded
   * tier 1 → 2 → 5 → 3 → 4, release date within tier); curate by updating
   * the row and regenerating this snapshot.
   */
  displayOrder: number;
  /**
   * Sets where unlimited is the common accessible printing and should lead
   * edition ordering (WTR/ARC/CRU/MON/ELE). Stored on the `sets` DB row.
   */
  unlimitedBeforeFirst: boolean;
}


// Explicit ordering for non-standard sets on the /sets page
const NON_STANDARD_ORDER = [
  'tcc', 'smp', 'mpw', 'gem', 'dvr', 'aur',
  'her', 'jdg', 'lgs', 'lss', 'win', 'tnp', 'oxo', 'fab',
];

/**
 * Returns edition sort priority for a given set code. Sets flagged
 * unlimited_before_first on their `sets` DB row (WTR/ARC/CRU/MON/ELE — both
 * editions existed, unlimited is the common accessible printing) lead with
 * unlimited; everyone else alpha → 1st → unlimited → normal.
 */
function getEditionPriority(setCode: string): Record<string, number> {
  if (SET_METADATA[setCode]?.unlimitedBeforeFirst) {
    return { u: 0, a: 1, f: 2, n: 3 };
  }
  return { a: 0, f: 1, u: 2, n: 3 };
}

// Physical-printing language display priority: English first, then the two
// most common localizations, then everything else alphabetically by code.
// A missing language field means English (matches the printings.language
// DB default).
const LANGUAGE_SORT_PRIORITY: Record<string, number> = { en: 0, fr: 1, ja: 2 };

function languageRank(language?: string | null): number {
  const lang = (language || 'en').toLowerCase();
  return LANGUAGE_SORT_PRIORITY[lang] ?? 3;
}

/**
 * Sort a printing array into a consistent, user-friendly order.
 * Primary: language (English → French → Japanese → others) — the first entry
 *          is used as the default printing for imports, and a native English
 *          speaker should never default to a localized printing
 * Then gold foils last regardless of set (tournament-winner prizes)
 * Then within each language (gold foils and Marvels sink last globally —
 * tournament prizes / chase cards are never a sensible default):
 *   set displayOrder — the CURATED ranking stored on the `sets` DB row
 *   (seeded main booster → supplemental → promo → blitz deck → armory,
 *   release date within tier; re-order by updating the row + regenerating)
 *   then within a set, edition-major:
 *     edition (unlimited before 1st for WTR/ARC/CRU/MON, else alpha → 1st →
 *     unlimited → normal) → foiling (non-foil → RF → CF → GF)
 *
 * Works with any printing object that has `set`, `foiling`, `rarity`, and `edition` fields.
 */
export function sortPrintings<T extends { set?: string; foiling?: string; rarity?: string; edition?: string; language?: string | null }>(printings: T[]): T[] {
  return [...printings].sort((a, b) => {
    // 0. Language — English first, unknown languages grouped alphabetically
    const aLangRank = languageRank(a.language);
    const bLangRank = languageRank(b.language);
    if (aLangRank !== bLangRank) return aLangRank - bLangRank;
    if (aLangRank === 3) {
      const langCompare = (a.language || '').toLowerCase().localeCompare((b.language || '').toLowerCase());
      if (langCompare !== 0) return langCompare;
    }

    // 0b. Gold foils last regardless of set — tournament-winner prizes,
    // effectively unacquirable, never a sensible default
    const aGold = (a.foiling || '').toLowerCase() === 'g' ? 1 : 0;
    const bGold = (b.foiling || '').toLowerCase() === 'g' ? 1 : 0;
    if (aGold !== bGold) return aGold - bGold;

    // 0c. Marvels (rarity 'v') last regardless of set — chase cards; a card
    // whose only main-set printing is the Marvel must still default to its
    // regular printing from a later product (armory deck, blitz deck, …)
    const aMarvel = (a.rarity || '').toLowerCase() === 'v' ? 1 : 0;
    const bMarvel = (b.rarity || '').toLowerCase() === 'v' ? 1 : 0;
    if (aMarvel !== bMarvel) return aMarvel - bMarvel;

    const aCode = (a.set || '').toLowerCase();
    const bCode = (b.set || '').toLowerCase();
    const aMeta = SET_METADATA[aCode];
    const bMeta = SET_METADATA[bCode];

    // 1. Curated set ranking — sets unknown to the table sort last until seeded
    const aOrder = aMeta?.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const bOrder = bMeta?.displayOrder ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;

    // 2. Edition (major) — priority varies by set (unlimited before 1st for WTR/ARC/CRU/MON)
    const editionPriority = getEditionPriority(aCode || bCode);
    const aEd = editionPriority[a.edition ?? 'n'] ?? 3;
    const bEd = editionPriority[b.edition ?? 'n'] ?? 3;
    if (aEd !== bEd) return aEd - bEd;

    // 3. Foiling (minor within edition)
    const FOIL_PRIORITY: Record<string, number> = { s: 0, n: 0, r: 1, c: 2, g: 3 };
    const aFoil = FOIL_PRIORITY[(a.foiling || 's').toLowerCase()] ?? 0;
    const bFoil = FOIL_PRIORITY[(b.foiling || 's').toLowerCase()] ?? 0;
    return aFoil - bFoil;
  });
}

// Helper functions
export function getSetMetadata(setCode: string): SetMetadata | undefined {
  return SET_METADATA[setCode.toLowerCase()];
}

export function hasFirstEdition(setCode: string): boolean {
  const metadata = getSetMetadata(setCode);
  return metadata?.hasFirstEdition ?? false;
}

export function getAllSetCodes(): string[] {
  return Object.keys(SET_METADATA);
}

export function getSetsInDisplayOrder(): SetMetadata[] {
  const allSets = Object.values(SET_METADATA);

  const standard = allSets
    .filter(s => s.category === 'standard')
    .sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime());

  const nonStandard = NON_STANDARD_ORDER
    .map(code => SET_METADATA[code])
    .filter(Boolean);

  return [...standard, ...nonStandard];
}

export function getSetCodesInDisplayOrder(): string[] {
  return getSetsInDisplayOrder().map(set => set.code.toLowerCase());
}

export function getOrderedSets(): {
  standard: SetMetadata[];
  nonStandard: SetMetadata[];
} {
  const allSets = Object.values(SET_METADATA);

  const standard = allSets
    .filter(s => s.category === 'standard')
    .sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime());

  const nonStandard = NON_STANDARD_ORDER
    .map(code => SET_METADATA[code])
    .filter(Boolean);

  return { standard, nonStandard };
}
