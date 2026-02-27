/**
 * MongoDB implementation of Binder Stats Service
 *
 * Handles calculation, caching, and batch updates of binder statistics.
 * Uses client-side aggregation (tested 50% faster than MongoDB pipelines).
 *
 * Key patterns preserved:
 * - Dirty flag pattern for lazy updates
 * - 20-item chunk size for batch operations
 * - Client-side aggregation for optimal performance
 */

import connectToDatabase from '@/lib/mongodb';
import { Types } from 'mongoose';
import type {
  IBinderStatsService,
  BinderStatsDTO,
  TriggerOptionsDTO,
  BatchUpdateResultDTO,
  PriceUpdateDTO,
  PriceUpdateResultDTO,
  PriceValuesDTO,
  ShowcaseCardDTO,
  BinderStatsTrackingResultDTO,
} from '../../contracts/IBinderStatsService';
import type { AsyncResult } from '../../contracts/common';

/**
 * Internal type for inventory item from MongoDB
 */
interface InventoryItemDoc {
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
}

export class MongoBinderStatsService implements IBinderStatsService {
  /**
   * Ensure database connection and return db reference
   */
  private async getDb() {
    const { db } = await connectToDatabase();
    return db;
  }

  /**
   * Check if a rarity should trigger immediate stats update
   * High-value rarities (M, L, F, V) trigger immediate updates.
   */
  shouldTriggerImmediateUpdate(rarity?: string): boolean {
    if (!rarity) return false;
    const highValueRarities = ['M', 'L', 'F', 'V']; // Majestic, Legendary, Fabled, Marvel
    return highValueRarities.includes(rarity.toUpperCase());
  }

