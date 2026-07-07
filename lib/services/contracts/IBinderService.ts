/**
 * Binder Service Contract
 *
 * This interface defines all binder-related data access operations.
 * Implementations must handle database connections and error handling.
 *
 * This is a DATABASE-AGNOSTIC contract - no MongoDB-specific types should appear here.
 */

import type { AsyncResult, PaginationOptions } from './common';

/**
 * Visibility settings for a binder
 */
export interface VisibilityDTO {
  level: 'public' | 'private' | 'friends' | 'unlisted';
  allowInSearch: boolean;
  allowInMatching: boolean;
  allowDiscordCommands: boolean;
  allowApiExport: boolean;
  allowWhoHas: boolean;
  allowWebhooks: boolean;
}

/**
 * Binder data transfer object
 */
export interface BinderDTO {
  _id: string;
  userId: string;
  name: string;
  description?: string;
  isPublic: boolean;
  visibility?: VisibilityDTO;
  tags?: string[];
  archived?: boolean;
  slug?: string;
  discordExternalId?: string;
  discordUsername?: string;
  discordId?: string;
  isOnHand?: boolean;
  thumbnailPrintingId?: string;
  createdAt: Date;
  updatedAt: Date;

  // Binder stats fields (calculated by MongoBinderStatsService)
  totalQuantity?: number;
  quantityForTrade?: number;
  quantityNotForTrade?: number;
  totalValue?: {
    tcg_market: number;
    tcg_low: number;
    tcg_mid: number;
    tcg_high: number;
  };
  valueForTrade?: {
    tcg_market: number;
    tcg_low: number;
    tcg_mid: number;
    tcg_high: number;
  };
  valueNotForTrade?: {
    tcg_market: number;
    tcg_low: number;
    tcg_mid: number;
    tcg_high: number;
  };
  rarityCounts?: Record<string, number>;
  rarityCountsForTrade?: Record<string, number>;
  rarityCountsNotForTrade?: Record<string, number>;
  showcaseCards?: Array<{
    printingId: string;
    tcg_low: number;
    rarity: string;
  }>;
  statsUpdatedAt?: Date;
  statsNeedUpdate?: boolean;
}

/**
 * Create binder input
 */
export interface CreateBinderDTO {
  name: string;
  description?: string;
  isPublic?: boolean;
  visibility?: Partial<VisibilityDTO>;
  tags?: string[];
  slug?: string;
  discordUsername?: string;
  discordId?: string;
}

/**
 * Update binder input
 */
export interface UpdateBinderDTO {
  name?: string;
  description?: string;
  isPublic?: boolean;
  visibility?: Partial<VisibilityDTO>;
  tags?: string[];
  archived?: boolean;
  slug?: string;
  thumbnailPrintingId?: string;
  pinnedInNav?: boolean;
}

/**
 * List binders filters
 */
export interface BinderListFilters {
  userId?: string;
  isPublic?: boolean;
  archived?: boolean;
  tags?: string[];
  discordId?: string;
}

// ====================================
// Card Management DTOs (Phase 2B)
// ====================================

/**
 * Input DTO for adding a card to binder
 */
export interface AddCardDTO {
  printingId: string;
  quantity?: number;
  condition?: string;
  language?: string;
  notes?: string;
  forTrade?: boolean;
  forSale?: boolean;
  acquisitionPrice?: number;
  acquisitionDate?: Date;
}

/**
 * Result DTO for add cards operation
 */
export interface AddCardsResultDTO {
  summary: {
    total: number;
    added: number;
    updated: number;
    failed: number;
    filtered: number;
  };
  results: Array<{
    printingId: string;
    success: boolean;
    action?: 'added' | 'updated';
    error?: string;
    filtered?: boolean;
    quantityAdded?: number;
  }>;
  filteredItems?: Array<{
    printingId: string;
    name: string;
    set: string;
    quantity: number;
  }>;
}

