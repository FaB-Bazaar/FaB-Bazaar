/**
 * Printings Service Contract
 *
 * Database-agnostic interface for searching the printings collection.
 * This collection contains full card metadata for display and searching.
 */

import type { AsyncResult } from './common';

// ====================================
// DTOs (Data Transfer Objects)
// ====================================

/**
 * Printing document DTO (database-agnostic)
 * Plain object representation of a printing from the printings collection
 */
export interface PrintingDTO {
  _id?: string;
  printing_id: string;
  card_unique_id: string;

  // Core card info
  name: string;
  text: string;
  type_text: string;
  type_text_display?: string;
  color: string;

  // Arrays
  types: string[];
  traits: string[];
  keywords: string[];
  keywords_display: string[];
  abilities: string[];
  text_keywords: string[];
  searchable_text: string;

  // Classes & Talents
  classes: string[];
  talents: string[];

  // Stats
  power?: number | null;
  cost?: number | null;
  defense?: number | null;
  pitch?: number | null;
  health?: number | null;
  intelligence?: number | null;

  // Original stat strings
  power_text: string;
  cost_text: string;
  defense_text: string;
  pitch_text: string;

  // Printing-specific
  collector_number: string;
  set: string;
  edition: string;
  foiling: string;
  rarity: string;
  language: string; // 'en' | 'fr' | 'de' | 'it' | 'es' | 'ja' — physical printing language
  artists: string[];

  // Pricing
  tcg_low?: number | null;
  tcg_mid?: number | null;
  tcg_high?: number | null;
  tcg_market?: number | null;
  price_updated_at?: Date;

  // Boolean flags - Type flags
  is_action: boolean;
  is_attack: boolean;
  is_defense_reaction: boolean;
  is_instant: boolean;
  is_equipment: boolean;
  is_weapon: boolean;
  is_hero: boolean;
  is_mentor: boolean;
  is_token: boolean;

  // Class flags
  is_generic: boolean;
  is_brute: boolean;
  is_guardian: boolean;
  is_mechanologist: boolean;
  is_ranger: boolean;
  is_runeblade: boolean;
  is_assassin: boolean;
  is_warrior: boolean;
  is_ninja: boolean;
  is_wizard: boolean;
  is_merchant: boolean;
  is_bard: boolean;
  is_adjudicator: boolean;
  is_illusionist: boolean;
  is_thief: boolean;
  is_shapeshifter: boolean;
  is_necromancer: boolean;

  // Talent flags
  has_chaos: boolean;
  has_light: boolean;
  has_royal: boolean;
  has_draconic: boolean;
  has_lightning: boolean;
  has_shadow: boolean;
  has_earth: boolean;
  has_mystic: boolean;
  has_revered: boolean;
  has_ice: boolean;
  has_reviled: boolean;
  has_pirate: boolean;
  has_elemental: boolean;

  // Combination flags
  is_generic_only: boolean;
  has_class_and_talent: boolean;
  has_class_only: boolean;
  has_talent_only: boolean;

  // Edition flags
  is_first_edition: boolean;
  is_unlimited: boolean;
  is_normal_edition: boolean;

  // Foiling flags
  is_normal_foil: boolean;
  is_rainbow_foil: boolean;
  is_cold_foil: boolean;

  // Rarity flags
  is_common: boolean;
  is_rare: boolean;
  is_super_rare: boolean;
  is_majestic: boolean;
  is_legendary: boolean;
  is_fabled: boolean;
  is_promo: boolean;

  // Price flags
  is_budget: boolean;
  is_under_5: boolean;
  is_under_10: boolean;
  is_under_25: boolean;
  is_under_50: boolean;
  is_under_100: boolean;
  is_expensive: boolean;
  is_premium: boolean;

  // Format legality
  blitz_legal: boolean;
  cc_legal: boolean;
  commoner_legal: boolean;
  ll_legal: boolean;
  silver_age_legal: boolean;

  // Format restrictions
  blitz_banned: boolean;
  cc_banned: boolean;
  commoner_banned: boolean;
  ll_banned: boolean;
  silver_age_banned: boolean;
  blitz_suspended: boolean;
  cc_suspended: boolean;
  commoner_suspended: boolean;
  ll_restricted: boolean;
  silver_age_suspended: boolean;

  // Art
  is_extended_art: boolean;
  art_variations: string[];

