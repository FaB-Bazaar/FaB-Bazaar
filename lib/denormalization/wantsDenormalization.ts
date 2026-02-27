// lib/denormalization/wantsDenormalization.ts
// NOTE: This file now uses the service layer - no direct MongoDB access.

import { denormalizationService } from '@/lib/services';

/**
 * Sync all wants items with updated user data
 * Updates denormalized user fields (username, location, etc.)
 *
 * @deprecated Prefer using denormalizationService.syncWantsWithUser() directly
 *
 * @param userId - User ID whose wants items should be synced
 * @param _db - DEPRECATED: No longer used, kept for backwards compatibility
 */
export async function syncWantsItemsWithUser(
  userId: { toString(): string } | string,
  _db: unknown
): Promise<void> {
  const userIdStr = typeof userId === 'string' ? userId : userId.toString();
  const result = await denormalizationService.syncWantsWithUser(userIdStr);

  if (!result.success) {
    throw new Error(result.error || 'Failed to sync wants items with user');
  }
}

/**
 * Sync all wants items with updated printing/card data
 * Updates denormalized card metadata (name, set, prices, etc.)
 *
 * @deprecated Prefer using denormalizationService.syncWantsWithPrinting() directly
 *
 * @param printingId - Printing ID whose wants items should be synced
 * @param _db - DEPRECATED: No longer used, kept for backwards compatibility
 */
export async function syncWantsItemsWithPrinting(
  printingId: string,
  _db: unknown
): Promise<void> {
  const result = await denormalizationService.syncWantsWithPrinting(printingId);

  if (!result.success) {
    throw new Error(result.error || 'Failed to sync wants items with printing');
  }
}

/**
 * Clean up all wants items for a deleted user
 * Should be called when a user account is deleted
 *
 * @deprecated Prefer using denormalizationService.cleanupUserWantsItems() directly
 *
 * @param userId - User ID whose wants items should be deleted
 * @param _db - DEPRECATED: No longer used, kept for backwards compatibility
 */
export async function cleanupUserWantsItems(
  userId: { toString(): string } | string,
  _db: unknown
): Promise<void> {
  const userIdStr = typeof userId === 'string' ? userId : userId.toString();
  const result = await denormalizationService.cleanupUserWantsItems(userIdStr);

  if (!result.success) {
    throw new Error(result.error || 'Failed to cleanup user wants items');
  }
}

/**
 * Clean up all wants items for a deleted printing
 * Should be called when a printing is removed from the database
 *
 * @deprecated Prefer using denormalizationService.cleanupPrintingWantsItems() directly
 *
 * @param printingId - Printing ID whose wants items should be deleted
 * @param _db - DEPRECATED: No longer used, kept for backwards compatibility
 */
export async function cleanupPrintingWantsItems(
  printingId: string,
  _db: unknown
): Promise<void> {
  const result = await denormalizationService.cleanupPrintingWantsItems(printingId);

  if (!result.success) {
    throw new Error(result.error || 'Failed to cleanup printing wants items');
  }
}

/**
 * Batch sync multiple printings at once (useful for bulk metadata updates)
 *
 * @deprecated Prefer using denormalizationService.batchSyncWantsWithPrintings() directly
 *
 * @param printingIds - Array of printing IDs to sync
 * @param _db - DEPRECATED: No longer used, kept for backwards compatibility
 */
export async function batchSyncWantsItemsWithPrintings(
  printingIds: string[],
  _db: unknown
): Promise<void> {
  const result = await denormalizationService.batchSyncWantsWithPrintings(printingIds);

  if (!result.success) {
    throw new Error(result.error || 'Failed batch sync');
  }
}