/**
 * Filters for searching cards in a binder
 */
export interface BinderCardFilters {
  search?: string;
  rarity?: string;
  foiling?: string;
  set?: string;
  condition?: string;
  forTrade?: boolean;
  class?: string;
  startsWith?: string;
}

/**
 * Search options for binder cards
 */
export interface BinderCardSearchOptions {
  page?: number;
  limit?: number;
  sortBy?:
    | 'name'
    | 'quantity-desc'
    | 'quantity-asc'
    | 'tcg-market-desc'
    | 'tcg-market-asc'
    | 'tcg-low-desc'
    | 'tcg-low-asc'
    | 'default';
}

/**
 * Result DTO for binder cards query
 */
export interface BinderCardsResult {
  cards: InventoryCardDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    /** Sum of quantities across ALL items matching the filters, not just the current page */
    totalQuantity: number;
  };
  metadata: {
    uniqueValues: {
      rarities: string[];
      foilings: string[];
      sets: string[];
      conditions: string[];
    };
    counts: {
      forTrade: number;
      notForTrade: number;
    };
    stats?: {
      totalCards: number;
      forTradeCount: number;
      totalValue?: {
        tcg_low: number;
        tcg_market: number;
        tcg_mid: number;
        tcg_high: number;
      };
      valueForTrade?: {
        tcg_low: number;
      };
      valueNotForTrade?: {
        tcg_low: number;
      };
      rarityCounts?: Record<string, number>;
    };
    priceUpdatedAt?: Date | null;
  };
}

/**
 * Inventory card DTO (card instance in a binder)
 * Contains both inventory-specific fields and denormalized printing data
 */
export interface InventoryCardDTO {
  _id: string;

  // Inventory-specific fields
  userId: string;
  binderId: string;
  printingId: string;
  quantity: number;
  condition: string;
  language: string;
  notes: string;
  forTrade: boolean;
  forSale: boolean;
  acquisitionPrice?: number;
  acquisitionDate?: Date;
  addedAt: Date;
  updatedAt: Date;

  // Denormalized user fields
  discordUsername: string;
  discordId: string;
  userCountry?: string;
  userState?: string;

  // Denormalized binder fields
  binderName: string;
  binderSlug?: string;
  binderIsPublic: boolean;

  // Denormalized printing fields from printings_core
  card_unique_id: string;
  name: string;
  display_name: string;
  pitch?: number;
  collector_number: string;
  set: string;
  edition: string;
  foiling: string;
  rarity: string;
  is_extended_art: boolean;
  art_variations: string[];
  foil_inset_top: number | null;
  foil_inset_right: number | null;
  foil_inset_bottom: number | null;
  foil_inset_left: number | null;
  foil_inset_round: string | null;
  type_text: string;
  type_text_display: string;
  card_text: string;
  image_url: string;
  tcg_market?: number;
  tcg_low?: number;
  tcg_mid?: number;
  tcg_high?: number;
  has_price: boolean;
  price_updated_at?: Date;
  tcgplayer_url?: string;
}

/**
 * Input DTO for updating a card
 */
export interface UpdateCardDTO {
  quantity?: number;
  condition?: string;
  notes?: string;
  forTrade?: boolean;
  forSale?: boolean;
  language?: string;
}

/**
 * Result DTO for swap printing operation
 */
export interface SwapPrintingResultDTO {
  success: boolean;
  message: string;
  merged?: boolean;
  newQuantity?: number;
  mergedIntoCardId?: string;
  updatedCard?: InventoryCardDTO;
}

/**
 * Result DTO for bulk update operation
 */
export interface BulkUpdateResultDTO {
  success: boolean;
  modifiedCount: number;
}

/**
 * Result DTO for transfer operations
 */
export interface TransferResultDTO {
  success: boolean;
  transferred: number;
  merged: number;
  message: string;
}

/**
 * Input DTO for transferring selected cards with quantity support
 */
