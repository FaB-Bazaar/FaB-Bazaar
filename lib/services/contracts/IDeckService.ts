/**
 * Deck Service Contract
 *
 * Database-agnostic interface for deck operations.
 * Supports deck CRUD, card management, and backwards-compatible lookups.
 */

import type { AsyncResult, PaginationOptions } from './common';

/** Max length of the user-defined deck `folder` label (trimmed; empty → NULL). */
export const DECK_FOLDER_MAX_LENGTH = 60;

// ====================================
// DTOs (Data Transfer Objects)
// ====================================

/**
 * Deck card categories
 */
export type DeckCategory =
  | 'hero'
  | 'equipment'
  | 'maindeck'
  | 'inventory'
  | 'benched'
  | 'tokens';

/**
 * Valid deck formats
 */
export type DeckFormat =
  | 'Classic Constructed'
  | 'Future Classic Constructed'
  | 'Silver Age'
  | 'Blitz'
  | 'Commoner'
  | 'Living Legend'
  | 'Limited'
  | 'Ultimate Pit Fight'
  | 'Casual';

/**
 * Deck visibility levels
 */
export type DeckVisibility = 'private' | 'unlisted' | 'public';

/**
 * Printing within a deck category
 */
export interface DeckPrintingDTO {
  printingId: string;
  quantity?: number;  // ✅ ADDED: Quantity of this printing in the deck
  condition?: string; // ⚠️ DEPRECATED: Removed from PostgreSQL schema
  notes?: string;
  addedAt?: Date;
  printingDetails?: {
    name?: string;
    display_name?: string;
    set?: string;
    edition?: string;
    foiling?: string;
    rarity?: string;
    image_url?: string;
    tcg_market?: number;
    tcg_low?: number;
    types?: string[];
    subtypes?: string[];
    card_unique_id?: string;
    pitch?: number;  // ✅ ADDED: Pitch value for color grouping
    [key: string]: any;
  };
}

/**
 * Basic deck DTO
 */
export interface DeckDTO {
  _id: string;
  publicId: string;
  userId: string;
  name: string;
  slug?: string;
  description?: string;
  format: DeckFormat;
  heroName?: string;
  visibility: DeckVisibility;
  isPublic: boolean;  // Computed: visibility !== 'private' (backward compat)
  metafyGuideId?: string | null;
  availableOnTalishar?: boolean;
  featured?: boolean;
  isSystemDeck?: boolean;

  // Category arrays
  hero: DeckPrintingDTO[];
  equipment: DeckPrintingDTO[];
  maindeck: DeckPrintingDTO[];
  inventory: DeckPrintingDTO[];
  benched?: DeckPrintingDTO[];
  tokens?: DeckPrintingDTO[];

  // Cached stats
  totalCards?: number;
  estimatedValue?: number;
  heroCount?: number;
  equipmentCount?: number;
  maindeckCount?: number;
  inventoryCount?: number;
  benchedCount?: number;
  tokensCount?: number;
  cardPoolCount?: number;

  // Format validation
  isFormatLegal?: boolean;
  formatErrors?: string[];

  // Event metadata (optional — drives the to-beat month filter, distinct from updatedAt)
  eventName?: string | null;
  eventDate?: string | null;  // ISO date string (YYYY-MM-DD)
  placing?: number | null;

  // User-defined folder label (free-form; null = unfiled)
  folder?: string | null;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;

  // Optional metadata
  tags?: string[];
  metadata?: Record<string, any>;

  // Co-owners: user IDs that share edit access (primary owner manages this list)
  coOwners?: string[];

  // Resolved display username of the primary owner (populated by API routes, not service layer)
  ownerUsername?: string | null;
}

/**
 * Lightweight deck summary for lists
 */
