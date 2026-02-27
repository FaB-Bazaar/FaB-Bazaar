// hooks/binder/useFilterManagement.ts
import { useState, useMemo } from 'react';

interface FilterState {
  forTrade: string | null;
  rarity: string | null;
  foiling: string | null;
  set: string | null;
  condition: string | null;
}

export const useFilterManagement = (cards: any[], searchQuery: string, setSearchQuery: (query: string) => void) => {
    const [activeFilters, setActiveFilters] = useState<FilterState>({
    forTrade: null,
    rarity: null,
    foiling: null,
    set: null,
    condition: null
  });

  const setFilter = (type: keyof FilterState, value: string) => {
    setActiveFilters(prev => ({
      ...prev,
      [type]: prev[type] === value ? null : value
    }));
  };

  const clearFilter = (type: keyof FilterState) => {
    setActiveFilters(prev => ({ ...prev, [type]: null }));
  };

  const clearAllFilters = () => {
    setActiveFilters({ 
      forTrade: null, 
      rarity: null, 
      foiling: null, 
      set: null, 
      condition: null 
    });
     setSearchQuery("");
  };

  // Calculate unique values for filter options
  const uniqueValues = useMemo(() => ({
    rarities: [...new Set(cards.map(card => card.printingDetails?.rarity).filter(Boolean))],
    foilings: [...new Set(cards.map(card => card.printingDetails?.foiling).filter(Boolean))],
    sets: [...new Set(cards.map(card => card.printingDetails?.set).filter(Boolean))],
    conditions: [...new Set(cards.map(card => card.condition).filter(Boolean))]
  }), [cards]);

  return {
    activeFilters,
    setFilter,
    clearFilter,
    clearAllFilters,
    uniqueValues
  };
};