  // Foil mask (rainbow foil clip-path, data-driven)
  foil_inset_top: number | null;
  foil_inset_right: number | null;
  foil_inset_bottom: number | null;
  foil_inset_left: number | null;
  foil_inset_round: string | null;

  // Other
  played_horizontally: boolean;
  expansion_slot: boolean;
  other_face_printing_id?: string | null;
  is_front_face: boolean;
  flavor_text: string;
  image_url: string;
  tcgplayer_product_id?: string;
  tcgplayer_url?: string;
  created_at: Date;

  // Original data
  printing_data?: any;
}

/**
 * Search filters for printings
 */
export interface PrintingsSearchFilters {
  // Text searches
  name?: string;
  text?: string;
  searchableText?: string;
  exact?: boolean;

  // Card attributes
  types?: string[];
  traits?: string[];
  keywords?: string[];
  textKeywords?: string[];
  colors?: string[];
  cardUniqueId?: string;
  cardUniqueIds?: string[];

  // Single color (shorthand parser convenience)
  color?: string;

  // Classes & Talents
  classes?: string[];
  classesNot?: string[];
  talents?: string[];
  talentsAll?: string[];
  talentsNot?: string[];

  // Stats
  power?: number | number[] | null;
  powerMin?: number;
  powerMax?: number;
  powerNot?: number[];
  cost?: number | number[] | null;
  costs?: number[];
  costMin?: number;
  costMax?: number;
  costNot?: number[];
  defense?: number | number[] | null;
  defenseMin?: number;
  defenseMax?: number;
  defenseNot?: number[];
  pitch?: number | number[] | null;

  // Printing attributes
  collectorNumber?: string | string[];
  printingIds?: string[];
  sets?: string[];
  editions?: string[];
  foilings?: string[];
  rarities?: string[];
  artists?: string[];
  // Physical printing language(s), e.g. ['en']. Only English printings carry
  // TCGplayer ids + prices, so price-aware UIs default to ['en'].
  languages?: string[];
  // Curated facet classification tags (cards.facet_tags array overlap). See
  // lib/search/card-facets.ts for the vocabulary.
  facetTags?: string[];

  // Price filters
  priceMin?: number;
  priceMax?: number;
  priceField?: 'tcg_low' | 'tcg_mid' | 'tcg_high' | 'tcg_market';

  // Boolean filters - Type filters
  isAction?: boolean;
  isAttack?: boolean;
  isDefenseReaction?: boolean;
  isInstant?: boolean;
  isEquipment?: boolean;
  isWeapon?: boolean;
  isHero?: boolean;
  isMentor?: boolean;
  isToken?: boolean;

  // Class boolean filters
  isGeneric?: boolean;
  isBrute?: boolean;
  isGuardian?: boolean;
  isMechanologist?: boolean;
  isRanger?: boolean;
  isRuneblade?: boolean;
  isAssassin?: boolean;
  isWarrior?: boolean;
  isNinja?: boolean;
  isWizard?: boolean;
  isMerchant?: boolean;
  isBard?: boolean;
  isAdjudicator?: boolean;
  isIllusionist?: boolean;
  isThief?: boolean;
  isShapeshifter?: boolean;
  isNecromancer?: boolean;

  // Talent boolean filters
  hasChaos?: boolean;
  hasLight?: boolean;
  hasRoyal?: boolean;
  hasDraconic?: boolean;
  hasLightning?: boolean;
  hasShadow?: boolean;
  hasEarth?: boolean;
  hasMystic?: boolean;
  hasRevered?: boolean;
  hasIce?: boolean;
  hasReviled?: boolean;
  hasPirate?: boolean;
  hasElemental?: boolean;

  // Combination filters
  isGenericOnly?: boolean;
  hasClassAndTalent?: boolean;
  hasClassOnly?: boolean;
  hasTalentOnly?: boolean;

  // Edition filters
  isFirstEdition?: boolean;
  isUnlimited?: boolean;
  isNormalEdition?: boolean;

  // Foiling filters
  isNormalFoil?: boolean;
  isRainbowFoil?: boolean;
  isColdFoil?: boolean;
  isExtendedArt?: boolean;

  // Rarity filters
  isCommon?: boolean;
  isRare?: boolean;
  isSuperRare?: boolean;
  isMajestic?: boolean;
  isLegendary?: boolean;
  isFabled?: boolean;
  isPromo?: boolean;

  // Price filters
  isBudget?: boolean;
  isUnder5?: boolean;
  isUnder10?: boolean;
  isUnder25?: boolean;
  isUnder50?: boolean;
  isUnder100?: boolean;
  isExpensive?: boolean;
  isPremium?: boolean;