export interface DeckSummaryDTO {
  _id: string;
  publicId: string;
  userId: string;
  name: string;
  slug?: string;
  description?: string;
  format: DeckFormat;
  heroName?: string;
  heroImageUrl?: string;
  heroDisplayName?: string;
  visibility: DeckVisibility;
  isPublic: boolean;  // Computed: visibility !== 'private'
  availableOnTalishar?: boolean;
  featured?: boolean;
  isSystemDeck?: boolean;
  pinnedInNav?: boolean;
  totalCards?: number;
  estimatedValue?: number;
  matchupCount?: number;
  heroCount?: number;
  equipmentCount?: number;
  maindeckCount?: number;
  inventoryCount?: number;
  benchedCount?: number;
  uniqueCardCount?: number;
  coOwners?: string[];
  createdAt?: Date;
  updatedAt?: Date;
  isCoOwned?: boolean;  // True when the requesting user is a co-owner (not the primary owner)
  ownerUsername?: string;  // Display username of the primary owner (populated for co-owned decks)
  metafyGuideId?: string | null;
  eventName?: string | null;
  eventDate?: string | null;  // ISO date string (YYYY-MM-DD)
  placing?: number | null;
  /** User-defined folder label (free-form; null = unfiled) */
  folder?: string | null;
  /** Game record from game_results (Talishar sync). 0/0 = no games logged. */
  wins?: number;
  losses?: number;
}

/**
 * Create deck input
 */
export interface CreateDeckDTO {
  name: string;
  description?: string;
  format: DeckFormat;
  heroName?: string;
  heroPrintingId?: string;
  visibility?: DeckVisibility;
  isPublic?: boolean;  // Backward compat: maps to visibility
  slug?: string;
  copyFromDeckId?: string;
  /**
   * When copying (copyFromDeckId set), convert each copied card to its closest
   * printing in this language, falling back to the original printing when the
   * card has no printing in the target language. Omit or 'en' = verbatim copy.
   */
  copyLanguage?: string;
}

/**
 * Update deck input
 */
export interface UpdateDeckDTO {
  name?: string;
  description?: string;
  format?: DeckFormat;
  heroName?: string;
  visibility?: DeckVisibility;
  isPublic?: boolean;  // Backward compat: maps to visibility
  slug?: string;
  metadata?: Record<string, any>;
  metafyGuideId?: string | null;
  availableOnTalishar?: boolean;
  pinnedInNav?: boolean;
  eventName?: string | null;
  eventDate?: string | null;  // ISO date string (YYYY-MM-DD)
  placing?: number | null;
  /** User-defined folder label; trimmed, '' or null clears it (max DECK_FOLDER_MAX_LENGTH) */
  folder?: string | null;
}

/**
 * Add printing to deck input
 */
export interface AddPrintingDTO {
  printingId: string;
  quantity?: number;
  category?: DeckCategory;
  condition?: string;
  notes?: string;
}

/**
 * Options for addPrinting/addPrintings
 */
export interface AddPrintingsOptions {
  /**
   * Skip the banlist check for this call. Superadmin-only — lets a historical
   * decklist keep cards that were legal when played but are banned now.
   */
  bypassBanned?: boolean;
}

/**
 * Result of adding a printing
 */
export interface AddPrintingResultDTO {
  printingId: string;
  success: boolean;
  action?: 'added' | 'updated';
  cardName?: string;
  quantity?: number;
  category?: string;
  error?: string;
  movedToInventory?: string[];
}

/**
 * Update printing properties input
 */
export interface UpdatePrintingDTO {
  printingId: string;
  updates: {
    category?: DeckCategory;
    condition?: string;
    notes?: string;
  };
}

/**
 * Result of updating a single printing
 */
export interface UpdatePrintingResultDTO {
  printingId: string;
  success: boolean;
  action?: 'updated';
  cardName?: string;
  quantity?: number;
  updates?: {
    category?: string;
    condition?: string;
    notes?: string;
  };
  error?: string;
}

/**
 * Batch update printings result
 */
export interface BatchUpdatePrintingsResultDTO {
  summary: {
    total: number;
    updated: number;
    failed: number;
    totalCardsUpdated: number;
  };
  results: UpdatePrintingResultDTO[];
  deck: {
    _id: string;
    name: string;
    updatedAt: Date;
  };
}

/**
 * Result of bulk import
 */
export interface BulkImportResultDTO {
  summary: {
    total: number;
    added: number;
    failed: number;
    totalCardsAdded: number;
  };
  results: AddPrintingResultDTO[];
  deck: DeckDTO;
}

/**
 * Deck list filters
 */
