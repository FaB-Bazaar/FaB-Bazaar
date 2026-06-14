/**
 * Decks Client Service
 *
 * Client-side API abstraction for deck operations.
 * Consolidates 10+ fetch() calls from 10 different components.
 */

import type { ApiResponse } from './types';
import { buildQueryParams, handleResponse, handleError } from './utils';

// Import types from server-side contract
import type {
  DeckDTO,
  DeckSummaryDTO,
  PublicDeckSummaryDTO,
  CreateDeckDTO,
  UpdateDeckDTO,
  DeckListFilters,
  PublicDeckFilters,
  AddPrintingDTO,
  AddPrintingResultDTO,
  BulkImportResultDTO,
  DeckStatsDTO,
  InventoryComparisonDTO,
  DeckCategory,
  UpgradePrintingSuggestionDTO,
  ApplyPrintingUpgradesResultDTO,
  DeckLanguageConversionPlanDTO,
} from '@/lib/services/contracts/IDeckService';

// ====================================
// Deck CRUD Operations
// ====================================

/**
 * Get user's decks list with filtering and pagination
 *
 * @param filters - Optional filters (format, heroName, search)
 * @param pagination - Optional pagination (page, limit)
 * @returns Paginated list of decks
 *
 * @example
 * ```typescript
 * const result = await getUserDecks(
 *   { format: 'Blitz', heroName: 'Iyslander' },
 *   { page: 1, limit: 20 }
 * );
 * ```
 */