  // Format legality
  format?: 'blitz' | 'cc' | 'commoner' | 'll' | 'silver_age';
  includeBanned?: boolean;
  includeSuspended?: boolean;

  // Pricing availability
  hasPricing?: boolean;
  hasProductId?: boolean;

  // Hero filtering (legacy - single flat list, OR logic)
  heroLegal?: string | string[];
  heroNotLegal?: string[];
  // Hero filtering (precise - AND+subset logic for correct deck-building legality)
  // A card is included only if card.classes ⊆ heroClasses AND card.talents ⊆ heroTalents
  // e.g. heroClasses=['warrior'], heroTalents=['light'] → shows generic, warrior, light, AND light-warrior
  //      but NOT light-warrior cards for a pure-warrior hero (Dorinthea)
  heroClasses?: string[];
  heroTalents?: string[];
  // Elemental essence elements the hero has (extracted from hero keywords, e.g. "essence of lightning" → ["lightning"])
  // These are added to allowedClasses so cards with classes=['lightning'] etc. are correctly shown.
  heroEssences?: string[];
  excludeClasses?: string[];
  excludeTalents?: string[];

  // Negation filters
  colorNot?: string[];
  raritiesNot?: string[];
  setsNot?: string[];
  foilingsNot?: string[];
  editionsNot?: string[];
  typesNot?: string[];
  keywordsNot?: string[];
  textNot?: string;
}

/**
 * Response mode for controlling returned fields
 */
export type ResponseMode =
  | 'all' // Full data (default)
  | 'summary' // Basic card info + key stats
  | 'gameplay' // Game mechanics focused
  | 'identifiers' // Just IDs and names
  | 'browse_bulk';

/**
 * Search options
 */
export interface PrintingsSearchOptions {
  limit?: number;
  page?: number;
  sortBy?:
    | 'name'
    | 'price'
    | 'power'
    | 'cost'
    | 'defense'
    | 'set'
    | 'rarity'
    | 'collector_number'
    | 'relevance'
    | 'color'
    | 'foiling'
    | 'edition';
  sortOrder?: 'asc' | 'desc';
  returnSimplified?: boolean;
  show?: ResponseMode;
  searchMode?: 'strict' | 'broad';
  // Opt-in card-level grouping: collapse to one row per card_unique_id,
  // represented by its cheapest printing (DISTINCT ON). Default off — callers
  // that need every printing (card-search dialog, bulk, MCP) omit it.
  groupByCard?: boolean;
}

/**
 * Search result with pagination
 */
export interface PrintingsSearchResult {
  printings: PrintingDTO[];
  total: number;
  page: number;
  pages: number;
  queryInfo?: {
    executionTime: number;
    filters?: PrintingsSearchFilters;
  };
}

/**
 * Filter values for faceted search
 */
export interface PrintingsFilterValues {
  sets: string[];
  editions: string[];
  foilings: string[];
  rarities: string[];
  artists: string[];
  types: string[];
  traits: string[];
  keywords: string[];
  colors: string[];
  classes: string[];
  talents: string[];
}

/**
 * Price statistics
 */
export interface PriceStatistics {
  count: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  totalValue: number;
  priceRanges: {
    budget: number; // < $1
    under5: number; // $1-5
    under10: number; // $5-10
    under25: number; // $10-25
    under50: number; // $25-50
    under100: number; // $50-100
    expensive: number; // $100+
  };
}

/**
 * Essence statistics
 */
export interface EssenceStatistics {
  earth: number;
  ice: number;
  lightning: number;
  light: number;
  combinations: {
    earth_ice: number;
    earth_lightning: number;
    ice_lightning: number;
    earth_light: number;
    ice_light: number;
    lightning_light: number;
  };
}

// ====================================
// Service Interface
// ====================================

/**
 * Slim card-level DTO used by the deck-editor card pool fetch.
 * One entry per unique card (not per printing); a representative printing
 * is chosen server-side via foiling-priority ordering.
 */
export interface CardSummaryDTO {
  cardUniqueId: string;
  name: string;
  types: string[];
  pitch: number | null;
  cost: number | null;
  defense: number | null;
  power: number | null;
  keywords: string[];
  classes: string[];
  talents: string[];
  color: string;
  representativePrintingId: string;
  representativeImageUrl: string | null;
  /** Total printings of this card across all sets/foilings (unfiltered) */
  printingsCount: number;
}