export interface DeckListFilters {
  format?: DeckFormat;
  visibility?: DeckVisibility;
  isPublic?: boolean;  // Backward compat
  heroName?: string;
  search?: string;
  availableOnTalishar?: boolean;
  includeSystemDecks?: boolean;
}

/**
 * Public deck list filters (no userId needed)
 */
export interface PublicDeckFilters {
  format?: DeckFormat;
  heroName?: string;
  search?: string;
  username?: string;
  featured?: boolean;
  /** System "Decks to Beat" rows are EXCLUDED by default (they have their own
   * section). featured: true implies them; set this to include them anyway. */
  includeSystemDecks?: boolean;
  /** Filter by event_date month (1–12) and year (e.g. 2026) — only matches decks with an explicit event_date set */
  month?: number;
  year?: number;
  /** Rolling event_date window (ISO YYYY-MM-DD), inclusive of dateFrom, exclusive of dateTo. For "last N months". */
  dateFrom?: string;
  dateTo?: string;
  /** Filter by event name (exact match) */
  eventName?: string;
  /**
   * Result order. 'recent' (default) = updated_at DESC. 'placing' = tournament
   * finish 1st → last (placing ASC, unplaced rows last, ties recent-first) —
   * what the Decks to Beat page wants for an event.
   */
  sortBy?: 'recent' | 'placing';
}

/**
 * Deterministic cross-deck archetype consensus (no AI): what a set of decks
 * (e.g. every Decks-to-Beat build of one hero in a window) agree on.
 */
// Card-intrinsic attributes ride each consensus card so the AI context can
// self-describe it (type/cost/power/defense/rules text) — the model only sees
// that context, and without these it invents card roles on follow-ups.
export interface ConsensusResultCard {
  name: string;
  pitch?: number;
  decks: number;
  typicalQty: number;
  printingId?: string;
  typeText?: string;
  cost?: number;
  power?: number;
  defense?: number;
  text?: string;
}

export interface ArchetypeConsensusResult {
  consensus: {
    deckCount: number;
    core: ConsensusResultCard[];
    flex: ConsensusResultCard[];
    colorCurve: { red: number; yellow: number; blue: number };
  };
  decks: Array<{ publicId: string; name: string; placing?: number | null; eventName?: string | null; eventDate?: string | null }>;
}

/**
 * Public deck summary with creator info
 */
export interface PublicDeckSummaryDTO extends DeckSummaryDTO {
  description?: string;
  /**
   * What the deck costs to BUILD: each card priced at the cheapest printing of
   * that card (any set/edition/foiling), not the printing the deck happens to
   * list. Same tcg_low basis as `estimatedValue`, so the two are comparable.
   */
  cheapestValue?: number;
  creatorUsername?: string;
  creatorDisplayUsername?: string;
  heroPrintingId?: string;
  featured?: boolean;
  articleReferences?: { publicId: string; title: string }[];
  eventName?: string | null;
  eventDate?: string | null;  // ISO date string (YYYY-MM-DD)
  placing?: number | null;
}

/**
 * Deck stats
 */
export interface DeckStatsDTO {
  totalCards: number;
  uniqueCards: number;
  estimatedValue: number;
  categoryBreakdown: {
    hero: number;
    equipment: number;
    maindeck: number;
    inventory: number;
    maybeboard: number;
    tokens: number;
  };
}

/**
 * Ownership status for a printing
 */
export interface OwnershipStatusDTO {
  printingId: string;
  cardUniqueId?: string;
  owned: number;
  forTrade: number;
  conditions: string[];
  binderNames: string[];
}

/**
 * Inventory comparison result
 */