export interface TransferCardInput {
  cardId: string;
  quantity: number;
}

/**
 * Result DTO for transfer selected cards operation with partial quantity support
 */
export interface TransferSelectedResultDTO {
  success: boolean;
  summary: {
    totalRequested: number;
    successful: number;
    failed: number;
    fullyTransferred: number;
    partiallyTransferred: number;
    mergedInTarget: number;
    totalQuantityTransferred: number;
  };
  results: Array<{
    success: boolean;
    cardId: string;
    printingId: string;
    name: string;
    action: 'transferred' | 'partial_transfer';
    quantity: number;
    remainingInSource: number;
    mergedInTarget?: boolean;
    targetQuantity?: number;
    error?: string;
  }>;
  message: string;
}

/**
 * Options for copyBinder operation
 */
export interface CopyBinderOptions {
  enforcePrivacy?: boolean;
  slug?: string;
}

// ====================================
// Cross-Binder Operations DTOs
// ====================================

/**
 * Result DTO for bulk toggle forTrade by printing IDs
 */
export interface BulkToggleByPrintingResult {
  modifiedCount: number;
  printingIdsProcessed: number;
}

/**
 * Filters for user collection query (all cards across all binders)
 */
export interface UserCollectionFilters {
  search?: string;
  rarity?: string;
  foiling?: string;
  set?: string;
  condition?: string;
  forTrade?: boolean;
}

/**
 * Options for user collection query
 */
export interface UserCollectionOptions {
  sortBy?: 'default' | 'name' | 'quantity-desc' | 'quantity-asc' |
           'tcg-market-desc' | 'tcg-market-asc' | 'tcg-low-desc' | 'tcg-low-asc';
}

/**
 * Result DTO for user collection query
 */
export interface UserCollectionResult {
  cards: InventoryCardDTO[];
  metadata: {
    uniqueValues: {
      rarities: string[];
      foilings: string[];
      sets: string[];
      conditions: string[];
    };
    counts: {
      forTrade: number;
      notForTrade: number;
    };
  };
  binders: Array<{ _id: string; name: string }>;
}

/**
 * A printing alternative with ownership information
 */
export interface PrintingAlternativeDTO {
  printingId: string;
  name: string;
  display_name: string;
  image_url?: string;
  set: string;
  edition: string;
  rarity: string;
  foiling: string;
  is_extended_art?: boolean;
  tcg_low?: number;
  tcg_market?: number;
  tcg_mid?: number;
  tcg_high?: number;
  quantity: number;      // 0 if not owned
  isOwned: boolean;
}

/**
 * Result DTO for printing alternatives query
 */
export interface PrintingAlternativesResult {
  cardUniqueId: string;
  cardName: string;
  alternatives: PrintingAlternativeDTO[];
}

// ====================================
// Export and Summary DTOs
// ====================================

/**
 * Lightweight binder summary for list views
 */
export interface BinderSummaryDTO {
  _id: string;
  name: string;
  slug?: string;
  discordExternalId?: string;
}

/**
 * Binder with stats for collection aggregation
 */
export interface BinderWithStatsDTO {
  _id: string;
  userId: string;
  name: string;
  description?: string | null;
  tags?: string[];
  slug?: string | null;
  isOnHand?: boolean;
  isPublic: boolean;
  visibility?: VisibilityDTO;
  pinnedInNav?: boolean;
  updatedAt?: Date;
  showcaseCards?: Array<{
    printingId: string;
    tcg_low: number;
    rarity: string;
  }>;
  stats?: {
    totalQuantity: number;
    quantityForTrade: number;
    quantityNotForTrade: number;
    totalValue: {
      tcg_market: number;
      tcg_low: number;
      tcg_mid: number;
      tcg_high: number;
    };
    valueForTrade: {
      tcg_market: number;
      tcg_low: number;
      tcg_mid: number;
      tcg_high: number;
    };
    valueNotForTrade: {
      tcg_market: number;
      tcg_low: number;
      tcg_mid: number;
      tcg_high: number;
    };
    rarityCounts: Record<string, number>;
    rarityCountsForTrade: Record<string, number>;
    rarityCountsNotForTrade: Record<string, number>;
  };
}

