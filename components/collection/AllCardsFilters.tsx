// components/collection/AllCardsFilters.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { RarityIcon } from '@/components/shared/RarityIcon';
import { getSetImageOrFallback } from '@/lib/set-images';
import { FOILING_MAP, RARITY_MAP, SET_MAP, EDITION_MAP, COLORS } from '@/lib/fab-constants';

interface AllCardsFiltersProps {
  searchQuery: string;
  counts: any;
  setSearchQuery: (query: string) => void;
  filtersExpanded: boolean;
  setFiltersExpanded: (expanded: boolean) => void;
  activeFilters: any;
  activeFilterCount: number;
  sortBy: string;
  setSortBy: (sort: string) => void;
  setFilter: (type: string, value: string) => void;
  clearFilter: (type: string) => void;
  clearAllFilters: () => void;
  uniqueValues: {
    conditions: string[];
  };
}

const useWindowWidth = () => {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    function handleResize() {
      setWidth(window.innerWidth);
    }

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return width;
};

// Rarity order
const DISPLAY_RARITIES = [ 'f', 'v', 'l', 'm', 's', 'r', 'c', 'p', 'b', 't' ];
const DISPLAY_FOILINGS = [ 'r', 'c', 's', 'g' ];
const DISPLAY_EDITIONS = [ 'a', 'f', 'u', 'n' ];
const SET_MAP_SUBSET = {
  'wtr': 'Welcome to Rathe', 'arc': 'Arcane Rising', 'cru': 'Crucible of War',
  'mon': 'Monarch', 'ele': 'Tales of Aria', 'evr': 'Everfest', 'upr': 'Uprising',
  '1hp': 'History Pack Vol.1', 'dyn': 'Dynasty', 'out': 'Outsiders', 'dtd': 'Dusk till Dawn',
  'evo': 'Bright Lights', 'hvy': 'Heavy Hitters', 'mst': 'Part the Mistveil',
  'ros': 'Rosetta', 'hnt': 'The Hunted', 'sea': 'High Seas', 'mpg': 'Mastery Pack Guardian',
  'sup': 'Super Slam',
} as const;
const DISPLAY_SETS = Object.keys(SET_MAP_SUBSET);

const FoilingIcon = ({ foilingKey }: { foilingKey: string }) => {
  switch (foilingKey) {
    case 'r': return <div title="Rainbow Foil" className="w-4 h-4 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 rounded-sm border" />;
    case 'c': return <div title="Cold Foil" className="w-4 h-4 bg-gradient-to-br from-cyan-200 to-cyan-400 rounded-sm border border-cyan-500" />;
    case 'g': return <div title="Gold Foil" className="w-4 h-4 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-sm border border-yellow-600" />;
    case 's':
    default:
      return <div title="Non-foil" className="w-4 h-4 bg-gray-200 border border-gray-400 rounded-sm" />;
  }
};

const ColorDot = ({ color }: { color: string }) => {
  const colorClasses = {
    'red': 'bg-red-500',
    'blue': 'bg-blue-500',
    'yellow': 'bg-yellow-400'
  };

  return <div className={`w-4 h-4 rounded-full border-2 border-gray-300 ${colorClasses[color] || 'bg-gray-400'}`} />;
};