export interface InventoryComparisonDTO {
  owned: Array<{
    printingId: string;
    /** card_unique_id of the row — in matchBy:'card' mode rows are keyed by card, printingId is just a representative */
    cardUniqueId?: string;
    cardName: string;
    pitch?: number;
    needed: number;
    owned: number;
    conditions: string[];
    binderNames: string[];
    tcgLow?: number;
    tcgMarket?: number;
    tcgplayerUrl?: string;
  }>;
  missing: Array<{
    printingId: string;
    cardUniqueId?: string;
    cardName: string;
    pitch?: number;
    needed: number;
    tcgLow?: number;
    tcgMarket?: number;
    tcgplayerUrl?: string;
    imageUrl?: string;
  }>;
  partial: Array<{
    printingId: string;
    cardUniqueId?: string;
    cardName: string;
    pitch?: number;
    needed: number;
    owned: number;
    shortage: number;
    tcgLow?: number;
    tcgMarket?: number;
    tcgplayerUrl?: string;
    imageUrl?: string;
  }>;
  summary: {
    totalNeeded: number;
    totalOwned: number;
    totalMissing: number;
    completionPercentage: number;
    estimatedMissingValue: number;
  };
}

/**
 * Per-card deck-usage aggregate for binder tiles.
 * Coverage semantics are max-per-deck, not sum: you play one deck at a time,
 * so owning maxDeckQuantity copies is enough to play any single deck.
 */
export interface CardDeckUsageSummaryDTO {
  /** Number of the user's (non-system) decks containing any printing of the card */
  deckCount: number;
  /** Highest total quantity any single deck runs (summed across printings/categories within the deck) */
  maxDeckQuantity: number;
  /** Copies owned across ALL the user's binders, any printing */
  ownedQuantity: number;
}

/**
 * One deck row in the per-card usage list (the on-demand popover).
 */
export interface CardDeckUsageEntryDTO {
  publicId: string;
  name: string;
  heroName?: string;
  format?: string;
  /** Total copies of the card this deck runs (summed across printings/categories) */
  quantity: number;
}

/**
 * Compact per-deck coverage row for batch "which of these decks could I
 * build from my collection?" queries (Decks-to-Beat buildability). One
 * small row per deck — sized for LLM consumption, not full comparisons.
 */
export interface DeckCoverageSummaryDTO {
  publicId: string;
  deckName: string;
  heroName?: string | null;
  format?: string | null;
  totalNeeded: number;
  totalOwned: number;
  /** Rounded 0–100. */
  coveragePct: number;
  /** Distinct card slots not fully covered (missing + partial). */
  missingCards: number;
  /** Cost to buy the gaps: shortage × tcgLow (fallback tcgMarket). */
  missingCost: number;
  /** Most expensive gaps first. */
  topMissing: Array<{
    printingId: string;
    cardName: string;
    pitch?: number;
    shortage: number;
    tcgLow?: number;
  }>;
}

/**
 * One owned alternative printing of a card the user doesn't fully own in their deck.
 */
export interface UpgradePrintingAlternativeDTO {
  printingId: string;
  setCode: string | null;
  foiling: string | null;
  edition: string | null;
  collectorNumber: string | null;
  imageUrl: string | null;
  tcgLow: number | null;
  ownedQty: number;
  isRecommended: boolean;
}

/**
 * Suggestion to swap one unowned deck printing for an owned alternative of the same card.
 *
 * `alternatives` lists every printing of the card the user owns (qty > 0), sorted by
 * `tcgLow` desc. Exactly one entry has `isRecommended = true` (highest `tcgLow`).
 */
export interface UpgradePrintingSuggestionDTO {
  currentPrintingId: string;
  cardName: string;
  color: string | null;
  category: DeckCategory;
  deckQuantity: number;
  current: {
    setCode: string | null;
    foiling: string | null;
    edition: string | null;
    collectorNumber: string | null;
    imageUrl: string | null;
    tcgLow: number | null;
  };
  recommendedPrintingId: string;
  alternatives: UpgradePrintingAlternativeDTO[];
}

/**
 * Result of executing a batch of printing upgrade swaps.
 */
export interface ApplyPrintingUpgradesResultDTO {
  swapped: number;
  errors: string[];
}

/**
 * Plan for converting a deck's printings to a target language. `swaps` are the
 * cards with an exact same-variant (set/edition/foiling) printing in the target
 * language; `skipped` are left as-is (no such printing, or already there).
 */
export interface DeckLanguageConversionPlanDTO {
  targetLanguage: string;
  swaps: Array<{ currentPrintingId: string; newPrintingId: string; category: DeckCategory }>;
  skipped: Array<{ printingId: string; cardName: string; reason: string }>;
}

