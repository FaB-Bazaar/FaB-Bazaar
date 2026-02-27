// lib/services/mongodb/system-stats/MongoSystemStatsService.ts

import User from '@/models/User';
import InventoryItem from '@/models/InventoryItem';
import connectToDatabase from '@/lib/mongodb';
import {
  ISystemStatsService,
  HomepageStatsDTO,
  PricingStatsDTO,
} from '../../contracts/ISystemStatsService';
import { AsyncResult } from '../../contracts/common';
import { Db } from 'mongodb';

/**
 * MongoDB implementation of System Stats Service
 *
 * Provides system-wide statistics with caching:
 * - Homepage stats (users, printings) with 1-hour cache
 * - Pricing run status from system_info
 */
export class MongoSystemStatsService implements ISystemStatsService {
  private readonly CACHE_TTL_MS = 1 * 60 * 60 * 1000; // 1 hour
  private readonly CACHE_ID = 'homepage_stats';
  private readonly PRICING_SYSTEM_ID = 'binder_pricing_system';

  /**
   * Get database connection
   */
  private async getDb(): Promise<Db> {
    const { db } = await connectToDatabase();
    return db;
  }

  /**
   * Get homepage statistics with 1-hour caching
   *
   * Flow:
   * 1. Check stats_cache for fresh data (< 1 hour old)
   * 2. If stale/missing, run expensive queries
   * 3. Update cache with fresh data
   * 4. On error, fall back to stale cache
   */
  async getHomepageStats(): AsyncResult<HomepageStatsDTO> {
    try {
      const db = await this.getDb();

      // Step 1: Check cache
      const cachedStats = await db
        .collection('stats_cache')
        .findOne({ _id: this.CACHE_ID });

      const now = new Date();
      const cacheExpiryTime = new Date(now.getTime() - this.CACHE_TTL_MS);

      // Return cached data if fresh
      if (cachedStats && cachedStats.lastUpdated > cacheExpiryTime) {
        return {
          success: true,
          data: {
            totalUsers: cachedStats.stats.totalUsers,
            totalPrintings: cachedStats.stats.totalPrintings,
            metadata: {
              cached: true,
              lastUpdated: cachedStats.lastUpdated,
            },
          },
        };
      }

      // Step 2: Cache miss or stale - run expensive queries
      const freshData = await this.computeFreshStats();

      if (!freshData.success) {
        // Fallback to stale cache on error
        return this.fallbackToStaleCache(cachedStats);
      }

      const { totalUsers, totalPrintings } = freshData.data;

      // Step 3: Update cache
      await db.collection('stats_cache').replaceOne(
        { _id: this.CACHE_ID },
        {
          _id: this.CACHE_ID,
          stats: { totalUsers, totalPrintings },
          lastUpdated: now,
          nextUpdate: new Date(now.getTime() + this.CACHE_TTL_MS),
        },
        { upsert: true }
      );

      return {
        success: true,
        data: {
          totalUsers,
          totalPrintings,
          metadata: {
            cached: false,
            lastUpdated: now,
          },
        },
      };
    } catch (error) {
      console.error('[MongoSystemStatsService] getHomepageStats error:', error);

      // Try to fall back to stale cache
      try {
        const db = await this.getDb();
        const staleStats = await db
          .collection('stats_cache')
          .findOne({ _id: this.CACHE_ID });

        return this.fallbackToStaleCache(staleStats);
      } catch (cacheError) {
        console.error(
          '[MongoSystemStatsService] Stale cache fallback failed:',
          cacheError
        );
        return {
          success: false,
          error: 'Failed to fetch homepage stats and no cache available',
        };
      }
    }
  }

  /**
   * Compute fresh homepage stats from database
   *
   * Runs two expensive queries in parallel:
   * 1. User.countDocuments() - total users
   * 2. InventoryItem aggregation - sum of all card quantities
   */
  private async computeFreshStats(): AsyncResult<{
    totalUsers: number;
    totalPrintings: number;
  }> {
    try {
      const [totalUsers, inventoryStats] = await Promise.all([
        User.countDocuments(),
        InventoryItem.aggregate([
          { $group: { _id: null, totalQuantity: { $sum: '$quantity' } } },
        ]),
      ]);

      const totalPrintings =
        inventoryStats.length > 0 ? inventoryStats[0].totalQuantity : 0;

      return {
        success: true,
        data: { totalUsers, totalPrintings },
      };
    } catch (error) {
      console.error('[MongoSystemStatsService] computeFreshStats error:', error);
      return {
        success: false,
        error: 'Failed to compute fresh stats',
      };
    }
  }

  /**
   * Fallback to stale cache when fresh queries fail
   */
  private fallbackToStaleCache(
    cachedStats: any
  ): AsyncResult<HomepageStatsDTO> {
    if (cachedStats && cachedStats.stats) {
      return {
        success: true,
        data: {
          totalUsers: cachedStats.stats.totalUsers,
          totalPrintings: cachedStats.stats.totalPrintings,
          metadata: {
            cached: true,
            stale: true,
            lastUpdated: cachedStats.lastUpdated,
          },
        },
      };
    }

    return {
      success: false,
      error: 'Failed to fetch stats and no cache available',
    };
  }

  /**
   * Get pricing run statistics from system_info collection
   *
   * Reads binder_pricing_system document for:
   * - lastPricingRun: timestamp of last pricing cron
   * - updatedAt: last update timestamp
   *
   * Returns human-readable status (time ago, recency)
   */
  async getPricingStats(): AsyncResult<PricingStatsDTO> {
    try {
      const db = await this.getDb();

      const pricingInfo = await db
        .collection('system_info')
        .findOne(
          { _id: this.PRICING_SYSTEM_ID },
          { projection: { lastPricingRun: 1, updatedAt: 1 } }
        );

      if (!pricingInfo) {
        return {
          success: false,
          error: 'Pricing stats not found - no pricing run data available',
        };
      }

      const lastRun = pricingInfo.lastPricingRun || null;
      const updatedAt = pricingInfo.updatedAt || null;

      return {
        success: true,
        data: {
          lastRun,
          updatedAt,
          status: {
            lastRunAgo: this.getTimeAgo(lastRun),
            isRecent: this.isRecentUpdate(lastRun),
          },
        },
      };
    } catch (error) {
      console.error('[MongoSystemStatsService] getPricingStats error:', error);
      return {
        success: false,
        error: 'Failed to fetch pricing statistics',
      };
    }
  }

  /**
   * Calculate human-readable time ago string
   *
   * Examples: "2 days ago", "5 hours ago", "Just now"
   */
  private getTimeAgo(date: Date | null): string {
    if (!date) return 'Never';

    const now = new Date();
    const runTime = new Date(date);
    const diffMs = now.getTime() - runTime.getTime();

    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }

  /**
   * Check if update is recent (within last 24 hours)
   */
  private isRecentUpdate(date: Date | null): boolean {
    if (!date) return false;

    const now = new Date();
    const runTime = new Date(date);
    const diffMs = now.getTime() - runTime.getTime();
    const hoursAgo = diffMs / (1000 * 60 * 60);

    return hoursAgo <= 24;
  }
}
