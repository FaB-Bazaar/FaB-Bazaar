// lib/fab-constants/sets.ts
// Set codes, names, and metadata including release dates

// SET_MAP and SET_METADATA are GENERATED from the `sets` database table
// (source of truth; migration 0061). To add a set or fix metadata, update
// the table and run: npx tsx --env-file=.env.local scripts/generate-set-constants.ts
import { SET_MAP as RAW_SET_MAP, SET_METADATA as RAW_SET_METADATA } from './sets-data.generated';
import { SET_IMAGES } from '@/lib/set-images';
// Exported as live views (see liveSetConstant below): every read first brings
// this module copy in line with the runtime set overlay. Internal code uses
// the RAW objects so nothing syncs while this module is still initializing.
export const SET_MAP = liveSetConstant(RAW_SET_MAP);
export const SET_METADATA = liveSetConstant(RAW_SET_METADATA);

export type SetCode = keyof typeof SET_MAP;

/**
 * Ordered list of set codes shown in binder, search, wants, collection, and
 * deck-builder filter chips. Newest first by release date — matches the
 * `/sets` landing page ordering. Update this single list when new sets ship —
 * every filter component reads from it.
 */
const RAW_CARD_FILTER_SETS = [
  'mpa', 'mpw', 'iar', 'omn', 'pen', 'anq', 'sup', 'mpg', 'sea', 'hnt', 'ros', 'mst', 'hvy',
  'evo', 'dtd', 'out', 'dyn', 'upr', '1hp', 'evr', 'ele', 'mon', 'cru', 'arc', 'wtr',
] as const;
export const CARD_FILTER_SETS = liveSetConstant(RAW_CARD_FILTER_SETS);

export type CardFilterSet = typeof RAW_CARD_FILTER_SETS[number];

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


/**
 * Promo sets selectable individually in the /opt & /tags set filter, in the
 * order the buttons render. Each is one DB set code (the collector-number
 * prefix is always identical to the code, so no finer mapping is needed).
 */
export const PROMO_FILTER_SETS: string[] = [
  'lgs', 'fab', 'her', 'gem', 'jdg', 'win', 'lss', 'tnp', 'oxo', 'con',
];

/**
 * Standalone non-booster products (Classic Battles, 1st Strike, Round the
 * Table, Smash Palace) selectable individually in the /opt & /tags set filter.
 */
export const OTHER_PRODUCT_FILTER_SETS: string[] = [
  'dvr', 'rvd', 'aur', 'ter', 'tcc', 'smp',
];

/**
 * Deck-product groups offered as single filter buttons. A selected group is
 * stored in OptUiState.selectedSets as its `grp:` token and expanded to member
 * set codes only at the server-filter boundary (expandSetSelections), so URLs
 * and chips stay one-entry-per-selection.
 *
 * Membership is DERIVED from SET_METADATA (armory via `category`, the rest via
 * the rigid name prefixes LSS uses) — a new deck added to the `sets` table
 * joins its group when the snapshot is regenerated, with no code edit here.
 */
export interface SetFilterGroup {
  token: string;
  label: string;
  codes: string[];
}

const SET_GROUP_TOKEN_PREFIX = 'grp:';

function codesWhere(pred: (m: SetMetadata) => boolean): string[] {
  return Object.entries(RAW_SET_METADATA)
    .filter(([, m]) => pred(m))
    .map(([code]) => code);
}

const SET_GROUP_MEMBERSHIP: Array<{ token: string; label: string; member: (m: SetMetadata) => boolean }> = [
  { token: 'grp:blitz', label: 'Blitz Decks', member: m => m.name.includes('Blitz Deck:') },
  { token: 'grp:armory', label: 'Armory Decks', member: m => m.category === 'armory' },
  { token: 'grp:silver-age', label: 'Silver Age Decks', member: m => m.name.startsWith('Silver Age Deck:') },
  { token: 'grp:hero-decks', label: 'Hero Decks', member: m => m.name.startsWith('Hero Deck:') },
];