/**
 * Allocation import format
 */
export interface AllocationDTO {
  hero?: AddPrintingDTO[];
  equipment?: AddPrintingDTO[];
  maindeck?: AddPrintingDTO[];
  inventory?: AddPrintingDTO[];
  maybeboard?: AddPrintingDTO[];
  tokens?: AddPrintingDTO[];
}

/**
 * @deprecated Use DeckPrintingDTO instead
 * Card within a deck (legacy format)
 */
export interface DeckCardDTO {
  printingId: string;
  category: DeckCategory;
  quantity: number;
  condition?: string;
  notes?: string;
  position?: number;
}

// ====================================
// Service Interface
// ====================================

/**
 * Deck Service Interface
 *
 * Database-agnostic contract for deck operations.
 * All methods return AsyncResult<T> for consistent error handling.
 *
 * @example
 * ```typescript
 * // Find deck by slug or ID (backwards compatible)
 * const result = await deckService.findBySlugOrId(userId, 'my-deck-slug');
 *
 * if (result.success && result.data) {
 *   console.log(`Found deck: ${result.data.name}`);
 * }
 * ```
 */
export interface IDeckService {
  // ====================================
  // Lookup Methods (existing)
  // ====================================

  /**
   * Find a deck by slug with backwards compatibility for ObjectId
   *
   * First attempts to find by slug, then falls back to finding by _id
   * if the identifier is a valid ObjectId. This supports legacy URLs
   * that used ObjectId directly.
   *
   * @param identifier - The deck slug or ObjectId string
   * @param userId - The user ID who owns the deck
   * @returns The deck or null if not found
   */
  findBySlugOrId(
    identifier: string,
    userId: string
  ): AsyncResult<DeckDTO | null>;

  /**
   * Find a deck by slug only
   *
   * @param slug - The deck slug
   * @param userId - The user ID who owns the deck
   * @returns The deck or null if not found
   */
  findBySlug(
    slug: string,
    userId: string
  ): AsyncResult<DeckDTO | null>;

  /**
   * Find a deck by ID only
   *
   * @param deckId - The deck ID
   * @param userId - Optional user ID for ownership verification
   * @returns The deck or null if not found
   */
  findById(
    deckId: string,
    userId?: string
  ): AsyncResult<DeckDTO | null>;

  /**
   * Find a deck by publicId
   *
   * The primary lookup method for external access. Uses the globally unique
   * publicId (nanoid) rather than MongoDB _id.
   *
   * @param publicId - The deck's public identifier (21-char nanoid)
   * @param userId - Optional user ID for ownership verification
   * @returns The deck or null if not found
   */
  findByPublicId(
    publicId: string,
    userId?: string
  ): AsyncResult<DeckDTO | null>;

  // ====================================
  // CRUD Operations
  // ====================================

  /**
   * Create a new deck
   *
   * @param userId - The user creating the deck
   * @param data - Deck creation data
   * @returns The created deck with computed stats
   */
  createDeck(
    userId: string,
    data: CreateDeckDTO
  ): AsyncResult<DeckDTO>;

  /**
   * Create a deck with initial cards
   *
   * @param userId - The user creating the deck
   * @param data - Deck creation data
   * @param printings - Initial printings to add
   * @returns The created deck with cards and stats
   */
  createDeckWithCards(
    userId: string,
    data: CreateDeckDTO,
    printings: AddPrintingDTO[]
  ): AsyncResult<DeckDTO>;

  /**
   * Update deck metadata
   *
   * @param publicId - The deck's public ID
   * @param userId - The user updating the deck (for ownership check)
   * @param updates - Fields to update
   * @returns The updated deck
   */
  updateDeck(
    publicId: string,
    userId: string,
    updates: UpdateDeckDTO
  ): AsyncResult<DeckDTO>;

  /**
   * Delete a deck
   *
   * @param publicId - The deck's public ID
   * @param userId - The user deleting the deck (for ownership check)
   * @returns True if deleted successfully
   */
  deleteDeck(
    publicId: string,
    userId: string
  ): AsyncResult<boolean>;