/**
 * Card location within a binder
 */
export interface CardLocationDTO {
  binderId: string;
  binderName: string;
  binderSlug?: string;
  quantity: number;
  forTrade: boolean;
}

/**
 * Card search result with locations
 */
export interface CardSearchResultDTO {
  _id: string; // cardId
  name: string;
  imageUrl?: string;
  locations: CardLocationDTO[];
}

/**
 * Result DTO for export operations
 * Returns full InventoryCardDTO for compatibility with formatters
 */
export interface ExportCardsResult {
  cards: InventoryCardDTO[];
  binderName: string;
  totalCards: number;
}

/**
 * Binder stats run details
 */
export interface BinderStatsRunDetails {
  bindersProcessed: number;
  bindersSuccessful: number;
  bindersFailed: number;
  processingTimeSeconds: number;
  avgProcessingTimePerBinder: number;
  batchSize: number;
}

/**
 * Binder stats system info
 */
export interface BinderStatsInfo {
  lastRun: Date | null;
  updatedAt: Date | null;
  status: {
    lastRunAgo: string;
    isRecent: boolean;
  };
  lastRunStats: BinderStatsRunDetails | null;
}

/**
 * Binder Service Interface
 *
 * This contract defines the methods for binder data access.
 * Any implementation (MongoDB, PostgreSQL, Supabase, etc.) must implement these methods.
 *
 * Phase 2A: Basic CRUD operations ✅
 * Phase 2B: Card management operations (in progress)
 */
export interface IBinderService {
  /**
   * Create a new binder
   *
   * @param userId - The ID of the user creating the binder
   * @param data - Binder creation data
   * @returns Result containing the created binder
   *
   * @example
   * ```typescript
   * const result = await binderService.createBinder('user123', {
   *   name: 'My Trade Binder',
   *   isPublic: true
   * });
   * if (result.success) {
   *   console.log(`Created binder: ${result.data._id}`);
   * }
   * ```
   */
  createBinder(userId: string, data: CreateBinderDTO): AsyncResult<BinderDTO>;

  /**
   * Get single binder
   *
   * @param binderId - The binder ID
   * @param requestingUserId - Optional user ID for access control
   * @returns Result containing binder data or null if not found/no access
   *
   * @example
   * ```typescript
   * const result = await binderService.getBinder('binder123', 'user123');
   * if (result.success && result.data) {
   *   console.log(`Binder: ${result.data.name}`);
   * }
   * ```
   */
  getBinder(
    binderId: string,
    requestingUserId?: string
  ): AsyncResult<BinderDTO | null>;

  /**
   * Update binder (ownership required)
   *
   * @param binderId - The binder ID
   * @param userId - The user ID (must be owner)
   * @param updates - Fields to update
   * @returns Result containing updated binder
   *
   * @example
   * ```typescript
   * const result = await binderService.updateBinder('binder123', 'user123', {
   *   name: 'Updated Name',
   *   isPublic: false
   * });
   * ```
   */
  updateBinder(
    binderId: string,
    userId: string,
    updates: UpdateBinderDTO
  ): AsyncResult<BinderDTO>;

  /**
   * Delete binder (ownership required)
   *
   * NOTE: Also deletes related InventoryItems
   *
   * @param binderId - The binder ID
   * @param userId - The user ID (must be owner)
   * @returns Result containing success boolean
   *
   * @example
   * ```typescript
   * const result = await binderService.deleteBinder('binder123', 'user123');
   * if (result.success && result.data) {
   *   console.log('Binder deleted successfully');
   * }
   * ```
   */
  deleteBinder(binderId: string, userId: string): AsyncResult<boolean>;

