/**
 * Search Client Service
 *
 * Client-side API abstraction for card search and browse operations.
 * Consolidates search-related fetch() calls from ~8 different components.
 */

import type { ApiResponse } from './types';
import { buildQueryParams, handleResponse, handleError } from './utils';

// Import types from server-side contract
import type {
  PrintingDTO,
  PrintingsSearchFilters,
  PrintingsSearchOptions,
  PrintingsSearchResult,
  PrintingsFilterValues,
} from '@/lib/services/contracts/IPrintingsService';

// ====================================
// Search Operations
// ====================================

/**
 * Search printings with filters
 *
 * @param filters - Search filters (name, class, type, rarity, etc.)
 * @param options - Search options (page, limit, sort)
 * @returns Paginated search results
 *
 * @example
 * ```typescript
 * const result = await searchPrintings(
 *   { name: 'command', class: 'ninja', rarity: 'M' },
 *   { page: 1, limit: 48, sortBy: 'name' }
 * );
 * ```
 */
export async function searchPrintings(
  filters: PrintingsSearchFilters = {},
  options: PrintingsSearchOptions = {}
): Promise<ApiResponse<PrintingsSearchResult>> {
  try {
    const params = buildQueryParams({
      page: options.page || 1,
      limit: options.limit || 48,
      sortBy: options.sortBy || 'name',
      sortOrder: options.sortOrder || 'asc',
      ...filters,
    });

    const response = await fetch(`/api/search/printings?${params.toString()}`);
    return await handleResponse<PrintingsSearchResult>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Browse printings with pagination
 *
 * Similar to search but optimized for browse pages with category filters.
 *
 * @param filters - Browse filters
 * @param options - Pagination options
 * @returns Paginated browse results
 *
 * @example
 * ```typescript
 * const result = await browsePrintings(
 *   { set: 'HVY', rarity: 'M' },
 *   { page: 1, limit: 48 }
 * );
 * ```
 */
export async function browsePrintings(
  filters: PrintingsSearchFilters = {},
  options: PrintingsSearchOptions = {}
): Promise<ApiResponse<PrintingsSearchResult>> {
  try {
    const params = buildQueryParams({
      page: options.page || 1,
      limit: options.limit || 48,
      sortBy: options.sortBy || 'collector_number',
      sortOrder: options.sortOrder || 'asc',
      ...filters,
    });

    const response = await fetch(`/api/browse?${params.toString()}`);
    return await handleResponse<PrintingsSearchResult>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Bulk lookup printings by IDs
 *
 * @param printingIds - Array of printing IDs to lookup
 * @returns Array of printing data
 *
 * @example
 * ```typescript
 * const result = await bulkSearchPrintings(['abc123', 'def456', 'ghi789']);
 * if (result.success) {
 *   console.log(`Found ${result.data.length} printings`);
 * }
 * ```
 */
export async function bulkSearchPrintings(
  printingIds: string[]
): Promise<ApiResponse<PrintingDTO[]>> {
  try {
    const response = await fetch('/api/browse/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printingIds }),
    });
    return await handleResponse<PrintingDTO[]>(response);
  } catch (error) {
    return handleError(error);
  }
}

// ====================================
// Single Printing Operations
// ====================================

/**
 * Get a single printing by ID
 *
 * @param printingId - The printing ID
 * @returns Full printing data
 *
 * @example
 * ```typescript
 * const result = await getPrintingById('abc123');
 * if (result.success) {
 *   console.log(result.data.display_name, result.data.tcg_market);
 * }
 * ```
 */
export async function getPrintingById(
  printingId: string
): Promise<ApiResponse<PrintingDTO>> {
  try {
    const response = await fetch(`/api/printings/${printingId}`);
    return await handleResponse<PrintingDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Get all printings of a card (all versions/editions)
 *
 * @param cardUniqueId - The unique card identifier (e.g., "WTR001")
 * @returns Array of all printings for this card
 *
 * @example
 * ```typescript
 * const result = await getCardPrintings('WTR001');
 * if (result.success) {
 *   console.log(`Found ${result.data.length} versions`);
 *   result.data.forEach(p => console.log(p.set, p.edition, p.foiling));
 * }
 * ```
 */
export async function getCardPrintings(
  cardUniqueId: string
): Promise<ApiResponse<PrintingDTO[]>> {
  try {
    const params = buildQueryParams({ cardUniqueId });
    const response = await fetch(`/api/printings/card?${params.toString()}`);
    return await handleResponse<PrintingDTO[]>(response);
  } catch (error) {
    return handleError(error);
  }
}

// ====================================
// Filter Values Operations
// ====================================

/**
 * Get available filter values for faceted search
 *
 * Returns all unique values for sets, editions, foilings, rarities, etc.
 *
 * @returns Filter values for building search UI
 *
 * @example
 * ```typescript
 * const result = await getFilterValues();
 * if (result.success) {
 *   console.log('Sets:', result.data.sets);
 *   console.log('Rarities:', result.data.rarities);
 * }
 * ```
 */
export async function getFilterValues(): Promise<ApiResponse<PrintingsFilterValues>> {
  try {
    const response = await fetch('/api/search/filters');
    return await handleResponse<PrintingsFilterValues>(response);
  } catch (error) {
    return handleError(error);
  }
}

// ====================================
// Quick Search Operations
// ====================================

/**
 * Quick search for autocomplete/typeahead
 *
 * Returns minimal results quickly for search suggestions.
 *
 * @param query - Search query string
 * @param limit - Max results to return (default: 10)
 * @returns Array of matching printings (minimal fields)
 *
 * @example
 * ```typescript
 * const result = await quickSearch('command', 5);
 * if (result.success) {
 *   result.data.forEach(p => console.log(p.display_name));
 * }
 * ```
 */
export async function quickSearch(
  query: string,
  limit: number = 10
): Promise<ApiResponse<PrintingDTO[]>> {
  try {
    const params = buildQueryParams({ q: query, limit });
    const response = await fetch(`/api/search/quick?${params.toString()}`);
    return await handleResponse<PrintingDTO[]>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Search by card name (fuzzy matching)
 *
 * @param name - Card name to search
 * @returns Matching printings
 *
 * @example
 * ```typescript
 * const result = await searchByName('Art of War');
 * if (result.success) {
 *   console.log(`Found ${result.data.length} matches`);
 * }
 * ```
 */
export async function searchByName(
  name: string
): Promise<ApiResponse<PrintingDTO[]>> {
  try {
    const params = buildQueryParams({ name });
    const response = await fetch(`/api/search/name?${params.toString()}`);
    return await handleResponse<PrintingDTO[]>(response);
  } catch (error) {
    return handleError(error);
  }
}

// ====================================
// Specialized Search Operations
// ====================================

/**
 * Marketplace search options for finding specific printings
 */
export interface MarketplaceSearchOptions {
  name?: string;
  isRainbowFoil?: boolean;
  isFirstEdition?: boolean;
  isUnlimited?: boolean;
  priceMin?: number;
  priceMax?: number;
  sets?: string[];
  rarities?: string[];
  limit?: number;
}

/**
 * Search marketplace for specific card printings
 *
 * @param options - Marketplace filter options
 * @returns Paginated search results
 *
 * @example
 * ```typescript
 * const result = await searchMarketplace({
 *   name: 'command',
 *   isRainbowFoil: true,
 *   priceMax: 50
 * });
 * ```
 */
export async function searchMarketplace(
  options: MarketplaceSearchOptions
): Promise<ApiResponse<PrintingsSearchResult>> {
  try {
    const params = buildQueryParams(options);
    const response = await fetch(`/api/printings/marketplace?${params.toString()}`);
    return await handleResponse<PrintingsSearchResult>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Budget category for filtering cards by price range
 */
export type BudgetCategory = 'budget' | 'under_5' | 'under_10' | 'under_25' | 'under_50';

/**
 * Budget search options
 */
export interface BudgetSearchOptions {
  types?: string[];
  format?: 'blitz' | 'cc' | 'commoner' | 'll';
  limit?: number;
}

/**
 * Search for budget-friendly cards
 *
 * @param category - Budget category (budget, under_5, under_10, under_25, under_50)
 * @param options - Additional filter options
 * @returns Paginated search results
 *
 * @example
 * ```typescript
 * const result = await searchBudget('under_10', {
 *   format: 'blitz',
 *   limit: 50
 * });
 * ```
 */
export async function searchBudget(
  category: BudgetCategory,
  options: BudgetSearchOptions = {}
): Promise<ApiResponse<PrintingsSearchResult>> {
  try {
    const params = buildQueryParams({ category, ...options });
    const response = await fetch(`/api/printings/budget?${params.toString()}`);
    return await handleResponse<PrintingsSearchResult>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Rarity type for filtering cards
 */
export type RarityType = 'common' | 'rare' | 'super_rare' | 'majestic' | 'legendary' | 'fabled' | 'promo';

/**
 * Rarity search options
 */
export interface RaritySearchOptions {
  sets?: string[];
  foilings?: string[];
  hasPricing?: boolean;
  limit?: number;
}

/**
 * Search cards by rarity
 *
 * @param rarity - Rarity type to filter by
 * @param options - Additional filter options
 * @returns Paginated search results
 *
 * @example
 * ```typescript
 * const result = await searchByRarity('majestic', {
 *   sets: ['HVY'],
 *   hasPricing: true
 * });
 * ```
 */
export async function searchByRarity(
  rarity: RarityType,
  options: RaritySearchOptions = {}
): Promise<ApiResponse<PrintingsSearchResult>> {
  try {
    const params = buildQueryParams({ rarity, ...options });
    const response = await fetch(`/api/printings/rarity?${params.toString()}`);
    return await handleResponse<PrintingsSearchResult>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Price statistics for a card
 */
export interface PriceStatsDTO {
  cardName: string;
  printings: Array<{
    printingId: string;
    set: string;
    edition: string;
    foiling: string;
    tcgMarket?: number;
    tcgLow?: number;
    tcgMid?: number;
  }>;
  lowestPrice?: number;
  averagePrice?: number;
  highestPrice?: number;
}

/**
 * Get price statistics for a card
 *
 * @param cardName - Name of the card to get price stats for
 * @returns Price statistics across all printings
 *
 * @example
 * ```typescript
 * const result = await getPriceStats('Art of War');
 * if (result.success) {
 *   console.log(`Lowest: $${result.data.lowestPrice}`);
 *   console.log(`Highest: $${result.data.highestPrice}`);
 * }
 * ```
 */
export async function getPriceStats(
  cardName: string
): Promise<ApiResponse<PriceStatsDTO>> {
  try {
    const params = buildQueryParams({ name: cardName });
    const response = await fetch(`/api/printings/price-stats?${params.toString()}`);
    return await handleResponse<PriceStatsDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Search printings with POST (for large filter arrays)
 *
 * Use this when filters contain arrays with 50+ items to avoid URL length limits.
 *
 * @param filters - Search filters
 * @param options - Search options
 * @returns Paginated search results
 *
 * @example
 * ```typescript
 * // When searching with many printing IDs
 * const result = await searchPrintingsPost(
 *   { printingIds: arrayOf100Ids },
 *   { page: 1, limit: 48 }
 * );
 * ```
 */
export async function searchPrintingsPost(
  filters: PrintingsSearchFilters,
  options: PrintingsSearchOptions = {}
): Promise<ApiResponse<PrintingsSearchResult>> {
  try {
    const response = await fetch('/api/printings/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters, options }),
    });
    return await handleResponse<PrintingsSearchResult>(response);
  } catch (error) {
    return handleError(error);
  }
}

export interface BulkSearchCard {
  name: string;
  color?: string;
  exact?: boolean;
  isPartialMatch?: boolean;
  foiling?: string;
  set?: string;
  edition?: string;
}

export interface BulkSearchResult {
  index: number;
  printings: PrintingDTO[];
}

export interface BulkSearchSharedFilters {
  heroClasses?: string[];
  heroTalents?: string[];
  heroEssences?: string[];
  format?: string;
}

/**
 * Bulk search printings by card descriptors — single HTTP request, single DB query.
 * Replaces N parallel searchPrintingsPost calls on the bulk-import page and deck editor.
 *
 * Pass `sharedFilters` for deck-building contexts to apply hero/format legality
 * constraints across all cards in the same query.
 */
export async function bulkSearchByNames(
  cards: BulkSearchCard[],
  sharedFilters?: BulkSearchSharedFilters
): Promise<ApiResponse<{ results: BulkSearchResult[] }>> {
  try {
    const response = await fetch('/api/printings/bulk-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards, ...sharedFilters }),
    });
    return await handleResponse<{ results: BulkSearchResult[] }>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Search attack action cards
 *
 * @param options - Filter options for attack actions
 * @returns Paginated search results
 *
 * @example
 * ```typescript
 * const result = await searchAttackActions({
 *   powerMin: 5,
 *   costMax: 2,
 *   format: 'blitz'
 * });
 * ```
 */
export async function searchAttackActions(
  options: {
    powerMin?: number;
    powerMax?: number;
    costMax?: number;
    format?: 'blitz' | 'cc' | 'commoner' | 'll';
    priceMax?: number;
    sets?: string[];
    limit?: number;
  }
): Promise<ApiResponse<PrintingsSearchResult>> {
  try {
    const params = buildQueryParams({ isAction: true, isAttack: true, ...options });
    const response = await fetch(`/api/printings/search?${params.toString()}`);
    return await handleResponse<PrintingsSearchResult>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Search format-legal cards
 *
 * @param format - Game format (blitz, cc, commoner, ll)
 * @param options - Additional filter options
 * @returns Paginated search results
 *
 * @example
 * ```typescript
 * const result = await searchFormatLegal('blitz', {
 *   types: ['Action'],
 *   includeBanned: false
 * });
 * ```
 */
export async function searchFormatLegal(
  format: 'blitz' | 'cc' | 'commoner' | 'll',
  options: {
    types?: string[];
    includeBanned?: boolean;
    includeSuspended?: boolean;
    limit?: number;
  } = {}
): Promise<ApiResponse<PrintingsSearchResult>> {
  try {
    const params = buildQueryParams({ format, ...options });
    const response = await fetch(`/api/printings/format-legal?${params.toString()}`);
    return await handleResponse<PrintingsSearchResult>(response);
  } catch (error) {
    return handleError(error);
  }
}