  /**
   * Update the co-owners list for a deck (primary owner only)
   *
   * @param publicId - The deck's public ID
   * @param ownerUserId - Must be the primary owner
   * @param coOwnerIds - Full replacement list of co-owner user IDs (max 20)
   * @returns The updated deck
   */
  updateCoOwners(
    publicId: string,
    ownerUserId: string,
    coOwnerIds: string[]
  ): AsyncResult<DeckDTO>;

  // ====================================
  // List Operations
  // ====================================

  /**
   * List user's decks with optional filters and pagination
   *
   * @param userId - The user whose decks to list
   * @param filters - Optional filters
   * @param pagination - Optional pagination options
   * @returns Paginated deck list with total count
   */
  listUserDecks(
    userId: string,
    filters?: DeckListFilters,
    pagination?: PaginationOptions
  ): AsyncResult<{ decks: DeckDTO[]; total: number }>;

  /**
   * List user's decks in lightweight format (for dropdowns/selectors)
   *
   * @param userId - The user whose decks to list
   * @returns Array of deck summaries
   */
  listUserDecksBasic(
    userId: string,
    filters?: { includeSystemDecks?: boolean }
  ): AsyncResult<DeckSummaryDTO[]>;

  /**
   * Count user's decks with optional filters
   *
   * @param userId - The user whose decks to count
   * @param filters - Optional filters
   * @returns Total count
   */
  countUserDecks(
    userId: string,
    filters?: DeckListFilters
  ): AsyncResult<number>;

  /**
   * List public decks from all users
   *
   * @param filters - Optional filters (format, heroName, search)
   * @param pagination - Optional pagination options
   * @returns Paginated list of public deck summaries with creator info
   */
  listPublicDecks(
    filters?: PublicDeckFilters,
    pagination?: PaginationOptions
  ): AsyncResult<{ decks: PublicDeckSummaryDTO[]; total: number }>;

  /**
   * Deterministic archetype consensus across featured (Decks-to-Beat) decks of
   * one hero in a time window — core vs flex cards, color curve. No AI.
   */
  getArchetypeConsensus(
    params: { heroName: string; format?: DeckFormat; dateFrom?: string; dateTo?: string; maxDecks?: number }
  ): AsyncResult<ArchetypeConsensusResult>;

  /**
   * Toggle the featured status of a deck (for "Decks to Beat" section)
   *
   * @param publicId - The deck's public ID
   * @param featured - Whether to feature or unfeature
   * @returns True if toggled successfully
   */
  toggleFeatured(
    publicId: string,
    featured: boolean
  ): AsyncResult<boolean>;

  /**
   * Toggle the isSystemDeck flag (superadmin only — enforced at API layer)
   *
   * @param publicId - The deck's public ID
   * @param isSystemDeck - Whether to mark or unmark as a system deck
   */
  toggleSystemDeck(
    publicId: string,
    isSystemDeck: boolean
  ): AsyncResult<boolean>;

  /**
   * Get distinct events for featured decks in a given month/year.
   */
  getEventSummaries(
    year: number,
    month: number
  ): AsyncResult<{ eventName: string; eventDate: string; format: string; count: number }[]>;

  /**
   * Most recent month (by event_date) that has featured public decks, so the
   * Decks to Beat page can default to a month with content instead of the empty
   * current calendar month. Optionally scoped to a format. Null if none exist.
   */
  getLatestFeaturedMonth(
    format?: DeckFormat
  ): AsyncResult<{ year: number; month: number } | null>;

  // ====================================
  // Card Management
  // ====================================

  /**
   * Add a printing to a deck
   *
   * Handles equipment conflict logic automatically:
   * - Adding 2H weapon moves existing weapons to inventory
   * - Adding armor moves existing armor in same slot to inventory
   *
   * @param publicId - The deck's public ID
   * @param userId - The user (for ownership check)
   * @param printing - Printing to add
   * @param options - bypassBanned: true skips the banlist check (superadmin-only,
   *   for preserving historical decklists whose cards weren't banned at the time)
   * @returns Result with card name, category, and any moved cards
   */
  addPrinting(
    publicId: string,
    userId: string,
    printing: AddPrintingDTO,
    options?: AddPrintingsOptions
  ): AsyncResult<AddPrintingResultDTO>;

