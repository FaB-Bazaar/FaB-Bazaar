'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Check, ChevronDown, SlidersHorizontal, List, Images, Heart, UploadCloud, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RarityIcon } from '@/components/shared/RarityIcon';
import { getSetImageOrFallback } from '@/lib/set-images';
import { SET_MAP } from '@/lib/fab-constants';
import { CARD_FILTER_SETS } from '@/lib/fab-constants/sets';
import SyntaxGuideModal from '@/components/dialogs/search/query-syntax-guide-modal';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import {
  TYPE_CHIPS, CLASS_ICONS, ALL_CLASSES, ALL_TALENTS, PITCH_CHIPS,
  KEYWORD_CHIPS, RARITY_OPTIONS, FOILING_OPTIONS, EDITION_OPTIONS, FORMAT_OPTIONS, PRICE_PRESETS, HERO_AGE_CHIPS,
} from '@/lib/search/card-filter-chips';
import { ImagesView } from '@/components/search/ImagesView';
import { ChecklistView } from '@/components/search/ChecklistView';
import { AppShellAttribution } from '@/components/search/AppShellAttribution';
import { useSearchSelection } from '@/hooks/search/useSearchSelection';
import { useCardSearch } from '@/hooks/search/useCardSearch';
import { useOptSearchState } from '@/hooks/search/useOptSearchState';
import { languageFlag } from '@/lib/utils/printing-language';
import { LANGUAGES } from '@/lib/search/build-server-filters';
import { toggleLanguageSelection } from '@/lib/search/language-selection';
import type { OptUiState } from '@/lib/search/opt-url-state';
import { trackSearch } from '@/lib/gtag';

const SECTION = 'text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-gray-400 mb-2';

// Sets selectable in the /opt set grid: the shared curated list plus GEM. GEM is
// a promo set kept out of CARD_FILTER_SETS (and thus the deck builder's filters),
// but it's offered here so its per-pack filter facet is reachable. Extend this
// list if other multi-group sets ever need pack filtering on /opt.
const OPT_FILTER_SETS: string[] = [...CARD_FILTER_SETS, 'gem'];

// Clickable example queries shown in the empty state. Either a plain card name
// or `key:value` shorthand (a bare phrase is treated as a name). All verified to
// return results.
const EXAMPLE_QUERIES = [
  'command and conquer',
  't:equipment p:<5',
  'r:m hero:dorinthea',
  'text:dominate t:attack',
];

// ─── Popover (filter dropdown) ────────────────────────────────────────────────
// Self-contained: closes on outside-click and Escape. No extra deps.

function Popover({
  label, count = 0, align = 'left', panelClassName, children,
}: {
  label: string;
  count?: number;
  align?: 'left' | 'right';
  panelClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
          count > 0
            ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
            : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-600',
        )}
      >
        {label}
        {count > 0 && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-white/25 text-xs leading-none">
            {count}
          </span>
        )}
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          className={cn(
            'absolute z-30 mt-1.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-3',
            align === 'right' ? 'right-0' : 'left-0',
            panelClassName ?? 'w-64',
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Art chip (type / class) ──────────────────────────────────────────────────

function ArtChip({
  label, iconUrl, iconPosition, active, activeClass, onClick,
}: {
  label: string;
  iconUrl?: string;
  iconPosition?: string;
  active: boolean;
  activeClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'group flex flex-col items-center gap-1 p-1 rounded border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
        active ? activeClass : 'bg-transparent border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200 hover:bg-[#E2EAF3] dark:hover:bg-gray-800',
      )}
    >
      <div
        className={cn(
          'w-full rounded overflow-hidden ring-1 transition-all',
          active
            ? 'ring-current opacity-100 shadow-md'
            : 'ring-black/10 dark:ring-gray-700 opacity-70 dark:opacity-50 group-hover:opacity-90 dark:group-hover:opacity-80 shadow-sm',
        )}
        style={{ aspectRatio: '1 / 1' }}
      >
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconUrl}
            alt={label}
            className="w-full object-cover"
            style={{ height: '220%', objectPosition: iconPosition ?? 'center 24%' }}
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-gray-600" />
          </div>
        )}
      </div>
      <span className="text-xs leading-tight truncate w-full text-center capitalize">{label}</span>
    </button>
  );
}

