// hooks/usePrintingsSearch.ts
import { useState, useCallback } from 'react';
import type { PrintingsSearchFilters, PrintingsSearchOptions, PrintingsSearchResult } from '@/lib/services/contracts/IPrintingsService';
import {
  searchClient,
  type MarketplaceSearchOptions,
  type BudgetCategory,
  type BudgetSearchOptions,
  type RarityType,
  type RaritySearchOptions,
} from '@/lib/client';

interface UsePrintingsSearchReturn {
  results: PrintingsSearchResult | null;
  loading: boolean;
  error: string | null;
  search: (filters: PrintingsSearchFilters, options?: PrintingsSearchOptions) => Promise<void>;
  searchMarketplace: (options: MarketplaceSearchOptions) => Promise<void>;
  searchBudget: (category: BudgetCategory, options?: BudgetSearchOptions) => Promise<void>;
  searchByRarity: (rarity: RarityType, options?: RaritySearchOptions) => Promise<void>;
  getPriceStats: (cardName: string) => Promise<any>;
  clearResults: () => void;
}

// Re-export types for consumers
export type { MarketplaceSearchOptions, BudgetCategory, BudgetSearchOptions, RarityType, RaritySearchOptions };

export function usePrintingsSearch(): UsePrintingsSearchReturn {
  const [results, setResults] = useState<PrintingsSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (
    filters: PrintingsSearchFilters,
    options: PrintingsSearchOptions = {}
  ) => {
    setLoading(true);
    setError(null);

    try {
      // Decide whether to use GET or POST based on the size of filters
      const hasLargeArrays = Object.values(filters).some(value =>
        Array.isArray(value) && value.length > 50
      );

      let result;

      if (hasLargeArrays || (filters.printingIds && filters.printingIds.length > 50)) {
        // Use POST for large requests to avoid URL length limits
        result = await searchClient.searchPrintingsPost(filters, options);
      } else {
        // Use GET for smaller requests
        result = await searchClient.searchPrintings(filters, options);
      }

      if (result.success) {
        setResults(result.data);
      } else {
        throw new Error(result.error || 'Search failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchMarketplace = useCallback(async (options: MarketplaceSearchOptions) => {
    setLoading(true);
    setError(null);

    try {
      const result = await searchClient.searchMarketplace(options);

      if (result.success) {
        setResults(result.data);
      } else {
        throw new Error(result.error || 'Marketplace search failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchBudget = useCallback(async (
    category: BudgetCategory,
    options: BudgetSearchOptions = {}
  ) => {
    setLoading(true);
    setError(null);

    try {
      const result = await searchClient.searchBudget(category, options);

      if (result.success) {
        setResults(result.data);
      } else {
        throw new Error(result.error || 'Budget search failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchByRarity = useCallback(async (
    rarity: RarityType,
    options: RaritySearchOptions = {}
  ) => {
    setLoading(true);
    setError(null);

    try {
      const result = await searchClient.searchByRarity(rarity, options);

      if (result.success) {
        setResults(result.data);
      } else {
        throw new Error(result.error || 'Rarity search failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const getPriceStats = useCallback(async (cardName: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await searchClient.getPriceStats(cardName);

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Price stats failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults(null);
    setError(null);
  }, []);

  return {
    results, // <-- Now properly exposed!
    loading,
    error,
    search,
    searchMarketplace,
    searchBudget,
    searchByRarity,
    getPriceStats,
    clearResults
  };
}

// Additional hooks for specific use cases
export function useAttackActionsSearch() {
  const [results, setResults] = useState<PrintingsSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchAttackActions = useCallback(async (options: {
    powerMin?: number;
    powerMax?: number;
    costMax?: number;
    format?: 'blitz' | 'cc' | 'commoner' | 'll';
    priceMax?: number;
    sets?: string[];
    limit?: number;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const result = await searchClient.searchAttackActions(options);

      if (result.success) {
        setResults(result.data);
      } else {
        throw new Error(result.error || 'Attack actions search failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    results,
    loading,
    error,
    searchAttackActions,
    clearResults: () => {
      setResults(null);
      setError(null);
    }
  };
}

export function useFormatLegalSearch() {
  const [results, setResults] = useState<PrintingsSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchFormatLegal = useCallback(async (
    format: 'blitz' | 'cc' | 'commoner' | 'll',
    options: {
      types?: string[];
      includeBanned?: boolean;
      includeSuspended?: boolean;
      limit?: number;
    } = {}
  ) => {
    setLoading(true);
    setError(null);

    try {
      const result = await searchClient.searchFormatLegal(format, options);

      if (result.success) {
        setResults(result.data);
      } else {
        throw new Error(result.error || 'Format legal search failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    results,
    loading,
    error,
    searchFormatLegal,
    clearResults: () => {
      setResults(null);
      setError(null);
    }
  };
}