// lib/denormalization/binderDenormalization.ts
// NOTE: This file now uses the service layer - no direct MongoDB access.

import { denormalizationService } from '@/lib/services';

/**
 * Sync inventory items with binder settings
 *
 * @deprecated Prefer using denormalizationService.syncInventoryWithBinder() directly
 *
 * @param binderId - Binder ID (string or ObjectId)
 * @param _db - DEPRECATED: No longer used, kept for backwards compatibility
 * @param inventoryItemId - Optional specific inventory item to sync
 */
export async function syncInventoryItemWithBinder(
  binderId: { toString(): string },
  _db: unknown,
  inventoryItemId?: { toString(): string }
): Promise<void> {
  const result = await denormalizationService.syncInventoryWithBinder(
    binderId.toString(),
    inventoryItemId?.toString()
  );

  if (!result.success) {
    throw new Error(result.error || 'Failed to sync inventory item with binder');
  }
}