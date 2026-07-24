/**
 * Wants Client Service
 *
 * Client-side API abstraction for wants list operations.
 * Consolidates 27+ fetch() calls from 11 different components.
 */

import type { ApiResponse } from './types';
import { buildQueryParams, handleResponse, handleError } from './utils';

// Import types from server-side contract
import type {
  WantsItemDTO,
  CreateWantsItemDTO,
  UpdateWantsItemDTO,
  WantsFilters,
  AddWantsResultDTO,
  BulkAddWantsResultDTO,
  RemoveWantsResultDTO,
  WantsListResultDTO,
  WantsStatsDTO,
  PublicWantsResultDTO,
  ImportCardDTO,
  ImportResultDTO,
  AcquireCardInputDTO,
  AcquireWantsResultDTO,
} from '@/lib/services/contracts/IWantsService';

// ====================================
// User's Wants Operations
// ====================================

/**
 * Get user's wants list with filtering and pagination
 *
 * @param filters - Optional filters (search, priority, set, rarity, etc.)
 * @param options - Pagination options (page, limit)
 * @returns Paginated list of wants items
 *
 * @example
 * ```typescript
 * const result = await getUserWants(
 *   { priority: 'high', set: 'HVY' },
 *   { page: 1, limit: 50 }
 * );
 * ```
 */