// ─── Pill (keyword / rarity / foiling / edition) ─────────────────────────────

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1 px-2 py-1 rounded-full border text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
        active
          ? 'border-gray-700 dark:border-gray-100 bg-gray-800 dark:bg-gray-100 text-gray-100 dark:text-gray-900'
          : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-200',
      )}
    >
      {children}
      {active && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden />}
    </button>
  );
}

// ─── Min/max numeric row ──────────────────────────────────────────────────────

function RangeRow({
  label, min, setMin, max, setMax,
}: {
  label: string;
  min: string; setMin: (v: string) => void;
  max: string; setMax: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-600 dark:text-gray-400 w-14 shrink-0">{label}</span>
      <input type="number" min="0" placeholder="Min" value={min} onChange={e => setMin(e.target.value)}
        className="w-16 px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <span className="text-gray-400 text-xs">–</span>
      <input type="number" min="0" placeholder="Max" value={max} onChange={e => setMax(e.target.value)}
        className="w-16 px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );
}

// ─── Active-filter chip ───────────────────────────────────────────────────────

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-200">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="p-0.5 rounded-full hover:bg-blue-200/60 dark:hover:bg-blue-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OptSearchPage() {
  // ── Consolidated filter/sort/view state ──
  // One reducer over OptUiState (lib/search/opt-search-reducer) + URL sync
  // (hydrate on mount, replaceState write-back) live in useOptSearchState.
  const {
    state, dispatch, urlReady, debouncedQuery, filters, hasAnyFilter,
    clearAll: resetFilters,
  } = useOptSearchState();
  const {
    query, searchMode, selectedType, selectedHeroAges, selectedClasses, selectedTalents,
    selectedTalentless, selectedPitch, selectedKeywords, selectedRarities, selectedFoilings,
    selectedEditions, selectedSets, selectedPacks, selectedFormat,
    costMin, costMax, powerMin, powerMax, defenseMin, defenseMax, priceMin, priceMax,
    selectedLanguages, sortBy, sortOrder, viewMode, groupByCard,
  } = state;
  const patch = (p: Partial<OptUiState>) => dispatch({ type: 'PATCH', patch: p });

  // ── UI-only state (not part of the shareable search state) ──
  // TCGplayer packs (sub-set groups) available for the currently-selected sets.
  // The pack facet only renders when a selected set actually has packs (e.g.
  // GEM), so it stays invisible for normal sets.
  const [availablePacks, setAvailablePacks] = useState<{ groupId: number; name: string }[]>([]);
  const [syntaxGuideOpen, setSyntaxGuideOpen] = useState(false);
  // Mobile-only: the filter bottom sheet (desktop uses the inline popover row).
  const [filtersOpen, setFiltersOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const selection = useSearchSelection();

  useEffect(() => { inputRef.current?.focus(); }, []);

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
    if (selectedSets.length === 0) {
      setAvailablePacks([]);
      dispatch({ type: 'PRUNE_PACKS', valid: [] });
      return;
    }
    let cancelled = false;
    Promise.all(
      selectedSets.map(s =>
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

  const isDefaultLang = selectedLanguages.length === 1 && selectedLanguages[0] === 'en';

  // ── Active-filter chip descriptors ──
  const rangeLabel = (label: string, min: string, max: string) =>
    min && max ? `${label} ${min}–${max}` : min ? `${label} ≥ ${min}` : `${label} ≤ ${max}`;

  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (selectedPitch !== null) {
    const p = PITCH_CHIPS.find(c => c.value === selectedPitch);
    activeChips.push({ key: 'pitch', label: `Pitch: ${p?.label ?? selectedPitch}`, onRemove: () => patch({ selectedPitch: null }) });
  }
  if (selectedType) {
    const t = TYPE_CHIPS.find(c => c.value === selectedType);
    activeChips.push({ key: 'type', label: t?.label ?? selectedType, onRemove: () => patch({ selectedType: null }) });
  }
  selectedHeroAges.forEach(age => {
    const def = HERO_AGE_CHIPS.find(c => c.value === age);
    activeChips.push({ key: `hero:${age}`, label: def?.label ?? age, onRemove: () => dispatch({ type: 'TOGGLE_HERO_AGE', value: age }) });
  });
  selectedClasses.forEach(cls => {
    activeChips.push({ key: `class:${cls}`, label: cls, onRemove: () => dispatch({ type: 'TOGGLE_IN', key: 'selectedClasses', value: cls }) });
  });
  selectedTalents.forEach(tal => {
    activeChips.push({ key: `talent:${tal}`, label: tal, onRemove: () => dispatch({ type: 'TOGGLE_TALENT', value: tal }) });
  });
  if (selectedTalentless) {
    activeChips.push({ key: 'talentless', label: 'Talentless', onRemove: () => dispatch({ type: 'TOGGLE_TALENTLESS' }) });
  }
  selectedKeywords.forEach(kw => {
    const def = KEYWORD_CHIPS.find(k => k.value === kw);
    activeChips.push({ key: `kw:${kw}`, label: def?.label ?? kw, onRemove: () => dispatch({ type: 'TOGGLE_IN', key: 'selectedKeywords', value: kw }) });
  });
  selectedRarities.forEach(r => {
    const def = RARITY_OPTIONS.find(o => o.value === r);
    activeChips.push({ key: `rar:${r}`, label: def?.label ?? r, onRemove: () => dispatch({ type: 'TOGGLE_IN', key: 'selectedRarities', value: r }) });
  });
  selectedFoilings.forEach(f => {
    const def = FOILING_OPTIONS.find(o => o.value === f);
    activeChips.push({ key: `foil:${f}`, label: def?.label ?? f, onRemove: () => dispatch({ type: 'TOGGLE_IN', key: 'selectedFoilings', value: f }) });
  });
  selectedEditions.forEach(e => {
    const def = EDITION_OPTIONS.find(o => o.value === e);
    activeChips.push({ key: `ed:${e}`, label: def?.label ?? e, onRemove: () => dispatch({ type: 'TOGGLE_IN', key: 'selectedEditions', value: e }) });
  });
  if (selectedFormat) {
    const def = FORMAT_OPTIONS.find(o => o.value === selectedFormat);
    activeChips.push({ key: 'format', label: `Format: ${def?.label ?? selectedFormat}`, onRemove: () => patch({ selectedFormat: null }) });
  }
  selectedSets.forEach(s => {
    activeChips.push({ key: `set:${s}`, label: SET_MAP[s.toLowerCase() as keyof typeof SET_MAP] ?? s, onRemove: () => dispatch({ type: 'TOGGLE_IN', key: 'selectedSets', value: s }) });
  });
  selectedPacks.forEach(g => {
    const pack = availablePacks.find(p => p.groupId === g);
    activeChips.push({ key: `pack:${g}`, label: pack?.name ?? `Pack ${g}`, onRemove: () => dispatch({ type: 'TOGGLE_PACK', value: g }) });
  });
  if (costMin || costMax) activeChips.push({ key: 'cost', label: rangeLabel('Cost', costMin, costMax), onRemove: () => dispatch({ type: 'CLEAR_RANGE', range: 'cost' }) });
  if (powerMin || powerMax) activeChips.push({ key: 'power', label: rangeLabel('Power', powerMin, powerMax), onRemove: () => dispatch({ type: 'CLEAR_RANGE', range: 'power' }) });
  if (defenseMin || defenseMax) activeChips.push({ key: 'def', label: rangeLabel('Defense', defenseMin, defenseMax), onRemove: () => dispatch({ type: 'CLEAR_RANGE', range: 'defense' }) });
  if (priceMin || priceMax) {
    const priceLabel = priceMin && priceMax
      ? `$${priceMin}–$${priceMax}`
      : priceMin ? `≥ $${priceMin}` : `≤ $${priceMax}`;
    activeChips.push({ key: 'price', label: priceLabel, onRemove: () => dispatch({ type: 'CLEAR_RANGE', range: 'price' }) });
  }
  if (!isDefaultLang) {
    const label = selectedLanguages.length === 0
      ? 'All languages'
      : 'Lang: ' + selectedLanguages.map(c => c.toUpperCase()).join(', ');
    activeChips.push({ key: 'lang', label, onRemove: () => patch({ selectedLanguages: ['en'] }) });
  }

  const statsCount = [costMin || costMax, powerMin || powerMax, defenseMin || defenseMax].filter(Boolean).length;

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

  // ── Filter facet descriptors — single source rendered both as desktop
  //    popovers and as mobile filter-sheet accordion sections. ──
  type FilterFacet = { key: string; label: string; count: number; align?: 'left' | 'right'; panelClassName?: string; body: React.ReactNode };
  const filterFacets: FilterFacet[] = [
    {
      key: 'pitch', label: 'Pitch', count: selectedPitch !== null ? 1 : 0, panelClassName: 'w-auto',
      body: (
        <>
          <p className={SECTION}>Pitch</p>
          <div className="flex items-center gap-2">
            {PITCH_CHIPS.map(chip => {
              const isActive = selectedPitch === chip.value;
              return (
                <button
                  key={chip.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => patch({ selectedPitch: selectedPitch === chip.value ? null : chip.value })}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-md border text-base font-medium transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                    isActive
                      ? cn(chip.active, 'text-gray-900 dark:text-white')
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700',
                  )}
                >
                  <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', chip.dot)} aria-hidden />
                  {chip.label}
                  {isActive && <Check className="w-4 h-4 shrink-0" aria-hidden />}
                </button>
              );
            })}
          </div>
        </>
      ),
    },
    {
      key: 'type', label: 'Type', count: (selectedType ? 1 : 0) + selectedHeroAges.length, panelClassName: 'w-72',
      body: (
        <>
          <p className={SECTION}>Type</p>
          <div className="grid grid-cols-4 gap-1">
            {TYPE_CHIPS.map(chip => (
              <ArtChip
                key={chip.value}
                label={chip.label} iconUrl={chip.iconUrl} iconPosition={chip.iconPosition}
                active={selectedType === chip.value} activeClass={chip.active}
                onClick={() => dispatch({ type: 'TOGGLE_TYPE', value: chip.value })}
              />
            ))}
          </div>
          <p className={cn(SECTION, 'mt-3')}>Hero</p>
          <div className="grid grid-cols-2 gap-1">
            {HERO_AGE_CHIPS.map(chip => (
              <ArtChip
                key={chip.value}
                label={chip.label} iconUrl={chip.iconUrl} iconPosition={chip.iconPosition}
                active={selectedHeroAges.includes(chip.value)} activeClass={chip.active}
                onClick={() => dispatch({ type: 'TOGGLE_HERO_AGE', value: chip.value })}
              />
            ))}
          </div>
        </>
      ),
    },
    {
      key: 'class', label: 'Class', count: selectedClasses.length, panelClassName: 'w-72',
      body: (
        <>
          <p className={SECTION}>Class</p>
          <div className="grid grid-cols-4 gap-1">
            {ALL_CLASSES.map(cls => {
              const icon = CLASS_ICONS[cls];
              return (
                <ArtChip
                  key={cls}
                  label={cls} iconUrl={icon?.iconUrl} iconPosition={icon?.iconPosition}
                  active={selectedClasses.includes(cls)} activeClass="bg-indigo-900/50 border-indigo-600"
                  onClick={() => dispatch({ type: 'TOGGLE_IN', key: 'selectedClasses', value: cls })}
                />
              );
            })}
          </div>
        </>
      ),
    },
    {
      key: 'talent', label: 'Talent', count: selectedTalents.length + (selectedTalentless ? 1 : 0), panelClassName: 'w-72',
      body: (
        <>
          <p className={SECTION}>Talent</p>
          <div className="mb-2">
            <Pill active={selectedTalentless} onClick={() => dispatch({ type: 'TOGGLE_TALENTLESS' })}>
              Talentless
            </Pill>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {ALL_TALENTS.map(tal => {
              const icon = CLASS_ICONS[tal];
              return (
                <ArtChip
                  key={tal}
                  label={tal} iconUrl={icon?.iconUrl} iconPosition={icon?.iconPosition}
                  active={selectedTalents.includes(tal)} activeClass="bg-teal-900/50 border-teal-600"
                  onClick={() => dispatch({ type: 'TOGGLE_TALENT', value: tal })}
                />
              );
            })}
          </div>
        </>
      ),
    },
    {
      key: 'keywords', label: 'Keywords', count: selectedKeywords.length, panelClassName: 'w-72',
      body: (
        <>
          <p className={SECTION}>Keywords</p>
          <div className="flex flex-wrap gap-1">
            {KEYWORD_CHIPS.map(kw => (
              <Pill key={kw.value} active={selectedKeywords.includes(kw.value)} onClick={() => dispatch({ type: 'TOGGLE_IN', key: 'selectedKeywords', value: kw.value })}>
                {kw.label}
              </Pill>
            ))}
          </div>
        </>
      ),
    },
    {
      key: 'format', label: 'Format', count: selectedFormat ? 1 : 0, panelClassName: 'w-56',
      body: (
        <>
          <p className={SECTION}>Format</p>
          <div className="flex flex-wrap gap-1">
            {FORMAT_OPTIONS.map(fmt => (
              <Pill
                key={fmt.value}
                active={selectedFormat === fmt.value}
                onClick={() => patch({ selectedFormat: selectedFormat === fmt.value ? null : fmt.value })}
              >
                {fmt.label}
              </Pill>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 leading-snug">
            Shows cards legal in the selected format (banned &amp; suspended excluded).
          </p>
        </>
      ),
    },
    {
      key: 'rarity', label: 'Rarity', count: selectedRarities.length, panelClassName: 'w-64',
      body: (
        <>
          <p className={SECTION}>Rarity</p>
          <div className="flex flex-wrap gap-1">
            {RARITY_OPTIONS.map(r => (
              <Pill key={r.value} active={selectedRarities.includes(r.value)} onClick={() => dispatch({ type: 'TOGGLE_IN', key: 'selectedRarities', value: r.value })}>
                <RarityIcon rarityCode={r.value} size="sm" />
                {r.label}
              </Pill>
            ))}
          </div>
        </>
      ),
    },
    {
      key: 'stats', label: 'Stats', count: statsCount, panelClassName: 'w-64',
      body: (
        <>
          <p className={SECTION}>Stats</p>
          <div className="space-y-2">
            <RangeRow label="Cost"    min={costMin}    setMin={v => dispatch({ type: 'SET_RANGE', range: 'cost', min: v })}    max={costMax}    setMax={v => dispatch({ type: 'SET_RANGE', range: 'cost', max: v })} />
            <RangeRow label="Power"   min={powerMin}   setMin={v => dispatch({ type: 'SET_RANGE', range: 'power', min: v })}   max={powerMax}   setMax={v => dispatch({ type: 'SET_RANGE', range: 'power', max: v })} />
            <RangeRow label="Defense" min={defenseMin} setMin={v => dispatch({ type: 'SET_RANGE', range: 'defense', min: v })} max={defenseMax} setMax={v => dispatch({ type: 'SET_RANGE', range: 'defense', max: v })} />
          </div>
        </>
      ),
    },
    {
      key: 'price', label: 'Price', count: (priceMin || priceMax) ? 1 : 0, panelClassName: 'w-64',
      body: (
        <>
          <p className={SECTION}>Price</p>
          <div className="flex flex-wrap gap-1">
            {PRICE_PRESETS.map(p => {
              const active = priceMin === p.min && priceMax === p.max;
              return (
                <Pill
                  key={p.label}
                  active={active}
                  onClick={() => dispatch({ type: 'TOGGLE_PRICE_PRESET', min: p.min, max: p.max })}
                >
                  {p.label}
                </Pill>
              );
            })}
          </div>
          <div className="mt-3">
            <p className={SECTION}>Custom range ($)</p>
            <RangeRow label="Price" min={priceMin} setMin={v => dispatch({ type: 'SET_RANGE', range: 'price', min: v })} max={priceMax} setMax={v => dispatch({ type: 'SET_RANGE', range: 'price', max: v })} />
          </div>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 leading-snug">
            Based on TCGplayer low; English printings only.
          </p>
        </>
      ),
    },
    {
      key: 'more', label: 'More', count: selectedFoilings.length + selectedEditions.length + selectedSets.length + selectedPacks.length, align: 'right', panelClassName: 'w-80',
      body: (
        <div className="space-y-3">
          <div>
            <p className={SECTION}>Foiling</p>
            <div className="flex flex-wrap gap-1">
              {FOILING_OPTIONS.map(f => (
                <Pill key={f.value} active={selectedFoilings.includes(f.value)} onClick={() => dispatch({ type: 'TOGGLE_IN', key: 'selectedFoilings', value: f.value })}>
                  <span className={cn('w-2.5 h-2.5 rounded-sm shrink-0', f.swatch)} />
                  {f.label}
                </Pill>
              ))}
            </div>
          </div>
          <div>
            <p className={SECTION}>Edition</p>
            <div className="flex flex-wrap gap-1">
              {EDITION_OPTIONS.map(e => (
                <Pill key={e.value} active={selectedEditions.includes(e.value)} onClick={() => dispatch({ type: 'TOGGLE_IN', key: 'selectedEditions', value: e.value })}>
                  {e.label}
                </Pill>
              ))}
            </div>
          </div>
          <div>
            <p className={SECTION}>Set</p>
            <div className="grid grid-cols-5 gap-1 max-h-48 overflow-y-auto">
              {OPT_FILTER_SETS.map(setCode => (
                <button
                  key={setCode}
                  type="button"
                  title={SET_MAP[setCode as keyof typeof SET_MAP]}
                  aria-pressed={selectedSets.includes(setCode)}
                  onClick={() => dispatch({ type: 'TOGGLE_IN', key: 'selectedSets', value: setCode })}
                  className={cn(
                    'flex flex-col items-center p-1 rounded border transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                    selectedSets.includes(setCode)
                      ? 'border-gray-800 dark:border-gray-100 ring-1 ring-gray-600 dark:ring-gray-100'
                      : 'border-gray-300 dark:border-gray-700 hover:border-gray-500',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getSetImageOrFallback(setCode, setCode.toUpperCase())}
                    className="w-7 h-7 object-contain"
                    alt={SET_MAP[setCode as keyof typeof SET_MAP] || setCode}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{setCode.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>
          {availablePacks.length > 0 && (
            <div>
              <p className={SECTION}>Pack</p>
              <div className="flex flex-wrap gap-1">
                {availablePacks.map(p => (
                  <Pill
                    key={p.groupId}
                    active={selectedPacks.includes(p.groupId)}
                    onClick={() => dispatch({ type: 'TOGGLE_PACK', value: p.groupId })}
                  >
                    {p.name}
                  </Pill>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'language', label: 'Language', count: isDefaultLang ? 0 : (selectedLanguages.length || 1), align: 'right', panelClassName: 'w-56',
      body: (
        <>
          <p className={SECTION}>Language</p>
          <div className="space-y-2">
            <Pill active={selectedLanguages.length === 0} onClick={() => patch({ selectedLanguages: [] })}>
              All languages
            </Pill>
            <div className="flex flex-wrap gap-1">
              {LANGUAGES.map(l => (
                <Pill key={l.code} active={selectedLanguages.includes(l.code)} onClick={() => patch({ selectedLanguages: toggleLanguageSelection(selectedLanguages, l.code) })}>
                  <span aria-hidden>{languageFlag(l.code)}</span> {l.label}
                </Pill>
              ))}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-snug">
              Only English printings have prices &amp; TCGplayer links.
            </p>
          </div>
        </>
      ),
    },
  ];

  // ── Render ──
  return (
    <div className="flex flex-col h-[calc(100vh-64px-3.5rem)] sm:h-[calc(100vh-64px)] bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">

      {/* ── COMMAND BAR ── */}
      <div className="shrink-0 border-b border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900">
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
            <button
              onClick={() => setSyntaxGuideOpen(true)}
              className="ml-auto shrink-0 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded px-1"
            >
              Syntax guide →
            </button>
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
        <DrawerContent className="max-h-[88vh]">
          <DrawerHeader className="flex flex-row items-center justify-between py-3">
            <DrawerTitle>Filters</DrawerTitle>
            <div className="flex items-center gap-3">
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
                {hasAnyFilter ? `Show ${total.toLocaleString()} ${groupByCard ? 'cards' : 'printings'}` : 'Done'}
              </button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <SyntaxGuideModal isOpen={syntaxGuideOpen} onClose={() => setSyntaxGuideOpen(false)} />
    </div>
  );
}