const RAW_SET_FILTER_GROUPS: SetFilterGroup[] = SET_GROUP_MEMBERSHIP.map(
  ({ token, label, member }) => ({ token, label, codes: codesWhere(member) }));
export const SET_FILTER_GROUPS = liveSetConstant(RAW_SET_FILTER_GROUPS);

/**
 * Re-derive group membership after SET_METADATA changes at runtime (the DB
 * set overlay, lib/fab-constants/set-overlay.ts). Mutates the existing arrays
 * so every holder of SET_FILTER_GROUPS sees the new members.
 */
export function refreshSetFilterGroups(): void {
  SET_GROUP_MEMBERSHIP.forEach(({ member }, i) => {
    const codes = RAW_SET_FILTER_GROUPS[i].codes;
    codes.splice(0, codes.length, ...codesWhere(member));
  });
}

const SET_GROUPS_BY_TOKEN = new Map(RAW_SET_FILTER_GROUPS.map(g => [g.token, g]));

/** True for `grp:` group tokens stored alongside plain codes in selectedSets. */
export function isSetGroupToken(value: string): boolean {
  return value.startsWith(SET_GROUP_TOKEN_PREFIX);
}

/** Display label for a group token, or undefined for plain codes / unknown tokens. */
export function setGroupLabel(token: string): string | undefined {
  syncSetOverlay();
  return SET_GROUPS_BY_TOKEN.get(token)?.label;
}

/**
 * Expand a selectedSets list (plain codes + `grp:` tokens) into the flat,
 * deduped set-code list the search service filters on. Unknown group tokens
 * are dropped rather than sent to the server as bogus codes.
 */
export function expandSetSelections(selected: string[]): string[] {
  syncSetOverlay();
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of selected) {
    const codes = isSetGroupToken(value)
      ? SET_GROUPS_BY_TOKEN.get(value)?.codes ?? []
      : [value];
    for (const code of codes) {
      if (!seen.has(code)) { seen.add(code); out.push(code); }
    }
  }
  return out;
}

// Explicit ordering for non-standard sets on the /sets page
const NON_STANDARD_ORDER = [
  'tcc', 'smp', 'gem', 'dvr', 'aur',
  'her', 'jdg', 'lgs', 'lss', 'win', 'tnp', 'oxo', 'fab', 'con',
];

/**
 * Returns edition sort priority for a given set code. Sets flagged
 * unlimited_before_first on their `sets` DB row (WTR/ARC/CRU/MON/ELE — both
 * editions existed, unlimited is the common accessible printing) lead with
 * unlimited; everyone else alpha → 1st → unlimited → normal.
 */
function getEditionPriority(setCode: string): Record<string, number> {
  if (RAW_SET_METADATA[setCode]?.unlimitedBeforeFirst) {
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
  syncSetOverlay();
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
    const aMeta = RAW_SET_METADATA[aCode];
    const bMeta = RAW_SET_METADATA[bCode];

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
  syncSetOverlay();
  return RAW_SET_METADATA[setCode.toLowerCase()];
}

export function hasFirstEdition(setCode: string): boolean {
  const metadata = getSetMetadata(setCode);
  return metadata?.hasFirstEdition ?? false;
}

export function getAllSetCodes(): string[] {
  syncSetOverlay();
  return Object.keys(RAW_SET_METADATA);
}

export function getSetsInDisplayOrder(): SetMetadata[] {
  syncSetOverlay();
  const allSets = Object.values(RAW_SET_METADATA);

  const standard = allSets
    .filter(s => s.category === 'standard')
    .sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime());

  const nonStandard = NON_STANDARD_ORDER
    .map(code => RAW_SET_METADATA[code])
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
  syncSetOverlay();
  const allSets = Object.values(RAW_SET_METADATA);

  const standard = allSets
    .filter(s => s.category === 'standard')
    .sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime());

  const nonStandard = NON_STANDARD_ORDER
    .map(code => RAW_SET_METADATA[code])
    .filter(Boolean);

  return { standard, nonStandard };
}

