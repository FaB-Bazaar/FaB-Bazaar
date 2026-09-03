/**
 * Binders Client Service
 *
 * Client-side API abstraction for binder operations.
 * Consolidates 30+ fetch() calls from 18 different components.
 */

import type { ApiResponse } from './types';
import { buildQueryParams, handleResponse, handleError } from './utils';

// Import types from server-side contract
import type {
  BinderDTO,
  CreateBinderDTO,
  UpdateBinderDTO,
  BinderCardFilters,
  BinderCardSearchOptions,
  BinderCardsResult,
  InventoryCardDTO,
  AddCardDTO,
  AddCardsResultDTO,
  UpdateCardDTO,
  SwapPrintingResultDTO,
  BulkUpdateResultDTO,
  TransferResultDTO,
  TransferCardInput,
  TransferSelectedResultDTO,
  CopyBinderOptions,
  ExportCardsResult,
  BinderSummaryDTO,
  PrintingAlternativesResult,
} from '@/lib/services/contracts/IBinderService';

// ====================================
// Binder CRUD Operations
// ====================================

/**
 * Get a single binder by ID
 *
 * @param binderId - The binder ID
 * @returns Binder data or error
 *
 * @example
 * ```typescript
 * const result = await getBinder('123');
 * if (result.success) {
 *   console.log(result.data.name);
 * }
 * ```
 */