export interface HeroPoolFilters {
  heroClasses?: string[];
  heroTalents?: string[];
  heroEssences?: string[];
  format?: string;
}

/** Snake_case flag names match the DB column names so admin UI can post them verbatim. */
export type HeroLegalityFlag =
  | 'cc_legal'
  | 'blitz_legal'
  | 'silver_age_legal'
  | 'commoner_legal'
  | 'll_legal';

export const HERO_LEGALITY_FLAGS: HeroLegalityFlag[] = [
  'cc_legal',
  'blitz_legal',
  'silver_age_legal',
  'commoner_legal',
  'll_legal',
];

/** Format codes for legality filtering — matches the column-suffix part of HeroLegalityFlag. */
export type HeroFormat = 'cc' | 'blitz' | 'silver_age' | 'commoner' | 'll';

export const HERO_FORMATS: HeroFormat[] = ['cc', 'blitz', 'silver_age', 'commoner', 'll'];

export interface HeroLegalityRow {
  cardUniqueId: string;
  /** Lowercased canonical name (matches the legacy roster keys). */
  name: string;
  displayName: string;
  imageUrl: string | null;
  types: string[];
  klass: string | null;
  ccLegal: boolean;
  blitzLegal: boolean;
  silverAgeLegal: boolean;
  commonerLegal: boolean;
  llLegal: boolean;
}

/**
 * Printings Service Interface
 *
 * Database-agnostic contract for printings collection operations.
 * Implementations must handle database connections and error handling.
 */
export interface IPrintingsService {
  /**
   * Search printings with filters and options
   *
   * @param filters - Search filters
   * @param options - Search options (pagination, sorting)
   * @returns Result containing paginated printings
   *
   * @example
   * ```typescript
   * const result = await printingsService.searchPrintings(
   *   { name: 'Art of War', sets: ['WTR'] },
   *   { limit: 10, sortBy: 'name' }
   * );
   * if (result.success) {
   *   console.log(`Found ${result.data.total} printings`);
   * }
   * ```
   */
  searchPrintings(
    filters: PrintingsSearchFilters,
    options?: PrintingsSearchOptions
  ): AsyncResult<PrintingsSearchResult>;

  /** Read a card's curated facet tags (from the projected cards.facet_tags). */
  getCardFacetTags(cardUniqueId: string): AsyncResult<string[]>;

  /** Replace a card's curated facet tags (validates vocabulary, applies to all
   *  same-name variants, projects to cards.facet_tags). */
  setCardFacetTags(cardUniqueId: string, tags: string[]): AsyncResult<{ applied: number }>;

  /**
   * Resolve multiple cards by name+pitch in a single DB query.
   * Returns one best-match printing per input entry.
   * Entries that match nothing are included with an empty printings array.
   *
   * Avoids N sequential searchPrintings calls — use this whenever you need to
   * look up a batch of cards by name (e.g., MCP deck import, curated list bulk-add).
   *
   * `sharedFilters` are applied as AND constraints that wrap the per-card OR clause,
   * e.g. heroClasses/heroTalents/format for deck-building legality checks.
   */
  bulkResolveByName(
    cards: Array<{ name: string; pitch?: number }>,
    sharedFilters?: Pick<PrintingsSearchFilters, 'heroClasses' | 'heroTalents' | 'heroEssences' | 'format'>
  ): AsyncResult<Array<{ name: string; pitch?: number; printings: PrintingDTO[] }>>;

  /**
   * Get single printing by printing_id
   *
   * @param printingId - The printing unique ID
   * @returns Result containing printing or null if not found
   *
   * @example
   * ```typescript
   * const result = await printingsService.getPrintingById('NGz8wFDFGQLf9TGTzJMPb');
   * if (result.success && result.data) {
   *   console.log(`Found: ${result.data.name}`);
   * }
   * ```
   */
  getPrintingById(printingId: string): AsyncResult<PrintingDTO | null>;

  /**
   * Get all printings for a specific card
   *
   * @param cardId - Card name or unique ID
   * @param options - Search options
   * @returns Result containing printings for this card
   */
  getPrintingsForCard(
    cardId: string,
    options?: PrintingsSearchOptions
  ): AsyncResult<PrintingsSearchResult>;

  /**
   * Fetch the entire card pool for a hero as slim card-level summaries.
   * Returns one row per unique card (not per printing) with a representative
   * printing chosen by foiling priority. Designed to ship the full pool in
   * a single small fetch instead of preloading all printings per type chip.
   */
  searchCardsForHero(filters: HeroPoolFilters): AsyncResult<CardSummaryDTO[]>;

