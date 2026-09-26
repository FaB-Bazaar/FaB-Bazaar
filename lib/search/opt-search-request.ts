/**
 * The /opt page's search request, as pure functions shared by the page's hooks
 * (useOptSearchState, useCardSearch) and the nightly cache warm-up. The search
 * cache is keyed by a hash of the POST body, so the warm-up must build the body
 * with the SAME code the page runs — never a hand-written copy.
 */

import { buildServerFilters, PAGE_SIZE } from '@/lib/search/build-server-filters';
import { effectiveSearchQuery } from '@/lib/search/effective-query';
import { DEFAULT_OPT_STATE, paramsToUiState, type OptUiState } from '@/lib/search/opt-url-state';
import type { PrintingsSearchFilters, PrintingsSearchOptions } from '@/lib/services/contracts/IPrintingsService';

export interface SearchRequest {
  filters: PrintingsSearchFilters;
  options: PrintingsSearchOptions;
}

/** Server filters for an /opt UI state (`query` = the debounced search box). */
export function optStateToFilters(state: OptUiState, query: string): PrintingsSearchFilters {
  return buildServerFilters({
    ...state,
    query: effectiveSearchQuery(state.searchMode, query),
    selectedTcgGroups: state.selectedPacks,
    selectedFormat: (state.selectedFormat ?? null) as PrintingsSearchFilters['format'] | null,
  });
}

/** The { filters, options } body useCardSearch POSTs to /api/printings/search. */
export function buildSearchRequest(p: {
  filters: PrintingsSearchFilters;
  languages: string[];
  sortBy: string;
  sortOrder: string;
  groupByCard: boolean;
  page: number;
  limit: number;
  matchMode?: PrintingsSearchOptions['searchMode'];
}): SearchRequest {
  return {
    filters: { ...p.filters, languages: p.languages.length ? p.languages : undefined },
    options: {
      page: p.page,
      limit: p.limit,
      sortBy: p.sortBy as PrintingsSearchOptions['sortBy'],
      sortOrder: p.sortOrder as PrintingsSearchOptions['sortOrder'],
      searchMode: p.matchMode ?? 'strict',
      groupByCard: p.groupByCard,
    },
  };
}

/**
 * The first-page request a visitor's browser sends for an /opt URL query
 * string (`classes=ninja&sortBy=rarity`), or null when the URL selects nothing
 * and the page runs no search.
 */
export function optQueryToSearchRequest(query: string): SearchRequest | null {
  const state: OptUiState = { ...DEFAULT_OPT_STATE, ...paramsToUiState(new URLSearchParams(query)) };
  const filters = optStateToFilters(state, state.query);
  if (Object.keys(filters).length === 0) return null;
  return buildSearchRequest({
    filters,
    languages: state.selectedLanguages,
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
    groupByCard: state.groupByCard,
    page: 1,
    limit: PAGE_SIZE,
  });
}
