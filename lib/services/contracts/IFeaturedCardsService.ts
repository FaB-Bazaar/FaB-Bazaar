/**
 * Featured Cards Service Contract
 *
 * Manages featured cards for the homepage.
 * Handles cron-based refresh and caching of high-value tradeable cards.
 */

import type { AsyncResult } from './common';

// ====================================
// DTOs (Data Transfer Objects)
// ====================================

/**
 * Featured Card DTO - Card featured on homepage
 */
export interface FeaturedCardDTO {
  printing_id: string;
  card_unique_id: string;
  name: string;
  set: string;
  foiling?: string;
  rarity?: string;
  edition?: string;
  tcg_market: number;
  image_url: string;
  uniqueOwners: number;
  totalQuantity: number;
  featuredScore: number;
  tcgplayer_url?: string | null;
  is_extended_art?: boolean;
}

/**
 * Featured Cards Refresh Result DTO
 */
export interface FeaturedCardsRefreshResultDTO {
  cardsRefreshed: number;
  setsProcessed: number;
  processingTimeSeconds: string;
  timestamp: string;
}

/**
 * Featured Cards Cache DTO
 */
export interface FeaturedCardsCacheDTO {
  _id: string;
  cards: FeaturedCardDTO[];
  lastUpdated: Date;
  nextUpdate: Date;
}

// ====================================
// Service Interface
// ====================================

/**
 * Featured Cards Service Interface
 *
 * Manages the homepage featured cards cache and refresh logic.
 */
export interface IFeaturedCardsService {
  /**
   * Refresh featured cards cache
   *
   * Runs aggregation pipelines to find high-value tradeable cards,
   * enriches them with TCGplayer data, and updates the cache.
   * Typically called by a cron job every 12 hours.
   *
   * @returns Result containing refresh statistics
   *
   * @example
   * ```typescript
   * const result = await featuredCardsService.refreshFeaturedCards();
   * if (result.success) {
   *   console.log(`Refreshed ${result.data.cardsRefreshed} featured cards`);
   * }
   * ```
   */
  refreshFeaturedCards(): AsyncResult<FeaturedCardsRefreshResultDTO>;

  /**
   * Get current featured cards from cache
   *
   * Returns the cached featured cards without triggering a refresh.
   *
   * @returns Result containing cached featured cards
   *
   * @example
   * ```typescript
   * const result = await featuredCardsService.getFeaturedCards();
   * if (result.success && result.data) {
   *   console.log(`Found ${result.data.cards.length} featured cards`);
   * }
   * ```
   */
  getFeaturedCards(): AsyncResult<FeaturedCardsCacheDTO | null>;
}
