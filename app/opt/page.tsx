'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDebounce } from 'use-debounce';
import { Search, X, ChevronDown, SlidersHorizontal, List, Images, Heart, UploadCloud, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RarityIcon } from '@/components/shared/RarityIcon';
import { getSetImageOrFallback } from '@/lib/set-images';
import { SET_MAP } from '@/lib/fab-constants';
import { CARD_FILTER_SETS } from '@/lib/fab-constants/sets';
import SyntaxGuideModal from '@/components/dialogs/search/query-syntax-guide-modal';
import {
  TYPE_CHIPS, GENERIC_CHIP, CLASS_ICONS, ALL_CLASSES, PITCH_CHIPS,
  KEYWORD_CHIPS, RARITY_OPTIONS, FOILING_OPTIONS, EDITION_OPTIONS,
} from '@/lib/search/card-filter-chips';
import { ImagesView } from '@/components/search/ImagesView';
import { ChecklistView } from '@/components/search/ChecklistView';
import { useSearchSelection } from '@/hooks/search/useSearchSelection';
import { useCardSearch } from '@/hooks/search/useCardSearch';
import { languageFlag } from '@/lib/utils/printing-language';
import { buildServerFilters, LANGUAGES, DEFAULT_LANGUAGES } from '@/lib/search/build-server-filters';
import type { PrintingsSearchFilters } from '@/lib/services/contracts/IPrintingsService';
import { trackSearch } from '@/lib/gtag';

const SECTION = 'text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-2';