  /**
   * List binders with filters
   *
   * @param filters - Query filters
   * @param options - Pagination/sorting options
   * @returns Result containing array of binders
   *
   * @example
   * ```typescript
   * const result = await binderService.listBinders(
   *   { userId: 'user123', archived: false },
   *   { limit: 10, sort: { createdAt: -1 } }
   * );
   * if (result.success) {
   *   console.log(`Found ${result.data.length} binders`);
   * }
   * ```
   */
  listBinders(
    filters: BinderListFilters,
    options?: PaginationOptions
  ): AsyncResult<BinderDTO[]>;

  /**
   * Check if user has access to binder
   *
   * @param binderId - The binder ID
   * @param userId - The user ID
   * @returns Result containing true if user owns binder OR binder is public
   *
   * @example
   * ```typescript
   * const result = await binderService.checkAccess('binder123', 'user123');
   * if (result.success && result.data) {
   *   console.log('User has access');
   * }
   * ```
   */
  checkAccess(binderId: string, userId: string): AsyncResult<boolean>;

  // ========================================
  // Card Management Operations (Phase 2B)
  // ========================================

  /**
   * Add cards to binder
   *
   * @param binderId - The binder ID
   * @param userId - The user ID (must be owner)
   * @param cards - Array of cards to add
   * @returns Result containing summary of added/updated/failed cards
   *
   * @example
   * ```typescript
   * const result = await binderService.addCardsToBinder('binder123', 'user123', [
   *   { printingId: 'abc123', quantity: 2, forTrade: true }
   * ]);
   * if (result.success) {
   *   console.log(`Added ${result.data.summary.added} cards`);
   * }
   * ```
   */
  addCardsToBinder(
    binderId: string,
    userId: string,
    cards: AddCardDTO[]
  ): AsyncResult<AddCardsResultDTO>;

  /**
   * Get binder cards with filtering/sorting
   *
   * @param binderId - The binder ID
   * @param filters - Search and filter criteria
   * @param options - Pagination and sorting options
   * @returns Result containing cards and metadata
   *
   * @example
   * ```typescript
   * const result = await binderService.getBinderCards('binder123',
   *   { search: 'command', rarity: 'm' },
   *   { page: 1, limit: 48, sortBy: 'name' }
   * );
   * ```
   */
  getBinderCards(
    binderId: string,
    filters: BinderCardFilters,
    options: BinderCardSearchOptions
  ): AsyncResult<BinderCardsResult>;

  /**
   * Get single card from binder
   *
   * @param binderId - The binder ID
   * @param cardId - The inventory item ID
   * @param requestingUserId - Optional user ID for access control
   * @returns Result containing card data or null if not found/no access
   *
   * @example
   * ```typescript
   * const result = await binderService.getBinderCard('binder123', 'card456', 'user123');
   * ```
   */
  getBinderCard(
    binderId: string,
    cardId: string,
    requestingUserId?: string
  ): AsyncResult<InventoryCardDTO | null>;

  /**
   * Update a single card in binder
   *
   * @param binderId - The binder ID
   * @param cardId - The inventory item ID
   * @param userId - The user ID (must be owner)
   * @param updates - Fields to update
   * @returns Result containing updated card
   *
   * @example
   * ```typescript
   * const result = await binderService.updateBinderCard('binder123', 'card456', 'user123', {
   *   quantity: 3,
   *   forTrade: false
   * });
   * ```
   */
  updateBinderCard(
    binderId: string,
    cardId: string,
    userId: string,
    updates: UpdateCardDTO
  ): AsyncResult<InventoryCardDTO>;

