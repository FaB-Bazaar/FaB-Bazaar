// hooks/use-card-search.ts - React hook for card searching

'use client';

import { useState, useCallback, useEffect } from 'react';
import { SearchFilters, SearchOptions, SimplifiedCard } from '@/types/fab';

interface SearchResponse {
  success: boolean;
  data: SimplifiedCard[];
  pagination: {
    page: number;
    pages: number;
    total: number;
    limit: number;
  };
  query_info: {
    original_query?: string;
    parsed_query: any;
    execution_time_ms: number;
    pipeline_stages?: number;
  };
  error?: string;
  details?: string;
}

interface UseCardSearchResult {
  // State
  query: string;
  filters: SearchFilters;
  options: SearchOptions;
  results: SimplifiedCard[];
  loading: boolean;
  error: string | null;
  pagination: SearchResponse['pagination'] | null;
  queryInfo: SearchResponse['query_info'] | null;

  // Actions
  setQuery: (query: string) => void;
  setFilters: (filters: SearchFilters) => void;
  setOptions: (options: SearchOptions) => void;
  search: () => Promise<void>;
  clearResults: () => void;
  
  // Convenience methods
  searchByName: (name: string) => Promise<void>;
  searchSpecificPrinting: (naturalQuery: string) => Promise<void>;
  searchFormatLegal: (format: 'blitz' | 'cc' | 'commoner' | 'll', query?: string) => Promise<void>;
  searchByPrice: (minPrice?: number, maxPrice?: number, additionalFilters?: SearchFilters) => Promise<void>;
}

export function useCardSearch(initialQuery: string = ''): UseCardSearchResult {
  // State
  const [query, setQuery] = useState<string>(initialQuery);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [options, setOptions] = useState<SearchOptions>({
    limit: 12,
    page: 1,
    sortBy: 'relevance',
    sortOrder: 'asc'
  });
  const [results, setResults] = useState<SimplifiedCard[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<SearchResponse['pagination'] | null>(null);
  const [queryInfo, setQueryInfo] = useState<SearchResponse['query_info'] | null>(null);

  // Main search function
  const search = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('FAB Search: Performing search with:', { query, filters, options });
      const response = await fetch('/api/cards/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query || null,
          filters,
          options
        })
      });

      const data: SearchResponse = await response.json();
      console.log('FAB Search: Raw API response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      if (data.success) {
        setResults(data.data);
        setPagination(data.pagination);
        setQueryInfo(data.query_info);
      } else {
        throw new Error(data.error || 'Search failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      setResults([]);
      setPagination(null);
      setQueryInfo(null);
    } finally {
      setLoading(false);
    }
  }, [query, filters, options]);

  // Clear results
  const clearResults = useCallback(() => {
    setResults([]);
    setPagination(null);
    setQueryInfo(null);
    setError(null);
  }, []);

  // Convenience methods
  const searchByName = useCallback(async (name: string) => {
    setQuery(name);
    setFilters({});
    setOptions({ limit: 10, page: 1, sortBy: 'name', sortOrder: 'asc' });
    
    // Trigger search on next render
    setTimeout(search, 0);
  }, [search]);

  const searchSpecificPrinting = useCallback(async (naturalQuery: string) => {
    setQuery(naturalQuery);
    setFilters({});
    setOptions({ limit: 5, page: 1, sortBy: 'relevance', sortOrder: 'asc' });
    
    setTimeout(search, 0);
  }, [search]);

  const searchFormatLegal = useCallback(async (
    format: 'blitz' | 'cc' | 'commoner' | 'll',
    searchQuery?: string
  ) => {
    setQuery(searchQuery || '');
    setFilters({ 
      format,
      includeBanned: false,
      includeSuspended: false
    });
    setOptions({ limit: 20, page: 1, sortBy: 'name', sortOrder: 'asc' });
    
    setTimeout(search, 0);
  }, [search]);

  const searchByPrice = useCallback(async (
    minPrice?: number,
    maxPrice?: number,
    additionalFilters: SearchFilters = {}
  ) => {
    setQuery('');
    setFilters({
      ...additionalFilters,
      priceMin: minPrice,
      priceMax: maxPrice
    });
    setOptions({ 
      limit: 20, 
      page: 1, 
      sortBy: 'price', 
      sortOrder: 'desc' 
    });
    
    setTimeout(search, 0);
  }, [search]);

  // Auto-search when dependencies change (debounced)
  useEffect(() => {
    if (query || Object.keys(filters).length > 0) {
      const timeoutId = setTimeout(search, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [query, filters, options, search]);

  return {
    // State
    query,
    filters,
    options,
    results,
    loading,
    error,
    pagination,
    queryInfo,

    // Actions
    setQuery,
    setFilters,
    setOptions,
    search,
    clearResults,

    // Convenience methods
    searchByName,
    searchSpecificPrinting,
    searchFormatLegal,
    searchByPrice
  };
}

// Alternative hook for simple name-based searches
export function useSimpleCardSearch(initialQuery: string = '') {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SimplifiedCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (searchQuery?: string) => {
    const queryToUse = searchQuery ?? query;
    if (!queryToUse.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/cards/search?q=${encodeURIComponent(queryToUse)}&limit=10`);
      const data: SearchResponse = await response.json();

      if (data.success) {
        setResults(data.data);
      } else {
        throw new Error(data.error || 'Search failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  // Debounced search
  useEffect(() => {
    if (query.trim()) {
      const timeoutId = setTimeout(() => search(), 300);
      return () => clearTimeout(timeoutId);
    } else {
      setResults([]);
    }
  }, [query, search]);

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    search
  };
}