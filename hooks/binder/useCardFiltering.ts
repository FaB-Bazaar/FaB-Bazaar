// hooks/binder/useCardFiltering.ts
import { useMemo } from 'react';

export const useCardFiltering = (
  cards: any[],
  searchQuery: string,
  activeFilters: any,
  sortBy: string
) => {
  const filteredAndSortedCards = useMemo(() => {
    // Filter logic
    let filtered = cards.filter(card => {
      const matchesSearch = !searchQuery || 
        card.name?.toLowerCase().includes(searchQuery.toLowerCase());
      
    //   const matchesForTrade = !activeFilters.forTrade ||
    //     (activeFilters.forTrade === "forTrade" && card.forTrade) ||
    //     (activeFilters.forTrade === "notForTrade" && !card.forTrade);

    const matchesForTrade = (() => {
        const filterValue = activeFilters.forTrade;
        if (!filterValue || filterValue === 'all') {
          return true; // No filter applied
        }
        // Determine the target boolean based on the filter string
        const targetValue = filterValue === 'forTrade' || filterValue === 'true';
        return card.forTrade === targetValue;
      })();
      
      const matchesRarity = !activeFilters.rarity || 
        card.printingDetails?.rarity === activeFilters.rarity;
      
      const matchesFoiling = !activeFilters.foiling || 
        card.printingDetails?.foiling === activeFilters.foiling;
      
      const matchesSet = !activeFilters.set || 
        card.printingDetails?.set === activeFilters.set;

      const matchesCondition = !activeFilters.condition || 
        card.condition === activeFilters.condition;

      return matchesSearch && matchesForTrade && matchesRarity && matchesFoiling && matchesSet && matchesCondition;
    });

    // Sort logic
    return filtered.sort((a, b) => {
      if (sortBy === "tcg-low-desc") {
        const aPrice = a.printingDetails?.tcg_low || a.tcg_low || 0;
        const bPrice = b.printingDetails?.tcg_low || b.tcg_low || 0;
        return bPrice - aPrice;
      }
      if (sortBy === "tcg-low-asc") {
        const aPrice = a.printingDetails?.tcg_low || a.tcg_low || 0;
        const bPrice = b.printingDetails?.tcg_low || b.tcg_low || 0;
        return aPrice - bPrice;
      }
      if (sortBy === "tcg-mid-desc") {
        const aPrice = a.printingDetails?.tcg_mid || a.tcg_mid || 0;
        const bPrice = b.printingDetails?.tcg_mid || b.tcg_mid || 0;
        return bPrice - aPrice;
      }
      if (sortBy === "tcg-mid-asc") {
        const aPrice = a.printingDetails?.tcg_mid || a.tcg_mid || 0;
        const bPrice = b.printingDetails?.tcg_mid || b.tcg_mid || 0;
        return aPrice - bPrice;
      }
      if (sortBy === "tcg-high-desc") {
        const aPrice = a.printingDetails?.tcg_high || a.tcg_high || 0;
        const bPrice = b.printingDetails?.tcg_high || b.tcg_high || 0;
        return bPrice - aPrice;
      }
      if (sortBy === "tcg-high-asc") {
        const aPrice = a.printingDetails?.tcg_high || a.tcg_high || 0;
        const bPrice = b.printingDetails?.tcg_high || b.tcg_high || 0;
        return aPrice - bPrice;
      }
      if (sortBy === "tcg-market-desc") {
        const aPrice = a.printingDetails?.tcg_market || a.tcg_market || 0;
        const bPrice = b.printingDetails?.tcg_market || b.tcg_market || 0;
        return bPrice - aPrice;
      }
      if (sortBy === "tcg-market-asc") {
        const aPrice = a.printingDetails?.tcg_market || a.tcg_market || 0;
        const bPrice = b.printingDetails?.tcg_market || b.tcg_market || 0;
        return aPrice - bPrice;
      }
      if (sortBy === "name") return a.name?.localeCompare(b.name) || 0;
      if (sortBy === "quantity-desc") return b.quantity - a.quantity;
      if (sortBy === "quantity-asc") return a.quantity - b.quantity;
      if (sortBy === "rarity") {
        const rarityOrder = { f: 0, l: 1, m: 2, r: 3, c: 4 };
        const aRarity = a.printingDetails?.rarity?.toLowerCase() || 'z';
        const bRarity = b.printingDetails?.rarity?.toLowerCase() || 'z';
        return (rarityOrder[aRarity] ?? 99) - (rarityOrder[bRarity] ?? 99);
      }
      if (sortBy === "set") {
        const aSet = a.printingDetails?.set || '';
        const bSet = b.printingDetails?.set || '';
        return aSet.localeCompare(bSet);
      }
      return 0;
    });
  }, [cards, searchQuery, activeFilters, sortBy]);

  return { filteredAndSortedCards };
};