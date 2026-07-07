/**
 * Wants Service Contract
 *
 * Database-agnostic interface for wants list operations.
 * Follows the same patterns as IBinderService for consistency.
 */

import type { AsyncResult, PaginationOptions } from './common';

// ====================================
// DTOs (Data Transfer Objects)
// ====================================

/**
 * Wants item DTO - represents a single wants list entry
 * Contains denormalized user and printing data for performance
 */
export interface WantsItemDTO {
  _id: string;
  userId: string;
  printingId: string;
  card_unique_id: string;
  quantity: number;
  priority: 'high' | 'medium' | 'low';
  notes?: string;
  value?: string;

  // Privacy and flags
  isPublic?: boolean;
  isTemporary?: boolean;
  forTrade?: boolean;
  forSale?: boolean;

  // User organization
  tags?: string[];
  condition?: string;
  language?: string;

  // Denormalized user fields (for "who wants" queries)
  discordUsername?: string;
  discordId?: string;
  userCountry?: string;
  userState?: string;

  // Denormalized printing fields
  display_name: string;
  name: string;
  pitch?: number;
  set: string;
  edition: string;
  foiling: string;
  rarity: string;
  collector_number?: string;
  color?: string;
  type_text?: string;
  type_text_display?: string;
  card_text?: string;
  is_extended_art?: boolean;
  image_url?: string;
  tcgplayer_url?: string;
  artVariation?: string;

  // Pricing fields
  tcg_low?: number;
  tcg_mid?: number;
  tcg_high?: number;
  tcg_market?: number;
  has_price?: boolean;
  price_updated_at?: Date;

  // Timestamps
  printingCreatedAt?: Date;
  printingUpdatedAt?: Date;
  addedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * DTO for creating a new wants item
 */
export interface CreateWantsItemDTO {
  printingId: string;
  quantity?: number;
  priority?: 'high' | 'medium' | 'low';
  notes?: string;
}

/**
 * DTO for updating an existing wants item
 */
export interface UpdateWantsItemDTO {
  quantity?: number;
  priority?: 'high' | 'medium' | 'low';
  notes?: string;
  // Extended fields that can be updated
  value?: number;
  set?: string;
  rarity?: string;
  foiling?: string;
  edition?: string;
  artVariation?: string;
  image_url?: string;
}

/**
 * Filters for querying wants items
 */
export interface WantsFilters {
  search?: string;
  priority?: 'high' | 'medium' | 'low';
  set?: string;
  rarity?: string;
  foiling?: string;
  edition?: string;
}

/**
 * Result of adding a wants item
 */
export interface AddWantsResultDTO {
  success: boolean;
  action: 'created' | 'updated';
  item: WantsItemDTO;
  message?: string;
}

/**
 * Result of bulk adding wants items
 */
export interface BulkAddWantsResultDTO {
  summary: {
    total: number;
    added: number;
    updated: number;
    failed: number;
  };
  results: Array<{
    printingId: string;
    success: boolean;
    action?: 'created' | 'updated';
    error?: string;
  }>;
}

/**
 * Result of removing a wants item
 */
export interface RemoveWantsResultDTO {
  success: boolean;
  action: 'removed' | 'reduced';
  remainingQuantity?: number;
}

/**
 * DTO for importing cards (bulk import with name lookup)
 */
export interface ImportCardDTO {
  name?: string;
  printingId?: string;
  quantity?: number;
  priority?: 'high' | 'medium' | 'low';
  pitch?: number;
}

/**
 * Result of bulk import operation
 */
export interface ImportResultDTO {
  summary: {
    added: number;
    updated: number;
    skipped: number;
    notFound: number;
  };
  notFoundCards: string[];
  results?: Array<{
    name?: string;
    printingId?: string;
    success: boolean;
    action?: string;
    error?: string;
  }>;
}

/**
 * Paginated list result
 */
export interface WantsListResultDTO {
  items: WantsItemDTO[];
  total: number;
  page?: number;
  pages?: number;
}

/**
 * Wants statistics DTO (for Discord notifications and analytics)
 */
export interface WantsStatsDTO {
  totalUniqueCards: number;          // Number of unique printings (documents)
  totalCardQuantity: number;         // Sum of all quantities
  highPriorityUniqueCount: number;   // Unique high-priority items
  highPriorityQuantity: number;      // Sum of high-priority quantities
  totalEstimatedValue: number;
}

/**
 * Public wants list result (includes user info)
 */
export interface PublicWantsResultDTO {
  items: WantsItemDTO[];
  total: number;
  user: {
    _id: string;
    username?: string;
    discordUsername?: string;
    country?: string;
    state?: string;
  };
  isPublic: boolean;
}

/**
 * User info for "who wants" queries
 */
export interface WanterDTO {
  userId: string;
  username?: string;
  discordUsername?: string;
  discordId?: string;
  country?: string;
  state?: string;
  quantity: number;
  priority: string;
  addedAt: Date;
}

/**
 * Result of "who wants" query (single ID, simple result)
 */
export interface WhoWantsResultDTO {
  wanters: WanterDTO[];
  total: number;
  cardName?: string;
  printingId?: string;
  cardUniqueId?: string;
}

// ====================================
// Batch "Who Wants" DTOs (for API route)
// ====================================

/**
 * Filters for batch "who wants" queries
 */
export interface WhoWantsFilters {
  /** ISO2 country code filter */
  country?: string;
  /** State/province code filter */
  state?: string;
  /** Sort order for results */
  sortBy?: 'username' | 'quantity' | 'priority';
}

/**
 * A wanted card within a user's list
 */
export interface WantedCardDTO {
  printing_id: string;
  display_name: string;
  quantity: number;
  priority: 'high' | 'medium' | 'low';
  notes: string;
  tcg_market: number;
  tcg_low: number;
  set: string;
  edition: string;
  foiling: string;
  rarity: string;
  color: string;
  image_url: string;
  tags: string[];
}

/**
 * A user (wanter) with their wanted cards
 */
export interface WanterGroupedDTO {
  user_id: string;
  username: string;
  discord_id: string | null;
  country: string | null;
  wanted_cards: WantedCardDTO[];
  total_cards_wanted: number;
  total_value: number;
  unique_printings_wanted: number;
  high_priority_count: number;
}

/**
 * Summary statistics for batch "who wants" query
 */
export interface WhoWantsSummaryDTO {
  total_wanters_found: number;
  total_cards_wanted: number;
  total_unique_printings: number;
  high_priority_total: number;
  page: number;
  limit: number;
  total_pages: number;
  search_mode: 'specific_printings' | 'all_versions';
  filters_applied: {
    country: string | null;
    state: string | null;
  };
}

/**
 * Complete result of a batch "who wants" query
 */
export interface WhoWantsGroupedResultDTO {
  wanters: WanterGroupedDTO[];
  summary: WhoWantsSummaryDTO;
}

/**
 * DTO for wants export (CSV, JSON, etc.)
 */
export interface WantsExportDTO {
  printingId: string;
  display_name: string;
  set: string;
  foiling: string;
  quantity: number;
  priority: 'high' | 'medium' | 'low';
  notes?: string;
  addedAt: Date;
  tcg_market?: number;
  tcg_low?: number;
  image_url?: string;
}

// ====================================
// Service Interface
// ====================================

/**
 * Wants Service Interface
 *
 * Database-agnostic contract for wants list operations.
 * All methods return AsyncResult<T> for consistent error handling.
 *
 * @example
 * ```typescript
 * // Add a card to wants list
 * const result = await wantsService.addWantsItem(userId, {
 *   printingId: 'abc123',
 *   quantity: 2,
 *   priority: 'high'
 * });
 *
 * if (result.success) {
 *   console.log(`Added: ${result.data.item.display_name}`);
 * }
 * ```
 */
export interface IWantsService {
  // ====================================
  // Single Item Operations
  // ====================================

