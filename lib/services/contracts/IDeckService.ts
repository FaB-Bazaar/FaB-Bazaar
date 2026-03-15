/**
 * Deck Service Contract
 *
 * Database-agnostic interface for deck operations.
 * Supports deck CRUD, card management, and backwards-compatible lookups.
 */

import type { AsyncResult, PaginationOptions } from './common';

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
  | 'Silver Age'
  | 'Blitz'
  | 'Commoner'
  | 'Living Legend'
  | 'Limited'
  | 'Ultimate Pit Fight'
  | 'Casual';

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
  isPublic: boolean;
  fabraryUrl?: string;
  fabraryDeckId?: string;
  metafyGuideId?: string | null;
  availableOnTalishar?: boolean;

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

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;

  // Optional metadata
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * Lightweight deck summary for lists
 */
export interface DeckSummaryDTO {
  _id: string;
  publicId: string;
  name: string;
  slug?: string;
  format: DeckFormat;
  heroName?: string;
  isPublic: boolean;
  totalCards?: number;
  estimatedValue?: number;
  updatedAt?: Date;
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
  isPublic?: boolean;
  fabraryUrl?: string;
  slug?: string;
  copyFromDeckId?: string;
}

/**
 * Update deck input
 */
export interface UpdateDeckDTO {
  name?: string;
  description?: string;
  format?: DeckFormat;
  heroName?: string;
  isPublic?: boolean;
  fabraryUrl?: string;
  slug?: string;
  metadata?: Record<string, any>;
  metafyGuideId?: string | null;
  availableOnTalishar?: boolean;
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
  isPublic?: boolean;
  heroName?: string;
  search?: string;
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
    cardName: string;
    needed: number;
    owned: number;
    conditions: string[];
    binderNames: string[];
  }>;
  missing: Array<{
    printingId: string;
    cardName: string;
    needed: number;
    tcgMarket?: number;
  }>;
  partial: Array<{
    printingId: string;
    cardName: string;
    needed: number;
    owned: number;
    shortage: number;
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
    userId: string
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
   * @returns Result with card name, category, and any moved cards
   */
  addPrinting(
    publicId: string,
    userId: string,
    printing: AddPrintingDTO
  ): AsyncResult<AddPrintingResultDTO>;

  /**
   * Add multiple printings to a deck
   *
   * @param publicId - The deck's public ID
   * @param userId - The user (for ownership check)
   * @param printings - Printings to add
   * @returns Bulk import result with summary
   */
  addPrintings(
    publicId: string,
    userId: string,
    printings: AddPrintingDTO[]
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
   * @returns The updated deck
   */
  swapPrinting(
    publicId: string,
    userId: string,
    oldPrintingId: string,
    newPrintingId: string,
    category: DeckCategory
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
    options?: { binderMode?: 'all' | 'specific'; binderId?: string }
  ): AsyncResult<InventoryComparisonDTO>;

  /**
   * Calculate deck statistics
   *
   * @param publicId - The deck's public ID
   * @returns Deck stats including unique cards, value, category breakdown
   */
  calculateStats(
    publicId: string
  ): AsyncResult<DeckStatsDTO>;

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