export async function getBinder(
  binderId: string
): Promise<ApiResponse<BinderDTO>> {
  try {
    const response = await fetch(`/api/binders/${binderId}`);
    return await handleResponse<BinderDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Get user's binders list
 *
 * @returns Array of user's binders
 *
 * @example
 * ```typescript
 * const result = await getUserBinders();
 * if (result.success) {
 *   console.log(`Found ${result.data.length} binders`);
 * }
 * ```
 */
export async function getUserBinders(): Promise<
  ApiResponse<{ binders: BinderSummaryDTO[] }>
> {
  try {
    const response = await fetch('/api/binders/user');
    return await handleResponse<{ binders: BinderSummaryDTO[] }>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Create a new binder
 *
 * @param data - Binder creation data
 * @returns Created binder
 *
 * @example
 * ```typescript
 * const result = await createBinder({
 *   name: 'Trade Binder',
 *   isPublic: true
 * });
 * ```
 */
export async function createBinder(
  data: CreateBinderDTO
): Promise<ApiResponse<BinderDTO>> {
  try {
    const response = await fetch('/api/binders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await handleResponse<BinderDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

export interface SetBinderResult {
  binderId: string;
  binderName: string;
  slug?: string;
  summary: { total: number; added: number; failed: number };
}

export interface ExistingSetBinder {
  binderId: string;
  binderName: string;
  slug?: string;
}

export type CreateSetBinderResponse =
  | { success: true; data: SetBinderResult }
  | { success: false; error: string; code?: string; existing?: ExistingSetBinder };

/**
 * Create a "{username} - {SETCODE}" binder holding 1 copy of each card in a
 * set, filtered by foilings (s/r/c) and optional edition.
 *
 * Nonstandard body handling: on 409 the route returns the existing binder
 * under `data` beside `error` — handleResponse drops it, so parse manually
 * (pinned by binders-client.set-binder.test.ts).
 */
export async function createSetBinder(
  setCode: string,
  options: { foilings: string[]; edition?: string }
): Promise<CreateSetBinderResponse> {
  try {
    const response = await fetch(`/api/sets/${setCode}/binder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        error: body?.error || `HTTP ${response.status}: ${response.statusText}`,
        code: `HTTP_${response.status}`,
        ...(response.status === 409 && body?.data
          ? { existing: body.data as ExistingSetBinder }
          : {}),
      };
    }
    return { success: true, data: body.data as SetBinderResult };
  } catch (error) {
    return handleError(error) as CreateSetBinderResponse;
  }
}

/**
 * Update binder metadata
 *
 * @param binderId - The binder ID
 * @param updates - Fields to update
 * @returns Updated binder
 *
 * @example
 * ```typescript
 * const result = await updateBinder('123', {
 *   name: 'New Name',
 *   isPublic: false
 * });
 * ```
 */
export async function updateBinder(
  binderId: string,
  updates: UpdateBinderDTO
): Promise<ApiResponse<BinderDTO>> {
  try {
    const response = await fetch(`/api/binders/${binderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return await handleResponse<BinderDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Delete a binder
 *
 * @param binderId - The binder ID
 * @returns Success status
 *
 * @example
 * ```typescript
 * const result = await deleteBinder('123');
 * if (result.success) {
 *   console.log('Binder deleted');
 * }
 * ```
 */
export async function deleteBinder(
  binderId: string
): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const response = await fetch(`/api/binders/${binderId}`, {
      method: 'DELETE',
    });
    return await handleResponse<{ success: boolean }>(response);
  } catch (error) {
    return handleError(error);
  }
}

// ====================================
// Card Management Operations
// ====================================

/**
 * Get binder cards with filters and pagination
 *
 * @param binderId - The binder ID
 * @param filters - Search and filter criteria
 * @param options - Pagination and sorting options
 * @returns Cards with pagination and metadata
 *
 * @example
 * ```typescript
 * const result = await getBinderCards('123',
 *   { search: 'ninja', rarity: 'M', forTrade: true },
 *   { page: 1, limit: 48, sortBy: 'name' }
 * );
 * ```
 */
export async function getBinderCards(
  binderId: string,
  filters: BinderCardFilters = {},
  options: BinderCardSearchOptions = {}
): Promise<ApiResponse<BinderCardsResult>> {
  try {
    const params = buildQueryParams({
      page: options.page || 1,
      limit: options.limit || 48,
      sortBy: options.sortBy || 'default',
      ...filters,
    });

    const response = await fetch(
      `/api/binders/${binderId}/cards?${params.toString()}`
    );
    return await handleResponse<BinderCardsResult>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Add cards to a binder (bulk operation)
 *
 * @param binderId - The binder ID
 * @param cards - Array of cards to add
 * @returns Summary of added/updated/failed cards
 *
 * @example
 * ```typescript
 * const result = await addCardsToBinder('123', [
 *   { printingId: 'abc', quantity: 2, forTrade: true }
 * ]);
 * ```
 */
export async function addCardsToBinder(
  binderId: string,
  cards: AddCardDTO[]
): Promise<ApiResponse<AddCardsResultDTO>> {
  try {
    const response = await fetch(`/api/binders/${binderId}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printings: cards }),
    });
    return await handleResponse<AddCardsResultDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Swap an inventory item to a different printing of the same card, via the
 * card route's `action: 'swapPrinting'` (same call the binder page's
 * PrintingSwapDialog makes). NOTE: `/cards/[cardId]/swap-printing` — the
 * endpoint BinderService.swapPrinting targets — does not exist (404s).
 *
 * @param binderId - The binder ID
 * @param cardId - The inventory item ID
 * @param newPrintingId - The printing to swap to
 */
export async function swapBinderCardPrinting(
  binderId: string,
  cardId: string,
  newPrintingId: string
): Promise<ApiResponse<{ merged?: boolean }>> {
  try {
    const response = await fetch(`/api/binders/${binderId}/cards/${cardId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'swapPrinting', newPrintingId }),
    });
    return await handleResponse<{ merged?: boolean }>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Get a single card from binder
 *
 * @param binderId - The binder ID
 * @param cardId - The inventory item ID
 * @returns Card data
 *
 * @example
 * ```typescript
 * const result = await getBinderCard('123', 'card456');
 * if (result.success) {
 *   console.log(result.data.display_name);
 * }
 * ```
 */
export async function getBinderCard(
  binderId: string,
  cardId: string
): Promise<ApiResponse<InventoryCardDTO>> {
  try {
    const response = await fetch(`/api/binders/${binderId}/cards/${cardId}`);
    return await handleResponse<InventoryCardDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Update a single card in binder
 *
 * @param binderId - The binder ID
 * @param cardId - The inventory item ID
 * @param updates - Fields to update
 * @returns Updated card
 *
 * @example
 * ```typescript
 * const result = await updateBinderCard('123', 'card456', {
 *   quantity: 3,
 *   forTrade: false
 * });
 * ```
 */
export async function updateBinderCard(
  binderId: string,
  cardId: string,
  updates: UpdateCardDTO
): Promise<ApiResponse<InventoryCardDTO>> {
  try {
    const response = await fetch(`/api/binders/${binderId}/cards/${cardId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return await handleResponse<InventoryCardDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Swap card to different printing
 *
 * @param binderId - The binder ID
 * @param cardId - The inventory item ID
 * @param newPrintingId - The new printing ID to swap to
 * @returns Swap result (merged or swapped)
 *
 * @example
 * ```typescript
 * const result = await swapCardPrinting('123', 'card456', 'newprint789');
 * if (result.success && result.data.merged) {
 *   console.log(`Merged into existing card`);
 * }
 * ```
 */
export async function swapCardPrinting(
  binderId: string,
  cardId: string,
  newPrintingId: string
): Promise<ApiResponse<SwapPrintingResultDTO>> {
  try {
    const response = await fetch(
      `/api/binders/${binderId}/cards/${cardId}/swap`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPrintingId }),
      }
    );
    return await handleResponse<SwapPrintingResultDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Delete a card from binder
 *
 * @param binderId - The binder ID
 * @param cardId - The inventory item ID
 * @returns Success status
 *
 * @example
 * ```typescript
 * const result = await deleteBinderCard('123', 'card456');
 * ```
 */
export async function deleteBinderCard(
  binderId: string,
  cardId: string
): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const response = await fetch(`/api/binders/${binderId}/cards/${cardId}`, {
      method: 'DELETE',
    });
    return await handleResponse<{ success: boolean }>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Bulk update cards in binder
 *
 * @param binderId - The binder ID
 * @param field - Field to update
 * @param value - New value for the field
 * @param cardIds - Optional: only update specific cards
 * @returns Number of cards updated
 *
 * @example
 * ```typescript
 * const result = await bulkUpdateCards('123', 'forTrade', true);
 * console.log(`Updated ${result.data.modifiedCount} cards`);
 * ```
 */
export async function bulkUpdateCards(
  binderId: string,
  field: 'forTrade' | 'forSale' | 'condition' | 'language',
  value: any,
  cardIds?: string[]
): Promise<ApiResponse<BulkUpdateResultDTO>> {
  try {
    const response = await fetch(
      `/api/binders/${binderId}/bulk-update`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value, cardIds }),
      }
    );
    return await handleResponse<BulkUpdateResultDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

// ====================================
// Transfer Operations
// ====================================

/**
 * Transfer all cards between binders
 *
 * @param sourceBinderId - Source binder ID
 * @param targetBinderId - Target binder ID
 * @returns Transfer summary
 *
 * @example
 * ```typescript
 * const result = await transferAllCards('source123', 'target456');
 * ```
 */
export async function transferAllCards(
  sourceBinderId: string,
  targetBinderId: string
): Promise<ApiResponse<TransferResultDTO>> {
  try {
    const response = await fetch('/api/binders/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceBinderId,
        targetBinderId,
      }),
    });
    return await handleResponse<TransferResultDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Transfer selected cards between binders with partial quantity support
 *
 * @param sourceBinderId - Source binder ID
 * @param targetBinderId - Target binder ID
 * @param cards - Cards with quantities to transfer
 * @returns Detailed transfer summary
 *
 * @example
 * ```typescript
 * const result = await transferSelectedCards('source123', 'target456', [
 *   { cardId: 'card1', quantity: 2 },
 *   { cardId: 'card2', quantity: 5 }
 * ]);
 * ```
 */
export async function transferSelectedCards(
  sourceBinderId: string,
  targetBinderId: string,
  cards: TransferCardInput[]
): Promise<ApiResponse<TransferSelectedResultDTO>> {
  try {
    const response = await fetch('/api/binders/transfer-selected', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceBinderId,
        targetBinderId,
        cards,
      }),
    });
    return await handleResponse<TransferSelectedResultDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Transfer cards from multiple source binders to a single target binder in one request.
 * Groups by sourceBinderId server-side; quantities are merged if the printing already exists
 * in the target.
 *
 * @param targetBinderId - Destination binder ID
 * @param cards - Cards with their source binder and quantity
 * @returns Aggregated transfer summary
 *
 * @example
 * ```typescript
 * const result = await transferCardsCrossSource('target456', [
 *   { cardId: 'card1', sourceBinderId: 'binderA', quantity: 2 },
 *   { cardId: 'card2', sourceBinderId: 'binderB', quantity: 1 },
 * ]);
 * ```
 */
export async function transferCardsCrossSource(
  targetBinderId: string,
  cards: { cardId: string; sourceBinderId: string; quantity: number }[]
): Promise<ApiResponse<{ summary: any; results: any[] }>> {
  try {
    const response = await fetch('/api/collection/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetBinderId, cards }),
    });
    return await handleResponse<{ summary: any; results: any[] }>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Copy entire binder (creates new binder with all cards)
 *
 * @param sourceBinderId - Source binder ID
 * @param newName - Name for the new binder
 * @param options - Optional settings for the copy operation
 * @returns The new binder
 *
 * @example
 * ```typescript
 * // Basic copy
 * const result = await copyBinder('123', 'My Copy');
 *
 * // Copy with privacy enforcement
 * const result = await copyBinder('123', 'My Copy', {
 *   enforcePrivacy: true,
 *   slug: 'my-custom-slug'
 * });
 * ```
 */
export async function copyBinder(
  sourceBinderId: string,
  newName: string,
  options?: CopyBinderOptions
): Promise<ApiResponse<BinderDTO>> {
  try {
    const response = await fetch(`/api/binders/${sourceBinderId}/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newName,
        ...options,
      }),
    });
    return await handleResponse<BinderDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

// ====================================
// Export & Lookup Operations
// ====================================

/**
 * Export binder cards for download
 *
 * @param binderId - The binder ID
 * @returns All cards formatted for export
 *
 * @example
 * ```typescript
 * const result = await exportBinderCards('123');
 * if (result.success) {
 *   console.log(`Exporting ${result.data.totalCards} cards`);
 * }
 * ```
 */
export async function exportBinderCards(
  binderId: string
): Promise<ApiResponse<ExportCardsResult>> {
  try {
    const response = await fetch(`/api/binders/${binderId}/export`);
    return await handleResponse<ExportCardsResult>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Get all printing alternatives for a card with user's ownership info
 * Used for printing swap dialogs
 *
 * @param cardUniqueId - The unique card identifier (e.g., "1HP001" or "WTR001")
 * @returns All printings with ownership data
 *
 * @example
 * ```typescript
 * const result = await getPrintingAlternatives('1HP001');
 * if (result.success) {
 *   console.log(`Found ${result.data.alternatives.length} printings`);
 *   const owned = result.data.alternatives.filter(p => p.isOwned);
 *   console.log(`User owns ${owned.length} of them`);
 * }
 * ```
 */
export async function getPrintingAlternatives(
  cardUniqueId: string
): Promise<ApiResponse<PrintingAlternativesResult>> {
  try {
    const params = buildQueryParams({ cardUniqueId });
    const response = await fetch(
      `/api/binders/printing-alternatives?${params.toString()}`
    );
    return await handleResponse<PrintingAlternativesResult>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Get current user's primary binder statistics
 *
 * Returns the user's main/default binder with total card count.
 * Used by the profile page to display collection size.
 *
 * @returns Primary binder stats including total card count
 *
 * @example
 * ```typescript
 * const result = await getPrimaryBinderStats();
 * if (result.success) {
 *   console.log(`You have ${result.data.totalCards} cards`);
 * }
 * ```
 */
export async function getPrimaryBinderStats(): Promise<
  ApiResponse<{ totalCards: number; binderId?: string }>
> {
  try {
    // Get user's binders
    const response = await fetch('/api/binders/user');
    const result = await handleResponse<{ binders: BinderSummaryDTO[] }>(response);

    if (!result.success) {
      return result;
    }

    // Get the first binder (primary) or return zero
    const primaryBinder = result.data.binders[0];

    if (!primaryBinder) {
      return {
        success: true,
        data: { totalCards: 0, binderId: undefined }
      };
    }

    // Get stats for the primary binder
    const statsResponse = await fetch(`/api/binders/${primaryBinder._id}/cards?limit=0`);
    const statsResult = await handleResponse<BinderCardsResult>(statsResponse);

    if (!statsResult.success) {
      return {
        success: true,
        data: { totalCards: 0, binderId: primaryBinder._id }
      };
    }

    return {
      success: true,
      data: {
        totalCards: statsResult.data.pagination.totalResults || 0,
        binderId: primaryBinder._id
      }
    };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Get total card count across all user's binders
 *
 * Lightweight method for profile page that gets total card count.
 * Makes a single API call using the collection summary endpoint.
 *
 * @returns Total card count across all binders
 *
 * @example
 * ```typescript
 * const result = await getTotalCardCount();
 * if (result.success) {
 *   console.log(`You have ${result.data} total cards`);
 * }
 * ```
 */
export async function getTotalCardCount(): Promise<ApiResponse<number>> {
  try {
    const response = await fetch('/api/collection?view=summary');
    const result = await handleResponse<{
      summary?: {
        totalCards?: number;
        total_cards?: number;
      };
    }>(response);

    if (!result.success) {
      return result;
    }

    // Extract total from summary (handle both field names for compatibility)
    const total = result.data.summary?.totalCards || result.data.summary?.total_cards || 0;

    return {
      success: true,
      data: total
    };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Get real-time card count by querying inventory directly
 * More accurate than getTotalCardCount which relies on cached stats
 * Returns both total quantity and unique printings
 *
 * @returns Object with totalQuantity (sum of all quantities) and uniquePrintings (count of unique cards)
 *
 * @example
 * ```typescript
 * const result = await getRealTimeCardCount();
 * if (result.success) {
 *   console.log(`You have ${result.data.totalQuantity} cards (${result.data.uniquePrintings} unique)`);
 * }
 * ```
 */
export async function getRealTimeCardCount(): Promise<ApiResponse<{ totalQuantity: number; uniquePrintings: number }>> {
  try {
    const response = await fetch('/api/collection/count');
    const result = await handleResponse<{ totalQuantity: number; uniquePrintings: number }>(response);

    return result;
  } catch (error) {
    return handleError(error);
  }
}

// ====================================
// Collection Overview & Search
// ====================================

/**
 * Get full collection overview including aggregated stats across all binders.
 * Replaces direct fetch('/api/collection?view=complete') calls in components.
 */
export async function getCollectionOverview(): Promise<ApiResponse<unknown>> {
  try {
    const response = await fetch('/api/collection?view=complete');
    return await handleResponse(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Explicit "Notify on Discord" ping from the non-owner trade sidebar.
 * Awaited so the UI can tell the user whether
 * the ping fired or was suppressed by the server's 15-minute dedupe window.
 * Throws with the server's error message on a non-OK response.
 */
export async function sendTradeInterestNotification(
  binderId: string,
  payload: {
    cards: Array<{ name: string; quantity: number; value: number }>;
    totalValue?: number;
  }
): Promise<{ notified: boolean }> {
  const res = await fetch(`/api/binders/${binderId}/notify-trade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error || `Failed to notify (${res.status})`);
  }
  return { notified: !!body?.data?.notified };
}

/**
 * Search cards by name across all user binders.
 * Returns cards grouped by card ID with binder locations.
 *
 * @param query - Search term (min 3 characters)
 */
export async function searchCollectionCards(query: string): Promise<ApiResponse<import('@/lib/services/contracts/IBinderService').CardSearchResultDTO[]>> {
  try {
    if (query.length < 3) return { success: true, data: [] };
    const response = await fetch(`/api/collection/cards?q=${encodeURIComponent(query)}`);
    const result = await handleResponse<{ success: boolean; results: import('@/lib/services/contracts/IBinderService').CardSearchResultDTO[] }>(response);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, data: result.data.results || [] };
  } catch (error) {
    return handleError(error);
  }
}

// ====================================
// Inventory trade status
// ====================================

/**
 * Mark every owned copy of a printing for-trade / not-for-trade.
 *
 * The route returns `updatedCount` at the TOP LEVEL of the body (no `data`
 * key), so this repackages the body instead of using handleResponse.
 */
export async function toggleForTrade(
  printingId: string,
  forTrade: boolean
): Promise<ApiResponse<{ updatedCount: number; message?: string }>> {
  try {
    const response = await fetch('/api/inventory/toggle-for-trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printingId, forTrade }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.success) {
      return {
        success: false,
        error: body?.error || `HTTP ${response.status}: ${response.statusText}`,
        code: body?.code || `HTTP_${response.status}`,
      };
    }
    return {
      success: true,
      data: { updatedCount: body.updatedCount ?? 0, message: body.message },
    };
  } catch (error) {
    return handleError(error);
  }
}

// ====================================
// Ownership Counts
// ====================================

/**
 * Card-level owned counts for the signed-in user — any printing variant in
 * any binder counts toward a card's total. Used by the /browse URL prefill
 * to net incoming lists against the collection. Max 1000 ids per call.
 *
 * @example
 * ```typescript
 * const result = await getOwnedCountsByCard(['card-abc', 'card-def']);
 * if (result.success) console.log(result.data['card-abc']); // 3
 * ```
 */
export async function getOwnedCountsByCard(
  cardUniqueIds: string[]
): Promise<ApiResponse<Record<string, number>>> {
  try {
    const response = await fetch('/api/inventory/owned-counts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardUniqueIds }),
    });
    return await handleResponse<Record<string, number>>(response);
  } catch (error) {
    return handleError(error);
  }
}

export interface BinderCardHit {
  binderId: string;
  name: string;
  slug: string | null;
  quantity: number;
}

/**
 * Which of the current user's binders hold any printing of each card
 * (card-details lightbox "In your binders" line).
 */
export async function getBindersByCard(
  cardUniqueIds: string[]
): Promise<ApiResponse<Record<string, BinderCardHit[]>>> {
  try {
    const response = await fetch('/api/inventory/binders-by-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardUniqueIds }),
    });
    return await handleResponse<Record<string, BinderCardHit[]>>(response);
  } catch (error) {
    return handleError(error);
  }
}