export async function getUserWants(
  filters?: WantsFilters,
  options?: { page?: number; limit?: number }
): Promise<ApiResponse<WantsListResultDTO>> {
  try {
    const params = buildQueryParams({
      page: options?.page || 1,
      limit: options?.limit || 50,
      ...filters,
    });

    const response = await fetch(`/api/wants?${params.toString()}`);
    return await handleResponse<WantsListResultDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Get another user's public wants list
 *
 * @param userId - Target user's ID
 * @param filters - Optional filters
 * @param options - Pagination options
 * @returns Public wants list with user info
 *
 * @example
 * ```typescript
 * const result = await getWantsForUser('user123', { priority: 'high' });
 * if (result.success && result.data.isPublic) {
 *   console.log(result.data.items);
 * }
 * ```
 */
export async function getWantsForUser(
  userId: string,
  filters?: WantsFilters,
  options?: { page?: number; limit?: number }
): Promise<ApiResponse<PublicWantsResultDTO>> {
  try {
    const params = buildQueryParams({
      page: options?.page || 1,
      limit: options?.limit || 50,
      ...filters,
    });

    const response = await fetch(`/api/wants/user/${userId}?${params.toString()}`);
    return await handleResponse<PublicWantsResultDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

// ====================================
// Add/Update/Remove Operations
// ====================================

/**
 * Add a card to wants list
 *
 * If the printing already exists, increments quantity.
 *
 * @param printingId - The printing ID to add
 * @param quantity - Quantity to add (default: 1)
 * @param priority - Priority level (default: 'medium')
 * @returns Result with action taken (created/updated)
 *
 * @example
 * ```typescript
 * const result = await addWantsItem('printingId123', 2, 'high');
 * if (result.success) {
 *   console.log(`${result.data.action}: ${result.data.item.display_name}`);
 * }
 * ```
 */
export async function addWantsItem(
  printingId: string,
  quantity: number = 1,
  priority: 'high' | 'medium' | 'low' = 'medium'
): Promise<ApiResponse<AddWantsResultDTO>> {
  try {
    const response = await fetch('/api/wants/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printingId, quantity, priority }),
    });
    return await handleResponse<AddWantsResultDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Update an existing wants item
 *
 * @param printingId - The printing ID to update
 * @param updates - Fields to update
 * @returns Updated wants item
 *
 * @example
 * ```typescript
 * const result = await updateWantsItem('printingId123', {
 *   quantity: 3,
 *   priority: 'low',
 *   notes: 'Looking for NM only'
 * });
 * ```
 */
export async function updateWantsItem(
  printingId: string,
  updates: UpdateWantsItemDTO
): Promise<ApiResponse<WantsItemDTO>> {
  try {
    const response = await fetch(`/api/wants/${printingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return await handleResponse<WantsItemDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Remove a card from wants list
 *
 * If removeAll is false and quantity is less than current, reduces quantity.
 * Otherwise removes the item completely.
 *
 * @param printingId - The printing ID to remove
 * @param removeAll - Whether to remove all quantity (default: true)
 * @param quantity - Quantity to remove (only used if removeAll is false)
 * @returns Result with action taken (removed/reduced)
 *
 * @example
 * ```typescript
 * // Remove all of this card
 * await removeWantsItem('printingId123', true);
 *
 * // Remove only 1 quantity
 * await removeWantsItem('printingId123', false, 1);
 * ```
 */
export async function removeWantsItem(
  printingId: string,
  removeAll: boolean = true,
  quantity?: number
): Promise<ApiResponse<RemoveWantsResultDTO>> {
  try {
    const response = await fetch('/api/wants/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printingId, removeAll, quantity }),
    });
    return await handleResponse<RemoveWantsResultDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Mark wants cards as acquired into a binder
 *
 * Adds the cards to the target binder and reduces/removes the corresponding
 * wants items in a single transactional operation.
 *
 * @param targetBinderId - Binder to add the acquired cards to
 * @param cards - Printings and quantities to acquire
 * @returns Per-card results and a summary
 *
 * @example
 * ```typescript
 * const result = await acquireWantsItems('binderId123', [
 *   { printingId: 'abc', quantity: 2 },
 * ]);
 * if (result.success) {
 *   console.log(`Acquired ${result.data.summary.totalQuantityAcquired} cards`);
 * }
 * ```
 */
export async function acquireWantsItems(
  targetBinderId: string,
  cards: AcquireCardInputDTO[]
): Promise<ApiResponse<AcquireWantsResultDTO>> {
  try {
    const response = await fetch('/api/wants/acquire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetBinderId, cards }),
    });
    return await handleResponse<AcquireWantsResultDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

// ====================================
// Bulk Operations
// ====================================

/**
 * Add multiple cards to wants list
 *
 * @param items - Array of cards to add
 * @returns Summary of operations
 *
 * @example
 * ```typescript
 * const result = await bulkAddWants([
 *   { printingId: 'abc', quantity: 2, priority: 'high' },
 *   { printingId: 'def', quantity: 1, priority: 'medium' }
 * ]);
 * console.log(`Added: ${result.data.summary.added}`);
 * ```
 */
export async function bulkAddWants(
  items: CreateWantsItemDTO[]
): Promise<ApiResponse<BulkAddWantsResultDTO>> {
  try {
    const response = await fetch('/api/wants/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printings: items }),
    });
    return await handleResponse<BulkAddWantsResultDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Import cards with name-based lookup
 *
 * Supports importing by card name when printingId is not known.
 *
 * @param cards - Array of cards to import
 * @returns Import summary with not-found list
 *
 * @example
 * ```typescript
 * const result = await bulkImportWants([
 *   { name: 'Command and Conquer', quantity: 2 },
 *   { name: 'Art of War', pitch: 3, quantity: 4 }
 * ]);
 * console.log(`Not found: ${result.data.notFoundCards.join(', ')}`);
 * ```
 */
export async function bulkImportWants(
  cards: ImportCardDTO[]
): Promise<ApiResponse<ImportResultDTO>> {
  try {
    const response = await fetch('/api/wants/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards }),
    });
    return await handleResponse<ImportResultDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

// ====================================
// Export & Stats Operations
// ====================================

/**
 * Export wants list for download
 *
 * @returns All wants items formatted for export
 *
 * @example
 * ```typescript
 * const result = await exportWants();
 * if (result.success) {
 *   const blob = new Blob([JSON.stringify(result.data)], { type: 'application/json' });
 *   // ... download blob
 * }
 * ```
 */
export async function exportWants(): Promise<ApiResponse<WantsItemDTO[]>> {
  try {
    const response = await fetch('/api/wants/export');
    return await handleResponse<WantsItemDTO[]>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Get wants list statistics
 *
 * @returns Stats including total count, high priority count, and estimated value
 *
 * @example
 * ```typescript
 * const result = await getWantsStats();
 * if (result.success) {
 *   console.log(`Total value: $${result.data.totalEstimatedValue.toFixed(2)}`);
 *   console.log(`High priority: ${result.data.highPriorityUniqueCount} cards`);
 * }
 * ```
 */
export async function getWantsStats(): Promise<ApiResponse<WantsStatsDTO>> {
  try {
    const response = await fetch('/api/wants/stats');
    return await handleResponse<WantsStatsDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Get total quantity of wants items
 *
 * Lightweight endpoint that returns only the sum of all quantities.
 * Uses the existing /api/wants?count=true endpoint.
 *
 * @returns Total quantity of all wants items
 *
 * @example
 * ```typescript
 * const result = await getTotalQuantity();
 * if (result.success) {
 *   console.log(`You want ${result.data} cards`);
 * }
 * ```
 */
export async function getTotalQuantity(): Promise<ApiResponse<number>> {
  try {
    const response = await fetch('/api/wants?count=true');
    const result = await handleResponse<{ totalCards: number }>(response);

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      data: result.data.totalCards,
    };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Check if a specific printing is on the user's wants list
 *
 * @param printingId - The printing ID to check
 * @returns The wants item if found, null otherwise
 *
 * @example
 * ```typescript
 * const result = await checkWantsItem('printingId123');
 * if (result.success && result.data) {
 *   console.log(`Already want ${result.data.quantity} of this card`);
 * }
 * ```
 */
export async function checkWantsItem(
  printingId: string
): Promise<ApiResponse<WantsItemDTO | null>> {
  try {
    const response = await fetch(`/api/wants/check/${printingId}`);
    return await handleResponse<WantsItemDTO | null>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Notify the wants-list owner (via Discord channel webhook) that the
 * current user copied cards from their wants list — i.e. "I have some
 * of the cards you're looking for".
 *
 * Fire-and-forget: the clipboard copy already succeeded, so a failed or
 * deduped ping must never surface as an error to the user.
 */
export function notifyWantsInterest(
  ownerUserId: string,
  payload: {
    cards: Array<{ name: string; quantity: number; value: number }>;
    totalValue?: number;
  }
): void {
  fetch(`/api/wants/user/${ownerUserId}/notify-interest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    // best-effort notification — nothing to do on failure
  });
}
