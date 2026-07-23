'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Search, X, Check, SlidersHorizontal, List, Images, Heart, UploadCloud, ArrowUpDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import SyntaxGuideModal from '@/components/dialogs/search/query-syntax-guide-modal';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { buildFilterFacets, Popover, ActiveChip, SECTION, type FacetDef } from '@/components/search/card-filter-facets';
import { ImagesView } from '@/components/search/ImagesView';
import { ChecklistView } from '@/components/search/ChecklistView';
import { AppShellAttribution } from '@/components/search/AppShellAttribution';
import { useSearchSelection } from '@/hooks/search/useSearchSelection';
import { useCardSearch } from '@/hooks/search/useCardSearch';
import { useOptSearchState } from '@/hooks/search/useOptSearchState';
import { optStateToChips } from '@/lib/search/opt-state-describe';
import { uiStateToParams, type OptUiState } from '@/lib/search/opt-url-state';
import { canUseVolzar } from '@/lib/ai/volzar-access';
import { isSetGroupToken } from '@/lib/fab-constants/sets';
import { trackSearch } from '@/lib/gtag';

// Clickable example queries shown in the empty state. Either a plain card name
// or `key:value` shorthand (a bare phrase is treated as a name). All verified to
// return results.
const EXAMPLE_QUERIES = [
  'command and conquer',
  't:equipment p:<5',
  'r:m hero:dorinthea',
  'text:dominate t:attack',
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OptSearchPage() {
  // ── Consolidated filter/sort/view state ──
  // One reducer over OptUiState (lib/search/opt-search-reducer) + URL sync
  // (hydrate on mount, replaceState write-back) live in useOptSearchState.
  const {
    state, dispatch, urlReady, debouncedQuery, filters, hasAnyFilter,
    clearAll: resetFilters,
  } = useOptSearchState();
  // Only the fields the page body itself reads — the filter popovers get the
  // whole state via buildFilterFacets (components/search/card-filter-facets).
  const { query, searchMode, selectedSets, selectedLanguages, sortBy, sortOrder, viewMode, groupByCard } = state;
  const patch = (p: Partial<OptUiState>) => dispatch({ type: 'PATCH', patch: p });

  // ── UI-only state (not part of the shareable search state) ──
  // TCGplayer packs (sub-set groups) available for the currently-selected sets.
  // The pack facet only renders when a selected set actually has packs (e.g.
  // GEM), so it stays invisible for normal sets.
  const [availablePacks, setAvailablePacks] = useState<{ groupId: number; name: string }[]>([]);
  // Curated facet vocabulary (public read). Dynamic, unlike the hardcoded chip
  // constants, so it's fetched once; drafts are curator-internal and hidden.
  const [facetDefs, setFacetDefs] = useState<FacetDef[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/card-facets/tags')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j?.success) setFacetDefs((j.data as any[]).filter((d) => !d.draft)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const facetLabels = React.useMemo(
    () => Object.fromEntries(facetDefs.map((d) => [d.id, d.label])),
    [facetDefs],
  );
  const [syntaxGuideOpen, setSyntaxGuideOpen] = useState(false);
  // Mobile-only: the filter bottom sheet (desktop uses the inline popover row).
  const [filtersOpen, setFiltersOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const selection = useSearchSelection();

  // Arrivals via redirect/link (e.g. from Volzar) can carry a stale scroll or
  // visual-viewport pan — land with the command bar in view, then focus
  // without letting the focus re-scroll on its own terms.
  useEffect(() => {
    window.scrollTo(0, 0);
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  // Load the packs available for the selected sets (only multi-group sets like
  // GEM return any). Drives the conditional pack facet below. Pruning of
  // selectedPacks happens HERE — once the authoritative list is fetched — rather
  // than on every availablePacks change, so a URL-restored pack isn't wiped
  // during the transient pre-fetch window where availablePacks is still empty.
  useEffect(() => {
    // Wait until URL hydration has applied — otherwise this runs once with the
    // pre-hydration selectedSets=[] and its PRUNE_PACKS dispatch would wipe a
    // pack just restored from the URL (StrictMode double-mount race).
    if (!urlReady) return;
    // Deck-product group tokens (grp:blitz, …) aren't set codes and have no
    // packs endpoint — only query packs for the plain codes.
    const setCodes = selectedSets.filter(s => !isSetGroupToken(s));
    if (setCodes.length === 0) {
      setAvailablePacks([]);
      dispatch({ type: 'PRUNE_PACKS', valid: [] });
      return;
    }
    let cancelled = false;
    Promise.all(
      setCodes.map(s =>
        fetch(`/api/sets/${s.toLowerCase()}/packs`)
          .then(r => (r.ok ? r.json() : null))
          .then(d => (d?.success ? d.data as { groupId: number; name: string }[] : []))
          .catch(() => [])
      )
    ).then(lists => {
      if (cancelled) return;
      // Dedupe by groupId across selected sets, preserve release order.
      const seen = new Set<number>();
      const merged: { groupId: number; name: string }[] = [];
      for (const list of lists) for (const p of list) {
        if (!seen.has(p.groupId)) { seen.add(p.groupId); merged.push({ groupId: p.groupId, name: p.name }); }
      }
      setAvailablePacks(merged);
      // Drop any selected packs not offered by the current sets (identity-
      // preserving no-op inside the reducer when nothing is pruned).
      dispatch({ type: 'PRUNE_PACKS', valid: merged.map(p => p.groupId) });
    });
    return () => { cancelled = true; };
  }, [selectedSets, urlReady, dispatch]);

  // ── Server-paginated search (shared with /search) ──
  const { results, total, loading, loadingMore, error, sentinelRef, hasMore } = useCardSearch({
    filters,
    languages: selectedLanguages,
    sortBy, sortOrder, groupByCard,
    enabled: hasAnyFilter,
    onLoaded: (t) => { const q = debouncedQuery.trim(); if (q) trackSearch({ search_term: q, result_count: t }); },
  });

  // Server returns card-level rows when grouped, printing-level when not.
  const displayed = results;

  const clearAll = () => {
    resetFilters();
    inputRef.current?.focus();
  };

  // ── Bridge B: hand the current search off to the hosted Volzar chat ──
  // Same access rule as the chat itself (canUseVolzar — any signed-in user;
  // pass null when signed out or the always-truthy flags object would open
  // the gate for anonymous visitors). The href reuses the page's own URL
  // params plus from=opt & total=N; the chat page parses them back into
  // OptUiState and queues a context string for the first message.
  const { data: session } = useSession();
  const canAskVolzar = canUseVolzar(session?.user ? (session.user.roles ?? {}) : null);
  const askVolzarHref = `/volzar?from=opt&total=${total}&${uiStateToParams({ ...state, query: debouncedQuery }).toString()}`;
  const askVolzarLink = canAskVolzar && hasAnyFilter && (
    <Link
      href={askVolzarHref}
      className="shrink-0 inline-flex items-center gap-1 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded px-1"
    >
      <Sparkles className="w-3.5 h-3.5" aria-hidden /> Ask Volzar
    </Link>
  );

  // ── Active-filter chip descriptors (pure projection + reducer removeActions) ──
  const activeChips = optStateToChips(state, { availablePacks, facetLabels }).map(c => ({
    key: c.key, label: c.label, onRemove: () => dispatch(c.removeAction),
  }));

  // ── Reusable control snippets (rendered inline on desktop, inside the mobile
  //    filter sheet on small screens). Controlled components, so mounting the
  //    same element in both places is safe. ──
  const searchModeToggle = (
    <div className="flex items-center rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden shrink-0" role="group" aria-label="Search scope">
      {(['name', 'text'] as const).map(mode => (
        <button
          key={mode}
          type="button"
          onClick={() => { patch({ searchMode: mode }); inputRef.current?.focus(); }}
          aria-pressed={searchMode === mode}
          title={mode === 'name' ? 'Search card names' : 'Search rule text'}
          className={cn(
            'flex items-center gap-1 px-3 py-2 text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
            mode === 'text' && 'border-l border-gray-300 dark:border-gray-700',
            searchMode === mode
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
          )}
        >
          {mode}
          {searchMode === mode && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden />}
        </button>
      ))}
    </div>
  );

  const groupedToggle = (
    <button
      onClick={() => patch({ groupByCard: !groupByCard })}
      title={groupByCard ? 'Grouping printings by card — click to show every printing' : 'Showing every printing — click to group by card'}
      className={cn(
        'px-2.5 py-1.5 text-sm rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
        groupByCard
          ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
          : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
      )}
    >
      {groupByCard ? 'Grouped' : 'All printings'}
    </button>
  );

  const sortControls = (
    <>
      <select
        value={sortBy}
        onChange={e => patch({ sortBy: e.target.value })}
        aria-label="Sort by"
        className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="name">Name</option>
        <option value="price">Price</option>
        <option value="set">Set</option>
        <option value="edition">Edition</option>
        <option value="collector_number">Collector #</option>
        <option value="rarity">Rarity</option>
        <option value="foiling">Foiling</option>
        <option value="color">Color</option>
        <option value="cost">Cost</option>
        <option value="power">Power</option>
        <option value="defense">Defense</option>
      </select>
      <button
        onClick={() => patch({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' })}
        aria-label={`Sort ${sortOrder === 'asc' ? 'ascending' : 'descending'}`}
        title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        className="flex items-center gap-1 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <ArrowUpDown className="w-3.5 h-3.5" />
        {sortOrder === 'asc' ? 'Asc' : 'Desc'}
      </button>
    </>
  );

  // ── Filter facet descriptors — shared with /tags
  //    (components/search/card-filter-facets). Rendered as desktop popovers
  //    and the mobile filter-sheet accordion below. ──
  const filterFacets = buildFilterFacets({ state, dispatch, availablePacks, facetDefs });

  // ── Render ──
  return (
    // dvh, not vh: iOS Safari's 100vh is the LARGE viewport, so vh oversizes the
    // shell and lets the page scroll the command bar under the sticky navbar.
    <div className="flex flex-col h-[calc(100dvh-64px-3.5rem)] sm:h-[calc(100dvh-64px)] bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">

      {/* ── COMMAND BAR ── */}
      {/* sticky top-16 (navbar height): the footer + tab-bar padding still make
          the BODY scrollable by ~100px, which used to slide the search bar off
          screen on mobile — pin it below the navbar instead. */}
      <div className="sticky top-16 z-30 shrink-0 border-b border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="px-3 sm:px-4 pt-3 pb-2 flex flex-col gap-2.5">

          {/* Row 1: search + result count + view/sort controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Name / Text scope toggle — desktop only; on mobile it lives in the filter sheet. */}
            <div className="hidden sm:block">{searchModeToggle}</div>
            <div className="relative w-full sm:flex-1 sm:min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => patch({ query: e.target.value })}
                placeholder={searchMode === 'text'
                  ? 'Search rule text — e.g. prevent, deal arcane damage, go again'
                  : 'Search by name or syntax — e.g. blue ninja go again, t:equipment p:<5'}
                aria-label={searchMode === 'text' ? 'Search rule text' : 'Search cards by name'}
                className="w-full pl-9 pr-8 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {query && (
                <button
                  onClick={() => { patch({ query: '' }); inputRef.current?.focus(); }}
                  aria-label="Clear search text"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <span className="flex-1 sm:flex-none text-xs text-gray-600 dark:text-gray-400 font-medium tabular-nums whitespace-nowrap" aria-live="polite">
              {error ? (
                <span className="text-red-500 dark:text-red-400">{error}</span>
              ) : !hasAnyFilter ? (
                <span className="text-gray-500 dark:text-gray-400">Search the catalog</span>
              ) : loading ? (
                <span className="animate-pulse">Searching…</span>
              ) : (
                <>
                  {total.toLocaleString()} {groupByCard ? `card${total === 1 ? '' : 's'}` : `printing${total === 1 ? '' : 's'}`}
                </>
              )}
            </span>

            <div className="flex items-center gap-2">
              {/* Name / Text scope toggle — mobile only (desktop renders it left of
                  the search input). Lives inline to the left of the Filters button. */}
              <div className="sm:hidden">{searchModeToggle}</div>

              {/* Mobile: single entry point to the filter sheet (with active count). */}
              <button
                onClick={() => setFiltersOpen(true)}
                aria-label="Open filters"
                className="sm:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                {activeChips.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-white text-xs leading-none">
                    {activeChips.length}
                  </span>
                )}
              </button>

              {/* Grouped — desktop inline; in the sheet on mobile. */}
              <div className="hidden sm:block">{groupedToggle}</div>

              {/* View mode — kept inline on every breakpoint (most-used quick toggle). */}
              <div className="flex items-center rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
                <button
                  onClick={() => patch({ viewMode: 'images' })}
                  title="Image grid" aria-label="Image grid view" aria-pressed={viewMode === 'images'}
                  className={cn('px-2.5 py-2 border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                    viewMode === 'images' ? 'border-blue-600 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}
                >
                  <Images className="w-4 h-4" />
                </button>
                <button
                  onClick={() => patch({ viewMode: 'checklist' })}
                  title="List view" aria-label="List view" aria-pressed={viewMode === 'checklist'}
                  className={cn('px-2.5 py-2 border-l border-gray-300 dark:border-gray-700 border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                    viewMode === 'checklist' ? 'border-b-blue-600 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'border-b-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Sort — desktop inline; in the sheet on mobile. */}
              <div className="hidden sm:flex items-center gap-2">{sortControls}</div>
            </div>
          </div>

          {/* Row 2: quick-filter popovers — desktop only. On mobile these live in
              the filter bottom sheet, opened via the "Filters" button above. */}
          <div className="hidden sm:flex flex-wrap items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
            {filterFacets.map(f => (
              <Popover key={f.key} label={f.label} count={f.count} align={f.align} panelClassName={f.panelClassName}>
                {f.body}
              </Popover>
            ))}
            <div className="ml-auto flex items-center gap-3">
              {askVolzarLink}
              <button
                onClick={() => setSyntaxGuideOpen(true)}
                className="shrink-0 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded px-1"
              >
                Syntax guide →
              </button>
            </div>
          </div>

          {/* Row 3: active-filter chips */}
          {activeChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400 font-semibold mr-0.5">Active</span>
              {activeChips.map(c => <ActiveChip key={c.key} label={c.label} onRemove={c.onRemove} />)}
              <button
                onClick={clearAll}
                className="ml-1 inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded px-1"
              >
                <X className="w-3 h-3" /> Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Selection action bar — always present (shows "0 cards selected" when
          empty) so selecting the first card doesn't shift the layout. */}
      {(() => {
        const none = selection.selectedCount === 0;
        return (
        <div className={cn('shrink-0 flex-wrap items-center gap-3 px-4 py-2 border-b transition-colors', none ? 'hidden sm:flex bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-800' : 'flex bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800/40')}>
          <span className={cn('text-sm font-medium', none ? 'text-gray-600 dark:text-gray-400' : 'text-blue-700 dark:text-blue-200')}>
            {selection.selectedCount} card{selection.selectedCount !== 1 ? 's' : ''} selected
          </span>
          {!none && (
            <button
              onClick={selection.clearSelection}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2 min-w-0">
            <button
              onClick={selection.handleAddToWants}
              disabled={selection.isImporting || none}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <Heart className="w-3.5 h-3.5" />
              {selection.isImporting ? 'Adding…' : 'To Wants'}
            </button>
            {selection.binders.length > 0 && (
              <>
                <select
                  value={selection.selectedBinderSlug}
                  onChange={e => selection.setSelectedBinderSlug(e.target.value)}
                  disabled={none}
                  className="min-w-0 max-w-[40vw] sm:max-w-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {selection.binders.map((b: any) => (
                    <option key={b._id || b.slug} value={b.slug}>{b.name}</option>
                  ))}
                </select>
                <button
                  onClick={selection.handleAddToBinder}
                  disabled={selection.isImporting || !selection.selectedBinderSlug || none}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-600 text-sm text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  {selection.isImporting ? 'Importing…' : 'To Binder'}
                </button>
              </>
            )}
          </div>
        </div>
        );
      })()}

      {/* ── RESULTS ── */}
      {/* overscroll-contain: keep wheel/touch momentum inside this pane so it
          can't chain to the window when the next page is still loading. */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 bg-gray-50 dark:bg-gray-900">
        {!hasAnyFilter ? (
          // Empty state — surfaces the search syntax with clickable examples.
          <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center px-4">
            <Search className="w-10 h-10 mb-4 text-gray-300 dark:text-gray-700" />
            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium mb-1">Search the card catalog</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
              Type a name, use the quick filters above, or try a shorthand query:
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {EXAMPLE_QUERIES.map(q => (
                <button
                  key={q}
                  onClick={() => { patch({ query: q }); inputRef.current?.focus(); }}
                  className="px-2.5 py-1 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 font-mono hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm">Searching…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Search className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : displayed.length > 0 ? (
          <>
            {viewMode === 'checklist' ? (
              <ChecklistView
                printings={displayed}
                onToggleSelection={selection.toggleCardSelection}
                isCardSelected={selection.isCardSelected}
                getCardQuantity={selection.getCardQuantity}
                onUpdateQuantity={selection.updateQuantity}
                onSelectAll={() => selection.selectAll(displayed)}
                onDeselectAll={() => selection.deselectAll(displayed)}
              />
            ) : (
              <ImagesView
                printings={displayed}
                onToggleSelection={selection.toggleCardSelection}
                isCardSelected={selection.isCardSelected}
                getCardQuantity={selection.getCardQuantity}
                onUpdateQuantity={selection.updateQuantity}
              />
            )}
            {hasMore && (
              <div ref={sentinelRef} className="flex items-center justify-center py-6">
                {loadingMore
                  ? <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  : <span className="text-xs text-gray-600 dark:text-gray-400">Scroll for more</span>}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Search className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No cards matched your filters.</p>
            <button onClick={clearAll} className="mt-3 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline rounded px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">Clear filters</button>
          </div>
        )}
      </div>

      <AppShellAttribution />

      {/* ── MOBILE FILTER SHEET ── (sm:hidden trigger; desktop uses the popover row) */}
      <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
        {/* dvh, not vh: on iOS 88vh is measured against the LARGE viewport
            (toolbars collapsed), which pushes the footer button under
            Safari's bottom bar when the toolbars are showing. */}
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader className="flex flex-row items-center justify-between py-3">
            <DrawerTitle>Filters</DrawerTitle>
            <div className="flex items-center gap-3">
              {askVolzarLink}
              {activeChips.length > 0 && (
                <button
                  onClick={clearAll}
                  className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded px-1"
                >
                  <X className="w-3 h-3" /> Clear all
                </button>
              )}
              <button
                onClick={() => setSyntaxGuideOpen(true)}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded px-1"
              >
                Syntax →
              </button>
              {/* Explicit close — the swipe-down gesture and the footer button
                  aren't discoverable for everyone. */}
              <DrawerClose asChild>
                <button
                  type="button"
                  aria-label="Close filters"
                  className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <X className="w-4 h-4" aria-hidden />
                </button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="overflow-y-auto px-4 pb-2">
            {/* Display options — only surfaced here on mobile. (The Name/Text
                scope toggle lives inline in the command bar, not in this sheet.) */}
            <div className="flex flex-col gap-3 pb-3">
              <div className="flex items-center justify-between gap-2">
                <span className={SECTION + ' mb-0'}>Grouping</span>
                {groupedToggle}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className={SECTION + ' mb-0'}>Sort</span>
                <div className="flex items-center gap-2">{sortControls}</div>
              </div>
            </div>

            <Accordion type="multiple" className="border-t border-gray-300 dark:border-gray-800">
              {filterFacets.map(f => (
                <AccordionItem key={f.key} value={f.key}>
                  <AccordionTrigger className="text-sm">
                    <span className="flex items-center gap-2">
                      {f.label}
                      {f.count > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-xs leading-none">
                          {f.count}
                        </span>
                      )}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>{f.body}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <DrawerFooter className="pt-2">
            <DrawerClose asChild>
              <button className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                {hasAnyFilter ? `Show ${total.toLocaleString()} ${(groupByCard ? 'card' : 'printing') + (total === 1 ? '' : 's')}` : 'Done'}
              </button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <SyntaxGuideModal isOpen={syntaxGuideOpen} onClose={() => setSyntaxGuideOpen(false)} />
    </div>
  );
}
