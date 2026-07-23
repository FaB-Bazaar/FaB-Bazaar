'use client';

/**
 * Shared card-filter UI for /opt and /tags: the filter-popover
 * primitives (Popover, Pill, ArtChip, RangeRow, ActiveChip, FacetsPanel) and
 * the `buildFilterFacets` descriptor array both pages render — /opt as a
 * desktop popover row + mobile accordion sheet, /tags as a popover row.
 *
 * Extracted from app/opt/page.tsx so the two pages cannot drift (the
 * two-shorthand-parsers lesson). State flows through OptUiState + the
 * opt-search-reducer dispatch — no local state in the descriptors.
 */

import React, { useState, useEffect, useRef, type Dispatch, type ReactNode } from 'react';
import { Search, X, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RarityIcon } from '@/components/shared/RarityIcon';
import { getSetImageOrFallback } from '@/lib/set-images';
import { SET_MAP } from '@/lib/fab-constants';
import {
  CARD_FILTER_SETS, PROMO_FILTER_SETS, OTHER_PRODUCT_FILTER_SETS, SET_FILTER_GROUPS,
} from '@/lib/fab-constants/sets';
import {
  TYPE_CHIPS, CLASS_ICONS, ALL_CLASSES, ALL_TALENTS, PITCH_CHIPS,
  KEYWORD_CHIPS, RARITY_OPTIONS, FOILING_OPTIONS, EDITION_OPTIONS, FORMAT_OPTIONS, PRICE_PRESETS, HERO_AGE_CHIPS,
} from '@/lib/search/card-filter-chips';
import { languageFlag } from '@/lib/utils/printing-language';
import { LANGUAGES } from '@/lib/search/build-server-filters';
import { toggleLanguageSelection } from '@/lib/search/language-selection';
import type { OptUiState } from '@/lib/search/opt-url-state';
import type { OptAction } from '@/lib/search/opt-search-reducer';

export const SECTION = 'text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-gray-400 mb-2';

// Sets selectable in the main set grid: the shared curated booster-set list.
// GEM (and the other promo sets) render in the dedicated Promos section below,
// so it no longer needs appending here; its per-pack facet stays reachable.
export const OPT_FILTER_SETS: string[] = [...CARD_FILTER_SETS];

// ─── Popover (filter dropdown) ────────────────────────────────────────────────
// Self-contained: closes on outside-click and Escape. No extra deps.

export function Popover({
  label, count = 0, align = 'left', panelClassName, children,
}: {
  label: string;
  count?: number;
  align?: 'left' | 'right';
  panelClassName?: string;
  children: ReactNode;
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

export function ArtChip({
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

export function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
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

// Logo + code tile used by every set section (main sets, promos, other
// products) in the "More" popover's set picker.
function SetGridButton({ setCode, selected, onToggle }: { setCode: string; selected: boolean; onToggle: () => void }) {
  // Promo/product sets without a mapped logo get a text-only tile — an
  // <img src=""> renders a broken-image glyph, so skip the img entirely.
  const imageUrl = getSetImageOrFallback(setCode, setCode.toUpperCase());
  return (
    <button
      type="button"
      title={SET_MAP[setCode as keyof typeof SET_MAP]}
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        'flex flex-col items-center justify-end p-1 rounded border transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
        selected
          ? 'border-gray-800 dark:border-gray-100 ring-1 ring-gray-600 dark:ring-gray-100'
          : 'border-gray-300 dark:border-gray-700 hover:border-gray-500',
      )}
    >
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          className="w-7 h-7 object-contain"
          alt={SET_MAP[setCode as keyof typeof SET_MAP] || setCode}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <span className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{setCode.toUpperCase()}</span>
    </button>
  );
}

// ─── Facets panel (grouped + filterable + Any/All) ────────────────────────────
// The curated facet vocabulary is dynamic (fetched), grows over time, and spans
// three dimensions — so it gets a searchable, grouped popover rather than a flat
// pill wrap. Multi-select; the Any/All switch flips overlap ↔ contains server-side.

export interface FacetDef { id: string; dim: string; label: string; def: string }

const FACET_DIMS = [
  { key: 'mechanical', label: 'Mechanical' },
  { key: 'strategic', label: 'Strategic' },
  { key: 'synergy', label: 'Synergy' },
] as const;

export function FacetsPanel({
  defs, selected, matchAll, onToggle, onSetMatchAll,
}: {
  defs: FacetDef[];
  selected: string[];
  matchAll: boolean;
  onToggle: (id: string) => void;
  onSetMatchAll: (all: boolean) => void;
}) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const matches = (d: FacetDef) =>
    !needle || d.label.toLowerCase().includes(needle) || d.id.includes(needle) || d.def.toLowerCase().includes(needle);

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <p className={cn(SECTION, 'mb-0')}>Tags</p>
        <MatchModeToggle matchAll={matchAll} onSetMatchAll={onSetMatchAll} />
      </div>

      {defs.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Loading tags…</p>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter tags…"
              aria-label="Filter tags"
              className="w-full pl-7 pr-2 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-72 overflow-y-auto mt-2 space-y-2.5">
            {FACET_DIMS.map(({ key, label }) => {
              const group = defs.filter((d) => d.dim === key && matches(d));
              if (!group.length) return null;
              return (
                <div key={key}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-500 mb-1">{label}</p>
                  <div className="flex flex-wrap gap-1">
                    {group.map((d) => (
                      <Pill key={d.id} active={selected.includes(d.id)} onClick={() => onToggle(d.id)}>
                        <span title={d.def}>{d.label}</span>
                      </Pill>
                    ))}
                  </div>
                </div>
              );
            })}
            {defs.every((d) => !matches(d)) && (
              <p className="text-xs text-gray-500 dark:text-gray-400">No matching tags.</p>
            )}
          </div>
        </>
      )}
    </>
  );
}

