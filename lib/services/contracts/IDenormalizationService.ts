/**
 * Denormalization Service Contract
 *
 * Database-agnostic interface for managing denormalized data.
 * Syncs denormalized fields across inventory items and wants items
 * when source documents are updated.
 */

import type { AsyncResult } from './common';

// ====================================
// DTOs (Data Transfer Objects)
// ====================================

/**
 * Result of a sync operation
 */
export interface SyncResultDTO {
  syncedCount: number;
}

/**
 * Result of a cleanup operation
 */
export interface CleanupResultDTO {
  deletedCount: number;
}

/**
 * Result of a batch sync operation
 */
export interface BatchSyncResultDTO {
  totalSynced: number;
  itemsProcessed: number;
}

// ====================================
// Service Interface
// ====================================

/**
 * Denormalization Service Interface
 *
 * Database-agnostic contract for denormalization sync operations.
 * All methods return AsyncResult<T> for consistent error handling.
 *
 * Denormalization is used for performance optimization - frequently
 * accessed fields are copied from parent documents to child documents
 * to avoid expensive joins at query time.
 *
 * @example
 * ```typescript
 * // After updating binder visibility, sync all inventory items
 * const result = await denormalizationService.syncInventoryWithBinder(binderId);
 *
 * if (result.success) {
 *   console.log(`Synced ${result.data.syncedCount} inventory items`);
 * }
 * ```
 */
export interface IDenormalizationService {
  // ====================================
  // Binder Denormalization
  // ====================================

  /**
   * Sync inventory items with binder settings
   *
   * Updates denormalized fields on inventory items when binder
   * settings change (visibility, name, slug, etc.).
   *
   * Fields synced:
   * - binderAllowWhoHas
   * - binderAllowInSearch
   * - binderAllowInMatching
   * - binderAllowDiscordCommands
   * - binderAllowApiExport
   * - binderIsPublic
   * - binderName
   * - binderSlug
   *
   * @param binderId - The binder ID whose settings changed
   * @param inventoryItemId - Optional specific item to sync (syncs all if omitted)
   * @returns Count of items synced
   */
  syncInventoryWithBinder(
    binderId: string,
    inventoryItemId?: string
  ): AsyncResult<SyncResultDTO>;

  // ====================================
  // Wants List Denormalization
  // ====================================

  /**
   * Sync wants items with user data
   *
   * Updates denormalized user fields on wants items when user
   * profile changes (username, location, etc.).
   *
   * Fields synced:
   * - discordUsername
   * - discordId
   * - userCountry
   * - userState
   *
   * @param userId - The user ID whose profile changed
   * @returns Count of items synced
   */
  syncWantsWithUser(
    userId: string
  ): AsyncResult<SyncResultDTO>;

  /**
   * Sync wants items with printing data
   *
   * Updates denormalized printing fields on wants items when
   * printing metadata changes (prices, name, etc.).
   *
   * Fields synced:
   * - card_unique_id, display_name, name
   * - set, edition, foiling, rarity
   * - collector_number, color, type_text
   * - is_extended_art, image_url, tcgplayer_url
   * - tcg_low, tcg_mid, tcg_high, tcg_market
   * - has_price, price_updated_at
   *
   * @param printingId - The printing ID whose data changed
   * @returns Count of items synced
   */
  syncWantsWithPrinting(
    printingId: string
  ): AsyncResult<SyncResultDTO>;

  /**
   * Batch sync multiple printings at once
   *
   * Useful for bulk metadata updates (e.g., price updates).
   *
   * @param printingIds - Array of printing IDs to sync
   * @returns Total count of items synced
   */
  batchSyncWantsWithPrintings(
    printingIds: string[]
  ): AsyncResult<BatchSyncResultDTO>;

  // ====================================
  // Cleanup Operations
  // ====================================

  /**
   * Clean up wants items for a deleted user
   *
   * Removes all wants items associated with a deleted user.
   * Should be called when a user account is deleted.
   *
   * @param userId - The deleted user's ID
   * @returns Count of items deleted
   */
  cleanupUserWantsItems(
    userId: string
  ): AsyncResult<CleanupResultDTO>;

  /**
   * Clean up wants items for a deleted printing
   *
   * Removes all wants items for a printing that no longer exists.
   * Should be called when a printing is removed from the database.
   *
   * @param printingId - The deleted printing ID
   * @returns Count of items deleted
   */
  cleanupPrintingWantsItems(
    printingId: string
  ): AsyncResult<CleanupResultDTO>;
}
