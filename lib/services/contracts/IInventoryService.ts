/**
 * Inventory Service Contract
 *
 * Database-agnostic interface for inventory queries, specifically
 * the "who has" functionality for finding card owners.
 *
 * This service queries denormalized inventory_items collection.
 */

import type { AsyncResult, PaginationOptions } from './common';

// ====================================
// Filter Options
// ====================================

/**
 * Filters for "who has" queries
 */
export interface WhoHasFilters {
  /** Only include items marked for trade */
  forTradeOnly?: boolean;
  /** Minimum card condition (NM, LP, MP, HP, DMG) */
  minCondition?: 'NM' | 'LP' | 'MP' | 'HP' | 'DMG';
  /** ISO2 country code filter */
  country?: string;
  /** State/province code filter */
  state?: string;
  /** Exclude binders not touched in X days (uses lastActivityAt with fallback to updatedAt/createdAt) */
  activeWithinDays?: number;
}

// ====================================
// Result DTOs
// ====================================

/**
 * A matching card within a binder
 */
export interface MatchingCardDTO {
  printing_id: string;
  display_name: string;
  total_quantity: number;
  conditions: Record<string, number>;
  tcg_market?: number;
  tcg_low?: number;
  set: string;
  edition: string;
  foiling: string;
  rarity: string;
  image_url?: string;
}

/**
 * A binder containing matching cards
 */
export interface BinderMatchDTO {
  binder_id: string;
  binder_name: string;
  binder_slug: string;
  matching_cards: MatchingCardDTO[];
  total_cards_found: number;
  total_value: number;
}

/**
 * An owner (user) with their binders containing matching cards
 */
export interface OwnerDTO {
  user_id: string;
  username: string;
  discord_id: string;
  avatar_url: string | null;
  binders: BinderMatchDTO[];
  total_cards_found: number;
  total_value: number;
  unique_printings_found: number;
}

/**
 * Summary statistics for the query
 */
export interface WhoHasSummaryDTO {
  total_owners_found: number;
  total_cards_found: number;
  total_value_found: number;
  ids_requested: number;
  unique_printings_found: number;
  items_before_filtering: number;
  items_after_filtering: number;
}

/**
 * Pagination and filter metadata
 */
export interface WhoHasMetadataDTO {
  current_page: number;
  total_pages: number;
  owners_per_page: number;
  owners_in_page: number;
  has_next_page: boolean;
  has_previous_page: boolean;
  filters_applied: {
    for_trade_only: boolean;
    min_condition: string | null;
    country: string | null;
    state: string | null;
    binder_allow_who_has: boolean;
  };
}

/**
 * Complete result of a "who has" query
 */
export interface WhoHasResultDTO {
  requested_ids: string[];
  search_mode: 'specific_printings' | 'all_versions';
  summary: WhoHasSummaryDTO;
  metadata: WhoHasMetadataDTO;
  owners: OwnerDTO[];
}

// ====================================
// Service Interface
// ====================================

/**
 * Inventory Service Interface
 *
 * Provides methods for querying inventory items across users,
 * specifically the "who has" functionality.
 *
 * @example
 * ```typescript
 * const result = await inventoryService.getWhoHasPrintings(
 *   ['printing-id-1', 'printing-id-2'],
 *   { forTradeOnly: true, country: 'US' },
 *   { skip: 0, limit: 50 }
 * );
 *
 * if (result.success) {
 *   console.log(`Found ${result.data.summary.total_owners_found} owners`);
 * }
 * ```
 */
export interface IInventoryService {
  /**
   * Find all owners who have specific printings
   *
   * Queries by exact printingId. Returns grouped results:
   * owners → binders → matching cards.
   *
   * @param printingIds - Array of printing IDs to search (max 20)
   * @param filters - Optional filters (forTrade, condition, geo, stores)
   * @param options - Pagination options (skip, limit for owners)
   * @returns Grouped owners with their matching inventory
   */
  getWhoHasPrintings(
    printingIds: string[],
    filters?: WhoHasFilters,
    options?: PaginationOptions
  ): AsyncResult<WhoHasResultDTO>;

  /**
   * Find all owners who have any printing of specified cards
   *
   * Queries by card_unique_id to find all versions/printings.
   * Returns grouped results: owners → binders → matching cards.
   *
   * @param cardUniqueIds - Array of card unique IDs to search (max 20)
   * @param filters - Optional filters (forTrade, condition, geo, stores)
   * @param options - Pagination options (skip, limit for owners)
   * @returns Grouped owners with their matching inventory
   */
  getWhoHasCards(
    cardUniqueIds: string[],
    filters?: WhoHasFilters,
    options?: PaginationOptions
  ): AsyncResult<WhoHasResultDTO>;

  // ====================================
  // Trade Analysis Methods
  // ====================================