  /**
   * Swap card to different printing
   *
   * @param binderId - The binder ID
   * @param cardId - The inventory item ID
   * @param userId - The user ID (must be owner)
   * @param newPrintingId - The new printing ID to swap to
   * @returns Result containing swap details (merged or swapped)
   *
   * @example
   * ```typescript
   * const result = await binderService.swapCardPrinting('binder123', 'card456', 'user123', 'newprint789');
   * if (result.success && result.data.merged) {
   *   console.log(`Merged into existing card with quantity ${result.data.newQuantity}`);
   * }
   * ```
   */
  swapCardPrinting(
    binderId: string,
    cardId: string,
    userId: string,
    newPrintingId: string
  ): AsyncResult<SwapPrintingResultDTO>;

  /**
   * Delete a card from binder
   *
   * @param binderId - The binder ID
   * @param cardId - The inventory item ID
   * @param userId - The user ID (must be owner)
   * @returns Result containing success boolean
   *
   * @example
   * ```typescript
   * const result = await binderService.deleteBinderCard('binder123', 'card456', 'user123');
   * ```
   */
  deleteBinderCard(
    binderId: string,
    cardId: string,
    userId: string
  ): AsyncResult<boolean>;

  bulkRemoveItems(
    binderId: string,
    userId: string,
    cardIds: string[]
  ): AsyncResult<{ removed: number }>;

  /**
   * Bulk update cards in binder
   *
   * @param binderId - The binder ID
   * @param userId - The user ID (must be owner)
   * @param field - Field to update
   * @param value - New value for the field
   * @param cardIds - Optional: only update specific cards
   * @returns Result containing number of cards updated
   *
   * @example
   * ```typescript
   * const result = await binderService.bulkUpdateCards('binder123', 'user123', 'forTrade', true);
   * if (result.success) {
   *   console.log(`Updated ${result.data.modifiedCount} cards`);
   * }
   * ```
   */
  bulkUpdateCards(
    binderId: string,
    userId: string,
    field: 'forTrade' | 'forSale' | 'condition' | 'language',
    value: any,
    cardIds?: string[]
  ): AsyncResult<BulkUpdateResultDTO>;

  /**
   * Transfer all cards between binders
   *
   * @param sourceBinderId - Source binder ID
   * @param targetBinderId - Target binder ID
   * @param userId - The user ID (must own both binders)
   * @returns Result containing transfer summary
   *
   * @example
   * ```typescript
   * const result = await binderService.transferAllCards('binder123', 'binder456', 'user123');
   * ```
   */
  transferAllCards(
    sourceBinderId: string,
    targetBinderId: string,
    userId: string
  ): AsyncResult<TransferResultDTO>;

  /**
   * Transfer selected cards between binders with partial quantity support
   *
   * @param sourceBinderId - Source binder ID
   * @param targetBinderId - Target binder ID
   * @param userId - The user ID (must own both binders)
   * @param cardsToTransfer - Array of cards with quantities to transfer
   * @returns Result containing detailed transfer summary with per-card results
   *
   * @example
   * ```typescript
   * const result = await binderService.transferSelectedCards('binder123', 'binder456', 'user123', [
   *   { cardId: 'card1', quantity: 2 },  // Transfer 2 of this card
   *   { cardId: 'card2', quantity: 5 }   // Transfer all 5 of this card
   * ]);
   * if (result.success) {
   *   console.log(`Transferred ${result.data.summary.totalQuantityTransferred} cards`);
   * }
   * ```
   */
  transferSelectedCards(
    sourceBinderId: string,
    targetBinderId: string,
    userId: string,
    cardsToTransfer: TransferCardInput[]
  ): AsyncResult<TransferSelectedResultDTO>;

  /**
   * Copy entire binder (creates new binder with all cards)
   *
   * @param sourceBinderId - Source binder ID
   * @param userId - The user ID (copying user)
   * @param newName - Name for the new binder
   * @param options - Optional settings for the copy operation
   * @returns Result containing the new binder
   *
   * @example
   * ```typescript
   * // Basic copy (preserves all card data)
   * const result = await binderService.copyBinder('binder123', 'user123', 'My Copy');
   *
   * // Copy with privacy enforcement (forTrade=false, notes cleared, user fields updated)
   * const result = await binderService.copyBinder('binder123', 'user123', 'My Copy', {
   *   enforcePrivacy: true,
   *   slug: 'my-custom-slug'
   * });
   * ```
   */
  copyBinder(
    sourceBinderId: string,
    userId: string,
    newName: string,
    options?: CopyBinderOptions
  ): AsyncResult<BinderDTO>;