  /**
   * Add multiple printings to a deck
   *
   * @param publicId - The deck's public ID
   * @param userId - The user (for ownership check)
   * @param printings - Printings to add
   * @param options - bypassBanned: true skips the banlist check (superadmin-only,
   *   for preserving historical decklists whose cards weren't banned at the time)
   * @returns Bulk import result with summary
   */
  addPrintings(
    publicId: string,
    userId: string,
    printings: AddPrintingDTO[],
    options?: AddPrintingsOptions
  ): AsyncResult<BulkImportResultDTO>;

  /**
   * Remove a printing from a deck
   *
   * @param publicId - The deck's public ID
   * @param userId - The user (for ownership check)
   * @param printingId - The printing ID to remove
   * @param category - The category to remove from
   * @returns True if removed successfully
   */
  removePrinting(
    publicId: string,
    userId: string,
    printingId: string,
    category: DeckCategory,
    quantity?: number
  ): AsyncResult<boolean>;

  /**
   * Swap a printing in a deck with a different printing
   *
   * @param publicId - The deck's public ID
   * @param userId - The user (for ownership check)
   * @param oldPrintingId - The printing to replace
   * @param newPrintingId - The new printing
   * @param category - The category containing the printing
   * @param quantity - Copies to move (default 1). Must not exceed the copies
   *                   of oldPrintingId present in that category — the deck
   *                   lightbox offers "1 / 2 / all N copies".
   * @returns The updated deck
   */
  swapPrinting(
    publicId: string,
    userId: string,
    oldPrintingId: string,
    newPrintingId: string,
    category: DeckCategory,
    quantity?: number
  ): AsyncResult<DeckDTO>;

  /**
   * Batch update printing properties (category, condition, notes)
   *
   * Updates multiple printings in a deck. Each printing can have its
   * category, condition, and/or notes updated. All matching cards with
   * the same printingId will be updated.
   *
   * @param publicId - The deck's public ID
   * @param userId - The user (for ownership check)
   * @param updates - Array of printing updates
   * @returns Batch update result with summary and per-printing results
   *
   * @example
   * ```typescript
   * const result = await deckService.updatePrintings(
   *   deckId,
   *   userId,
   *   [
   *     {
   *       printingId: "abc123",
   *       updates: { category: "sideboard", condition: "LP" }
   *     },
   *     {
   *       printingId: "def456",
   *       updates: { notes: "Proxy card" }
   *     }
   *   ]
   * );
   * ```
   */
  updatePrintings(
    publicId: string,
    userId: string,
    updates: UpdatePrintingDTO[]
  ): AsyncResult<BatchUpdatePrintingsResultDTO>;

  // ====================================
  // Bulk Operations
  // ====================================

  /**
   * Bulk import printings to a deck
   *
   * @param publicId - The deck's public ID
   * @param userId - The user (for ownership check)
   * @param printings - Printings to import
   * @returns Bulk import result
   */
  bulkImport(
    publicId: string,
    userId: string,
    printings: AddPrintingDTO[]
  ): AsyncResult<BulkImportResultDTO>;

  /**
   * Import an allocation structure to a deck
   *
   * @param publicId - The deck's public ID
   * @param userId - The user (for ownership check)
   * @param allocation - Allocation by category
   * @returns The updated deck
   */
  importAllocation(
    publicId: string,
    userId: string,
    allocation: AllocationDTO
  ): AsyncResult<DeckDTO>;

  // ====================================
  // Analysis & Comparison
  // ====================================

  /**
   * Get ownership status for a list of printings
   *
   * Checks user's inventory to see what they own.
   *
   * @param userId - The user to check ownership for
   * @param printingIds - The printings to check
   * @returns Ownership status for each printing
   */
  getOwnershipStatus(
    userId: string,
    printingIds: string[]
  ): AsyncResult<OwnershipStatusDTO[]>;

  /**
   * Compare a deck against user's inventory
   *
   * @param publicId - The deck's public ID
   * @param userId - The user
   * @param options - Comparison options (binderMode, specific binderId)
   * @returns Comparison result with owned/missing/partial breakdowns
   */
  getInventoryComparison(
    publicId: string,
    userId: string,
    options?: { binderMode?: 'all' | 'specific'; binderId?: string; matchBy?: 'printing' | 'card' }
  ): AsyncResult<InventoryComparisonDTO>;

