"use client";

/**
 * /opt-style command bar for the deck-builder Add Card dialog: scope toggle
 * (name/text), search input, result count, facet popover row, sort controls,
 * and active-filter chips — all driven by the shared OptUiState reducer.
 *
 * Purely presentational: state and dispatch come from QuickAddCardDialog,
 * which also owns the data fetch (useCardSearch) and deck-legality context.
 * Rendered inside the dialog's `.dark` wrapper, so the shared facet
 * components' dark: variants apply.
 */

import React, { useMemo, type Dispatch, type RefObject } from 'react';
import { Search, X, Check, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildFilterFacets, Popover, ActiveChip, type FacetDef } from '@/components/search/card-filter-facets';
import { optStateToChips } from '@/lib/search/opt-state-describe';
import type { OptUiState } from '@/lib/search/opt-url-state';
import type { OptAction } from '@/lib/search/opt-search-reducer';
import type { HeroPoolChip } from '@/lib/deck/hero-pool-chips';

// Sort options that are meaningful for card-grouped deck-building results.
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'cost', label: 'Cost' },
  { value: 'power', label: 'Power' },
  { value: 'defense', label: 'Defense' },
  { value: 'color', label: 'Color' },
  { value: 'rarity', label: 'Rarity' },
];

export interface QuickAddCommandBarProps {
  state: OptUiState;
  dispatch: Dispatch<OptAction>;
  facetDefs: FacetDef[];
  /** Facet keys hidden on this surface (class/talent/format/… are implied by the deck). */
  excludeFacets: string[];
  /** Hero-pool quick filter chips (classes/talents/Generic); empty = no facet. */
  poolChips?: HeroPoolChip[];
  total: number;
  loading: boolean;
  error: string | null;
  /** True when there is nothing to search (no legality context and no filters). */
  idle: boolean;
  /** Typo-tolerant name matching (server 'broad' mode); default strict. */
  matchBroad: boolean;
  onToggleMatchBroad: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

export default function QuickAddCommandBar({
  state, dispatch, facetDefs, excludeFacets, poolChips, total, loading, error,
  idle, matchBroad, onToggleMatchBroad, inputRef,
}: QuickAddCommandBarProps) {
  const { query, searchMode, sortBy, sortOrder } = state;
  const patch = (p: Partial<OptUiState>) => dispatch({ type: 'PATCH', patch: p });

  const facetLabels = useMemo(
    () => Object.fromEntries(facetDefs.map((d) => [d.id, d.label])),
    [facetDefs],
  );

  const filterFacets = buildFilterFacets({
    state, dispatch, availablePacks: [], facetDefs,
    exclude: excludeFacets, hideHeroAges: true, poolChips,
  });

  const activeChips = optStateToChips(state, { availablePacks: [], facetLabels }).map(c => ({
    key: c.key, label: c.label, onRemove: () => dispatch(c.removeAction),
  }));

  return (
    <div className="shrink-0 border-b border-gray-700/60 px-4 pt-3 pb-2 flex flex-col gap-2">
      {/* Row 1: scope toggle + search + count */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-gray-700 overflow-hidden shrink-0" role="group" aria-label="Search scope">
          {(['name', 'text'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => { patch({ searchMode: mode }); inputRef.current?.focus(); }}
              aria-pressed={searchMode === mode}
              title={mode === 'name' ? 'Search card names' : 'Search rule text'}
              className={cn(
                'flex items-center gap-1 px-3 py-2 text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                mode === 'text' && 'border-l border-gray-700',
                searchMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700',
              )}
            >
              {mode}
              {searchMode === mode && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden />}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => patch({ query: e.target.value })}
            placeholder={searchMode === 'text'
              ? 'Search rule text — e.g. prevent, deal arcane damage, go again'
              : 'Search by name or syntax — e.g. blue ninja go again, t:attack p:<5'}
            aria-label={searchMode === 'text' ? 'Search rule text' : 'Search cards by name'}
            className="w-full pl-9 pr-8 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {query && (
            <button
              onClick={() => { patch({ query: '' }); inputRef.current?.focus(); }}
              aria-label="Clear search text"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Strict/Broad match pill */}
        <button
          type="button"
          onClick={onToggleMatchBroad}
          aria-pressed={matchBroad}
          title={matchBroad
            ? 'Fuzzy matching on — also shows approximate name matches'
            : 'Strict matching — exact substring only. Click for fuzzy name matches.'}
          className={cn(
            'shrink-0 text-xs px-2.5 py-1 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
            matchBroad
              ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-800 border-gray-600 text-gray-300 hover:text-gray-100',
          )}
        >
          {matchBroad ? 'Fuzzy' : 'Strict'}
        </button>

        <span className="text-xs text-gray-300 font-medium tabular-nums whitespace-nowrap" aria-live="polite">
          {error ? (
            <span className="text-red-400">{error}</span>
          ) : idle ? (
            <span className="text-gray-400">Search or pick a filter</span>
          ) : loading ? (
            <span className="animate-pulse">Searching…</span>
          ) : (
            <>{total.toLocaleString()} card{total === 1 ? '' : 's'}</>
          )}
        </span>

        {/* Sort */}
        <div className="flex items-center gap-2 ml-auto">
          <select
            value={sortBy}
            onChange={e => patch({ sortBy: e.target.value })}
            aria-label="Sort by"
            className="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            onClick={() => patch({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' })}
            aria-label={`Sort ${sortOrder === 'asc' ? 'ascending' : 'descending'}`}
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            className="flex items-center gap-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortOrder === 'asc' ? 'Asc' : 'Desc'}
          </button>
        </div>
      </div>

      {/* Row 2: facet popovers */}
      <div className="flex flex-wrap items-center gap-2">
        <SlidersHorizontal className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
        {filterFacets.map(f => (
          <Popover key={f.key} label={f.label} count={f.count} align={f.align} panelClassName={f.panelClassName}>
            {f.body}
          </Popover>
        ))}
      </div>

      {/* Row 3: active chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold mr-0.5">Active</span>
          {activeChips.map(c => <ActiveChip key={c.key} label={c.label} onRemove={c.onRemove} />)}
          <button
            onClick={() => { dispatch({ type: 'RESET' }); inputRef.current?.focus(); }}
            className="ml-1 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-red-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded px-1"
          >
            <X className="w-3 h-3" /> Clear all
          </button>
        </div>
      )}
    </div>
  );
}