  // ====================================
  // Cross-Binder Operations
  // ====================================

  /**
   * Toggle forTrade status for all cards with specified printing IDs across ALL user's binders
   *
   * @param userId - The user ID
   * @param printingIds - Array of printing IDs to update
   * @param forTrade - New forTrade value
   * @returns Result containing number of modified items
   *
   * @example
   * ```typescript
   * const result = await binderService.toggleForTradeByPrintingIds('user123', ['print1', 'print2'], true);
   * if (result.success) {
   *   console.log(`Updated ${result.data.modifiedCount} items`);
   * }
   * ```
   */
  toggleForTradeByPrintingIds(
    userId: string,
    printingIds: string[],
    forTrade: boolean
  ): AsyncResult<BulkToggleByPrintingResult>;

  /**
   * Get ALL cards across all user's binders with filtering and sorting
   * Note: Does NOT paginate - returns all matching cards
   *
   * @param userId - The user ID
   * @param filters - Optional filtering criteria
   * @param options - Optional sorting options
   * @returns Result containing cards, metadata, and binder info
   *
   * @example
   * ```typescript
   * const result = await binderService.getAllCardsForUser('user123', {
   *   forTrade: true,
   *   rarity: 'M'
   * }, {
   *   sortBy: 'tcg-market-desc'
   * });
   * if (result.success) {
   *   console.log(`Found ${result.data.cards.length} cards across ${result.data.binders.length} binders`);
   * }
   * ```
   */
  getAllCardsForUser(
    userId: string,
    filters?: UserCollectionFilters,
    options?: UserCollectionOptions
  ): AsyncResult<UserCollectionResult>;

  /**
   * Get all printing alternatives for a card with user's ownership info
   * Used for printing swap dialogs across binder, deck, and wants contexts
   *
   * @param cardUniqueId - The unique card identifier (e.g., "1HP001" or "WTR001")
   * @param userId - Optional user ID to include ownership information
   * @returns Result containing all printings with ownership data
   *
   * @example
   * ```typescript
   * // Get alternatives with ownership info
   * const result = await binderService.getPrintingAlternatives('1HP001', 'user123');
   * if (result.success) {
   *   console.log(`Found ${result.data.alternatives.length} printings`);
   *   const owned = result.data.alternatives.filter(p => p.isOwned);
   *   console.log(`User owns ${owned.length} of them`);
   * }
   *
   * // Get alternatives without ownership (for non-authenticated contexts)
   * const result = await binderService.getPrintingAlternatives('WTR001');
   * ```
   */
  getPrintingAlternatives(
    cardUniqueId: string,
    userId?: string
  ): AsyncResult<PrintingAlternativesResult>;

  // ====================================
  // Lookup and Export Operations
  // ====================================

  /**
   * Find binder by ID, slug, or discordExternalId
   * Consolidates various binder lookup patterns into a single method
   *
   * @param identifier - Can be MongoDB ObjectId, slug, or discordExternalId
   * @param userId - Optional user ID for ownership filtering
   * @returns Result containing binder or null if not found
   *
   * @example
   * ```typescript
   * // Find by ObjectId
   * const result = await binderService.findBinderByIdOrSlug('507f1f77bcf86cd799439011');
   *
   * // Find by slug for specific user
   * const result = await binderService.findBinderByIdOrSlug('trade-binder', 'user123');
   *
   * // Find by discordExternalId (backwards compatibility)
   * const result = await binderService.findBinderByIdOrSlug('my-discord-binder');
   * ```
   */
  findBinderByIdOrSlug(
    identifier: string,
    userId?: string
  ): AsyncResult<BinderDTO | null>;

