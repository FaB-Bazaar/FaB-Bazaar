import Link from 'next/link';
import Image from 'next/image';
import { RarityIcon } from '@/components/shared/RarityIcon';
import { useState, useRef, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { TcgAffiliateLink } from '@/components/tracking';
import { ArrowUp, ArrowDown, Filter, X, Minus, Plus } from 'lucide-react';
import { RARITY_MAP, FOILING_MAP, FOILING_STYLES, SET_MAP, COLOR_STYLES } from '@/lib/fab-constants';

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
            className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 min-w-[200px] max-h-[300px] overflow-y-auto"
          >
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
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
    <div className="overflow-x-auto">
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