// ── Runtime set overlay ───────────────────────────────────────────────────
// The DB can be ahead of this compiled snapshot (a set registered from
// /admin/cardvault). lib/fab-constants/set-overlay.ts builds the difference and
// publishes it to globalThis; each copy of this module patches its own
// constants IN PLACE on the next helper call (Next.js keeps separate module
// copies for server components, SSR and route handlers, so the shared slot is
// globalThis, not a module variable). The exported constants are live views,
// so direct reads (CARD_FILTER_SETS, SET_MAP, …) sync too.

export interface SetOverlay {
  version: string;
  /** lowercase code → full metadata, only for new or changed sets. */
  meta: Record<string, SetMetadata>;
  /** lowercase code → Cloudflare image id, only where the DB adds/changes one. */
  images: Record<string, string>;
  /** The full filter-chip list when it differs from the compiled one, else null. */
  filterSets: string[] | null;
}

export const SET_OVERLAY_GLOBAL = '__FAB_SET_OVERLAY__';

const COMPILED = {
  map: { ...RAW_SET_MAP } as Record<string, string>,
  meta: { ...RAW_SET_METADATA },
  filters: [...RAW_CARD_FILTER_SETS] as string[],
  images: { ...SET_IMAGES },
};

/** The compiled snapshot as shipped, before any overlay. Do not mutate. */
export function compiledSetSnapshot(): Readonly<typeof COMPILED> {
  return COMPILED;
}

let appliedOverlayVersion: string | null = null;

/** Version patched into THIS module copy (null = compiled snapshot). */
export function appliedSetOverlayVersion(): string | null {
  return appliedOverlayVersion;
}

/** Bring this module copy in line with the published overlay. Cheap when unchanged. */
export function syncSetOverlay(): void {
  const overlay = (globalThis as Record<string, unknown>)[SET_OVERLAY_GLOBAL] as SetOverlay | undefined;
  const version = overlay?.version ?? null;
  if (version === appliedOverlayVersion) return;

  const map = RAW_SET_MAP as Record<string, string>;
  for (const k of Object.keys(map)) if (!(k in COMPILED.map)) delete map[k];
  Object.assign(map, COMPILED.map);
  for (const k of Object.keys(RAW_SET_METADATA)) if (!(k in COMPILED.meta)) delete RAW_SET_METADATA[k];
  Object.assign(RAW_SET_METADATA, COMPILED.meta);
  for (const k of Object.keys(SET_IMAGES)) if (!(k in COMPILED.images)) delete SET_IMAGES[k];
  Object.assign(SET_IMAGES, COMPILED.images);
  const filters = RAW_CARD_FILTER_SETS as unknown as string[];

  if (overlay) {
    for (const [code, m] of Object.entries(overlay.meta)) {
      RAW_SET_METADATA[code] = m;
      map[code] = m.name;
    }
    Object.assign(SET_IMAGES, overlay.images);
  }
  filters.splice(0, filters.length, ...(overlay?.filterSets ?? COMPILED.filters));
  refreshSetFilterGroups();
  appliedOverlayVersion = version;
}

/**
 * A read-through view of a set constant: any read (property, `in`, keys,
 * iteration, array methods) first syncs this module copy with the published
 * overlay. Writes go to the target untouched.
 */
function liveSetConstant<T extends object>(target: T): T {
  return new Proxy(target, {
    get(t, p, r) { syncSetOverlay(); return Reflect.get(t, p, r); },
    has(t, p) { syncSetOverlay(); return Reflect.has(t, p); },
    ownKeys(t) { syncSetOverlay(); return Reflect.ownKeys(t); },
    getOwnPropertyDescriptor(t, p) { syncSetOverlay(); return Reflect.getOwnPropertyDescriptor(t, p); },
  });
}