  /**
   * Get a single wants item by printing ID
   *
   * @param userId - User's ID
   * @param printingId - Printing ID to look up
   * @returns The wants item or null if not found
   */
  getWantsItem(userId: string, printingId: string): AsyncResult<WantsItemDTO | null>;

  /**
   * Add a card to wants list
   *
   * If the printing already exists, increments quantity.
   * Handles denormalization of user and printing data.
   *
   * @param userId - User's ID
   * @param data - Card data to add
   * @returns Result with action taken (created/updated)
   */
  addWantsItem(userId: string, data: CreateWantsItemDTO): AsyncResult<AddWantsResultDTO>;

  /**
   * Update an existing wants item
   *
   * @param userId - User's ID
   * @param printingId - Printing ID to update
   * @param updates - Fields to update
   * @returns Updated wants item
   */
  updateWantsItem(
    userId: string,
    printingId: string,
    updates: UpdateWantsItemDTO
  ): AsyncResult<WantsItemDTO>;

  /**
   * Remove a card from wants list
   *
   * If quantity specified and less than current, reduces quantity.
   * Otherwise removes the item completely.
   *
   * @param userId - User's ID
   * @param printingId - Printing ID to remove
   * @param quantity - Optional quantity to remove (removes all if not specified)
   * @returns Result with action taken (removed/reduced)
   */
  removeWantsItem(
    userId: string,
    printingId: string,
    quantity?: number
  ): AsyncResult<RemoveWantsResultDTO>;

  // ====================================
  // List Operations
  // ====================================

  /**
   * Get user's wants list with filtering and pagination
   *
   * @param userId - User's ID
   * @param filters - Optional filters
   * @param options - Pagination options
   * @returns Paginated list of wants items
   */
  getUserWants(
    userId: string,
    filters?: WantsFilters,
    options?: PaginationOptions
  ): AsyncResult<WantsListResultDTO>;

