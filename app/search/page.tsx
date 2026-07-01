'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDebounce } from 'use-debounce';
import { Search, X, ChevronDown, ChevronUp, SlidersHorizontal, List, Images, Heart, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RarityIcon } from '@/components/shared/RarityIcon';
import { getSetImageOrFallback } from '@/lib/set-images';
import { SET_MAP } from '@/lib/fab-constants';
import { CARD_FILTER_SETS } from '@/lib/fab-constants/sets';
import SyntaxGuideModal from '@/components/dialogs/search/query-syntax-guide-modal';
import {
  TYPE_CHIPS, CLASS_ICONS, ALL_CLASSES, ALL_TALENTS, PITCH_CHIPS,
  KEYWORD_CHIPS, RARITY_OPTIONS, FOILING_OPTIONS, EDITION_OPTIONS, PRICE_PRESETS,
} from '@/lib/search/card-filter-chips';
import { ImagesView } from '@/components/search/ImagesView';
import { ChecklistView } from '@/components/search/ChecklistView';
import { AppShellAttribution } from '@/components/search/AppShellAttribution';
import { useSearchSelection } from '@/hooks/search/useSearchSelection';
import { useCardSearch } from '@/hooks/search/useCardSearch';
import { buildServerFilters, LANGUAGES, DEFAULT_LANGUAGES } from '@/lib/search/build-server-filters';
import { toggleLanguageSelection } from '@/lib/search/language-selection';
import { languageFlag } from '@/lib/utils/printing-language';
import type { PrintingsSearchFilters } from '@/lib/services/contracts/IPrintingsService';
import { trackSearch } from '@/lib/gtag';

const SECTION = 'text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-2';

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
      <span className="text-xs leading-tight w-full text-center capitalize break-words">{label}</span>
    </button>
  );
}

// ─── Collapsible sidebar section ─────────────────────────────────────────────

function SidebarSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-[#D0DAE6] dark:border-gray-800 pt-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full mb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
      >
        <span className={SECTION + ' mb-0'}>{title}</span>
        {open ? <ChevronUp className="w-3 h-3 text-slate-400 dark:text-gray-600" /> : <ChevronDown className="w-3 h-3 text-slate-400 dark:text-gray-600" />}
      </button>
      {open && children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SearchPage() {
  // ── Filter state ──
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedTalents, setSelectedTalents] = useState<string[]>([]);
  const [selectedTalentless, setSelectedTalentless] = useState(false);
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
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');

  // ── UI state ──
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [viewMode, setViewMode] = useState<'images' | 'checklist'>('images');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [syntaxGuideOpen, setSyntaxGuideOpen] = useState(false);

  // Grouped (server-side: one cheapest printing per card) is the default on
  // every load — session-only, never persisted.
  const [groupByCard, setGroupByCard] = useState<boolean>(true);

  // Language selection: ['en'] = English default, [] = ALL languages.
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(DEFAULT_LANGUAGES);

  const [debouncedQuery] = useDebounce(query, 250);
  const inputRef = useRef<HTMLInputElement>(null);
  const selection = useSearchSelection();

  useEffect(() => { inputRef.current?.focus(); }, []);

  // ── Build structured server filters from the sidebar state ──
  const filters = useMemo<PrintingsSearchFilters>(() => buildServerFilters({
    query: debouncedQuery,
    selectedType, selectedClasses, selectedTalents, selectedTalentless, selectedPitch,
    selectedKeywords, selectedRarities, selectedFoilings, selectedEditions, selectedSets,
    costMin, costMax, powerMin, powerMax, defenseMin, defenseMax, priceMin, priceMax,
  }), [debouncedQuery, selectedType, selectedClasses, selectedTalents, selectedTalentless, selectedPitch, selectedKeywords,
       selectedRarities, selectedFoilings, selectedEditions, selectedSets,
       costMin, costMax, powerMin, powerMax, defenseMin, defenseMax, priceMin, priceMax]);

  const hasAnyFilter = Object.keys(filters).length > 0;
  const isDefaultLang = selectedLanguages.length === 1 && selectedLanguages[0] === 'en';

  // ── Server-paginated search (shared with /opt) ──
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
    setQuery(''); setSelectedType(null); setSelectedClasses([]); setSelectedTalents([]); setSelectedTalentless(false); setSelectedPitch(null);
    setSelectedKeywords([]); setSelectedRarities([]); setSelectedFoilings([]);
    setSelectedEditions([]); setSelectedSets([]);
    setCostMin(''); setCostMax(''); setPowerMin(''); setPowerMax('');
    setDefenseMin(''); setDefenseMax(''); setPriceMin(''); setPriceMax('');
    setSelectedLanguages(DEFAULT_LANGUAGES);
    inputRef.current?.focus();
  };

  const toggleArr = (arr: string[], set: (v: string[]) => void, val: string) =>
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">

      {/* ── LEFT SIDEBAR ── */}
      <aside
        className={cn(
          'shrink-0 border-r-2 border-[#C4D0DF] dark:border-gray-700 bg-[#EEF2F7] dark:bg-gray-900 shadow-[2px_0_8px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_12px_rgba(0,0,0,0.4)] overflow-y-auto flex flex-col transition-all duration-200',
          sidebarOpen ? 'w-[280px]' : 'w-0 overflow-hidden border-r-0',
        )}
      >
        <div className="p-3 flex flex-col gap-3 min-w-[280px]">

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 pointer-events-none" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Name or shorthand — e.g. t:equipment p:<5"
              className="w-full pl-8 pr-7 py-2 bg-white dark:bg-gray-800 border border-[#C4D0DF] dark:border-gray-700 rounded-lg shadow-sm text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setSyntaxGuideOpen(true)}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
          >
            Shorthand syntax guide →
          </button>

          {/* Pitch */}
          <div>
            <p className={SECTION}>Pitch</p>
            <div className="flex items-center gap-2">
              {PITCH_CHIPS.map(chip => {
                const isActive = selectedPitch === chip.value;
                return (
                  <button
                    key={chip.value}
                    type="button"
                    title={chip.label}
                    onClick={() => setSelectedPitch(p => p === chip.value ? null : chip.value)}
                    className={cn(
                      'p-1 rounded border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                      isActive
                        ? 'bg-gray-200 dark:bg-gray-700 border-gray-400 dark:border-white/30'
                        : 'border-transparent opacity-55 dark:opacity-40 hover:opacity-90 dark:hover:opacity-80 hover:border-gray-300 dark:hover:border-gray-600',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={chip.iconUrl} alt={chip.label} className="w-6 h-6 object-contain" draggable={false} />
                  </button>
                );
              })}
              {selectedPitch !== null && (
                <button onClick={() => setSelectedPitch(null)} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded">clear</button>
              )}
            </div>
          </div>

          {/* Rarity — a primary "base" filter: kept at the top, open by default */}
          <SidebarSection title="Rarity">
            <div className="flex flex-wrap gap-1">
              {RARITY_OPTIONS.map(r => {
                const active = selectedRarities.includes(r.value);
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => toggleArr(selectedRarities, setSelectedRarities, r.value)}
                    className={cn(
                      'flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                      active
                        ? 'border-gray-700 dark:border-gray-100 bg-gray-800 dark:bg-gray-100 text-gray-100 dark:text-gray-900'
                        : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-200',
                    )}
                  >
                    <RarityIcon rarityCode={r.value} size="sm" />
                    {r.label}
                  </button>
                );
              })}
            </div>
          </SidebarSection>

          {/* Type chips */}
          <SidebarSection title="Type">
            <div className="grid grid-cols-4 gap-1">
              {TYPE_CHIPS.map(chip => (
                <ArtChip
                  key={chip.value}
                  label={chip.label}
                  iconUrl={chip.iconUrl}
                  iconPosition={chip.iconPosition}
                  active={selectedType === chip.value}
                  activeClass={chip.active}
                  onClick={() => setSelectedType(t => t === chip.value ? null : chip.value)}
                />
              ))}
            </div>
          </SidebarSection>

          {/* Class chips — multi-select (OR). Includes Generic and Pirate. */}
          <SidebarSection title="Class">
            <div className="grid grid-cols-4 gap-1">
              {ALL_CLASSES.map(cls => {
                const icon = CLASS_ICONS[cls];
                return (
                  <ArtChip
                    key={cls}
                    label={cls}
                    iconUrl={icon?.iconUrl}
                    iconPosition={icon?.iconPosition}
                    active={selectedClasses.includes(cls)}
                    activeClass="bg-indigo-900/50 border-indigo-600"
                    onClick={() => toggleArr(selectedClasses, setSelectedClasses, cls)}
                  />
                );
              })}
            </div>
          </SidebarSection>

          {/* Talent chips — multi-select (OR), independent of class. "Talentless" = cards
              any hero of the class can play; mutually exclusive with specific talents. */}
          <SidebarSection title="Talent">
            <div className="mb-2">
              <button
                type="button"
                onClick={() => { setSelectedTalents([]); setSelectedTalentless(v => !v); }}
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                  selectedTalentless
                    ? 'border-gray-700 dark:border-gray-100 bg-gray-800 dark:bg-gray-100 text-gray-100 dark:text-gray-900'
                    : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-200',
                )}
              >
                Talentless
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {ALL_TALENTS.map(tal => {
                const icon = CLASS_ICONS[tal];
                return (
                  <ArtChip
                    key={tal}
                    label={tal}
                    iconUrl={icon?.iconUrl}
                    iconPosition={icon?.iconPosition}
                    active={selectedTalents.includes(tal)}
                    activeClass="bg-teal-900/50 border-teal-600"
                    onClick={() => { setSelectedTalentless(false); toggleArr(selectedTalents, setSelectedTalents, tal); }}
                  />
                );
              })}
            </div>
          </SidebarSection>

          {/* Keywords */}
          <SidebarSection title="Keywords" defaultOpen={false}>
            <div className="flex flex-wrap gap-1">
              {KEYWORD_CHIPS.map(kw => {
                const active = selectedKeywords.includes(kw.value);
                return (
                  <button
                    key={kw.value}
                    type="button"
                    onClick={() => toggleArr(selectedKeywords, setSelectedKeywords, kw.value)}
                    className={cn(
                      'px-2 py-0.5 rounded-full border text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                      active
                        ? 'border-gray-700 dark:border-gray-100 bg-gray-800 dark:bg-gray-100 text-gray-100 dark:text-gray-900'
                        : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-200',
                    )}
                  >
                    {kw.label}
                  </button>
                );
              })}
            </div>
          </SidebarSection>

          {/* Foiling */}
          <SidebarSection title="Foiling" defaultOpen={false}>
            <div className="flex flex-wrap gap-1">
              {FOILING_OPTIONS.map(f => {
                const active = selectedFoilings.includes(f.value);
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => toggleArr(selectedFoilings, setSelectedFoilings, f.value)}
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                      active
                        ? 'border-gray-700 dark:border-gray-100 bg-gray-800 dark:bg-gray-100 text-gray-100 dark:text-gray-900'
                        : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-200',
                    )}
                  >
                    <span className={cn('w-2.5 h-2.5 rounded-sm shrink-0', f.swatch)} />
                    {f.label}
                  </button>
                );
              })}
            </div>
          </SidebarSection>

          {/* Edition */}
          <SidebarSection title="Edition" defaultOpen={false}>
            <div className="flex flex-wrap gap-1">
              {EDITION_OPTIONS.map(e => {
                const active = selectedEditions.includes(e.value);
                return (
                  <button
                    key={e.value}
                    type="button"
                    onClick={() => toggleArr(selectedEditions, setSelectedEditions, e.value)}
                    className={cn(
                      'px-2 py-0.5 rounded-full border text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                      active
                        ? 'border-gray-700 dark:border-gray-100 bg-gray-800 dark:bg-gray-100 text-gray-100 dark:text-gray-900'
                        : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-200',
                    )}
                  >
                    {e.label}
                  </button>
                );
              })}
            </div>
          </SidebarSection>

          {/* Sets */}
          <SidebarSection title="Set" defaultOpen={false}>
            <div className="grid grid-cols-5 gap-1">
              {CARD_FILTER_SETS.map(setCode => {
                const active = selectedSets.includes(setCode);
                return (
                  <button
                    key={setCode}
                    type="button"
                    title={SET_MAP[setCode]}
                    onClick={() => toggleArr(selectedSets, setSelectedSets, setCode)}
                    className={cn(
                      'flex flex-col items-center p-1 rounded border transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                      active
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
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{setCode.toUpperCase()}</span>
                  </button>
                );
              })}
            </div>
          </SidebarSection>

          {/* Stats */}
          <SidebarSection title="Stats" defaultOpen={false}>
            <div className="space-y-2">
              {[
                { label: 'Cost',    min: costMin,    setMin: setCostMin,    max: costMax,    setMax: setCostMax    },
                { label: 'Power',   min: powerMin,   setMin: setPowerMin,   max: powerMax,   setMax: setPowerMax   },
                { label: 'Defense', min: defenseMin, setMin: setDefenseMin, max: defenseMax, setMax: setDefenseMax },
              ].map(stat => (
                <div key={stat.label} className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500 w-14 shrink-0">{stat.label}</span>
                  <input type="number" min="0" placeholder="Min" value={stat.min} onChange={e => stat.setMin(e.target.value)}
                    className="w-16 px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <span className="text-gray-400 text-xs">–</span>
                  <input type="number" min="0" placeholder="Max" value={stat.max} onChange={e => stat.setMax(e.target.value)}
                    className="w-16 px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
            </div>
          </SidebarSection>

          {/* Price — quick buckets + custom range (tcg_low, English only) */}
          <SidebarSection title="Price" defaultOpen={false}>
            <div className="flex flex-wrap gap-1">
              {PRICE_PRESETS.map(p => {
                const active = priceMin === p.min && priceMax === p.max;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      if (active) { setPriceMin(''); setPriceMax(''); }
                      else { setPriceMin(p.min); setPriceMax(p.max); }
                    }}
                    aria-pressed={active}
                    className={cn(
                      'px-2 py-0.5 rounded-full border text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                      active
                        ? 'border-gray-700 dark:border-gray-100 bg-gray-800 dark:bg-gray-100 text-gray-100 dark:text-gray-900'
                        : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-200',
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-xs text-gray-500">$</span>
              <input type="number" min="0" placeholder="Min" value={priceMin} onChange={e => setPriceMin(e.target.value)}
                className="w-20 px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-gray-400 text-xs">–</span>
              <input type="number" min="0" placeholder="Max" value={priceMax} onChange={e => setPriceMax(e.target.value)}
                className="w-20 px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </SidebarSection>

          {/* Language — default English (only en has prices); expand to specific or ALL */}
          <SidebarSection title="Language" defaultOpen={false}>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setSelectedLanguages([])}
                aria-pressed={selectedLanguages.length === 0}
                className={cn(
                  'px-2 py-0.5 rounded-full border text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                  selectedLanguages.length === 0
                    ? 'border-gray-700 dark:border-gray-100 bg-gray-800 dark:bg-gray-100 text-gray-100 dark:text-gray-900'
                    : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-200',
                )}
              >
                All languages
              </button>
              {LANGUAGES.map(l => {
                const active = selectedLanguages.includes(l.code);
                return (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setSelectedLanguages(prev => toggleLanguageSelection(prev, l.code))}
                    aria-pressed={active}
                    className={cn(
                      'flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                      active
                        ? 'border-gray-700 dark:border-gray-100 bg-gray-800 dark:bg-gray-100 text-gray-100 dark:text-gray-900'
                        : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-200',
                    )}
                  >
                    <span aria-hidden>{languageFlag(l.code)}</span> {l.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 leading-snug">
              Only English printings have prices &amp; TCGplayer links.
            </p>
          </SidebarSection>

          {/* Clear all */}
          {(hasAnyFilter || !isDefaultLang) && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
            >
              <X className="w-3 h-3" /> Clear all filters
            </button>
          )}

        </div>
      </aside>

      {/* ── RIGHT: results area ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            title="Toggle filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
            {error ? (
              <span className="text-red-500 dark:text-red-400">{error}</span>
            ) : !hasAnyFilter ? (
              <span className="text-gray-500 dark:text-gray-400">Search the catalog</span>
            ) : loading ? (
              <span className="animate-pulse">Searching…</span>
            ) : (
              <>{total.toLocaleString()} {groupByCard ? `card${total === 1 ? '' : 's'}` : `printing${total === 1 ? '' : 's'}`}</>
            )}
          </span>

          <div className="ml-auto flex items-center gap-2">
            {/* Group by card toggle — collapses cross-language / foiling
                variants of the same card into one tile. Persisted in
                localStorage; default on (much fewer tiles to look at). */}
            <button
              onClick={() => setGroupByCard(g => !g)}
              title={groupByCard ? 'Currently grouping printings by card — click to show every printing individually' : 'Currently showing every printing individually — click to group by card'}
              className={cn(
                'px-2 py-1 text-xs rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                groupByCard
                  ? 'bg-blue-600 dark:bg-blue-600 text-white border-blue-700 dark:border-blue-500 hover:bg-blue-700'
                  : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
              )}
            >
              {groupByCard ? 'One per card' : 'All printings'}
            </button>

            {/* View mode toggle */}
            <div className="flex items-center rounded border border-gray-300 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => setViewMode('images')}
                title="Image grid"
                className={cn(
                  'px-2 py-1.5 text-xs flex items-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                  viewMode === 'images' ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
                )}
              >
                <Images className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('checklist')}
                title="List view"
                className={cn(
                  'px-2 py-1.5 text-xs flex items-center gap-1 border-l border-gray-300 dark:border-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                  viewMode === 'checklist' ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
                )}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
              className="px-2 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
            </button>
          </div>
        </div>

        {/* Selection action bar — always present (shows "0 cards selected" when
            empty) so selecting the first card doesn't shift the layout. */}
        {(() => {
          const none = selection.selectedCount === 0;
          return (
          <div className={cn('shrink-0 flex items-center gap-3 px-4 py-2 border-b transition-colors', none ? 'bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-800' : 'bg-blue-950/60 border-blue-800/40')}>
            <span className={cn('text-sm font-medium', none ? 'text-gray-500 dark:text-gray-400' : 'text-blue-200')}>
              {selection.selectedCount} card{selection.selectedCount !== 1 ? 's' : ''} selected
            </span>
            {!none && (
              <button
                onClick={selection.clearSelection}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={selection.handleAddToWants}
                disabled={selection.isImporting || none}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-xs text-gray-200 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
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
                    className="bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {selection.binders.map((b: any) => (
                      <option key={b._id || b.slug} value={b.slug}>{b.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={selection.handleAddToBinder}
                    disabled={selection.isImporting || !selection.selectedBinderSlug || none}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-600 text-xs text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
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

        {/* Results */}
        {/* overscroll-contain: keep wheel/touch momentum inside this pane so it
            can't chain to the window when the next page is still loading. */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 bg-gray-50 dark:bg-gray-900">
          {!hasAnyFilter ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              <SlidersHorizontal className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm">Use the filters on the left to browse cards.</p>
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
              {/* Infinite scroll sentinel — triggers next page load when scrolled into view */}
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

        <AppShellAttribution />
      </div>

      <SyntaxGuideModal isOpen={syntaxGuideOpen} onClose={() => setSyntaxGuideOpen(false)} />
    </div>
  );
}
