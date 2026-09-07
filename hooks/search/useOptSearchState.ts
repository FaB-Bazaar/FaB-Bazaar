'use client';

/**
 * Consolidated /opt search state: one reducer over OptUiState plus the
 * URL hydrate/write-back lifecycle the page previously inlined.
 *
 * Deliberately thin — all decision logic lives in lib/search/ (pure,
 * node-vitest-covered): opt-search-reducer.ts, opt-url-state.ts,
 * build-server-filters.ts. This file only wires them to React, and is
 * exercised by the /opt Playwright specs.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type Dispatch } from 'react';
import { useDebounce } from 'use-debounce';
import { optSearchReducer, type OptAction } from '@/lib/search/opt-search-reducer';
import { DEFAULT_OPT_STATE, paramsToUiState, uiStateToParams, type OptUiState } from '@/lib/search/opt-url-state';
import { buildServerFilters } from '@/lib/search/build-server-filters';
import { effectiveSearchQuery } from '@/lib/search/effective-query';
import type { PrintingsSearchFilters } from '@/lib/services/contracts/IPrintingsService';

export interface OptSearchState {
  state: OptUiState;
  debouncedQuery: string;
  /** True once URL hydration has applied — gates effects that would otherwise
   *  race the restored state (pack fetch, URL write-back). */
  urlReady: boolean;
  dispatch: Dispatch<OptAction>;
  /** Structured server filters built from state (debounced query). */
  filters: PrintingsSearchFilters;
  hasAnyFilter: boolean;
  clearAll: () => void;
  /**
   * Apply a Volzar translation (chips + query + scope) so the FIRST search
   * after Enter already uses the translated query. A plain PATCH would leave
   * the 300ms-debounced query holding the English sentence for one render,
   * firing a stale name/text search (0 results + a wrong URL) that could even
   * land after the right one — useCardSearch has no request sequencing.
   */
  applyTranslation: (patch: Partial<OptUiState>) => void;
}

export function useOptSearchState(): OptSearchState {
  const [state, dispatch] = useReducer(optSearchReducer, DEFAULT_OPT_STATE);
  const [debouncedQueryRaw] = useDebounce(state.query, 300);
  // Set by applyTranslation; while true the live query bypasses the debounce.
  // Cleared once the debounce has caught up with the state.
  const immediateRef = useRef(false);
  if (immediateRef.current && debouncedQueryRaw === state.query) immediateRef.current = false;
  const debouncedQuery = immediateRef.current ? state.query : debouncedQueryRaw;
  const applyTranslation = useCallback((patch: Partial<OptUiState>) => {
    immediateRef.current = true;
    dispatch({ type: 'PATCH', patch });
  }, []);

  // Hydrate once on mount from the URL (client-only: avoids SSR hydration
  // mismatch). `urlReady` gates the write-back so we never serialize default
  // state over the incoming params before we've read them.
  const [urlReady, setUrlReady] = useState(false);
  useEffect(() => {
    dispatch({ type: 'HYDRATE', state: paramsToUiState(new URLSearchParams(window.location.search)) });
    setUrlReady(true);
  }, []);

  // Write current state back to the URL (no history spam, back button intact).
  // Uses the debounced query so typing doesn't rewrite the URL every keystroke.
  useEffect(() => {
    if (!urlReady) return;
    // Volzar scope: the box holds a question, not a filter — keep it out of the URL.
    const qs = uiStateToParams({ ...state, query: effectiveSearchQuery(state.searchMode, debouncedQuery) }).toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [urlReady, state, debouncedQuery]);

  const filters = useMemo<PrintingsSearchFilters>(() => buildServerFilters({
    ...state,
    query: effectiveSearchQuery(state.searchMode, debouncedQuery),
    selectedTcgGroups: state.selectedPacks,
    selectedFormat: (state.selectedFormat ?? null) as PrintingsSearchFilters['format'] | null,
  }), [state, debouncedQuery]);

  const hasAnyFilter = Object.keys(filters).length > 0;

  return {
    state,
    debouncedQuery,
    urlReady,
    dispatch,
    filters,
    hasAnyFilter,
    clearAll: () => dispatch({ type: 'RESET' }),
    applyTranslation,
  };
}