/** Any/All switch — whether a card must match ANY or ALL selected facet tags. */
export function MatchModeToggle({ matchAll, onSetMatchAll }: { matchAll: boolean; onSetMatchAll: (all: boolean) => void }) {
  return (
    <div className="flex items-center rounded-full border border-gray-300 dark:border-gray-700 overflow-hidden text-xs" role="group" aria-label="Tag match mode">
      {([['any', false], ['all', true]] as const).map(([lbl, all]) => (
        <button
          key={lbl}
          type="button"
          onClick={() => onSetMatchAll(all)}
          aria-pressed={matchAll === all}
          title={all ? 'Cards that have ALL selected tags' : 'Cards that have ANY selected tag'}
          className={cn(
            'px-2 py-1 font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
            matchAll === all ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300',
          )}
        >
          {lbl}
        </button>
      ))}
    </div>
  );
}

// ─── Min/max numeric row ──────────────────────────────────────────────────────

export function RangeRow({
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

export function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
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

// ─── Filter facet descriptors ─────────────────────────────────────────────────
// Single source rendered as desktop popovers (both pages) and the /opt mobile
// filter-sheet accordion. Pure projection of OptUiState → descriptors; all
// mutation goes through the reducer dispatch.

export interface FilterFacet {
  key: string;
  label: string;
  count: number;
  align?: 'left' | 'right';
  panelClassName?: string;
  body: ReactNode;
}

export function buildFilterFacets({
  state, dispatch, availablePacks, facetDefs, exclude,
}: {
  state: OptUiState;
  dispatch: Dispatch<OptAction>;
  availablePacks: { groupId: number; name: string }[];
  facetDefs: FacetDef[];
  /** Facet keys to omit (e.g. /tags hides 'facets' — its rail owns them). */
  exclude?: string[];
}): FilterFacet[] {
  const {
    selectedType, selectedHeroAges, selectedClasses, selectedTalents,
    selectedTalentless, selectedPitch, selectedKeywords, selectedRarities, selectedFoilings,
    selectedEditions, selectedSets, selectedPacks, selectedFacets, facetsMatchAll, selectedFormat,
    costMin, costMax, powerMin, powerMax, defenseMin, defenseMax, arcaneMin, arcaneMax, healthMin, healthMax, priceMin, priceMax,
    selectedLanguages,
  } = state;
  const patch = (p: Partial<OptUiState>) => dispatch({ type: 'PATCH', patch: p });

  const statsCount = [costMin || costMax, powerMin || powerMax, defenseMin || defenseMax, arcaneMin || arcaneMax, healthMin || healthMax].filter(Boolean).length;
  const isDefaultLang = selectedLanguages.length === 1 && selectedLanguages[0] === 'en';

  const facets: FilterFacet[] = [
    {
      key: 'pitch', label: 'Pitch', count: selectedPitch.length, panelClassName: 'w-auto',
      body: (
        <>
          <p className={SECTION}>Pitch</p>
          {/* Multi-select OR: red + blue = cards that are either. */}
          <div className="flex items-center gap-2">
            {PITCH_CHIPS.map(chip => {
              const isActive = selectedPitch.includes(chip.value);
              return (
                <button
                  key={chip.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => dispatch({ type: 'TOGGLE_PITCH', value: chip.value })}
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
      key: 'facets', label: 'Tags', count: selectedFacets.length, panelClassName: 'w-80',
      body: (
        <FacetsPanel
          defs={facetDefs}
          selected={selectedFacets}
          matchAll={facetsMatchAll}
          onToggle={(id) => dispatch({ type: 'TOGGLE_IN', key: 'selectedFacets', value: id })}
          onSetMatchAll={(all) => patch({ facetsMatchAll: all })}
        />
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
            <RangeRow label="Arcane"  min={arcaneMin}  setMin={v => dispatch({ type: 'SET_RANGE', range: 'arcane', min: v })}  max={arcaneMax}  setMax={v => dispatch({ type: 'SET_RANGE', range: 'arcane', max: v })} />
            <RangeRow label="Health"  min={healthMin}  setMin={v => dispatch({ type: 'SET_RANGE', range: 'health', min: v })}  max={healthMax}  setMax={v => dispatch({ type: 'SET_RANGE', range: 'health', max: v })} />
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
      // max-h + scroll: three set sections (Promos / Deck products / Other
      // products) plus packs otherwise overflow short viewports.
      key: 'sets', label: 'Sets', count: selectedSets.length + selectedPacks.length, align: 'right', panelClassName: 'w-80 max-h-[min(70vh,640px)] overflow-y-auto',
      body: (
        <div className="space-y-3">
          <div>
            <p className={SECTION}>Set</p>
            <div className="grid grid-cols-5 gap-1 max-h-48 overflow-y-auto">
              {OPT_FILTER_SETS.map(setCode => (
                <SetGridButton
                  key={setCode}
                  setCode={setCode}
                  selected={selectedSets.includes(setCode)}
                  onToggle={() => dispatch({ type: 'TOGGLE_IN', key: 'selectedSets', value: setCode })}
                />
              ))}
            </div>
          </div>
          <div>
            <p className={SECTION}>Promos</p>
            <div className="grid grid-cols-5 gap-1">
              {PROMO_FILTER_SETS.map(setCode => (
                <SetGridButton
                  key={setCode}
                  setCode={setCode}
                  selected={selectedSets.includes(setCode)}
                  onToggle={() => dispatch({ type: 'TOGGLE_IN', key: 'selectedSets', value: setCode })}
                />
              ))}
            </div>
          </div>
          <div>
            <p className={SECTION}>Deck products</p>
            <div className="flex flex-wrap gap-1">
              {SET_FILTER_GROUPS.map(g => (
                <Pill
                  key={g.token}
                  active={selectedSets.includes(g.token)}
                  onClick={() => dispatch({ type: 'TOGGLE_IN', key: 'selectedSets', value: g.token })}
                >
                  {g.label}
                </Pill>
              ))}
            </div>
          </div>
          <div>
            <p className={SECTION}>Other products</p>
            <div className="grid grid-cols-5 gap-1">
              {OTHER_PRODUCT_FILTER_SETS.map(setCode => (
                <SetGridButton
                  key={setCode}
                  setCode={setCode}
                  selected={selectedSets.includes(setCode)}
                  onToggle={() => dispatch({ type: 'TOGGLE_IN', key: 'selectedSets', value: setCode })}
                />
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
      key: 'more', label: 'More', count: selectedFoilings.length + selectedEditions.length, align: 'right', panelClassName: 'w-80',
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

  return exclude?.length ? facets.filter((f) => !exclude.includes(f.key)) : facets;
}