export async function getUserDecks(
  filters?: DeckListFilters,
  pagination?: { page?: number; limit?: number }
): Promise<ApiResponse<{ decks: DeckDTO[]; total: number }>> {
  try {
    const params = buildQueryParams({
      page: pagination?.page || 1,
      limit: pagination?.limit || 20,
      ...filters,
    });

    const response = await fetch(`/api/decks?${params.toString()}`);
    return await handleResponse<{ decks: DeckDTO[]; total: number }>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Get user's decks in lightweight format (for dropdowns/selectors)
 *
 * @returns Array of deck summaries
 *
 * @example
 * ```typescript
 * const result = await getUserDecksBasic();
 * if (result.success) {
 *   console.log(result.data.map(d => d.name));
 * }
 * ```
 */
export async function getUserDecksBasic(): Promise<ApiResponse<DeckSummaryDTO[]>> {
  try {
    const response = await fetch('/api/decks/basic');
    return await handleResponse<DeckSummaryDTO[]>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Get a single deck by public ID
 *
 * @param publicId - The deck's public ID (21-char nanoid)
 * @returns Full deck data
 *
 * @example
 * ```typescript
 * const result = await getDeck('abc123...');
 * if (result.success) {
 *   console.log(result.data.name, result.data.heroName);
 * }
 * ```
 */
export async function getDeck(publicId: string): Promise<ApiResponse<DeckDTO>> {
  try {
    const response = await fetch(`/api/decks/${publicId}`);
    return await handleResponse<DeckDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Create a new deck
 *
 * @param data - Deck creation data
 * @returns Created deck
 *
 * @example
 * ```typescript
 * const result = await createDeck({
 *   name: 'Iyslander Control',
 *   format: 'Classic Constructed',
 *   heroName: 'Iyslander'
 * });
 * ```
 */
export async function createDeck(
  data: CreateDeckDTO
): Promise<ApiResponse<DeckDTO>> {
  try {
    const response = await fetch('/api/decks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await handleResponse<DeckDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Update deck metadata
 *
 * @param publicId - The deck's public ID
 * @param updates - Fields to update
 * @returns Updated deck
 *
 * @example
 * ```typescript
 * const result = await updateDeck('abc123...', {
 *   name: 'Updated Deck Name',
 *   isPublic: true
 * });
 * ```
 */
export async function updateDeck(
  publicId: string,
  updates: UpdateDeckDTO
): Promise<ApiResponse<DeckDTO>> {
  try {
    const response = await fetch(`/api/decks/${publicId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return await handleResponse<DeckDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Delete a deck
 *
 * @param publicId - The deck's public ID
 * @returns Success status
 *
 * @example
 * ```typescript
 * const result = await deleteDeck('abc123...');
 * if (result.success) {
 *   console.log('Deck deleted');
 * }
 * ```
 */
export async function deleteDeck(
  publicId: string
): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const response = await fetch(`/api/decks/${publicId}`, {
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
 * Add a printing to a deck
 *
 * Handles equipment conflict logic automatically.
 *
 * @param publicId - The deck's public ID
 * @param printing - Printing to add
 * @returns Result with card name, category, and any moved cards
 *
 * @example
 * ```typescript
 * const result = await addPrinting('abc123...', {
 *   printingId: 'xyz789',
 *   quantity: 3,
 *   category: 'maindeck'
 * });
 * ```
 */
export async function addPrinting(
  publicId: string,
  printing: AddPrintingDTO
): Promise<ApiResponse<AddPrintingResultDTO>> {
  try {
    const response = await fetch(`/api/decks/${publicId}/printings/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(printing),
    });
    return await handleResponse<AddPrintingResultDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Add multiple printings to a deck (bulk import)
 *
 * @param publicId - The deck's public ID
 * @param printings - Printings to add
 * @returns Bulk import result with summary
 *
 * @example
 * ```typescript
 * const result = await addPrintings('abc123...', [
 *   { printingId: 'xyz789', quantity: 3, category: 'maindeck' },
 *   { printingId: 'def456', quantity: 1, category: 'equipment' }
 * ]);
 * ```
 */
export async function addPrintings(
  publicId: string,
  printings: AddPrintingDTO[]
): Promise<ApiResponse<BulkImportResultDTO>> {
  try {
    const response = await fetch(`/api/decks/${publicId}/printings/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printings }),
    });
    return await handleResponse<BulkImportResultDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Remove a printing from a deck
 *
 * @param publicId - The deck's public ID
 * @param printingId - The printing ID to remove
 * @param category - The category to remove from
 * @returns Success status
 *
 * @example
 * ```typescript
 * const result = await removePrinting('abc123...', 'xyz789', 'maindeck');
 * ```
 */
export async function removePrinting(
  publicId: string,
  printingId: string,
  category: DeckCategory,
  quantity?: number
): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const response = await fetch(`/api/decks/${publicId}/printings/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printingId, category, quantity }),
    });
    return await handleResponse<{ success: boolean }>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Swap a printing in a deck with a different printing
 *
 * @param publicId - The deck's public ID
 * @param oldPrintingId - The printing to replace
 * @param newPrintingId - The new printing
 * @param category - The category containing the printing
 * @returns Updated deck
 *
 * @example
 * ```typescript
 * const result = await swapPrinting('abc123...', 'old123', 'new456', 'maindeck');
 * ```
 */
export async function swapPrinting(
  publicId: string,
  oldPrintingId: string,
  newPrintingId: string,
  category: DeckCategory
): Promise<ApiResponse<DeckDTO>> {
  try {
    const response = await fetch(`/api/decks/${publicId}/printings/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPrintingId, newPrintingId, category }),
    });
    return await handleResponse<DeckDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

// ====================================
// Analysis & Comparison Operations
// ====================================

/**
 * Compare a deck against user's inventory
 *
 * @param publicId - The deck's public ID
 * @param options - Comparison options
 * @returns Comparison result with owned/missing/partial breakdowns
 *
 * @example
 * ```typescript
 * const result = await getInventoryComparison('abc123...', {
 *   binderMode: 'all'
 * });
 * if (result.success) {
 *   console.log(`Missing ${result.data.missing.length} cards`);
 *   console.log(`Completion: ${result.data.summary.completionPercentage}%`);
 * }
 * ```
 */
export async function getInventoryComparison(
  publicId: string,
  options?: { binderMode?: 'all' | 'specific'; binderId?: string }
): Promise<ApiResponse<InventoryComparisonDTO>> {
  try {
    const params = buildQueryParams({
      binderMode: options?.binderMode || 'all',
      binderId: options?.binderId,
    });

    const response = await fetch(
      `/api/decks/${publicId}/inventory-comparison?${params.toString()}`
    );
    return await handleResponse<InventoryComparisonDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Calculate deck statistics
 *
 * @param publicId - The deck's public ID
 * @returns Deck stats including unique cards, value, category breakdown
 *
 * @example
 * ```typescript
 * const result = await calculateStats('abc123...');
 * if (result.success) {
 *   console.log(`Total value: $${result.data.estimatedValue.toFixed(2)}`);
 *   console.log(`Maindeck: ${result.data.categoryBreakdown.maindeck} cards`);
 * }
 * ```
 */
export async function calculateStats(
  publicId: string
): Promise<ApiResponse<DeckStatsDTO>> {
  try {
    const response = await fetch(`/api/decks/${publicId}/stats`);
    return await handleResponse<DeckStatsDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

// ====================================
// Import Operations
// ====================================

/**
 * Import a deck from Fabrary URL
 *
 * @param fabraryUrl - The Fabrary deck URL
 * @returns Created deck with imported cards
 *
 * @example
 * ```typescript
 * const result = await importFromFabrary('https://fabrary.net/decks/...');
 * if (result.success) {
 *   console.log(`Imported: ${result.data.name}`);
 * }
 * ```
 */
export async function importFromFabrary(
  fabraryUrl: string
): Promise<ApiResponse<DeckDTO>> {
  try {
    const response = await fetch('/api/decks/import/fabrary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: fabraryUrl }),
    });
    return await handleResponse<DeckDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Copy a deck (creates a new deck with same cards)
 *
 * @param publicId - The source deck's public ID
 * @param newName - Name for the new deck
 * @returns The new deck
 *
 * @example
 * ```typescript
 * const result = await copyDeck('abc123...', 'My Copy of Deck');
 * if (result.success) {
 *   console.log(`New deck ID: ${result.data.publicId}`);
 * }
 * ```
 */
export async function copyDeck(
  publicId: string,
  newName: string
): Promise<ApiResponse<DeckDTO>> {
  try {
    const response = await fetch(`/api/decks/${publicId}/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    return await handleResponse<DeckDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

// ====================================
// Community Deck Operations
// ====================================

/**
 * Get community (public) decks with filtering and pagination
 *
 * No authentication required to browse.
 */
export async function getCommunityDecks(
  filters?: PublicDeckFilters,
  pagination?: { page?: number; limit?: number }
): Promise<ApiResponse<{ decks: PublicDeckSummaryDTO[]; total: number; pagination: { page: number; limit: number; total: number; hasMore: boolean } }>> {
  try {
    const params = buildQueryParams({
      page: pagination?.page || 1,
      limit: pagination?.limit || 20,
      ...filters,
    });

    const response = await fetch(`/api/decks/community?${params.toString()}`);
    return await handleResponse(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Fetch upgrade suggestions: for each unowned non-hero deck printing, every
 * owned alternative printing of the same card. The recommended pick is flagged.
 *
 * @param publicId - The deck's public ID
 */
export async function getPrintingUpgradeSuggestions(
  publicId: string
): Promise<ApiResponse<UpgradePrintingSuggestionDTO[]>> {
  try {
    const res = await fetch(`/api/decks/${publicId}/upgrade-printings`);
    const result = await handleResponse<{ suggestions: UpgradePrintingSuggestionDTO[] }>(res);
    if (!result.success) return result;
    return { success: true, data: result.data.suggestions };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Apply a (possibly user-filtered) batch of upgrade swaps to a deck.
 *
 * @param publicId - The deck's public ID
 * @param swaps - Subset of suggestions the user accepted, with chosen alt printing
 */
export async function applyPrintingUpgrades(
  publicId: string,
  swaps: Array<{ currentPrintingId: string; newPrintingId: string; category: DeckCategory }>
): Promise<ApiResponse<ApplyPrintingUpgradesResultDTO>> {
  try {
    const res = await fetch(`/api/decks/${publicId}/upgrade-printings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ swaps }),
    });
    return await handleResponse<ApplyPrintingUpgradesResultDTO>(res);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Preview converting a deck's printings to a target language (exact-variant only).
 * Returns the planned swaps + the cards that would be left as-is.
 */
export async function previewDeckLanguageConversion(
  publicId: string,
  language: string
): Promise<ApiResponse<DeckLanguageConversionPlanDTO>> {
  try {
    const res = await fetch(
      `/api/decks/${publicId}/convert-language?language=${encodeURIComponent(language)}`
    );
    return await handleResponse<DeckLanguageConversionPlanDTO>(res);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Apply the language conversion: swaps every deck card that has a same-variant
 * printing in the target language; leaves the rest as-is.
 */
export async function convertDeckToLanguage(
  publicId: string,
  targetLanguage: string
): Promise<ApiResponse<{ swapped: number; skipped: number; errors: string[] }>> {
  try {
    const res = await fetch(`/api/decks/${publicId}/convert-language`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetLanguage }),
    });
    return await handleResponse<{ swapped: number; skipped: number; errors: string[] }>(res);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Duplicate a deck (creates a copy with "Copy of" prefix)
 *
 * @param publicId - The source deck's public ID
 * @returns The duplicated deck
 *
 * @example
 * ```typescript
 * const result = await duplicateDeck('abc123...');
 * if (result.success) {
 *   console.log(`Duplicated deck: ${result.data.name}`);
 * }
 * ```
 */
export async function duplicateDeck(
  publicId: string
): Promise<ApiResponse<DeckDTO>> {
  try {
    const response = await fetch(`/api/decks/${publicId}/duplicate`, {
      method: 'POST',
    });
    return await handleResponse<DeckDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Toggle featured status for a deck (Decks to Beat)
 * Requires curator or superadmin role.
 */
export async function toggleFeatured(
  publicId: string,
  featured: boolean
): Promise<ApiResponse<{ featured: boolean }>> {
  try {
    const response = await fetch(`/api/decks/${publicId}/featured`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featured }),
    });
    return await handleResponse<{ featured: boolean }>(response);
  } catch (error) {
    return handleError(error);
  }
}

export async function toggleSystemDeck(
  publicId: string,
  isSystemDeck: boolean
): Promise<ApiResponse<{ isSystemDeck: boolean }>> {
  try {
    const response = await fetch(`/api/decks/${publicId}/featured`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isSystemDeck }),
    });
    return await handleResponse<{ isSystemDeck: boolean }>(response);
  } catch (error) {
    return handleError(error);
  }
}
