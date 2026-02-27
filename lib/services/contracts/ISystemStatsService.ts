// lib/services/contracts/ISystemStatsService.ts

import { AsyncResult } from './common';

/**
 * Homepage stats returned by the service
 */
export interface HomepageStatsDTO {
  totalUsers: number;
  totalPrintings: number;
  metadata: {
    cached: boolean;
    stale?: boolean;
    lastUpdated: Date;
  };
}

/**
 * Pricing run status information
 */
export interface PricingStatsDTO {
  lastRun: Date | null;
  updatedAt: Date | null;
  status: {
    lastRunAgo: string;
    isRecent: boolean;
  };
}

/**
 * System Stats Service
 *
 * Provides system-wide statistics with caching for performance.
 *
 * Collections accessed:
 * - stats_cache (homepage stats with 1-hour TTL)
 * - users (total user count)
 * - inventory_items (total printings aggregation)
 * - system_info (pricing run timestamps)
 *
 * Methods:
 * - getHomepageStats(): Retrieve homepage stats with 1-hour cache
 * - getPricingStats(): Retrieve pricing run status from system_info
 */
export interface ISystemStatsService {
  /**
   * Get homepage statistics (users, printings) with 1-hour caching
   *
   * Caching strategy:
   * 1. Check cache freshness (1 hour TTL)
   * 2. If stale/missing, run expensive queries (User count, InventoryItem aggregation)
   * 3. Update cache with new data
   * 4. On error, fall back to stale cache if available
   *
   * @returns Homepage stats with cache metadata
   */
  getHomepageStats(): AsyncResult<HomepageStatsDTO>;

  /**
   * Get pricing run statistics from system_info collection
   *
   * Reads binder_pricing_system document:
   * - lastPricingRun: timestamp of last pricing cron
   * - updatedAt: last system_info update
   *
   * Status calculation:
   * - lastRunAgo: human-readable time (e.g., "2 hours ago")
   * - isRecent: true if run within last 24 hours
   *
   * @returns Pricing run statistics
   */
  getPricingStats(): AsyncResult<PricingStatsDTO>;
}