  /**
   * Get tradeable inventory items for a user
   *
   * Returns items from binders where:
   * - forTrade: true
   * - binderAllowWhoHas: true (allows trading/matching)
   *
   * Used by trade analysis to find what a user has available to trade.
   *
   * @param userId - The user's ID
   * @returns Array of tradeable inventory items
   */
  getTradeableItems(
    userId: string
  ): AsyncResult<TradeableItemDTO[]>;

  // ====================================
  // Public API Methods
  // ====================================

  /**
   * Get paginated tradeable cards for a user (public endpoint)
   *
   * Returns cards from binders where forTrade: true.
   * Supports search, sorting, and pagination.
   *
   * Used by /users/[userId]/tradeable-cards endpoint.
   *
   * @param userId - The user's ID
   * @param options - Pagination, search, and sort options
   * @returns Paginated tradeable cards
   *
   * @example
   * ```typescript
   * const result = await inventoryService.getTradeableCards(userId, {
   *   skip: 0,
   *   limit: 20,
   *   search: 'arakni',
   *   sortBy: 'price',
   *   sortOrder: 'desc'
   * });
   * ```
   */
  getTradeableCards(
    userId: string,
    options: TradeableCardsOptions
  ): AsyncResult<PaginatedTradeableCards>;

  getStoreTradeMatches(
    storeId: string,
    userId: string
  ): AsyncResult<StoreTradeMatchDTO[]>;

  /**
   * For each card on the user's wants list, which followers of the given store
   * have it for trade. Card-first view ("who at this store has what I want").
   * Only counts for-trade items in binders with allowInMatching, owned by other
   * users who follow the store. Returns only wanted cards with ≥1 owner.
   */
  getStoreWantMatches(
    storeId: string,
    userId: string
  ): AsyncResult<StoreWantMatchDTO[]>;

  /**
   * Sum owned quantity per printingId for a user.
   *
   * Returns a map of printingId → total owned across all the user's binders.
   * Missing keys = user owns 0 of that printing. Empty input returns {}.
   */
  getOwnedCountsByPrintingId(
    userId: string,
    printingIds: string[]
  ): AsyncResult<Record<string, number>>;

  /**
   * Sum owned quantity per cardUniqueId for a user (any printing counts).
   *
   * Returns a map of cardUniqueId → total owned across all printings of that card.
   * Missing keys = user owns 0. Empty input returns {}.
   */
  getOwnedCountsByCardUniqueId(
    userId: string,
    cardUniqueIds: string[]
  ): AsyncResult<Record<string, number>>;
}

// ====================================
// Store Trade Match DTOs
// ====================================

export interface StoreTradeCardDTO {
  printingId: string;
  collectorNumber?: string | null;
  displayName: string;
  set: string;
  foiling: string;
  /** How many the current user wants (theyHaveYouWant) or has forTrade (theyWantYouHave) */
  quantity: number;
  tcgMarket?: number | null;
  imageUrl?: string | null;
}

export interface StoreTradeMatchDTO {
  userId: string;
  username: string;
  displayUsername?: string | null;
  avatarUrl?: string | null;
  theyHaveYouWant: StoreTradeCardDTO[];
  theyWantYouHave: StoreTradeCardDTO[];
}

/** An owner (store follower) who has a wanted card for trade. */
export interface StoreWantMatchOwnerDTO {
  userId: string;
  username: string;
  displayUsername?: string | null;
  avatarUrl?: string | null;
  /** How many of this printing the owner has for trade (matching binders). */
  quantity: number;
}

/** A card on the viewer's wants list that ≥1 store follower has for trade. */
export interface StoreWantMatchDTO {
  printingId: string;
  collectorNumber?: string | null;
  displayName: string;
  set: string;
  foiling: string;
  imageUrl?: string | null;
  tcgMarket?: number | null;
  /** How many the viewer wants. */
  wantedQuantity: number;
  owners: StoreWantMatchOwnerDTO[];
}

/**
 * Simplified inventory item for trade analysis
 */
export interface TradeableItemDTO {
  _id: string;
  userId: string;
  binderId: string;
  printingId: string;
  card_unique_id?: string;
  quantity: number;
  forTrade: boolean;
  display_name?: string;
  name?: string;
  set?: string;
  rarity?: string;
  tcg_low?: number;
  tcg_market?: number;
}

// ====================================
// Public Tradeable Cards (for /users/[userId]/tradeable-cards)
// ====================================

/**
 * Options for querying tradeable cards
 */
export interface TradeableCardsOptions extends PaginationOptions {
  /** Search query (partial match on card name) */
  search?: string;
  /** Sort field */
  sortBy?: 'name' | 'set' | 'price' | 'quantity';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

/**
 * A single tradeable card for display
 */
export interface TradeableCardDTO {
  _id: string;
  printingId: string;
  display_name: string;
  set: string;
  foiling: string;
  condition: string;
  quantity: number;
  forTrade: boolean;
  tcg_market?: number;
  image_url?: string;
  binderId: string;
  binderName: string;
}

/**
 * Paginated result of tradeable cards
 */
export interface PaginatedTradeableCards {
  items: TradeableCardDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