  /**
   * Calculate stats for a binder without saving
   */
  async calculateStats(binderId: string): AsyncResult<BinderStatsDTO> {
    try {
      const db = await this.getDb();
      const binderObjectId = new Types.ObjectId(binderId);

      // Optimized query with projection to minimize network transfer
      const items = await db.collection<InventoryItemDoc>('inventory_items').find(
        { binderId: binderObjectId },
        {
          projection: {
            quantity: 1,
            forTrade: 1,
            tcg_market: 1,
            tcg_low: 1,
            tcg_mid: 1,
            tcg_high: 1,
            rarity: 1,
            printingId: 1,
          },
        }
      ).toArray();

      // Initialize stats with complete price type support
      const stats: BinderStatsDTO = {
        totalQuantity: 0,
        quantityForTrade: 0,
        quantityNotForTrade: 0,
        totalValue: { tcg_market: 0, tcg_low: 0, tcg_mid: 0, tcg_high: 0 },
        valueForTrade: { tcg_market: 0, tcg_low: 0, tcg_mid: 0, tcg_high: 0 },
        valueNotForTrade: { tcg_market: 0, tcg_low: 0, tcg_mid: 0, tcg_high: 0 },
        rarityCounts: {},
        rarityCountsForTrade: {},
        rarityCountsNotForTrade: {},
        showcaseCards: [],
        statsUpdatedAt: new Date(),
      };

      // Track showcase candidates during main processing
      const showcaseCandidates: ShowcaseCardDTO[] = [];

      // Single-pass processing for optimal performance
      items.forEach((item) => {
        const qty = item.quantity || 1;
        const isForTrade = item.forTrade || false;
        const rarity = item.rarity || 'C';

        // Robust price handling with fallback to zero
        const prices: PriceValuesDTO = {
          tcg_market: item.tcg_market || 0,
          tcg_low: item.tcg_low || 0,
          tcg_mid: item.tcg_mid || 0,
          tcg_high: item.tcg_high || 0,
        };

        // Quantity calculations
        stats.totalQuantity += qty;
        if (isForTrade) {
          stats.quantityForTrade += qty;
        } else {
          stats.quantityNotForTrade += qty;
        }

        // Value calculations for all price types
        (Object.keys(prices) as (keyof PriceValuesDTO)[]).forEach((priceType) => {
          const value = qty * prices[priceType];
          stats.totalValue[priceType] += value;

          if (isForTrade) {
            stats.valueForTrade[priceType] += value;
          } else {
            stats.valueNotForTrade[priceType] += value;
          }
        });

        // Rarity count calculations
        stats.rarityCounts[rarity] = (stats.rarityCounts[rarity] || 0) + qty;

        if (isForTrade) {
          stats.rarityCountsForTrade[rarity] = (stats.rarityCountsForTrade[rarity] || 0) + qty;
        } else {
          stats.rarityCountsNotForTrade[rarity] = (stats.rarityCountsNotForTrade[rarity] || 0) + qty;
        }

        // Collect showcase candidates (only cards with pricing data)
        if (item.printingId && prices.tcg_low > 0) {
          showcaseCandidates.push({
            printingId: item.printingId,
            tcg_low: prices.tcg_low,
            rarity: rarity,
          });
        }
      });

      // Calculate showcase cards - top 6 most expensive by tcg_low
      stats.showcaseCards = showcaseCandidates
        .sort((a, b) => b.tcg_low - a.tcg_low)
        .slice(0, 6);

      return { success: true, data: stats };
    } catch (error) {
      console.error(`[MongoBinderStatsService] calculateStats error for ${binderId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate binder stats',
      };
    }
  }

  /**
   * Update binder with calculated stats
   */
  async updateStats(binderId: string): AsyncResult<BinderStatsDTO> {
    try {
      console.log(`[MongoBinderStatsService] Calculating stats for binder ${binderId}`);

      const statsResult = await this.calculateStats(binderId);
      if (!statsResult.success) {
        return statsResult;
      }

      const stats = statsResult.data;
      const db = await this.getDb();
      const binderObjectId = new Types.ObjectId(binderId);

      // Atomic update operation - include clearing the dirty flag
      await db.collection('binders').updateOne(
        { _id: binderObjectId },
        {
          $set: {
            ...stats,
            statsNeedUpdate: false, // Clear the dirty flag
          },
        }
      );

      console.log(`[MongoBinderStatsService] Updated stats for binder ${binderId}:`, {
        totalQuantity: stats.totalQuantity,
        totalValue: stats.totalValue.tcg_low,
        rarities: Object.keys(stats.rarityCounts).length,
        showcaseCards: stats.showcaseCards.length,
      });

      return { success: true, data: stats };
    } catch (error) {
      console.error(`[MongoBinderStatsService] updateStats error for ${binderId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update binder stats',
      };
    }
  }

  /**
   * Trigger a stats update for a binder
   */
  async triggerUpdate(
    binderId: string,
    options: TriggerOptionsDTO = {}
  ): AsyncResult<void> {
    try {
      const { async = true, rarity, force = false, reason = 'unknown' } = options;

      const db = await this.getDb();
      const binderObjectId = new Types.ObjectId(binderId);

      // Always mark the binder as needing an update
      await db.collection('binders').updateOne(
        { _id: binderObjectId },
        { $set: { statsNeedUpdate: true } }
      );

      console.log(`[MongoBinderStatsService] Marked binder ${binderId} as needing stats update (reason: ${reason})`);

      // For high-value cards or forced updates, process immediately
      if (force || this.shouldTriggerImmediateUpdate(rarity)) {
        console.log(`[MongoBinderStatsService] Processing immediate stats update for high-value rarity: ${rarity}`);

        if (async) {
          // Don't make user wait for stats calculation
          this.updateStats(binderId).catch((error) => {
            console.error('[MongoBinderStatsService] Async stats update failed:', error);
          });
        } else {
          // Synchronous update (slower but guaranteed completion)
          await this.updateStats(binderId);
        }
      }

      return { success: true, data: undefined };
    } catch (error) {
      console.error(`[MongoBinderStatsService] triggerUpdate error for ${binderId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to trigger stats update',
      };
    }
  }

  /**
   * Update stats for all dirty binders
   */
  async updateDirtyBinders(limit: number = 100): AsyncResult<BatchUpdateResultDTO[]> {
    try {
      console.log(`[MongoBinderStatsService] Finding dirty binders (limit: ${limit})`);

      const db = await this.getDb();

      // Find binders that need stats updates
      const dirtyBinders = await db.collection('binders')
        .find(
          { statsNeedUpdate: true },
          { projection: { _id: 1 } }
        )
        .limit(limit)
        .toArray();

      if (dirtyBinders.length === 0) {
        console.log('[MongoBinderStatsService] No dirty binders found');
        return { success: true, data: [] };
      }

      console.log(`[MongoBinderStatsService] Found ${dirtyBinders.length} dirty binders to update`);

      const binderIds = dirtyBinders.map((b) => b._id.toString());
      return await this.batchUpdateStats(binderIds);
    } catch (error) {
      console.error('[MongoBinderStatsService] updateDirtyBinders error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update dirty binders',
      };
    }
  }

  /**
   * Update dirty binders with system_info tracking
   */
  async updateDirtyBindersWithTracking(limit: number = 100): AsyncResult<BinderStatsTrackingResultDTO> {
    const startTime = Date.now();

    try {
      const db = await this.getDb();

      // Process dirty binders
      const result = await this.updateDirtyBinders(limit);

      if (!result.success) {
        // Update system_info with error status
        try {
          await db.collection('system_info').replaceOne(
            { _id: 'binder_stats_system' },
            {
              _id: 'binder_stats_system',
              lastStatsRun: new Date(),
              stats: {
                bindersProcessed: 0,
                bindersSuccessful: 0,
                bindersFailed: 0,
                processingTimeSeconds: (Date.now() - startTime) / 1000,
                error: result.error,
                batchSize: limit,
              },
              updatedAt: new Date(),
            },
            { upsert: true }
          );
        } catch (systemInfoError) {
          console.error('[MongoBinderStatsService] Failed to update system_info on error:', systemInfoError);
        }

        return {
          success: false,
          error: result.error,
        };
      }

      const results = result.data;
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      const processingTimeSeconds = (Date.now() - startTime) / 1000;

      // Calculate aggregate stats
      const totalProcessingTime = results.reduce((sum, r) => sum + (r.processingTime || 0), 0);
      const avgProcessingTimePerBinder = results.length > 0 ? totalProcessingTime / results.length : 0;

      // Update system_info collection
      await db.collection('system_info').replaceOne(
        { _id: 'binder_stats_system' },
        {
          _id: 'binder_stats_system',
          lastStatsRun: new Date(),
          stats: {
            bindersProcessed: results.length,
            bindersSuccessful: successful,
            bindersFailed: failed,
            processingTimeSeconds: processingTimeSeconds,
            avgProcessingTimePerBinder: Math.round(avgProcessingTimePerBinder),
            batchSize: limit,
          },
          updatedAt: new Date(),
        },
        { upsert: true }
      );

      console.log('[MongoBinderStatsService] Binder stats completed:', {
        processed: results.length,
        successful,
        failed,
        processingTimeSeconds: processingTimeSeconds.toFixed(2),
      });

      return {
        success: true,
        data: {
          processed: results.length,
          successful,
          failed,
          processingTimeSeconds: processingTimeSeconds.toFixed(2),
          avgProcessingTimePerBinder: Math.round(avgProcessingTimePerBinder),
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[MongoBinderStatsService] updateDirtyBindersWithTracking error:', error);

      // Update system_info with error status
      try {
        const db = await this.getDb();
        await db.collection('system_info').replaceOne(
          { _id: 'binder_stats_system' },
          {
            _id: 'binder_stats_system',
            lastStatsRun: new Date(),
            stats: {
              bindersProcessed: 0,
              bindersSuccessful: 0,
              bindersFailed: 0,
              processingTimeSeconds: (Date.now() - startTime) / 1000,
              error: error instanceof Error ? error.message : 'Unknown error',
              batchSize: limit,
            },
            updatedAt: new Date(),
          },
          { upsert: true }
        );
      } catch (systemInfoError) {
        console.error('[MongoBinderStatsService] Failed to update system_info on error:', systemInfoError);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update dirty binders with tracking',
      };
    }
  }

  /**
   * Batch update stats for multiple binders
   */
  async batchUpdateStats(
    binderIds: string[],
    chunkSize: number = 20
  ): AsyncResult<BatchUpdateResultDTO[]> {
    try {
      console.log(`[MongoBinderStatsService] Batch updating stats for ${binderIds.length} binders in chunks of ${chunkSize}`);

      const results: BatchUpdateResultDTO[] = [];

      // Process in chunks to avoid memory issues and timeouts
      for (let i = 0; i < binderIds.length; i += chunkSize) {
        const chunk = binderIds.slice(i, i + chunkSize);
        console.log(`[MongoBinderStatsService] Processing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(binderIds.length / chunkSize)}`);

        // Process chunk in parallel
        const chunkPromises = chunk.map(async (binderId) => {
          const startTime = Date.now();
          const result = await this.updateStats(binderId);
          const processingTime = Date.now() - startTime;

          if (result.success) {
            return { binderId, success: true, stats: result.data, processingTime };
          } else {
            return { binderId, success: false, error: result.error, processingTime };
          }
        });

        const chunkResults = await Promise.allSettled(chunkPromises);

        // Collect results from this chunk
        chunkResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            console.error('[MongoBinderStatsService] Unexpected promise rejection:', result.reason);
          }
        });

        // Brief pause between chunks to prevent overwhelming the database
        if (i + chunkSize < binderIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      const avgTime = results.length > 0
        ? Math.round(results.reduce((sum, r) => sum + (r.processingTime || 0), 0) / results.length)
        : 0;

      console.log(`[MongoBinderStatsService] Batch complete: ${successful} successful, ${failed} failed, ${avgTime}ms avg per binder`);

      return { success: true, data: results };
    } catch (error) {
      console.error('[MongoBinderStatsService] batchUpdateStats error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to batch update stats',
      };
    }
  }

  /**
   * Process price updates and mark affected binders as dirty
   */
  async processPriceUpdates(updates: PriceUpdateDTO[]): AsyncResult<PriceUpdateResultDTO> {
    try {
      console.log(`[MongoBinderStatsService] Processing ${updates.length} price updates`);

      const db = await this.getDb();
      const affectedBinders = new Set<string>();

      // 1. Update prices for all affected inventory items using bulk operations
      const bulkOps = updates.map((priceUpdate) => ({
        updateMany: {
          filter: { printingId: priceUpdate.printingId },
          update: {
            $set: {
              tcg_market: priceUpdate.tcg_market,
              tcg_low: priceUpdate.tcg_low,
              tcg_mid: priceUpdate.tcg_mid,
              tcg_high: priceUpdate.tcg_high,
              price_updated_at: new Date(),
            },
          },
        },
      }));

      // Execute bulk price updates
      if (bulkOps.length > 0) {
        await db.collection('inventory_items').bulkWrite(bulkOps);
      }

      // 2. Find all affected binders in one query
      const printingIds = updates.map((p) => p.printingId);
      const affectedItems = await db.collection('inventory_items')
        .find(
          { printingId: { $in: printingIds } },
          { projection: { binderId: 1 } }
        )
        .toArray();

      affectedItems.forEach((item) => affectedBinders.add(item.binderId.toString()));

      // 3. Mark all affected binders as dirty - cron job will process them
      const binderObjectIds = Array.from(affectedBinders).map((id) => new Types.ObjectId(id));

      if (binderObjectIds.length > 0) {
        await db.collection('binders').updateMany(
          { _id: { $in: binderObjectIds } },
          { $set: { statsNeedUpdate: true } }
        );
        console.log(`[MongoBinderStatsService] Marked ${binderObjectIds.length} binders as dirty due to price updates`);
      }

      return {
        success: true,
        data: {
          priceUpdatesProcessed: updates.length,
          bindersMarkedDirty: binderObjectIds.length,
        },
      };
    } catch (error) {
      console.error('[MongoBinderStatsService] processPriceUpdates error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process price updates',
      };
    }
  }

  /**
   * Migrate all binders to have calculated stats
   */
  async migrateAllBinders(batchSize: number = 25): AsyncResult<void> {
    try {
      console.log('[MongoBinderStatsService] Starting binder stats migration...');

      const db = await this.getDb();

      const binders = await db.collection('binders')
        .find({}, { projection: { _id: 1 } })
        .toArray();

      console.log(`[MongoBinderStatsService] Found ${binders.length} binders to migrate`);

      const binderIds = binders.map((b) => b._id.toString());
      const resultsResult = await this.batchUpdateStats(binderIds, batchSize);

      if (!resultsResult.success) {
        return { success: false, error: resultsResult.error };
      }

      const results = resultsResult.data;
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      console.log(`[MongoBinderStatsService] Migration completed: ${successful}/${binders.length} binders updated, ${failed} failed`);

      if (failed > 0) {
        console.log('[MongoBinderStatsService] Failed binders:', results.filter((r) => !r.success).map((r) => r.binderId));
      }

      return { success: true, data: undefined };
    } catch (error) {
      console.error('[MongoBinderStatsService] migrateAllBinders error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to migrate binders',
      };
    }
  }
}