export const AllCardsFilters: React.FC<AllCardsFiltersProps> = ({
  searchQuery,
  setSearchQuery,
  filtersExpanded,
  setFiltersExpanded,
  activeFilters,
  activeFilterCount,
  sortBy,
  setSortBy,
  setFilter,
  clearFilter,
  clearAllFilters,
  uniqueValues,
  counts
}) => {
  const windowWidth = useWindowWidth();

  return (
    <>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
        <Input
          placeholder="Search by card name, type, or collector number"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-10 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
        />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className="flex items-center justify-center gap-2 px-2 py-2 sm:px-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-gray-900 dark:text-gray-100 text-xs sm:text-sm flex-1"
        >
          <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs">
              {activeFilterCount}
            </Badge>
          )}
          {filtersExpanded ? <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
        </button>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-2 py-2 sm:px-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs sm:text-sm flex-1"
        >
          <option value="default">Sort: Default</option>
          <option value="name">Sort: Name</option>
          <option value="quantity-desc">Sort: Quantity (High to Low)</option>
          <option value="quantity-asc">Sort: Quantity (Low to High)</option>
          <option value="tcg-market-desc">Sort: TCG Market (High to Low)</option>
          <option value="tcg-market-asc">Sort: TCG Market (Low to High)</option>
          <option value="tcg-low-desc">Sort: TCG Low (High to Low)</option>
          <option value="tcg-low-asc">Sort: TCG Low (Low to High)</option>
        </select>
      </div>

       {filtersExpanded && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 mb-4">
          <div className="space-y-4">

            {/* Set Filters */}
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Set:</span>
              {windowWidth > 300 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                  {DISPLAY_SETS.map(setKey => {
                    const isActive = activeFilters.set === setKey;
                    const imageUrl = getSetImageOrFallback(setKey, setKey.toUpperCase());
                    return (
                      <button
                        key={setKey}
                        type="button"
                        onClick={() => isActive ? clearFilter('set') : setFilter('set', setKey)}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all hover:scale-105 ${
                          isActive
                            ? 'border-blue-500 bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-500'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
                        }`}
                        title={SET_MAP[setKey]}
                      >
                        <img
                          src={imageUrl}
                          alt={`${SET_MAP[setKey]} logo`}
                          className="w-12 h-12 object-contain"
                        />
                        <span className={`text-xs text-center font-medium mt-1 ${
                          isActive ? 'text-blue-800 dark:text-blue-200' : 'text-gray-700 dark:text-gray-200'
                        }`}>
                          {setKey.toUpperCase()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {DISPLAY_SETS.map(setKey => {
                    const isActive = activeFilters.set === setKey;
                    return(
                      <button
                        key={setKey}
                        onClick={() => isActive ? clearFilter('set') : setFilter('set', setKey)}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                          isActive
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 ring-1 ring-blue-500'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                      >
                        {SET_MAP_SUBSET[setKey]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Rarity Filters */}
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Rarity:</span>
                <div className="flex gap-2 flex-wrap">
                  {DISPLAY_RARITIES.map(rarityKey => {
                    const isActive = activeFilters.rarity === rarityKey;
                    return (
                      <button
                        key={rarityKey}
                        onClick={() => isActive ? clearFilter('rarity') : setFilter('rarity', rarityKey)}
                        className={`px-3 py-2 flex items-center gap-2 rounded-lg border text-sm transition-colors ${
                          isActive
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50 ring-1 ring-blue-500'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                      >
                        <RarityIcon rarityCode={rarityKey} size="sm" />
                        <span className="text-gray-900 dark:text-gray-100">{RARITY_MAP[rarityKey]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Foiling Filters */}
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Foiling:</span>
                <div className="flex gap-2 flex-wrap">
                  {DISPLAY_FOILINGS.map(foilingKey => {
                    const isActive = activeFilters.foiling === foilingKey;
                    return (
                      <button
                        key={foilingKey}
                        onClick={() => isActive ? clearFilter('foiling') : setFilter('foiling', foilingKey)}
                        className={`px-3 py-2 flex items-center gap-2 rounded-lg border text-sm transition-colors ${
                          isActive
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50 ring-1 ring-blue-500'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                      >
                        <FoilingIcon foilingKey={foilingKey} />
                        <span className="text-gray-900 dark:text-gray-100">{FOILING_MAP[foilingKey]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Edition Filters */}
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Edition:</span>
                <div className="flex gap-2 flex-wrap">
                  {DISPLAY_EDITIONS.map(editionKey => {
                    const isActive = activeFilters.edition === editionKey;
                    return (
                      <button
                        key={editionKey}
                        onClick={() => isActive ? clearFilter('edition') : setFilter('edition', editionKey)}
                        className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                          isActive
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 ring-1 ring-blue-500'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                      >
                        {EDITION_MAP[editionKey]}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Color Filters */}
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Color:</span>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(color => {
                    const isActive = activeFilters.color === color;
                    return (
                      <button
                        key={color}
                        onClick={() => isActive ? clearFilter('color') : setFilter('color', color)}
                        className={`px-3 py-2 flex items-center gap-2 rounded-lg border text-sm transition-colors ${
                          isActive
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50 ring-1 ring-blue-500'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                      >
                        <ColorDot color={color} />
                        <span className="text-gray-900 dark:text-gray-100 capitalize">{color}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Type Text Filter */}
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Card Type:</span>
              <Input
                placeholder="e.g., attack, action, weapon..."
                value={activeFilters.type_text || ''}
                onChange={(e) => e.target.value ? setFilter('type_text', e.target.value) : clearFilter('type_text')}
                className="h-10 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Extended Art Filter */}
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Extended Art:</span>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => activeFilters.is_extended_art === 'true' ? clearFilter('is_extended_art') : setFilter('is_extended_art', 'true')}
                  className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                    activeFilters.is_extended_art === 'true'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 ring-1 ring-blue-500'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  Extended Art Only
                </button>
                <button
                  onClick={() => activeFilters.is_extended_art === 'false' ? clearFilter('is_extended_art') : setFilter('is_extended_art', 'false')}
                  className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                    activeFilters.is_extended_art === 'false'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 ring-1 ring-blue-500'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  Standard Art Only
                </button>
              </div>
            </div>

            {/* For Trade Filter */}
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">For Trade:</span>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => activeFilters.forTrade === 'true' ? clearFilter('forTrade') : setFilter('forTrade', 'true')}
                  className={`px-3 py-2 flex items-center gap-2 rounded-lg border text-sm transition-colors ${
                    activeFilters.forTrade === 'true'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50 ring-1 ring-blue-500'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <span className="text-gray-900 dark:text-gray-100">For Trade</span>
                </button>

                <button
                  onClick={() => activeFilters.forTrade === 'false' ? clearFilter('forTrade') : setFilter('forTrade', 'false')}
                  className={`px-3 py-2 flex items-center gap-2 rounded-lg border text-sm transition-colors ${
                    activeFilters.forTrade === 'false'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50 ring-1 ring-blue-500'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <span className="text-gray-900 dark:text-gray-100">Not for Trade</span>
                </button>
              </div>
            </div>

            {activeFilterCount > 0 && (
              <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