  /**
   * Count total wants items for a user
   *
   * @param userId - User's ID
   * @returns Total count
   */
  countUserWants(userId: string): AsyncResult<number>;

  /**
   * Get total quantity of all wants items for a user
   *
   * Unlike countUserWants which counts unique items,
   * this returns the sum of all quantities.
   *
   * @param userId - User's ID
   * @returns Total quantity (sum of all item quantities)
   */
  getTotalWantsQuantity(userId: string): AsyncResult<number>;

  /**
   * Get wants list statistics for a user
   *
   * Used for Discord notifications and analytics.
   *
   * @param userId - User's ID
   * @returns Stats including total count, high priority count, and estimated value
   */
  getWantsStats(userId: string): AsyncResult<WantsStatsDTO>;

  /**
   * Get another user's public wants list
   *
   * Respects privacy settings - returns error if list is private.
   *
   * @param userId - Target user's ID
   * @param filters - Optional filters
   * @param options - Pagination options
   * @returns Public wants list with user info
   */
  getPublicWants(
    userId: string,
    filters?: WantsFilters,
    options?: PaginationOptions
  ): AsyncResult<PublicWantsResultDTO>;

  // ====================================
  // Bulk Operations
  // ====================================

  /**
   * Add multiple cards to wants list
   *
   * @param userId - User's ID
   * @param items - Array of cards to add
   * @returns Summary of operations
   */
  bulkAddWants(userId: string, items: CreateWantsItemDTO[]): AsyncResult<BulkAddWantsResultDTO>;

  /**
   * Import cards with name-based lookup
   *
   * Supports importing by card name (with optional pitch) when printingId is not known.
   * Service handles card lookup from printings collection.
   *
   * @param userId - User's ID
   * @param cards - Array of cards to import
   * @returns Import summary with not-found list
   */
  bulkImportWants(userId: string, cards: ImportCardDTO[]): AsyncResult<ImportResultDTO>;

  // ====================================
  // "Who Wants" Queries
  // ====================================

  /**
   * Get all users who want a specific printing
   *
   * @param printingId - The printing ID to query
   * @param options - Pagination options
   * @returns List of users wanting this printing
   */
  getWhoWantsPrinting(
    printingId: string,
    options?: PaginationOptions
  ): AsyncResult<WhoWantsResultDTO>;

  /**
   * Get all users who want any printing of a card
   *
   * @param cardUniqueId - The card unique ID to query
   * @param options - Pagination options
   * @returns List of users wanting any printing of this card
   */
  getWhoWantsCard(
    cardUniqueId: string,
    options?: PaginationOptions
  ): AsyncResult<WhoWantsResultDTO>;

  // ====================================
  // Batch "Who Wants" Queries (for API route)
  // ====================================

  /**
   * Find all users who want specific printings (batch query)
   *
   * Queries by exact printingIds. Returns grouped results with full
   * aggregation matching the API route response shape.
   *
   * @param printingIds - Array of printing IDs to search (max 20)
   * @param filters - Optional filters (country, state, sortBy)
   * @param options - Pagination options (skip, limit for wanters)
   * @returns Grouped wanters with their wanted cards and summary
   */
  getWhoWantsPrintings(
    printingIds: string[],
    filters?: WhoWantsFilters,
    options?: PaginationOptions
  ): AsyncResult<WhoWantsGroupedResultDTO>;

  /**
   * Find all users who want any printing of specified cards (batch query)
   *
   * Queries by card_unique_id to find all versions/printings.
   * Returns grouped results with full aggregation.
   *
   * @param cardUniqueIds - Array of card unique IDs to search (max 20)
   * @param filters - Optional filters (country, state, sortBy)
   * @param options - Pagination options (skip, limit for wanters)
   * @returns Grouped wanters with their wanted cards and summary
   */
  getWhoWantsCards(
    cardUniqueIds: string[],
    filters?: WhoWantsFilters,
    options?: PaginationOptions
  ): AsyncResult<WhoWantsGroupedResultDTO>;

  // ====================================
  // Trade Analysis Methods
  // ====================================

  /**
   * Get all wants items for a user
   *
   * Returns all wants items for a user (simplified format for trade analysis).
   *
   * @param userId - The user's ID
   * @returns Array of wants items
   */
  getAllWantsForUser(
    userId: string
  ): AsyncResult<WantsItemDTO[]>;

  // ====================================
  // Export Methods
  // ====================================

  /**
   * Export all wants items for a user
   *
   * Returns all user's wants with full card details for export.
   * Used by /user/export/wants endpoint.
   *
   * @param userId - The user's ID
   * @returns Array of wants items with export-ready data
   *
   * @example
   * ```typescript
   * const result = await wantsService.exportWants(userId);
   * if (result.success) {
   *   // Can format as CSV, JSON, or other export format
   *   console.log(`Exporting ${result.data.length} wants items`);
   * }
   * ```
   */
  exportWants(userId: string): AsyncResult<WantsExportDTO[]>;
}