  /**
   * Batch coverage summaries: how much of each deck the user could build
   * from their collection. One compact row per deck, ranked most-buildable
   * first. Unknown publicIds are skipped, not errors.
   *
   * @param publicIds - Deck public IDs (max 30 per call)
   * @param userId - The user whose collection to compare against
   * @param options - matchBy defaults to 'card' (any printing satisfies a slot)
   */
  getDecksCoverageSummary(
    publicIds: string[],
    userId: string,
    options?: { matchBy?: 'printing' | 'card'; topMissingLimit?: number }
  ): AsyncResult<DeckCoverageSummaryDTO[]>;

  /**
   * Batch per-card deck-usage aggregates for the user's own decks (binder
   * tile badges). Card-level matching: any printing of the card counts, in
   * decks and in owned inventory. Cards used by no deck are absent from the
   * returned map. Excludes system decks and scratch categories
   * (inventory/benched/tokens).
   *
   * @param userId - The user whose decks and inventory to aggregate
   * @param cardUniqueIds - Cards to look up (typically one binder page)
   */
  getCardDeckUsageSummary(
    userId: string,
    cardUniqueIds: string[]
  ): AsyncResult<Record<string, CardDeckUsageSummaryDTO>>;

  /**
   * The user's (non-system) decks containing any printing of the card, with
   * per-deck total quantity, highest quantity first. Same category/system-deck
   * exclusions as getCardDeckUsageSummary.
   */
  getCardDeckUsage(
    userId: string,
    cardUniqueId: string
  ): AsyncResult<CardDeckUsageEntryDTO[]>;

  /**
   * Calculate deck statistics
   *
   * @param publicId - The deck's public ID
   * @returns Deck stats including unique cards, value, category breakdown
   */
  calculateStats(
    publicId: string
  ): AsyncResult<DeckStatsDTO>;

  /**
   * Find swap suggestions: for each unowned non-hero deck printing, list every
   * printing of the same card the user owns. The highest-`tcgLow` owned printing
   * is flagged as recommended. Heroes are excluded (swap manually).
   *
   * @param publicId - The deck's public ID
   * @param userId - The viewing user (their inventory + deck ownership)
   * @returns One suggestion per unowned deck card with at least one owned alternative
   */
  getUpgradePrintingSuggestions(
    publicId: string,
    userId: string
  ): AsyncResult<UpgradePrintingSuggestionDTO[]>;

  /**
   * Apply a batch of printing swaps to a deck. Each swap calls swapPrinting;
   * partial failures are reported in `errors` rather than aborting the batch.
   *
   * @param publicId - The deck's public ID
   * @param userId - The user (for ownership check)
   * @param swaps - Swap list (typically a filtered subset of getUpgradePrintingSuggestions)
   * @returns Count of successful swaps and per-swap error messages
   */
  applyPrintingUpgrades(
    publicId: string,
    userId: string,
    swaps: Array<{ currentPrintingId: string; newPrintingId: string; category: DeckCategory }>
  ): AsyncResult<ApplyPrintingUpgradesResultDTO>;

  /**
   * Plan (do not apply) the swaps to convert every deck card to a target
   * language, exact-variant only. Apply the returned `swaps` via
   * applyPrintingUpgrades.
   */
  convertDeckToLanguage(
    publicId: string,
    userId: string,
    targetLanguage: string
  ): AsyncResult<DeckLanguageConversionPlanDTO>;

  // ====================================
  // Utilities
  // ====================================

  /**
   * Generate a unique slug for a deck
   *
   * @param userId - The user (slugs are unique per user)
   * @param baseName - The base name to generate slug from
   * @returns A unique slug
   */
  generateUniqueSlug(
    userId: string,
    baseName: string
  ): AsyncResult<string>;

  /**
   * Validate a deck against its format rules
   *
   * @param publicId - The deck's public ID
   * @returns Validation result with errors if any
   */
  validateFormat(
    publicId: string
  ): AsyncResult<{ isLegal: boolean; errors: string[] }>;
}
