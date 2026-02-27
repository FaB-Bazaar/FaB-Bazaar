/**
 * Binder Stats Service Contract
 *
 * Database-agnostic interface for binder statistics operations.
 * Handles calculation, caching, and batch updates of binder stats.
 */

import type { AsyncResult } from './common';

// ====================================
// DTOs (Data Transfer Objects)
// ====================================

/**
 * Price values across different pricing types
 */
export interface PriceValuesDTO {
  tcg_market: number;
  tcg_low: number;
  tcg_mid: number;
  tcg_high: number;
}

/**
 * Card counts by rarity
 */
export interface RarityCountsDTO {
  [rarity: string]: number;
}

/**
 * Showcase card (top valuable cards)
 */
export interface ShowcaseCardDTO {
  printingId: string;
  tcg_low: number;
  rarity: string;
}

/**
 * Complete binder statistics
 */
export interface BinderStatsDTO {
  totalQuantity: number;
  quantityForTrade: number;
  quantityNotForTrade: number;
  totalValue: PriceValuesDTO;
  valueForTrade: PriceValuesDTO;
  valueNotForTrade: PriceValuesDTO;
  rarityCounts: RarityCountsDTO;
  rarityCountsForTrade: RarityCountsDTO;
  rarityCountsNotForTrade: RarityCountsDTO;
  showcaseCards: ShowcaseCardDTO[];
  statsUpdatedAt: Date;
}

/**
 * Options for triggering stats updates
 */
export interface TriggerOptionsDTO {
  /** If true, don't wait for completion */
  async?: boolean;
  /** Card rarity for priority determination */
  rarity?: string;
  /** Force immediate update regardless of rarity */
  force?: boolean;
  /** Reason for the update (for logging) */
  reason?: string;
}

/**
 * Result of a batch stats update
 */
export interface BatchUpdateResultDTO {
  binderId: string;
  success: boolean;
  stats?: BinderStatsDTO;
  error?: string;
  processingTime?: number;
}

/**
 * Price update for a printing
 */
export interface PriceUpdateDTO {
  printingId: string;
  tcg_market: number;
  tcg_low: number;
  tcg_mid: number;
  tcg_high: number;
}

/**
 * Result of processing price updates
 */
export interface PriceUpdateResultDTO {
  priceUpdatesProcessed: number;
  bindersMarkedDirty: number;
}

/**
 * Result of updating dirty binders with tracking
 */
export interface BinderStatsTrackingResultDTO {
  processed: number;
  successful: number;
  failed: number;
  processingTimeSeconds: string;
  avgProcessingTimePerBinder: number;
  timestamp: string;
}

// ====================================
// Service Interface
// ====================================

/**
 * Binder Stats Service Interface
 *
 * Database-agnostic contract for binder statistics operations.
 * All methods return AsyncResult<T> for consistent error handling.
 *
 * ## Architecture Notes
 *
 * The stats system uses a "dirty flag" pattern for efficiency:
 * 1. When inventory changes, binders are marked as "dirty" (statsNeedUpdate: true)
 * 2. High-value cards (M, L, F, V rarities) trigger immediate updates
 * 3. Other cards rely on background job to process dirty binders
 *
 * Performance optimization: Uses client-side aggregation instead of
 * MongoDB aggregation pipeline (tested 50% faster due to better index usage).
 *
 * @example
 * ```typescript
 * // Trigger stats update after adding a card
 * await binderStatsService.triggerUpdate(binderId, {
 *   rarity: 'M',
 *   reason: 'card_added'
 * });
 *
 * // Process dirty binders in background
 * const results = await binderStatsService.updateDirtyBinders(100);
 * console.log(`Updated ${results.length} binders`);
 * ```
 */
export interface IBinderStatsService {
  // ====================================
  // Calculation Operations
  // ====================================

  /**
   * Calculate stats for a binder without saving
   *
   * Performs client-side aggregation of inventory items.
   * Does not modify the binder document.
   *
   * @param binderId - The binder ID
   * @returns Calculated statistics
   */
  calculateStats(
    binderId: string
  ): AsyncResult<BinderStatsDTO>;

  /**
   * Update binder with calculated stats
   *
   * Calculates stats and saves them to the binder document.
   * Also clears the dirty flag (statsNeedUpdate: false).
   *
   * @param binderId - The binder ID
   * @returns The updated statistics
   */
  updateStats(
    binderId: string
  ): AsyncResult<BinderStatsDTO>;

  // ====================================
  // Dirty Flag Operations
  // ====================================

  /**
   * Trigger a stats update for a binder
   *
   * Always marks the binder as dirty. For high-value cards
   * (M, L, F, V rarities) or forced updates, processes immediately.
   * Otherwise, the background job will handle it.
   *
   * Call this after any inventory_items CRUD operation.
   *
   * @param binderId - The binder ID
   * @param options - Trigger options
   */
  triggerUpdate(
    binderId: string,
    options?: TriggerOptionsDTO
  ): AsyncResult<void>;

  /**
   * Update stats for all dirty binders
   *
   * Finds binders with statsNeedUpdate: true and processes them.
   * Used by background cron job.
   *
   * @param limit - Maximum number of binders to process (default 100)
   * @returns Results for each processed binder
   */
  updateDirtyBinders(
    limit?: number
  ): AsyncResult<BatchUpdateResultDTO[]>;

  /**
   * Update dirty binders with system_info tracking
   *
   * Processes dirty binders and updates the system_info collection
   * with execution stats for monitoring. This is the preferred method
   * for cron jobs.
   *
   * @param limit - Maximum number of binders to process (default 100)
   * @returns Aggregated execution statistics
   */
  updateDirtyBindersWithTracking(
    limit?: number
  ): AsyncResult<BinderStatsTrackingResultDTO>;

  // ====================================
  // Batch Operations
  // ====================================

  /**
   * Batch update stats for multiple binders
   *
   * Processes binders in chunks (default 20) to prevent
   * memory issues and timeouts.
   *
   * @param binderIds - Array of binder IDs to update
   * @param chunkSize - Number of binders per chunk (default 20)
   * @returns Results for each processed binder
   */
  batchUpdateStats(
    binderIds: string[],
    chunkSize?: number
  ): AsyncResult<BatchUpdateResultDTO[]>;

  /**
   * Process price updates and mark affected binders as dirty
   *
   * Updates prices on inventory items and marks affected binders
   * for stats recalculation. The actual stats update is handled
   * by the background cron job.
   *
   * @param updates - Array of price updates
   * @returns Count of updates processed and binders marked dirty
   */
  processPriceUpdates(
    updates: PriceUpdateDTO[]
  ): AsyncResult<PriceUpdateResultDTO>;

  // ====================================
  // Utility Operations
  // ====================================

  /**
   * Check if a rarity should trigger immediate stats update
   *
   * High-value rarities (M, L, F, V) trigger immediate updates.
   * This is a pure function that doesn't access the database.
   *
   * @param rarity - The card rarity code
   * @returns True if this rarity should trigger immediate update
   */
  shouldTriggerImmediateUpdate(
    rarity?: string
  ): boolean;

  /**
   * Migrate all binders to have calculated stats
   *
   * Used for initial migration or repair. Processes all binders
   * in batches.
   *
   * @param batchSize - Number of binders per batch (default 25)
   */
  migrateAllBinders(
    batchSize?: number
  ): AsyncResult<void>;
}
