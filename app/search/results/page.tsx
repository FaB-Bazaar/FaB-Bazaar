'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, ArrowLeft, Settings, List, Image as ImageIcon, X } from 'lucide-react';
import { urlParamsToFilters, filtersToURLParams } from '@/lib/search-url-params';
import { FABShorthandParser } from '@/lib/fab-shorthand-parser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChecklistView } from '@/components/search/ChecklistView';
import { ImagesView } from '@/components/search/ImagesView';
import { SearchActionBar } from '@/components/search/SearchActionBar';
import { useSearchSelection } from '@/hooks/search/useSearchSelection';
import { SET_MAP, RARITY_MAP, FOILING_MAP } from '@/lib/fab-constants';

interface SearchResults {
  printings: any[];
  total: number;
  page: number;
  pages: number;
  queryInfo: {
    executionTime: string;
    query: any;
    filters: any;
  };
}

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickSearch, setQuickSearch] = useState('');
  const [priceField, setPriceField] = useState<'tcg_low' | 'tcg_mid' | 'tcg_high' | 'tcg_market'>('tcg_low');

  // View mode state - default to checklist, or get from URL
  const [viewMode, setViewMode] = useState<'checklist' | 'images'>(() => {
    const view = searchParams.get('view');
    return (view === 'images' || view === 'checklist') ? view : 'checklist';
  });

  // On mobile, default to images view when the URL doesn't specify one
  useEffect(() => {
    if (searchParams.get('view')) return;
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setViewMode('images');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Selection hook
  const selection = useSearchSelection();

  // Parse URL params and fetch results
  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        setError(null);

        // Parse filters from URL
        const { filters, options } = urlParamsToFilters(searchParams);

        // Set the price field from filters (default to tcg_low if not specified)
        setPriceField(filters.priceField || 'tcg_low');

        // Build API request
        const response = await fetch('/api/printings/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filters,
            options: {
              limit: options.limit || 24,
              page: options.page || 1,
              sortBy: options.sortBy || 'name',
              sortOrder: options.sortOrder || 'asc',
              show: options.show || 'summary',
            },
          }),
        });

        if (!response.ok) {
          throw new Error('Search failed');
        }

        const data = await response.json();
        if (data.success && data.data) {
          setResults(data.data);
        } else {
          throw new Error(data.error || 'Invalid response');
        }
      } catch (err: any) {
        console.error('Search error:', err);
        setError(err.message || 'Failed to load search results');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [searchParams]);

  // Clear selection when navigating to a new page
  useEffect(() => {
    selection.clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('page')]);

  // Quick search handler - parse shorthand and navigate with explicit filter params
  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSearch.trim()) return;
    const parser = new FABShorthandParser();
    const parsed = parser.parseQuery(quickSearch.trim());
    const params = filtersToURLParams(parsed.filters as any, { page: 1, sortBy: 'name', sortOrder: 'asc', show: 'summary' });
    router.push(`/search/results?${params.toString()}`);
  };

  // Sort change handler
  const handleSortChange = (field: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const currentSortBy = params.get('sortBy') || 'name';
    const currentSortOrder = params.get('sortOrder') || 'asc';

    // Toggle order if clicking same column, otherwise default to asc
    if (currentSortBy === field) {
      const newOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
      params.set('sortOrder', newOrder);
    } else {
      params.set('sortBy', field);
      params.set('sortOrder', 'asc'); // Default to ascending for new column
    }

    params.set('page', '1'); // Reset to page 1 on sort change
    router.push(`/search/results?${params.toString()}`);
  };

  // Column filter field name → URL param name mapping
  const columnFilterParamMap: Record<string, string> = {
    set: 'sets',
    color: 'colors',
    edition: 'editions',
    rarity: 'rarities',
    foiling: 'foilings',
    language: 'languages',
  };

  // All column filter URL param keys
  const columnFilterParams = ['sets', 'colors', 'editions', 'rarities', 'foilings', 'languages'];

  // Derive active column filters from URL params (for ChecklistView filter dropdowns)
  const activeFilters = useMemo(() => {
    const filters: { [key: string]: string[] } = {};
    // Map URL param back to field name for ChecklistView
    const paramToField: Record<string, string> = {
      sets: 'set',
      colors: 'color',
      editions: 'edition',
      rarities: 'rarity',
      foilings: 'foiling',
      languages: 'language',
    };
    for (const [param, field] of Object.entries(paramToField)) {
      const val = searchParams.get(param);
      if (val) {
        filters[field] = val.split(',').filter(Boolean);
      }
    }
    return filters;
  }, [searchParams]);

  // Server-side filter handler — updates URL params and re-fetches
  const handleFilterChange = (field: string, values: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    const paramName = columnFilterParamMap[field] || field;

    if (values.length > 0) {
      params.set(paramName, values.join(','));
    } else {
      params.delete(paramName);
    }
    params.set('page', '1'); // Reset to page 1 on filter change
    router.push(`/search/results?${params.toString()}`);
  };

  // Remove a single column filter value
  const removeColumnFilter = (paramName: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const current = params.get(paramName)?.split(',').filter(Boolean) || [];
    const updated = current.filter(v => v !== value);
    if (updated.length > 0) {
      params.set(paramName, updated.join(','));
    } else {
      params.delete(paramName);
    }
    params.set('page', '1');
    router.push(`/search/results?${params.toString()}`);
  };

  // Clear all column filters
  const clearAllColumnFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    columnFilterParams.forEach(p => params.delete(p));
    params.set('page', '1');
    router.push(`/search/results?${params.toString()}`);
  };

  // Check if any column filters are active
  const hasColumnFilters = columnFilterParams.some(p => searchParams.get(p));

  // View mode change handler
  const handleViewModeChange = (mode: 'checklist' | 'images') => {
    setViewMode(mode);
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', mode);
    router.push(`/search/results?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Minimal Search Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            {/* Back to Advanced Search */}
            <Link href="/search">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Advanced Search</span>
              </Button>
            </Link>

            {/* Quick Search */}
            <form onSubmit={handleQuickSearch} className="flex-1 max-w-2xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Quick search..."
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  className="pl-10 h-10"
                />
              </div>
            </form>

            {/* View Mode Toggles */}
            <div className="flex items-center gap-1 border border-gray-300 dark:border-gray-700 rounded-md">
              <Button
                variant={viewMode === 'checklist' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewModeChange('checklist')}
                className="gap-1 rounded-r-none"
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">Checklist</span>
              </Button>
              <Button
                variant={viewMode === 'images' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewModeChange('images')}
                className="gap-1 rounded-l-none"
              >
                <ImageIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Images</span>
              </Button>
            </div>

            {/* Modify Search Button */}
            <Link href={`/search?${searchParams.toString()}`}>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Modify</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Search Action Bar - shown when cards are selected */}
      <SearchActionBar
        selectedCount={selection.selectedCount}
        isImporting={selection.isImporting}
        binders={selection.binders}
        selectedBinderSlug={selection.selectedBinderSlug}
        onSelectBinder={selection.setSelectedBinderSlug}
        onCreateBinder={selection.handleCreateBinder}
        onAddToBinder={selection.handleAddToBinder}
        onAddToWants={selection.handleAddToWants}
        onClearSelection={selection.clearSelection}
      />

      {/* Results Content */}
      <div className="container mx-auto px-4 py-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300">Searching...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {results && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-300 dark:border-gray-700">
            {/* Results Header */}
            <div className="p-6 border-b border-gray-300 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {results.total.toLocaleString()} Results Found
                  </h2>
                  <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
                    <span>Page {results.page} of {results.pages}</span>
                    <span>•</span>
                    <span>{results.queryInfo?.executionTime}ms</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Column Filters Bar */}
            {hasColumnFilters && (
              <div className="px-6 py-3 border-b border-gray-300 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Filters:</span>
                  {columnFilterParams.map(paramName => {
                    const values = searchParams.get(paramName)?.split(',').filter(Boolean) || [];
                    return values.map(value => {
                      // Get display label for each filter value
                      let displayLabel = value;
                      if (paramName === 'sets') {
                        displayLabel = (SET_MAP as Record<string, string>)[value.toLowerCase()] || value.toUpperCase();
                      } else if (paramName === 'rarities') {
                        displayLabel = (RARITY_MAP as Record<string, string>)[value.toLowerCase()] || value;
                      } else if (paramName === 'foilings') {
                        displayLabel = (FOILING_MAP as Record<string, string>)[value.toLowerCase()] || value;
                      } else if (paramName === 'editions') {
                        const editionLabels: Record<string, string> = { a: 'Alpha', f: 'First', u: 'Unlimited', n: 'Normal' };
                        displayLabel = editionLabels[value.toLowerCase()] || value.toUpperCase();
                      } else if (paramName === 'colors') {
                        displayLabel = value.charAt(0).toUpperCase() + value.slice(1);
                      }

                      const categoryLabel = paramName.charAt(0).toUpperCase() + paramName.slice(1, -1);
                      return (
                        <button
                          key={`${paramName}-${value}`}
                          onClick={() => removeColumnFilter(paramName, value)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors"
                        >
                          <span className="text-blue-500 dark:text-blue-300">{categoryLabel}:</span>
                          {displayLabel}
                          <X className="w-3 h-3 ml-0.5" />
                        </button>
                      );
                    });
                  })}
                  <button
                    onClick={clearAllColumnFilters}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-2"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            )}

            {/* Results Display */}
            <div className={viewMode === 'checklist' ? '' : 'p-6'}>
              {results.printings.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">No cards found matching your criteria.</p>
                  <Link href="/search">
                    <Button className="mt-4">Try Different Filters</Button>
                  </Link>
                </div>
              ) : (
                <>
                  {viewMode === 'checklist' && (
                    <ChecklistView
                      printings={results.printings}
                      priceField={priceField}
                      onToggleSelection={selection.toggleCardSelection}
                      isCardSelected={selection.isCardSelected}
                      getCardQuantity={selection.getCardQuantity}
                      onUpdateQuantity={selection.updateQuantity}
                      currentSort={{
                        field: searchParams.get('sortBy') || 'name',
                        order: (searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc'
                      }}
                      onSortChange={handleSortChange}
                      activeFilters={activeFilters}
                      onFilterChange={handleFilterChange}
                    />
                  )}
                  {viewMode === 'images' && (
                    <ImagesView
                      printings={results.printings}
                      onToggleSelection={selection.toggleCardSelection}
                      isCardSelected={selection.isCardSelected}
                      getCardQuantity={selection.getCardQuantity}
                      onUpdateQuantity={selection.updateQuantity}
                    />
                  )}
                </>
              )}
            </div>

            {/* Pagination */}
            {results.pages > 1 && (
              <div className="p-6 border-t border-gray-300 dark:border-gray-700">
                <div className="flex justify-center gap-2">
                  {results.page > 1 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const params = new URLSearchParams(searchParams.toString());
                        params.set('page', String(results.page - 1));
                        router.push(`/search/results?${params.toString()}`);
                      }}
                    >
                      Previous
                    </Button>
                  )}
                  <div className="flex items-center px-4">
                    Page {results.page} of {results.pages}
                  </div>
                  {results.page < results.pages && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const params = new URLSearchParams(searchParams.toString());
                        params.set('page', String(results.page + 1));
                        router.push(`/search/results?${params.toString()}`);
                      }}
                    >
                      Next
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchResultsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    }>
      <SearchResultsContent />
    </Suspense>
  );
}
