// components/wants/WantsFilterSidebar.tsx
"use client";

import React, { useState } from "react";
import { getSetImageOrFallback } from "@/lib/set-images";
import { RarityIcon } from "@/components/shared/RarityIcon";
import { ChevronDown, ChevronUp } from "lucide-react";
import { CARD_FILTER_SETS } from "@/lib/fab-constants/sets";

interface WantsFilterSidebarProps {
  activeFilters: Record<string, string | null>;
  activeFilterCount: number;
  setFilter: (type: string, value: string) => void;
  clearFilter: (type: string) => void;
  clearAllFilters: () => void;
}

// Reuse the shared filter list so newly released sets appear here automatically.
const DISPLAY_SETS = CARD_FILTER_SETS;

const PRIMARY_RARITIES: { key: string; label: string }[] = [
  { key: 'f', label: 'Fabled' },
  { key: 'v', label: 'Marvel' },
  { key: 'l', label: 'Legendary' },
  { key: 'm', label: 'Majestic' },
  { key: 'p', label: 'Promo' },
];

const SECONDARY_RARITIES: { key: string; label: string }[] = [
  { key: 's', label: 'Super Rare' },
  { key: 'r', label: 'Rare' },
  { key: 'c', label: 'Common' },
  { key: 'b', label: 'Basic' },
  { key: 't', label: 'Token' },
];

const DISPLAY_FOILINGS: { key: string; label: string; swatch: string }[] = [
  { key: 'r', label: 'Rainbow Foil', swatch: 'bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400' },
  { key: 'c', label: 'Cold Foil',    swatch: 'bg-gradient-to-br from-cyan-200 to-cyan-400' },
  { key: 'g', label: 'Gold Foil',    swatch: 'bg-gradient-to-br from-yellow-300 to-yellow-500' },
  { key: 's', label: 'Non-foil',     swatch: 'bg-gray-300 dark:bg-gray-500' },
];

const PRIORITIES: { key: string; label: string; activeClass: string; inactiveClass: string }[] = [
  {
    key: 'high',
    label: 'High',
    activeClass: 'bg-red-600 text-white border-red-600',
    inactiveClass: 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-red-300 dark:hover:border-red-700 hover:text-red-700 dark:hover:text-red-400',
  },
  {
    key: 'medium',
    label: 'Medium',
    activeClass: 'bg-yellow-500 text-white border-yellow-500',
    inactiveClass: 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-yellow-300 dark:hover:border-yellow-700 hover:text-yellow-700 dark:hover:text-yellow-400',
  },
  {
    key: 'low',
    label: 'Low',
    activeClass: 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100',
    inactiveClass: 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-900 dark:hover:text-gray-100',
  },
];

const sectionTitle = "text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3";

export function WantsFilterSidebar({
  activeFilters,
  activeFilterCount,
  setFilter,
  clearFilter,
  clearAllFilters,
}: WantsFilterSidebarProps) {
  const [showAllRarities, setShowAllRarities] = useState(false);

  const allRarities = showAllRarities
    ? [...PRIMARY_RARITIES, ...SECONDARY_RARITIES]
    : PRIMARY_RARITIES;

  return (
    <aside className="w-48 flex-shrink-0 sticky top-20 self-start hidden md:flex flex-col max-h-[calc(100vh-6rem)] overflow-y-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Filters</span>
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 underline transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Priority */}
      <div className="flex gap-2 mb-4">
        {PRIORITIES.map(({ key, label, activeClass, inactiveClass }) => (
          <button
            key={key}
            onClick={() => activeFilters.priority === key ? clearFilter('priority') : setFilter('priority', key)}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              activeFilters.priority === key ? activeClass : inactiveClass
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <hr className="border-gray-200 dark:border-gray-700 mb-4" />

      {/* Rarity */}
      <div className="mb-4">
        <p className={sectionTitle}>Rarity</p>
        {allRarities.map(({ key, label }) => {
          const isActive = activeFilters.rarity === key;
          return (
            <button
              key={key}
              onClick={() => isActive ? clearFilter('rarity') : setFilter('rarity', key)}
              className={`flex items-center gap-2 w-full text-left py-0.5 transition-colors ${
                isActive
                  ? 'font-semibold text-gray-900 dark:text-gray-100'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <RarityIcon rarityCode={key} size="sm" />
              <span className={`text-sm ${isActive ? 'underline' : ''}`}>{label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setShowAllRarities(v => !v)}
          className="flex items-center gap-1 mt-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          {showAllRarities ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {showAllRarities ? 'Show less' : 'Show more'}
        </button>
      </div>

      <hr className="border-gray-200 dark:border-gray-700 mb-4" />

      {/* Foiling */}
      <div className="mb-4">
        <p className={sectionTitle}>Foiling</p>
        {DISPLAY_FOILINGS.map(({ key, label, swatch }) => {
          const isActive = activeFilters.foiling === key;
          return (
            <button
              key={key}
              onClick={() => isActive ? clearFilter('foiling') : setFilter('foiling', key)}
              className={`flex items-center gap-2 w-full text-left py-0.5 transition-colors ${
                isActive
                  ? 'font-semibold text-gray-900 dark:text-gray-100'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <span className={`w-4 h-4 rounded-sm flex-shrink-0 border border-gray-300 dark:border-gray-600 ${swatch}`} />
              <span className={`text-sm ${isActive ? 'underline' : ''}`}>{label}</span>
            </button>
          );
        })}
      </div>

      <hr className="border-gray-200 dark:border-gray-700 mb-4" />

      {/* Set */}
      <div>
        <p className={sectionTitle}>Set</p>
        <div className="grid grid-cols-3 gap-1.5">
          {DISPLAY_SETS.map(setKey => {
            const isActive = activeFilters.set === setKey;
            const imageUrl = getSetImageOrFallback(setKey, setKey.toUpperCase());
            return (
              <button
                key={setKey}
                onClick={() => isActive ? clearFilter('set') : setFilter('set', setKey)}
                title={setKey.toUpperCase()}
                className={`flex flex-col items-center justify-center p-1.5 rounded-md border transition-all hover:scale-105 ${
                  isActive
                    ? 'border-gray-900 dark:border-gray-100 ring-1 ring-gray-900 dark:ring-gray-100'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-500 dark:hover:border-gray-400'
                }`}
              >
                <img
                  src={imageUrl}
                  alt={setKey.toUpperCase()}
                  className="w-10 h-10 object-contain"
                />
                <span className={`text-[10px] font-medium mt-0.5 leading-none ${
                  isActive ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {setKey.toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

    </aside>
  );
}