  /**
   * Resolve a set of card_unique_ids to one card-level summary each, with a
   * representative printing chosen by foiling priority. Use when a feature is
   * keyed by CARD (e.g. the banned-cards registry) and only needs a name +
   * image per card — never loop searchPrintings or rely on a row-count limit,
   * which over-fetches printings and truncates late-sorting cards.
   * Unknown ids are silently skipped; an empty input returns an empty array.
   */
  getCardSummariesByUniqueIds(cardUniqueIds: string[]): AsyncResult<CardSummaryDTO[]>;

  /**
   * Get multiple printings by their printing_id values
   *
   * @param printingIds - Array of printing IDs
   * @param options - Search options
   * @returns Result containing requested printings
   */
  getPrintingsByIds(
    printingIds: string[],
    options?: PrintingsSearchOptions
  ): AsyncResult<PrintingsSearchResult>;

  /**
   * Get printings legal for a specific hero
   *
   * @param heroName - Hero name (e.g., "Prism", "Oldhim")
   * @param options - Search options
   * @returns Result containing hero-legal cards
   *
   * @example
   * ```typescript
   * const result = await printingsService.getPrintingsForHero('Prism', { limit: 50 });
   * ```
   */
  getPrintingsForHero(
    heroName: string,
    options?: PrintingsSearchOptions
  ): AsyncResult<PrintingsSearchResult>;

  /**
   * Get elemental cards by essence type(s)
   *
   * @param essenceTypes - Array of essence types ('earth', 'ice', 'lightning', 'light')
   * @param options - Search options
   * @returns Result containing elemental cards
   */
  getElementalCards(
    essenceTypes: string[],
    options?: PrintingsSearchOptions
  ): AsyncResult<PrintingsSearchResult>;

  /**
   * Get cards by class and/or talent combination
   *
   * @param classes - Optional array of classes
   * @param talents - Optional array of talents
   * @param options - Search options
   * @returns Result containing matching cards
   */
  getCardsByClassTalent(
    classes?: string[],
    talents?: string[],
    options?: PrintingsSearchOptions
  ): AsyncResult<PrintingsSearchResult>;

  /**
   * Get available filter values for faceted search
   *
   * @returns Result containing all distinct filter values
   *
   * @example
   * ```typescript
   * const result = await printingsService.getFilterValues();
   * if (result.success) {
   *   console.log('Available sets:', result.data.sets);
   * }
   * ```
   */
  getFilterValues(): AsyncResult<PrintingsFilterValues>;

  /**
   * Get essence statistics
   *
   * @returns Result containing essence counts and combinations
   */
  getEssenceStatistics(): AsyncResult<EssenceStatistics>;

  /**
   * Get price statistics for filtered cards
   *
   * @param filters - Optional filters to narrow down cards
   * @returns Result containing price statistics
   */
  getPriceStatistics(
    filters?: PrintingsSearchFilters
  ): AsyncResult<PriceStatistics>;

  /**
   * Get deck building cards for a hero
   * Combines hero-legal filtering with additional filters, excludes heroes
   *
   * @param heroName - Hero name
   * @param additionalFilters - Additional search filters
   * @param options - Search options
   * @returns Result containing deck-building card pool
   */
  getDeckBuildingCards(
    heroName: string,
    additionalFilters?: PrintingsSearchFilters,
    options?: PrintingsSearchOptions
  ): AsyncResult<PrintingsSearchResult>;

  /**
   * List hero cards with their format-legality flags. One row per cardUniqueId,
   * image picked from any printing. Pass `{ legalIn }` to filter to heroes
   * legal in a single format (used by deck-builder hero pickers).
   */
  listHeroCards(opts?: { legalIn?: HeroFormat }): AsyncResult<HeroLegalityRow[]>;

  /**
   * Admin-only: flip a single format-legality flag on a hero card.
   * Rejects unknown cardUniqueId, non-hero cards, and unknown flag names.
   */
  setHeroLegality(
    cardUniqueId: string,
    flag: HeroLegalityFlag,
    value: boolean
  ): AsyncResult<void>;

  /**
   * Admin-only: toggle whether a hero is marked as Young by adding/removing
   * 'young' from the types array. Idempotent.
   */
  setHeroYoung(cardUniqueId: string, value: boolean): AsyncResult<void>;
}
