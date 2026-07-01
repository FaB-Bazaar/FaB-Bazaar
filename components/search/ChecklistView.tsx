import Link from 'next/link';
import Image from 'next/image';
import { RarityIcon } from '@/components/shared/RarityIcon';
import React, { useState, useRef, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { TcgAffiliateLink } from '@/components/tracking';
import { ArrowUp, ArrowDown, Filter, X, Minus, Plus, ExternalLink } from 'lucide-react';
import { RARITY_MAP, FOILING_MAP, FOILING_STYLES, SET_MAP, COLOR_STYLES } from '@/lib/fab-constants';
import { languageFlag } from '@/lib/utils/printing-language';
import { cn } from '@/lib/utils';

// Missing language = English (matches the printings.language DB default)
const getLanguageDisplay = (language?: string | null): { code: string; flag: string } => {
  const lang = (language || 'en').toLowerCase();
  return { code: lang.toUpperCase(), flag: languageFlag(lang) };
};

interface ChecklistViewProps {
  printings: any[];
  priceField?: 'tcg_low' | 'tcg_mid' | 'tcg_high' | 'tcg_market';
  onToggleSelection?: (printing: any) => void;
  isCardSelected?: (printingId: string) => boolean;
  getCardQuantity?: (printingId: string) => number;
  onUpdateQuantity?: (printingId: string) => void;
  currentSort?: { field: string; order: 'asc' | 'desc' };
  onSortChange?: (field: string) => void;
  activeFilters?: { [key: string]: string[] };
  onFilterChange?: (field: string, values: string[]) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
}

// Helper to get foiling display info
const getFoilingDisplay = (foiling?: string): { shortName: string; className: string } => {
  if (!foiling) return { shortName: 'NF', className: 'bg-gray-500 text-white' };

  const foilingKey = foiling.toLowerCase() as keyof typeof FOILING_STYLES;
  const foilingStyle = FOILING_STYLES[foilingKey];

  if (foilingStyle) {
    return { shortName: foilingStyle.shortName, className: foilingStyle.className };
  }

  // Fallback for unknown foiling
  return { shortName: foiling.toUpperCase(), className: 'bg-gray-500 text-white' };
};

// Helper to get color display
const getColorDisplay = (color?: string): { label: string; className: string } => {
  if (!color) return { label: '-', className: '' };

  const colorKey = color.toLowerCase() as keyof typeof COLOR_STYLES;
  const colorStyle = COLOR_STYLES[colorKey];

  if (colorStyle) {
    return { label: colorStyle.label, className: colorStyle.className };
  }

  // Fallback for unknown colors
  return {
    label: color.charAt(0).toUpperCase(),
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  };
};

// Helper to get price field label
const getPriceFieldLabel = (priceField: string): string => {
  const labelMap: Record<string, string> = {
    'tcg_low': 'TCG Low',
    'tcg_mid': 'TCG Mid',
    'tcg_high': 'TCG High',
    'tcg_market': 'TCG Market',
  };
  return labelMap[priceField] || 'Price';
};

export function ChecklistView({
  printings,
  priceField = 'tcg_low',
  onToggleSelection,
  isCardSelected,
  getCardQuantity,
  onUpdateQuantity,
  currentSort,
  onSortChange,
  activeFilters = {},
  onFilterChange,
  onSelectAll,
  onDeselectAll,
}: ChecklistViewProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [openFilterField, setOpenFilterField] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  // Mobile-only: tap a row thumbnail to enlarge it without leaving the list view.
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreview(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [preview]);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setOpenFilterField(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper component for sortable column headers
  const SortableHeader = ({ field, label, className = "text-left" }: { field: string; label: string; className?: string }) => {
    const isActive = currentSort?.field === field;
    const isAsc = currentSort?.order === 'asc';

    return (
      <th
        onClick={() => onSortChange?.(field)}
        className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 ${
          onSortChange ? 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 select-none' : ''
        } ${className}`}
      >
        <div className="flex items-center gap-1.5">
          <span>{label}</span>
          {onSortChange && (
            <span className={`flex-shrink-0 ${isActive ? 'opacity-100' : 'opacity-30'}`}>
              {isActive ? (
                isAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              ) : (
                <ArrowUp className="w-3 h-3" />
              )}
            </span>
          )}
        </div>
      </th>
    );
  };

  // Helper component for filterable + sortable column headers
  const FilterableHeader = ({
    field,
    label,
    className = "text-left",
    getDisplayValue
  }: {
    field: string;
    label: string;
    className?: string;
    getDisplayValue: (value: string) => string;
  }) => {
    const isActive = currentSort?.field === field;
    const isAsc = currentSort?.order === 'asc';
    const isFilterOpen = openFilterField === field;
    const hasActiveFilter = activeFilters[field]?.length > 0;

    // Get unique values for this field
    const uniqueValues = Array.from(new Set(
      printings.map((p: any) => p[field]).filter(Boolean)
    )).sort();

    const toggleFilter = (value: string) => {
      const current = activeFilters[field] || [];
      const newValues = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      onFilterChange?.(field, newValues);
    };

    return (
      <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 relative ${className}`}>
        <div className="flex items-center gap-1.5">
          <span
            onClick={() => onSortChange?.(field)}
            className={onSortChange ? 'cursor-pointer hover:underline select-none' : ''}
          >
            {label}
          </span>
          {onSortChange && (
            <span
              onClick={() => onSortChange?.(field)}
              className={`flex-shrink-0 cursor-pointer ${isActive ? 'opacity-100' : 'opacity-30'}`}
            >
              {isActive ? (
                isAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              ) : (
                <ArrowUp className="w-3 h-3" />
              )}
            </span>
          )}
          {onFilterChange && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenFilterField(isFilterOpen ? null : field);
              }}
              className={`flex-shrink-0 p-0.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600 ${
                hasActiveFilter ? 'text-blue-600 dark:text-blue-400' : ''
              }`}
            >
              <Filter className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filter Dropdown */}
        {isFilterOpen && onFilterChange && (
          <div
            ref={filterRef}
            className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg z-50 min-w-[200px] max-h-[300px] overflow-y-auto"
          >
            <div className="p-2 border-b border-gray-300 dark:border-gray-700 flex justify-between items-center">
              <span className="text-xs font-medium">Filter {label}</span>
              {hasActiveFilter && (
                <button
                  onClick={() => onFilterChange(field, [])}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="p-2 space-y-1">
              {uniqueValues.map((value: any) => {
                const isChecked = activeFilters[field]?.includes(value) || false;
                return (
                  <label
                    key={value}
                    className="flex items-center gap-2 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleFilter(value)}
                    />
                    <span>{getDisplayValue(value)}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </th>
    );
  };

  const handleMouseMove = (e: React.MouseEvent, printingId: string) => {
    // Don't show preview if hovering over interactive elements (checkbox, quantity selector)
    const row = (e.target as HTMLElement).closest('tr');
    if (row?.classList.contains('no-preview')) {
      setHoveredRow(null);
      return;
    }
    setHoveredRow(printingId);
    setMousePosition({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    setHoveredRow(null);
  };

  const selectionEnabled = onToggleSelection && isCardSelected && getCardQuantity && onUpdateQuantity;

  return (
    <div>
      {/* ── MOBILE: stacked card rows (the wide table is unreadable on phones) ── */}
      <ul className="sm:hidden divide-y divide-gray-300/70 dark:divide-gray-800">
        {printings.map((printing: any) => {
          const colorInfo = getColorDisplay(printing.color);
          const foilingDisplay = getFoilingDisplay(printing.foiling);
          const { code: langCode, flag: langFlag } = getLanguageDisplay(printing.language);
          const isSelected = selectionEnabled && isCardSelected(printing.printing_id);
          const quantity = selectionEnabled ? getCardQuantity(printing.printing_id) : 1;
          const price = printing[priceField];
          const rarityLabel = printing.rarity ? (RARITY_MAP[printing.rarity?.toLowerCase()] || printing.rarity) : null;
          const cardName = printing.display_name || printing.name;

          return (
            <li
              key={printing.printing_id}
              className={cn(
                'relative flex items-start gap-3 py-3 pl-3 pr-2 transition-colors',
                // Selected rows get a clear, multi-cue signifier: tinted bg + a
                // left accent bar (color is never the sole differentiator).
                isSelected
                  ? 'bg-blue-500/[0.07] dark:bg-blue-500/10 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-blue-500'
                  : '',
              )}
            >
              {selectionEnabled && (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelection(printing)}
                  aria-label={`Select ${cardName}`}
                  className="mt-1 shrink-0 focus-visible:ring-2 focus-visible:ring-blue-400"
                />
              )}

              {/* Tappable thumbnail — enlarge in place, no trip to image view. */}
              {printing.image_url && (
                <button
                  type="button"
                  onClick={() => setPreview({ url: printing.image_url, name: cardName })}
                  aria-label={`Enlarge ${cardName}`}
                  className="shrink-0 w-12 overflow-hidden rounded-md ring-1 ring-black/10 dark:ring-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  style={{ aspectRatio: '3 / 4' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={printing.image_url}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover object-top"
                    draggable={false}
                  />
                </button>
              )}

              <div className="min-w-0 flex-1">
                {/* Line 1: name (primary) + price (secondary) */}
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/printing/${printing.printing_id}`}
                    className="font-semibold text-[15px] leading-snug text-blue-700 dark:text-blue-300 hover:underline break-words rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    {cardName}
                  </Link>
                  <div className="shrink-0">
                    {price !== undefined && price !== null ? (
                      printing.tcgplayer_url ? (
                        // The price IS the affiliate link on mobile — keeps the
                        // TCGplayer integration secondary instead of letting a wide
                        // wordmark compete with the card name (and overflow the row).
                        <TcgAffiliateLink
                          tcgplayerUrl={printing.tcgplayer_url}
                          feature="SearchResultsPriceClick"
                          className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 hover:underline rounded px-0.5 -mx-0.5 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                          title="Buy on TCGplayer"
                        >
                          <span className="font-semibold text-xs tabular-nums">${price.toFixed(2)}</span>
                          <ExternalLink className="w-3 h-3 opacity-60" aria-hidden />
                        </TcgAffiliateLink>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-300 font-semibold text-xs tabular-nums">
                          ${price.toFixed(2)}
                        </span>
                      )
                    ) : (
                      <span className="text-gray-400 dark:text-gray-400 text-xs">—</span>
                    )}
                  </div>
                </div>

                {/* Line 2: identity — set · collector · rarity (uniform muted text) */}
                <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                  <span className="font-semibold tracking-wide">{printing.set ? printing.set.toUpperCase() : '—'}</span>
                  {printing.collector_number && (
                    <>
                      <span className="text-gray-300 dark:text-gray-600" aria-hidden>·</span>
                      <span className="font-mono">{printing.collector_number}</span>
                    </>
                  )}
                  {rarityLabel && (
                    <>
                      <span className="text-gray-300 dark:text-gray-600" aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1">
                        <RarityIcon rarityCode={printing.rarity} size="sm" />
                        {rarityLabel}
                      </span>
                    </>
                  )}
                </div>

                {/* Line 3: variant badges — color, foiling, edition, language,
                    all aligned on one baseline as a single grouped cluster. */}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {colorInfo.label !== '-' && (
                    <span className={cn('inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded text-xs font-bold', colorInfo.className)}>
                      {colorInfo.label}
                    </span>
                  )}
                  <span className={cn('inline-flex items-center h-5 px-2 rounded-full text-xs font-semibold', foilingDisplay.className)}>
                    {foilingDisplay.shortName}
                  </span>
                  {printing.edition && (
                    <span className="inline-flex items-center h-5 px-2 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                      {printing.edition.toUpperCase()}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300" title={langCode}>
                    <span aria-hidden>{langFlag}</span>{langCode}
                  </span>
                </div>

                {/* Quantity stepper (only once selected) — bounded + labeled. */}
                {selectionEnabled && isSelected && (
                  <div className="mt-2.5 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Qty</span>
                    <div className="inline-flex items-center rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                      <button
                        onClick={(e) => { e.stopPropagation(); onUpdateQuantity(printing.printing_id, Math.max(1, quantity - 1)); }}
                        disabled={quantity <= 1}
                        aria-label="Decrease quantity"
                        className="w-8 h-8 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-9 text-center text-sm font-semibold tabular-nums border-x border-gray-300 dark:border-gray-600">{quantity}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onUpdateQuantity(printing.printing_id, quantity + 1); }}
                        aria-label="Increase quantity"
                        className="w-8 h-8 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* ── DESKTOP: full table (hidden on phones) ── */}
      <div className="hidden sm:block overflow-x-auto">
      <table className="w-full text-sm md:text-base">
        <thead className="bg-gray-100 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/50">
          <tr>
            {selectionEnabled && (() => {
              const allSelected = printings.length > 0 && printings.every(p => isCardSelected(p.printing_id));
              const someSelected = !allSelected && printings.some(p => isCardSelected(p.printing_id));
              const showToggle = !!(onSelectAll || onDeselectAll);
              return (
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-12">
                  {showToggle ? (
                    <Checkbox
                      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                      onCheckedChange={() => {
                        if (allSelected) onDeselectAll?.();
                        else onSelectAll?.();
                      }}
                      aria-label={allSelected ? 'Deselect all' : 'Select all'}
                      className="focus-visible:ring-2 focus-visible:ring-blue-400"
                    />
                  ) : (
                    <span className="sr-only">Select</span>
                  )}
                </th>
              );
            })()}
            {selectionEnabled && (
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">QTY</th>
            )}
            <FilterableHeader
              field="set"
              label="SET"
              className="text-left"
              getDisplayValue={(val) => SET_MAP[val?.toLowerCase()] || val?.toUpperCase() || ''}
            />
            <SortableHeader field="collector_number" label="COLLECTOR" className="text-left" />
            <SortableHeader field="name" label="NAME" className="text-left" />
            <FilterableHeader
              field="color"
              label="COLOR"
              className="text-center"
              getDisplayValue={(val) => {
                const colorMap: { [key: string]: string } = {
                  'red': 'Red',
                  'yellow': 'Yellow',
                  'blue': 'Blue',
                  'generic': 'Generic',
                  '': 'Generic'
                };
                return colorMap[val?.toLowerCase()] || val || 'Generic';
              }}
            />
            <FilterableHeader
              field="edition"
              label="EDITION"
              className="text-center"
              getDisplayValue={(val) => val?.toUpperCase() || ''}
            />
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">TYPE</th>
            <FilterableHeader
              field="rarity"
              label="R"
              className="text-center"
              getDisplayValue={(val) => RARITY_MAP[val?.toLowerCase()] || val || ''}
            />
            <FilterableHeader
              field="foiling"
              label="FOILING"
              className="text-center"
              getDisplayValue={(val) => FOILING_MAP[val?.toLowerCase()] || val || ''}
            />
            <FilterableHeader
              field="language"
              label="LANG"
              className="text-center"
              getDisplayValue={(val) => {
                const { code, flag } = getLanguageDisplay(val);
                return `${flag} ${code}`;
              }}
            />
            <SortableHeader field="price" label={getPriceFieldLabel(priceField).toUpperCase()} className="text-right" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {printings.map((printing: any) => {
            const colorInfo = getColorDisplay(printing.color);
            const isSelected = selectionEnabled && isCardSelected(printing.printing_id);
            const quantity = selectionEnabled ? getCardQuantity(printing.printing_id) : 1;

            return (
              <tr
                key={printing.printing_id}
                className={`hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors relative ${
                  isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
                onMouseMove={(e) => handleMouseMove(e, printing.printing_id)}
                onMouseLeave={handleMouseLeave}
              >
                {/* CHECKBOX */}
                {selectionEnabled && (
                  <td
                    className="px-4 py-3 text-center"
                    onMouseEnter={(e) => {
                      e.stopPropagation();
                      (e.currentTarget.closest('tr') as HTMLElement)?.classList.add('no-preview');
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget.closest('tr') as HTMLElement)?.classList.remove('no-preview');
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelection(printing)}
                    />
                  </td>
                )}

                {/* QUANTITY */}
                {selectionEnabled && (
                  <td className="px-4 py-3 text-center">
                    {isSelected ? (
                      <div
                        className="inline-flex items-center gap-1.5"
                        onMouseEnter={(e) => {
                          e.stopPropagation();
                          (e.currentTarget.closest('tr') as HTMLElement)?.classList.add('no-preview');
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget.closest('tr') as HTMLElement)?.classList.remove('no-preview');
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateQuantity(printing.printing_id, Math.max(1, quantity - 1));
                          }}
                          disabled={quantity <= 1}
                          className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <div className="text-center text-sm font-medium min-w-[20px]">
                          {quantity}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateQuantity(printing.printing_id, quantity + 1);
                          }}
                          className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                )}

                {/* SET */}
                <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                  {printing.set ? printing.set.toUpperCase() : '-'}
                </td>

                {/* COLLECTOR NUMBER */}
                <td className="px-4 py-3 text-gray-700 dark:text-gray-200 font-mono text-xs md:text-sm">
                  {printing.collector_number || printing.printing_data?.id || '-'}
                </td>

                {/* NAME */}
                <td className="px-4 py-3">
                  <Link
                    href={`/printing/${printing.printing_id}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    {printing.display_name || printing.name}
                  </Link>
                </td>

                {/* COLOR */}
                <td className="px-4 py-3 text-center">
                  {colorInfo.label !== '-' ? (
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${colorInfo.className}`}>
                      {colorInfo.label}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>

                {/* EDITION */}
                <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-200 font-medium">
                  {printing.edition ? printing.edition.toUpperCase() : '-'}
                </td>

                {/* TYPE */}
                <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                  {printing.type_text_display || printing.type_text || '-'}
                </td>

                {/* RARITY */}
                <td className="px-4 py-3 text-center">
                  {printing.rarity && (
                    <RarityIcon rarityCode={printing.rarity} size="sm" />
                  )}
                </td>

                {/* FOILING */}
                <td className="px-4 py-3 text-center text-xs">
                  <div className="flex items-center justify-center">
                    {(() => {
                      const foilingDisplay = getFoilingDisplay(printing.foiling);
                      return (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${foilingDisplay.className}`}>
                          {foilingDisplay.shortName}
                        </span>
                      );
                    })()}
                  </div>
                </td>

                {/* LANGUAGE */}
                <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-200">
                  {(() => {
                    const { code, flag } = getLanguageDisplay(printing.language);
                    return (
                      <span title={code} className="inline-flex items-center gap-1 text-xs font-semibold">
                        <span aria-hidden="true">{flag}</span>
                        <span>{code}</span>
                      </span>
                    );
                  })()}
                </td>

                {/* PRICE - Dynamic based on priceField */}
                <td className="px-4 py-3 text-right">
                  {printing[priceField] !== undefined && printing[priceField] !== null ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        ${printing[priceField].toFixed(2)}
                      </span>
                      {printing.tcgplayer_url && (
                        <TcgAffiliateLink
                          tcgplayerUrl={printing.tcgplayer_url}
                          feature="SearchResultsPriceClick"
                          className="hover:opacity-80 transition-opacity"
                          title="Purchase on TCGPlayer"
                        >
                          <img
                            src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
                            alt="TCGPlayer"
                            className="h-4 w-auto"
                          />
                        </TcgAffiliateLink>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      {/* Mobile tap-to-zoom lightbox — dismiss by tapping anywhere or Escape. */}
      {preview && (
        <div
          className="sm:hidden fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${preview.name} card image`}
        >
          <button
            type="button"
            onClick={() => setPreview(null)}
            aria-label="Close image preview"
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <X className="w-5 h-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.url}
            alt={preview.name}
            className="max-h-[82vh] w-auto rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Image Hover Overlay */}
      {hoveredRow && printings.find(p => p.printing_id === hoveredRow)?.image_url && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: `${mousePosition.x + 20}px`,
            top: `${mousePosition.y - 150}px`,
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border-2 border-gray-300 dark:border-gray-600 overflow-hidden">
            <Image
              src={printings.find(p => p.printing_id === hoveredRow)!.image_url}
              alt="Card preview"
              width={250}
              height={350}
              className="object-contain"
              unoptimized
            />
          </div>
        </div>
      )}
    </div>
  );
}
