// lib/stats/binderStats.ts
// NOTE: This file now uses the service layer - no direct MongoDB access.
// All functions delegate to binderStatsService for backwards compatibility.

import { binderStatsService } from '@/lib/services';
import type {
  BinderStatsDTO,
  TriggerOptionsDTO,
  BatchUpdateResultDTO,
  PriceUpdateDTO,
  PriceValuesDTO,
  RarityCountsDTO,
  ShowcaseCardDTO,
} from '@/lib/services/contracts/IBinderStatsService';

// Re-export types for backwards compatibility
export type BinderStats = BinderStatsDTO;
export type TriggerOptions = TriggerOptionsDTO;
export type BatchUpdateResult = BatchUpdateResultDTO;
export type PriceUpdate = PriceUpdateDTO;
export type PriceValues = PriceValuesDTO;
export type RarityCounts = RarityCountsDTO;
export type ShowcaseCard = ShowcaseCardDTO;

// Legacy type kept for backwards compatibility
export interface InventoryItem {
  _id: any;
  binderId: any;
  userId: any;
  quantity: number;
  forTrade: boolean;
  tcg_market?: number;
  tcg_low?: number;
  tcg_mid?: number;
  tcg_high?: number;
  rarity: string;
  printingId?: string;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Check if a card rarity should trigger stats recalculation
 * Only recalculate for high-value rarities to reduce MongoDB costs
 *
 * @deprecated Prefer using binderStatsService.shouldTriggerImmediateUpdate() directly
 */
export function shouldTriggerStatsUpdate(rarity?: string): boolean {
  return binderStatsService.shouldTriggerImmediateUpdate(rarity);
}

/**
 * Calculate comprehensive binder statistics
 *
 * @deprecated Prefer using binderStatsService.calculateStats() directly
 *
 * @param binderId - Binder ID (ObjectId or string)
 * @param _db - DEPRECATED: No longer used, kept for backwards compatibility
 */
export async function calculateBinderStats(
  binderId: { toString(): string },
  _db: unknown
): Promise<BinderStats> {
  const result = await binderStatsService.calculateStats(binderId.toString());

  if (!result.success) {
    throw new Error(result.error || 'Failed to calculate binder stats');
  }

  return result.data;
}

/**
 * Update binder document with calculated stats and clear dirty flag
 *
 * @deprecated Prefer using binderStatsService.updateStats() directly
 *
 * @param binderId - Binder ID (ObjectId or string)
 * @param _db - DEPRECATED: No longer used, kept for backwards compatibility
 */
export async function updateBinderStats(
  binderId: { toString(): string },
  _db: unknown
): Promise<BinderStats> {
  const result = await binderStatsService.updateStats(binderId.toString());

  if (!result.success) {
    throw new Error(result.error || 'Failed to update binder stats');
  }

  return result.data;
}

/**
 * Trigger stats update - always mark as dirty, optionally process immediately
 * Call this after any inventory_items CRUD operation
 *
 * @deprecated Prefer using binderStatsService.triggerUpdate() directly
 *
 * @param binderId - Binder ID (ObjectId or string)
 * @param _db - DEPRECATED: No longer used, kept for backwards compatibility
 * @param options - Trigger options
 */
export async function triggerBinderStatsUpdate(
  binderId: { toString(): string },
  _db: unknown,
  options: TriggerOptions = {}
): Promise<void> {
  const result = await binderStatsService.triggerUpdate(binderId.toString(), options);

  if (!result.success) {
    throw new Error(result.error || 'Failed to trigger binder stats update');
  }
}

/**
 * Update stats only for binders that have the dirty flag set
 * This is the efficient way to handle stats updates in background jobs
 *
 * @deprecated Prefer using binderStatsService.updateDirtyBinders() directly
 *
 * @param _db - DEPRECATED: No longer used, kept for backwards compatibility
 * @param limit - Maximum number of binders to process
 */
export async function updateDirtyBinderStats(
  _db: unknown,
  limit: number = 100
): Promise<BatchUpdateResult[]> {
  const result = await binderStatsService.updateDirtyBinders(limit);

  if (!result.success) {
    throw new Error(result.error || 'Failed to update dirty binder stats');
  }

  return result.data;
}

/**
 * Batch update stats for multiple binders with optimized processing
 * Uses chunking to prevent memory issues and timeout problems
 *
 * @deprecated Prefer using binderStatsService.batchUpdateStats() directly
 *
 * @param binderIds - Array of binder IDs (ObjectId or string)
 * @param _db - DEPRECATED: No longer used, kept for backwards compatibility
 * @param chunkSize - Number of binders per chunk
 */
export async function batchUpdateBinderStats(
  binderIds: Array<{ toString(): string }>,
  _db: unknown,
  chunkSize: number = 20
): Promise<BatchUpdateResult[]> {
  const binderIdStrings = binderIds.map((id) => id.toString());
  const result = await binderStatsService.batchUpdateStats(binderIdStrings, chunkSize);

  if (!result.success) {
    throw new Error(result.error || 'Failed to batch update binder stats');
  }

  return result.data;
}

/**
 * Process bulk price updates and mark affected binders as dirty
 * All stats processing will be handled by background cron job
 *
 * @deprecated Prefer using binderStatsService.processPriceUpdates() directly
 *
 * @param priceUpdates - Array of price updates
 * @param _db - DEPRECATED: No longer used, kept for backwards compatibility
 */
export async function processPriceUpdates(
  priceUpdates: PriceUpdate[],
  _db: unknown
): Promise<{
  priceUpdatesProcessed: number;
  bindersMarkedDirty: number;
}> {
  const result = await binderStatsService.processPriceUpdates(priceUpdates);

  if (!result.success) {
    throw new Error(result.error || 'Failed to process price updates');
  }

  return result.data;
}

/**
 * Migration function to populate stats for existing binders
 * Uses batch processing for efficiency
 *
 * @deprecated Prefer using binderStatsService.migrateAllBinders() directly
 *
 * @param _db - DEPRECATED: No longer used, kept for backwards compatibility
 * @param batchSize - Number of binders per batch
 */
export async function migrateBinders(
  _db: unknown,
  batchSize: number = 25
): Promise<void> {
  const result = await binderStatsService.migrateAllBinders(batchSize);

  if (!result.success) {
    throw new Error(result.error || 'Failed to migrate binders');
  }
}
