/**
 * useCardSearch — shared data layer for the server-paginated card search used by
 * both /opt and /search. Owns the page-1 fetch, infinite-scroll "load more",
 * out-of-order response guarding, and the IntersectionObserver sentinel.
 *
 * Callers supply memoized `filters` (build with buildServerFilters) + sort +
 * grouping + language selection; the hook returns the accumulated results and
 * a `sentinelRef` to place at the end of the list.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';
import { searchPrintingsPost } from '@/lib/client/search-client';
import { PAGE_SIZE } from '@/lib/search/build-server-filters';
import type { PrintingsSearchFilters } from '@/lib/services/contracts/IPrintingsService';

interface UseCardSearchParams {
  filters: PrintingsSearchFilters;   // memoized by the caller
  languages: string[];               // [] = all languages
  sortBy: string;
  sortOrder: string;
  groupByCard: boolean;
  enabled: boolean;                  // false → idle (empty state)
  pageSize?: number;
  /** Name-matching mode passed to the server ('strict' substring vs 'broad'
   *  typo-tolerant word_similarity). Distinct from the name/text scope toggle. */
  matchMode?: 'strict' | 'broad';
  onLoaded?: (total: number) => void; // fired on each page-1 success (e.g. GA)
}

export function useCardSearch({
  filters, languages, sortBy, sortOrder, groupByCard, enabled,
  pageSize = PAGE_SIZE, matchMode = 'strict', onLoaded,
}: UseCardSearchParams) {
  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { ref: sentinelRef, inView } = useInView({ threshold: 0 });

  // Monotonic request id — guards against out-of-order responses when the query
  // changes while a fetch is in flight.
  const reqIdRef = useRef(0);

  const languageFilter = languages.length ? languages : undefined;

  // Stable key: changes whenever the effective query changes.
  const queryKey =
    JSON.stringify(filters) + '|' + sortBy + '|' + sortOrder + '|' + groupByCard +
    '|' + (languageFilter ? languageFilter.join(',') : 'all') + '|' + enabled + '|' + matchMode;

  // ── Page 1 (replace) on query change ──
  useEffect(() => {
    if (!enabled) {
      setResults([]); setTotal(0); setPages(0); setPage(1); setError(null); setLoading(false);
      return;
    }
    const id = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    searchPrintingsPost(
      { ...filters, languages: languageFilter },
      { page: 1, limit: pageSize, sortBy: sortBy as any, sortOrder: sortOrder as any, searchMode: matchMode, groupByCard },
    )
      .then(res => {
        if (id !== reqIdRef.current) return;
        if (res.success) {
          setResults(res.data.printings ?? []);
          setTotal(res.data.total ?? 0);
          setPages(res.data.pages ?? 0);
          setPage(1);
          onLoaded?.(res.data.total ?? 0);
        } else {
          setError(res.error || 'Search failed');
          setResults([]); setTotal(0); setPages(0);
        }
      })
      .catch(() => { if (id === reqIdRef.current) { setError('Search failed'); setResults([]); } })
      .finally(() => { if (id === reqIdRef.current) setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  // ── Load next page and append ──
  const loadMore = useCallback(() => {
    if (loading || loadingMore || page >= pages) return;
    const id = reqIdRef.current;
    const next = page + 1;
    setLoadingMore(true);
    searchPrintingsPost(
      { ...filters, languages: languageFilter },
      { page: next, limit: pageSize, sortBy: sortBy as any, sortOrder: sortOrder as any, searchMode: matchMode, groupByCard },
    )
      .then(res => {
        if (id !== reqIdRef.current) return;
        if (res.success) {
          setResults(prev => [...prev, ...(res.data.printings ?? [])]);
          setPage(next);
        }
      })
      .finally(() => { if (id === reqIdRef.current) setLoadingMore(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loadingMore, page, pages, queryKey, pageSize]);

  useEffect(() => {
    if (inView) loadMore();
  }, [inView, loadMore]);

  return { results, total, pages, page, loading, loadingMore, error, sentinelRef, hasMore: page < pages };
}