// Clickable example queries shown in the empty state + under the search bar.
const EXAMPLE_QUERIES = [
  'blue ninja go again',
  't:equipment p:<5',
  'r:m hero:dorinthea',
  'command and conquer | art of war',
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
          'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
          count > 0
            ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
            : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-600',
        )}
      >
        {label}
        {count > 0 && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-white/25 text-[10px] leading-none">
            {count}
          </span>
        )}
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          className={cn(
            'absolute z-30 mt-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-3',
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
        active ? activeClass : 'bg-transparent border-transparent text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-200 hover:bg-[#E2EAF3] dark:hover:bg-gray-800',
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
      <span className="text-[10px] leading-tight truncate w-full text-center capitalize">{label}</span>
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
        'flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400',
        active
          ? 'border-gray-700 dark:border-gray-100 bg-gray-800 dark:bg-gray-100 text-gray-100 dark:text-gray-900'
          : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-200',
      )}
    >
      {children}
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
      <span className="text-[10px] text-gray-500 w-14 shrink-0">{label}</span>
      <input type="number" min="0" placeholder="Min" value={min} onChange={e => setMin(e.target.value)}
        className="w-16 px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
      <span className="text-gray-400 text-xs">–</span>
      <input type="number" min="0" placeholder="Max" value={max} onChange={e => setMax(e.target.value)}
        className="w-16 px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
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
        className="p-0.5 rounded-full hover:bg-blue-200/60 dark:hover:bg-blue-800/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OptSearchPage() {
  // ── Filter state ──
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedPitch, setSelectedPitch] = useState<number | null>(null);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
  const [selectedFoilings, setSelectedFoilings] = useState<string[]>([]);
  const [selectedEditions, setSelectedEditions] = useState<string[]>([]);
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [costMin, setCostMin] = useState('');
  const [costMax, setCostMax] = useState('');
  const [powerMin, setPowerMin] = useState('');
  const [powerMax, setPowerMax] = useState('');
  const [defenseMin, setDefenseMin] = useState('');
  const [defenseMax, setDefenseMax] = useState('');
  const [priceMax, setPriceMax] = useState('');
  // Language selection: ['en'] = English default, [] = ALL languages.
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(DEFAULT_LANGUAGES);

  // ── UI state ──
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [viewMode, setViewMode] = useState<'images' | 'checklist'>('images');
  const [syntaxGuideOpen, setSyntaxGuideOpen] = useState(false);

  // Grouped is always the default on load (session-only toggle, not persisted) —
  // so a prior "All printings" choice never becomes the sticky default.
  const [groupByCard, setGroupByCard] = useState<boolean>(true);

  const [debouncedQuery] = useDebounce(query, 300);
  const inputRef = useRef<HTMLInputElement>(null);
  const selection = useSearchSelection();

  useEffect(() => { inputRef.current?.focus(); }, []);

  // ── Build structured server filters from UI state (debounced query) ──
  const filters = useMemo<PrintingsSearchFilters>(() => buildServerFilters({
    query: debouncedQuery,
    selectedType, selectedClass, selectedPitch,
    selectedKeywords, selectedRarities, selectedFoilings, selectedEditions, selectedSets,
    costMin, costMax, powerMin, powerMax, defenseMin, defenseMax, priceMax,
  }), [debouncedQuery, selectedType, selectedClass, selectedPitch, selectedKeywords,
       selectedRarities, selectedFoilings, selectedEditions, selectedSets,
       costMin, costMax, powerMin, powerMax, defenseMin, defenseMax, priceMax]);

  const hasAnyFilter = Object.keys(filters).length > 0;

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

  const toggleArr = (arr: string[], set: (v: string[]) => void, val: string) =>
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

  const clearAll = () => {
    setQuery(''); setSelectedType(null); setSelectedClass(null); setSelectedPitch(null);
    setSelectedKeywords([]); setSelectedRarities([]); setSelectedFoilings([]);
    setSelectedEditions([]); setSelectedSets([]);
    setCostMin(''); setCostMax(''); setPowerMin(''); setPowerMax('');
    setDefenseMin(''); setDefenseMax(''); setPriceMax('');
    setSelectedLanguages(DEFAULT_LANGUAGES);
    inputRef.current?.focus();
  };

  const isDefaultLang = selectedLanguages.length === 1 && selectedLanguages[0] === 'en';

  // ── Active-filter chip descriptors ──
  const rangeLabel = (label: string, min: string, max: string) =>
    min && max ? `${label} ${min}–${max}` : min ? `${label} ≥ ${min}` : `${label} ≤ ${max}`;

  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (selectedPitch !== null) {
    const p = PITCH_CHIPS.find(c => c.value === selectedPitch);
    activeChips.push({ key: 'pitch', label: `Pitch: ${p?.label ?? selectedPitch}`, onRemove: () => setSelectedPitch(null) });
  }
  if (selectedType) {
    const t = [...TYPE_CHIPS, GENERIC_CHIP].find(c => c.value === selectedType);
    activeChips.push({ key: 'type', label: t?.label ?? selectedType, onRemove: () => setSelectedType(null) });
  }
  if (selectedClass) {
    activeChips.push({ key: 'class', label: selectedClass, onRemove: () => setSelectedClass(null) });
  }
  selectedKeywords.forEach(kw => {
    const def = KEYWORD_CHIPS.find(k => k.value === kw);
    activeChips.push({ key: `kw:${kw}`, label: def?.label ?? kw, onRemove: () => toggleArr(selectedKeywords, setSelectedKeywords, kw) });
  });
  selectedRarities.forEach(r => {
    const def = RARITY_OPTIONS.find(o => o.value === r);
    activeChips.push({ key: `rar:${r}`, label: def?.label ?? r, onRemove: () => toggleArr(selectedRarities, setSelectedRarities, r) });
  });
  selectedFoilings.forEach(f => {
    const def = FOILING_OPTIONS.find(o => o.value === f);
    activeChips.push({ key: `foil:${f}`, label: def?.label ?? f, onRemove: () => toggleArr(selectedFoilings, setSelectedFoilings, f) });
  });
  selectedEditions.forEach(e => {
    const def = EDITION_OPTIONS.find(o => o.value === e);
    activeChips.push({ key: `ed:${e}`, label: def?.label ?? e, onRemove: () => toggleArr(selectedEditions, setSelectedEditions, e) });
  });
  selectedSets.forEach(s => {
    activeChips.push({ key: `set:${s}`, label: SET_MAP[s.toLowerCase() as keyof typeof SET_MAP] ?? s, onRemove: () => toggleArr(selectedSets, setSelectedSets, s) });
  });
  if (costMin || costMax) activeChips.push({ key: 'cost', label: rangeLabel('Cost', costMin, costMax), onRemove: () => { setCostMin(''); setCostMax(''); } });
  if (powerMin || powerMax) activeChips.push({ key: 'power', label: rangeLabel('Power', powerMin, powerMax), onRemove: () => { setPowerMin(''); setPowerMax(''); } });
  if (defenseMin || defenseMax) activeChips.push({ key: 'def', label: rangeLabel('Defense', defenseMin, defenseMax), onRemove: () => { setDefenseMin(''); setDefenseMax(''); } });
  if (priceMax) activeChips.push({ key: 'price', label: `≤ $${priceMax}`, onRemove: () => setPriceMax('') });
  if (!isDefaultLang) {
    const label = selectedLanguages.length === 0
      ? 'All languages'
      : 'Lang: ' + selectedLanguages.map(c => c.toUpperCase()).join(', ');
    activeChips.push({ key: 'lang', label, onRemove: () => setSelectedLanguages(['en']) });
  }

  const statsCount = [costMin || costMax, powerMin || powerMax, defenseMin || defenseMax].filter(Boolean).length;

  // ── Render ──
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">

      {/* ── COMMAND BAR ── */}
      <div className="shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="px-3 sm:px-4 pt-3 pb-2 flex flex-col gap-2.5">

          {/* Row 1: search + result count + view/sort controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by name or syntax — e.g. blue ninja go again, t:equipment p:<5"
                aria-label="Search cards"
                className="w-full pl-9 pr-8 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {query && (
                <button
                  onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                  aria-label="Clear search text"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium tabular-nums whitespace-nowrap" aria-live="polite">
              {error ? (
                <span className="text-red-500">{error}</span>
              ) : !hasAnyFilter ? (
                <span className="text-gray-400 dark:text-gray-600">Search the catalog</span>
              ) : loading ? (
                <span className="animate-pulse">Searching…</span>
              ) : (
                <>
                  {total.toLocaleString()} {groupByCard ? `card${total === 1 ? '' : 's'}` : `printing${total === 1 ? '' : 's'}`}
                </>
              )}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setGroupByCard(g => !g)}
                title={groupByCard ? 'Grouping printings by card — click to show every printing' : 'Showing every printing — click to group by card'}
                className={cn(
                  'px-2.5 py-1.5 text-xs rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                  groupByCard
                    ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
                )}
              >
                {groupByCard ? 'Grouped' : 'All printings'}
              </button>

              <div className="flex items-center rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
                <button
                  onClick={() => setViewMode('images')}
                  title="Image grid" aria-label="Image grid view" aria-pressed={viewMode === 'images'}
                  className={cn('px-2.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                    viewMode === 'images' ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}
                >
                  <Images className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('checklist')}
                  title="List view" aria-label="List view" aria-pressed={viewMode === 'checklist'}
                  className={cn('px-2.5 py-2 border-l border-gray-300 dark:border-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                    viewMode === 'checklist' ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                aria-label="Sort by"
                className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="name">Name</option>
                <option value="price">Price</option>
                <option value="set">Set</option>
                <option value="rarity">Rarity</option>
                <option value="power">Power</option>
                <option value="cost">Cost</option>
              </select>
              <button
                onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
                aria-label={`Sort ${sortOrder === 'asc' ? 'ascending' : 'descending'}`}
                title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                className="flex items-center gap-1 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                {sortOrder === 'asc' ? 'Asc' : 'Desc'}
              </button>
            </div>
          </div>

          {/* Row 2: quick-filter dropdowns. (No overflow container — it would clip the popovers.) */}
          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />

            {/* Pitch */}
            <Popover label="Pitch" count={selectedPitch !== null ? 1 : 0} panelClassName="w-auto">
              <p className={SECTION}>Pitch</p>
              <div className="flex items-center gap-2">
                {PITCH_CHIPS.map(chip => (
                  <button
                    key={chip.value}
                    type="button"
                    title={chip.label}
                    aria-pressed={selectedPitch === chip.value}
                    onClick={() => setSelectedPitch(p => p === chip.value ? null : chip.value)}
                    className={cn(
                      'p-1 rounded border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                      selectedPitch === chip.value
                        ? 'bg-gray-200 dark:bg-gray-700 border-gray-400 dark:border-white/30'
                        : 'border-transparent opacity-55 dark:opacity-40 hover:opacity-90 hover:border-gray-300 dark:hover:border-gray-600',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={chip.iconUrl} alt={chip.label} className="w-7 h-7 object-contain" draggable={false} />
                  </button>
                ))}
              </div>
            </Popover>

            {/* Type */}
            <Popover label="Type" count={selectedType ? 1 : 0} panelClassName="w-72">
              <p className={SECTION}>Type</p>
              <div className="grid grid-cols-4 gap-1">
                {[...TYPE_CHIPS, GENERIC_CHIP].map(chip => (
                  <ArtChip
                    key={chip.value}
                    label={chip.label} iconUrl={chip.iconUrl} iconPosition={chip.iconPosition}
                    active={selectedType === chip.value} activeClass={chip.active}
                    onClick={() => setSelectedType(t => t === chip.value ? null : chip.value)}
                  />
                ))}
              </div>
            </Popover>

            {/* Class */}
            <Popover label="Class" count={selectedClass ? 1 : 0} panelClassName="w-72">
              <p className={SECTION}>Class</p>
              <div className="grid grid-cols-4 gap-1">
                {ALL_CLASSES.map(cls => {
                  const icon = CLASS_ICONS[cls];
                  return (
                    <ArtChip
                      key={cls}
                      label={cls} iconUrl={icon?.iconUrl} iconPosition={icon?.iconPosition}
                      active={selectedClass === cls} activeClass="bg-indigo-900/50 border-indigo-600"
                      onClick={() => setSelectedClass(c => c === cls ? null : cls)}
                    />
                  );
                })}
              </div>
            </Popover>

            {/* Keywords */}
            <Popover label="Keywords" count={selectedKeywords.length} panelClassName="w-72">
              <p className={SECTION}>Keywords</p>
              <div className="flex flex-wrap gap-1">
                {KEYWORD_CHIPS.map(kw => (
                  <Pill key={kw.value} active={selectedKeywords.includes(kw.value)} onClick={() => toggleArr(selectedKeywords, setSelectedKeywords, kw.value)}>
                    {kw.label}
                  </Pill>
                ))}
              </div>
            </Popover>

            {/* Rarity */}
            <Popover label="Rarity" count={selectedRarities.length} panelClassName="w-64">
              <p className={SECTION}>Rarity</p>
              <div className="flex flex-wrap gap-1">
                {RARITY_OPTIONS.map(r => (
                  <Pill key={r.value} active={selectedRarities.includes(r.value)} onClick={() => toggleArr(selectedRarities, setSelectedRarities, r.value)}>
                    <RarityIcon rarityCode={r.value} size="sm" />
                    {r.label}
                  </Pill>
                ))}
              </div>
            </Popover>

            {/* Stats */}
            <Popover label="Stats" count={statsCount} panelClassName="w-64">
              <p className={SECTION}>Stats</p>
              <div className="space-y-2">
                <RangeRow label="Cost"    min={costMin}    setMin={setCostMin}    max={costMax}    setMax={setCostMax} />
                <RangeRow label="Power"   min={powerMin}   setMin={setPowerMin}   max={powerMax}   setMax={setPowerMax} />
                <RangeRow label="Defense" min={defenseMin} setMin={setDefenseMin} max={defenseMax} setMax={setDefenseMax} />
              </div>
            </Popover>

            {/* Price */}
            <Popover label="Price" count={priceMax ? 1 : 0} panelClassName="w-56">
              <p className={SECTION}>Max Price</p>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">$</span>
                <input type="number" min="0" placeholder="e.g. 25" value={priceMax} onChange={e => setPriceMax(e.target.value)}
                  className="w-28 px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </Popover>

            {/* More: foiling + edition + sets */}
            <Popover label="More" count={selectedFoilings.length + selectedEditions.length + selectedSets.length} align="right" panelClassName="w-80">
              <div className="space-y-3">
                <div>
                  <p className={SECTION}>Foiling</p>
                  <div className="flex flex-wrap gap-1">
                    {FOILING_OPTIONS.map(f => (
                      <Pill key={f.value} active={selectedFoilings.includes(f.value)} onClick={() => toggleArr(selectedFoilings, setSelectedFoilings, f.value)}>
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
                      <Pill key={e.value} active={selectedEditions.includes(e.value)} onClick={() => toggleArr(selectedEditions, setSelectedEditions, e.value)}>
                        {e.label}
                      </Pill>
                    ))}
                  </div>
                </div>
                <div>
                  <p className={SECTION}>Set</p>
                  <div className="grid grid-cols-5 gap-1 max-h-48 overflow-y-auto">
                    {CARD_FILTER_SETS.map(setCode => (
                      <button
                        key={setCode}
                        type="button"
                        title={SET_MAP[setCode]}
                        aria-pressed={selectedSets.includes(setCode)}
                        onClick={() => toggleArr(selectedSets, setSelectedSets, setCode)}
                        className={cn(
                          'flex flex-col items-center p-1 rounded border transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400',
                          selectedSets.includes(setCode)
                            ? 'border-gray-800 dark:border-gray-100 ring-1 ring-gray-600 dark:ring-gray-100'
                            : 'border-gray-300 dark:border-gray-700 hover:border-gray-500',
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getSetImageOrFallback(setCode, setCode.toUpperCase())}
                          className="w-7 h-7 object-contain"
                          alt={SET_MAP[setCode] || setCode}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{setCode.toUpperCase()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Popover>

            {/* Language — default English; expand to specific languages or ALL */}
            <Popover label="Language" count={isDefaultLang ? 0 : (selectedLanguages.length || 1)} align="right" panelClassName="w-56">
              <p className={SECTION}>Language</p>
              <div className="space-y-2">
                <Pill active={selectedLanguages.length === 0} onClick={() => setSelectedLanguages([])}>
                  All languages
                </Pill>
                <div className="flex flex-wrap gap-1">
                  {LANGUAGES.map(l => (
                    <Pill key={l.code} active={selectedLanguages.includes(l.code)} onClick={() => toggleArr(selectedLanguages, setSelectedLanguages, l.code)}>
                      <span aria-hidden>{languageFlag(l.code)}</span> {l.label}
                    </Pill>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-snug">
                  Only English printings have prices &amp; TCGplayer links.
                </p>
              </div>
            </Popover>

            <button
              onClick={() => setSyntaxGuideOpen(true)}
              className="ml-auto shrink-0 text-xs text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 rounded px-1"
            >
              Syntax guide →
            </button>
          </div>

          {/* Row 3: active-filter chips */}
          {activeChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mr-0.5">Active</span>
              {activeChips.map(c => <ActiveChip key={c.key} label={c.label} onRemove={c.onRemove} />)}
              <button
                onClick={clearAll}
                className="ml-1 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 rounded px-1"
              >
                <X className="w-3 h-3" /> Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Selection action bar */}
      {selection.selectedCount > 0 && (
        <div className="shrink-0 flex flex-wrap items-center gap-3 px-4 py-2 bg-blue-950/60 border-b border-blue-800/40">
          <span className="text-sm text-blue-200 font-medium">
            {selection.selectedCount} card{selection.selectedCount !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={selection.clearSelection}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-200 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 rounded"
          >
            <X className="w-3 h-3" /> Clear
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={selection.handleAddToWants}
              disabled={selection.isImporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-xs text-gray-200 hover:bg-gray-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
            >
              <Heart className="w-3.5 h-3.5" />
              {selection.isImporting ? 'Adding…' : 'To Wants'}
            </button>
            {selection.binders.length > 0 && (
              <>
                <select
                  value={selection.selectedBinderSlug}
                  onChange={e => selection.setSelectedBinderSlug(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {selection.binders.map((b: any) => (
                    <option key={b._id || b.slug} value={b.slug}>{b.name}</option>
                  ))}
                </select>
                <button
                  onClick={selection.handleAddToBinder}
                  disabled={selection.isImporting || !selection.selectedBinderSlug}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-600 text-xs text-white transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  {selection.isImporting ? 'Importing…' : 'To Binder'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── RESULTS ── */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-gray-50 dark:bg-gray-900">
        {!hasAnyFilter ? (
          // Empty state — surfaces the search syntax with clickable examples.
          <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center px-4">
            <Search className="w-10 h-10 mb-4 text-gray-300 dark:text-gray-700" />
            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium mb-1">Search the card catalog</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
              Type a name, use the quick filters above, or try a shorthand query:
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {EXAMPLE_QUERIES.map(q => (
                <button
                  key={q}
                  onClick={() => { setQuery(q); inputRef.current?.focus(); }}
                  className="px-2.5 py-1 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-300 font-mono hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
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
                  : <span className="text-xs text-gray-400">Scroll for more</span>}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Search className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No cards matched your filters.</p>
            <button onClick={clearAll} className="mt-3 text-xs hover:text-gray-700 dark:hover:text-gray-300 underline">Clear filters</button>
          </div>
        )}
      </div>

      <SyntaxGuideModal isOpen={syntaxGuideOpen} onClose={() => setSyntaxGuideOpen(false)} />
    </div>
  );
}