  /**
   * Get all cards for export (no pagination)
   * Used by export routes that need complete card data
   *
   * @param binderId - The binder ID
   * @param userId - Optional user ID for access control
   * @returns Result containing all cards formatted for export
   *
   * @example
   * ```typescript
   * const result = await binderService.getAllCardsForExport('binder123', 'user123');
   * if (result.success) {
   *   console.log(`Exporting ${result.data.totalCards} cards`);
   * }
   * ```
   */
  getAllCardsForExport(
    binderId: string,
    userId?: string
  ): AsyncResult<ExportCardsResult>;

  /**
   * List user's binders as lightweight summaries
   * Returns only basic fields for performance
   * Excludes archived binders by default
   *
   * @param userId - The user ID
   * @returns Result containing array of binder summaries
   *
   * @example
   * ```typescript
   * const result = await binderService.listUserBindersSummary('user123');
   * if (result.success) {
   *   console.log(`User has ${result.data.length} binders`);
   * }
   * ```
   */
  listUserBindersSummary(userId: string): AsyncResult<BinderSummaryDTO[]>;

  /**
   * Get or create binder by slug
   * Used for Discord bot and API operations that need to ensure a binder exists
   *
   * @param userId - The user ID
   * @param slug - The binder slug
   * @returns Result containing existing or newly created binder
   *
   * @example
   * ```typescript
   * const result = await binderService.getOrCreateBinderBySlug('user123', 'trade-binder');
   * if (result.success) {
   *   console.log(`Binder ID: ${result.data._id}`);
   * }
   * ```
   */
  getOrCreateBinderBySlug(userId: string, slug: string): AsyncResult<BinderDTO>;

  /**
   * Get user's primary (first) binder
   * Used for legacy export functionality
   *
   * @param userId - The user ID
   * @returns Result containing user's first binder or null
   *
   * @example
   * ```typescript
   * const result = await binderService.getUserPrimaryBinder('user123');
   * ```
   */
  getUserPrimaryBinder(userId: string): AsyncResult<BinderDTO | null>;

  /**
   * Get binder stats system info
   * Returns processing statistics from system_info collection
   *
   * @returns Result containing stats info or null if not found
   *
   * @example
   * ```typescript
   * const result = await binderService.getBinderStatsSystemInfo();
   * if (result.success && result.data) {
   *   console.log(`Last run: ${result.data.lastRun}`);
   * }
   * ```
   */
  getBinderStatsSystemInfo(): AsyncResult<BinderStatsInfo | null>;

  /**
   * Get user's binders with stats for collection aggregation
   * Excludes archived binders by default
   *
   * @param userId - The user ID
   * @returns Result containing array of binders with their stats
   *
   * @example
   * ```typescript
   * const result = await binderService.getUserBindersWithStats('user123');
   * if (result.success) {
   *   const totalCards = result.data.reduce((sum, b) => sum + (b.stats?.totalQuantity || 0), 0);
   *   console.log(`User has ${totalCards} total cards across ${result.data.length} binders`);
   * }
   * ```
   */
  getUserBindersWithStats(userId: string): AsyncResult<BinderWithStatsDTO[]>;

  /**
   * Search for cards by name across all user's binders
   * Returns cards grouped by card ID with their locations
   *
   * @param userId - The user ID
   * @param searchQuery - The search term (case-insensitive)
   * @param limit - Maximum number of results (default: 50)
   * @returns Result containing array of cards with their binder locations
   *
   * @example
   * ```typescript
   * const result = await binderService.searchUserCards('user123', 'tunic');
   * if (result.success) {
   *   result.data.forEach(card => {
   *     console.log(`${card.name} found in ${card.locations.length} binder(s)`);
   *   });
   * }
   * ```
   */
  searchUserCards(userId: string, searchQuery: string, limit?: number): AsyncResult<CardSearchResultDTO[]>;
}
