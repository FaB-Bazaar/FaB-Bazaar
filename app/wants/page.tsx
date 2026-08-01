// app/wants/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal, Filter, ChevronDown, ChevronUp, X, PackageCheck } from "lucide-react";
import { FOILING_MAP, RARITY_MAP, SET_MAP } from "@/lib/fab-constants";
import { formatWantsExport } from "@/lib/wants/export-format";
import CardSearchDialog from "@/components/dialogs/cards/card-search-dialog";
import { WantsCard, AcquireSelectedCardsSheet, AcquireSelectedCardsPanel } from '@/components/wants';
import { useIsMobile } from '@/hooks/use-mobile';
import type { AcquiredCard } from '@/components/wants/MarkAcquiredDialog';
import { TooltipProvider } from "@/components/ui/tooltip";
import { AffiliateDisclosure } from "@/components/shared/AffiliateDisclosure";
import { WantsHeader } from "@/components/wants/WantsHeader";
import { WantsFilterSidebar } from "@/components/wants/WantsFilterSidebar";
import { useCookieBannerInset } from "@/hooks/useCookieBannerInset";

// Client service for API calls
import { wantsClient } from "@/lib/client";

const FilterChip = ({ label, isActive, onClick, onRemove }) => (
  <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
    isActive
      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700'
      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
  }`}>
    <button onClick={onClick} className="hover:underline">
      {label}
    </button>
    {isActive && (
      <button onClick={onRemove} className="hover:text-red-600 dark:hover:text-red-400">
        <X className="w-3 h-3" />
      </button>
    )}
  </div>
);

export default function NewWantsPage() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState({
    priority: null,
    rarity: null,
    foiling: null,
    set: null
  });
  const [sortBy, setSortBy] = useState("default");
  const [isCardSearchOpen, setIsCardSearchOpen] = useState(false);
  const [wantsListData, setWantsListData] = useState(null);
  const [isShareCopied, setIsShareCopied] = useState(false);
  const [isExportCopied, setIsExportCopied] = useState(false);
  const [filterSidebarVisible, setFilterSidebarVisible] = useState(true);
  const [mobileFiltersExpanded, setMobileFiltersExpanded] = useState(false);
  const [selectedForAcquire, setSelectedForAcquire] = useState<any[]>([]);
  const [acquireSheetOpen, setAcquireSheetOpen] = useState(false);
  const cookieBannerInset = useCookieBannerInset();
  const isMobile = useIsMobile();

  // Selection UX splits by viewport (binder-page pattern): on mobile the
  // bottom sheet opens whenever cards are selected and closes when the
  // selection empties; on desktop a docked right panel renders instead —
  // non-modal, so multi-selecting never requires closing anything.
  useEffect(() => {
    if (isMobile) setAcquireSheetOpen(selectedForAcquire.length > 0);
  }, [selectedForAcquire.length, isMobile]);

  const desktopPanelOpen = !isMobile && selectedForAcquire.length > 0;

  useEffect(() => {
    fetchWantsList();
  }, []);

  const fetchWantsList = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await wantsClient.getUserWants();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch wants list');
      }

      if (result.data.wantsList && result.data.wantsList.cards) {
        setCards(result.data.wantsList.cards);
        setWantsListData(result.data.wantsList);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load wants list');
      console.error('Error fetching wants list:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    totalCards: cards.length,
    highPriorityCount: cards.filter(card => card.priority === 'high').length,
    mediumPriorityCount: cards.filter(card => card.priority === 'medium').length,
    lowPriorityCount: cards.filter(card => card.priority === 'low').length,
    uniqueCards: new Set(cards.map(card => card.cardId)).size,
    totalQuantity: cards.reduce((sum, card) => sum + (card.quantity || 1), 0),
    estimatedValue: cards.reduce((total, card) => {
      const price = card.printingDetails?.tcg_low ||
                    card.printingDetails?.tcg_market ||
                    card.printingDetails?.tcg_mid ||
                    card.printingDetails?.tcg_high || 0;
      return total + (price * (card.quantity || 1));
    }, 0)
  };

  const filteredCards = cards.filter(card => {
    const matchesSearch = !searchQuery ||
      card.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = !activeFilters.priority ||
      card.priority === activeFilters.priority;
    const matchesRarity = !activeFilters.rarity ||
      card.printingDetails?.rarity === activeFilters.rarity;
    const matchesFoiling = !activeFilters.foiling ||
      card.printingDetails?.foiling === activeFilters.foiling;
    const matchesSet = !activeFilters.set ||
      card.printingDetails?.set === activeFilters.set;
    return matchesSearch && matchesPriority && matchesRarity && matchesFoiling && matchesSet;
  });

  const sortedCards = [...filteredCards].sort((a, b) => {
    if (sortBy === "price-high") {
      return (b.printingDetails?.tcg_low || 0) - (a.printingDetails?.tcg_low || 0);
    }
    if (sortBy === "price-low") {
      return (a.printingDetails?.tcg_low || 0) - (b.printingDetails?.tcg_low || 0);
    }
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "priority") {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return 0;
  });

  const handleQuantityChange = async (id: string, newQuantity: number) => {
    const originalCards = cards;
    setCards(prev => prev.map(card =>
      card.id === id ? { ...card, quantity: Math.max(1, newQuantity) } : card
    ));
    try {
      const result = await wantsClient.updateWantsItem(id, { quantity: Math.max(1, newQuantity) });
      if (!result.success) throw new Error(result.error || 'Failed to update quantity');
    } catch (err) {
      console.error('Failed to update quantity:', err);
      setCards(originalCards);
    }
  };

  const handlePriorityChange = async (id: string, newPriority: string) => {
    const originalCards = cards;
    setCards(prev => prev.map(card =>
      card.id === id ? { ...card, priority: newPriority } : card
    ));
    try {
      const result = await wantsClient.updateWantsItem(id, { priority: newPriority as 'high' | 'medium' | 'low' });
      if (!result.success) throw new Error(result.error || 'Failed to update priority');
    } catch (err) {
      console.error('Failed to update priority:', err);
      setCards(originalCards);
    }
  };

  const handleRemove = async (id: string) => {
    const originalCards = cards;
    setCards(prev => prev.filter(card => card.id !== id));
    try {
      const result = await wantsClient.removeWantsItem(id);
      if (!result.success) throw new Error(result.error || 'Failed to remove card');
    } catch (err) {
      console.error('Failed to remove card:', err);
      setCards(originalCards);
    }
  };

  // Tap on a card image toggles it in/out of the acquire selection (binder
  // page semantics): selected quantity starts at 1, adjusted in the sheet's
  // per-card steppers up to the wanted quantity.
  const handleAcquireToggle = (card: any) => {
    setSelectedForAcquire(prev => {
      if (prev.some(c => c.id === card.id)) {
        return prev.filter(c => c.id !== card.id);
      }
      return [...prev, { ...card, quantity: 1, maxQuantity: card.quantity || 1 }];
    });
  };

  const handleSelectedQtyChange = (cardId: string, newQuantity: number) => {
    setSelectedForAcquire(prev => prev.map(c =>
      c.id === cardId
        ? { ...c, quantity: Math.max(1, Math.min(newQuantity, c.maxQuantity)) }
        : c
    ));
  };

  // Sync local state after cards were acquired into a binder: drop fully
  // acquired cards, reduce quantities on partial acquisitions, and clear the
  // acquired cards from the selection.
  const handleAcquireComplete = (acquiredCards: AcquiredCard[]) => {
    const acquiredById = new Map(acquiredCards.map(a => [a.printingId, a]));
    setCards(prev => prev
      .map(card => {
        const acquired = acquiredById.get(card.id);
        if (!acquired) return card;
        if (acquired.remainingWanted <= 0) return null;
        return { ...card, quantity: acquired.remainingWanted };
      })
      .filter(Boolean));
    setSelectedForAcquire(prev => prev.filter(card => !acquiredById.has(card.id)));
  };

  const handlePrintingSwap = (cardId: string, oldPrintingId: string, newPrinting: any) => {
    const cardToUpdate = cards.find(c => c.id === cardId);
    if (!cardToUpdate) return;

    setCards(prev => prev.map(card => {
      if (card.id === cardId) {
        return {
          ...card,
          id: newPrinting.printing_id,
          printingDetails: {
            printing_id: newPrinting.printing_id,
            card_unique_id: newPrinting.card_unique_id,
            collector_number: newPrinting.collector_number,
            display_name: newPrinting.name || newPrinting.display_name,
            name: (newPrinting.name || newPrinting.display_name)?.toLowerCase(),
            set: newPrinting.set,
            edition: newPrinting.edition,
            foiling: newPrinting.foiling,
            rarity: newPrinting.rarity,
            color: newPrinting.color,
            types: newPrinting.types,
            traits: newPrinting.traits || [],
            keywords: newPrinting.keywords || [],
            text: newPrinting.text,
            type_text: newPrinting.type_text,
            pitch_text: newPrinting.pitch_text,
            power: newPrinting.power,
            power_text: newPrinting.power_text,
            cost: newPrinting.cost,
            cost_text: newPrinting.cost_text,
            defense: newPrinting.defense,
            defense_text: newPrinting.defense_text,
            pitch: newPrinting.pitch,
            tcg_low: newPrinting.tcg_low,
            tcg_mid: newPrinting.tcg_mid,
            tcg_high: newPrinting.tcg_high,
            tcg_market: newPrinting.tcg_market,
            price_updated_at: newPrinting.price_updated_at,
            tcgplayer_url: newPrinting.tcgplayer_url,
            tcgplayer_product_id: newPrinting.tcgplayer_product_id,
            artists: newPrinting.artists,
            image_url: newPrinting.image_url,
            expansion_slot: newPrinting.expansion_slot || false,
            is_under_5: newPrinting.is_under_5 || false,
            is_under_10: newPrinting.is_under_10 || false,
            is_under_25: newPrinting.is_under_25 || false,
            is_under_50: newPrinting.is_under_50 || false,
            is_under_100: newPrinting.is_under_100 || false,
            is_expensive: newPrinting.is_expensive || false,
            is_budget: newPrinting.is_budget || false,
            is_premium: newPrinting.is_premium || false,
            blitz_legal: newPrinting.blitz_legal ?? true,
            cc_legal: newPrinting.cc_legal ?? true,
            commoner_legal: newPrinting.commoner_legal || false,
            ll_legal: newPrinting.ll_legal ?? true
          }
        };
      }
      return card;
    }));
  };

  const handleAddCardToWants = async ({ card, printing, quantity }: { card: any, printing: any, quantity: number }, shouldContinue = false) => {
    const printingId = printing?.printing_id || printing?.unique_id;
    if (!printingId) {
      console.error("No printing was selected.");
      return;
    }

    const existingCardIndex = cards.findIndex(c =>
      (c.printingId || c.printingDetails?.printing_id) === printingId
    );

    if (existingCardIndex !== -1) {
      setCards(prev => prev.map((c, index) =>
        index === existingCardIndex ? { ...c, quantity: c.quantity + quantity } : c
      ));
    } else {
      const newCardForUI = {
        id: printingId,
        cardId: card?.unique_id || card?.cardId,
        name: card?.name || printing?.display_name,
        quantity: quantity,
        priority: 'medium',
        printingDetails: { ...printing, printing_id: printingId }
      };
      setCards(prev => [newCardForUI, ...prev]);
    }

    if (!shouldContinue) {
      setIsCardSearchOpen(false);
    }

    try {
      const result = await wantsClient.addWantsItem(printingId, quantity);
      if (!result.success) console.error('API Error:', result.error);
    } catch (err) {
      console.error('Fetch Error:', err);
    }
  };

  const setFilter = (type, value) => {
    setActiveFilters(prev => ({
      ...prev,
      [type]: prev[type] === value ? null : value
    }));
  };

  const clearFilter = (type) => {
    setActiveFilters(prev => ({ ...prev, [type]: null }));
  };

  const clearAllFilters = () => {
    setActiveFilters({ priority: null, rarity: null, foiling: null, set: null });
    setSearchQuery("");
  };

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length + (searchQuery ? 1 : 0);

  const handleExport = async () => {
    // Export mirrors the on-screen view: filtered AND sorted.
    const cardList = formatWantsExport(sortedCards);

    try {
      await navigator.clipboard.writeText(cardList);
      setIsExportCopied(true);
      setTimeout(() => setIsExportCopied(false), 2000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = cardList;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setIsExportCopied(true);
        setTimeout(() => setIsExportCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Failed to copy to clipboard:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleShare = async () => {
    const wantsListId = wantsListData?.userId || wantsListData?._id;
    if (!wantsListId) return;
    const shareUrl = `${window.location.origin}/wants/${wantsListId}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsShareCopied(true);
      setTimeout(() => setIsShareCopied(false), 2000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setIsShareCopied(true);
        setTimeout(() => setIsShareCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Failed to copy to clipboard:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading wants list...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">Error Loading Wants List</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline">Try Again</Button>
        </div>
      </div>
    );
  }

  // Unique values for mobile filters
  const uniqueRarities = [...new Set(cards.map(card => card.printingDetails?.rarity).filter(Boolean))];
  const uniqueFoilings = [...new Set(cards.map(card => card.printingDetails?.foiling).filter(Boolean))];
  const uniqueSets = [...new Set(cards.map(card => card.printingDetails?.set).filter(Boolean))];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <CardSearchDialog
        open={isCardSearchOpen}
        onOpenChange={setIsCardSearchOpen}
        onSelectCard={(data, shouldContinue) => handleAddCardToWants(data, shouldContinue)}
        destination="wants"
      />

      {/* Slim affiliate disclosure */}
      <AffiliateDisclosure />

      {/* Content shrinks to make room for the docked acquire panel (binder-page pattern) */}
      <div className={`transition-all duration-300 ${desktopPanelOpen ? 'md:max-w-[calc(100%-18rem)]' : ''}`}>

      {/* Header: title + stats + actions */}
      <WantsHeader
        stats={stats}
        onAddCard={() => setIsCardSearchOpen(true)}
        onExport={handleExport}
        onShare={handleShare}
        isExportCopied={isExportCopied}
        isShareCopied={isShareCopied}
      />

      {/* Main content */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex gap-8 items-start">

          {/* Left: filter sidebar (desktop only) */}
          {filterSidebarVisible && (
            <WantsFilterSidebar
              activeFilters={activeFilters}
              activeFilterCount={activeFilterCount}
              setFilter={setFilter}
              clearFilter={clearFilter}
              clearAllFilters={clearAllFilters}
            />
          )}

          {/* Right: main content */}
          <div className="flex-1 min-w-0">

            {/* Mobile: collapsible filters */}
            <div className="md:hidden mb-4">
              <button
                onClick={() => setMobileFiltersExpanded(v => !v)}
                className="flex items-center justify-center gap-2 px-3 py-2 w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-gray-900 dark:text-gray-100 mb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded-full">{activeFilterCount}</span>
                )}
                {mobileFiltersExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {mobileFiltersExpanded && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-300 dark:border-gray-600 space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Priority:</span>
                    <div className="flex gap-2 flex-wrap">
                      {['high', 'medium', 'low'].map(p => (
                        <FilterChip
                          key={p}
                          label={`${p.charAt(0).toUpperCase() + p.slice(1)} (${cards.filter(c => c.priority === p).length})`}
                          isActive={activeFilters.priority === p}
                          onClick={() => setFilter('priority', p)}
                          onRemove={() => clearFilter('priority')}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Rarity:</span>
                    <div className="flex gap-2 flex-wrap">
                      {uniqueRarities.map(r => (
                        <FilterChip
                          key={r}
                          label={`${RARITY_MAP[r?.toLowerCase()] || r} (${cards.filter(c => c.printingDetails?.rarity === r).length})`}
                          isActive={activeFilters.rarity === r}
                          onClick={() => setFilter('rarity', r)}
                          onRemove={() => clearFilter('rarity')}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Foiling:</span>
                    <div className="flex gap-2 flex-wrap">
                      {uniqueFoilings.map(f => (
                        <FilterChip
                          key={f}
                          label={`${FOILING_MAP[f?.toLowerCase()] || f} (${cards.filter(c => c.printingDetails?.foiling === f).length})`}
                          isActive={activeFilters.foiling === f}
                          onClick={() => setFilter('foiling', f)}
                          onRemove={() => clearFilter('foiling')}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Set:</span>
                    <div className="flex gap-2 flex-wrap">
                      {uniqueSets.map(s => (
                        <FilterChip
                          key={s}
                          label={`${SET_MAP[s?.toLowerCase()] || s?.toUpperCase()} (${cards.filter(c => c.printingDetails?.set === s).length})`}
                          isActive={activeFilters.set === s}
                          onClick={() => setFilter('set', s)}
                          onRemove={() => clearFilter('set')}
                        />
                      ))}
                    </div>
                  </div>
                  {activeFilterCount > 0 && (
                    <button onClick={clearAllFilters} className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline">
                      Clear all filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Desktop: search + hide filters + sort toolbar */}
            <div className="hidden md:flex items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                <Input
                  placeholder="Filter by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
              <button
                onClick={() => setFilterSidebarVisible(v => !v)}
                className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
              >
                <SlidersHorizontal className="w-4 h-4" />
                {filterSidebarVisible ? 'Hide Filters' : 'Show Filters'}
              </button>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              >
                <option value="default">Sort: Default</option>
                <option value="priority">Sort: Priority</option>
                <option value="price-high">Sort: Price (High to Low)</option>
                <option value="price-low">Sort: Price (Low to High)</option>
                <option value="name">Sort: Name</option>
              </select>
            </div>

            {/* Mobile: search + sort */}
            <div className="flex gap-2 md:hidden mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                <Input
                  placeholder="Filter by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              >
                <option value="default">Default</option>
                <option value="priority">Priority</option>
                <option value="price-high">Price ↓</option>
                <option value="price-low">Price ↑</option>
                <option value="name">Name</option>
              </select>
            </div>

            {/* Count row */}
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Showing {sortedCards.length} of {cards.length}
              {cards.length > 0 && (
                <span className="text-gray-500 dark:text-gray-400"> — tap a card image to mark it as acquired</span>
              )}
            </p>

            {/* Cards grid */}
            <TooltipProvider>
              {sortedCards.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700">
                  <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100">No cards found</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">Try adjusting your search or filters</p>
                  <Button onClick={clearAllFilters} variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                    Clear filters
                  </Button>
                </div>
              ) : (
                <div className={`grid gap-1.5 grid-cols-2 ${
                  filterSidebarVisible
                    ? 'md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                    : 'md:grid-cols-4 lg:grid-cols-6'
                }`}>
                  {sortedCards.map((card) => (
                    <WantsCard
                      key={`${card.id}-${card.printingDetails?.printing_id || card.id}`}
                      card={card}
                      onQuantityChange={handleQuantityChange}
                      onPriorityChange={handlePriorityChange}
                      onRemove={handleRemove}
                      onPrintingSwap={handlePrintingSwap}
                      onAcquireToggle={handleAcquireToggle}
                      isSelected={selectedForAcquire.some(c => c.id === card.id)}
                      selectedQty={selectedForAcquire.find(c => c.id === card.id)?.quantity || 1}
                    />
                  ))}
                </div>
              )}
            </TooltipProvider>
          </div>
        </div>
      </div>
      </div>

      {/* Floating count button reopens the sheet (mobile only — the desktop
          panel is always visible while cards are selected). Shifted above the
          cookie banner while it is visible so it stays tappable. */}
      {isMobile && selectedForAcquire.length > 0 && (
        <Button
          onClick={() => setAcquireSheetOpen(true)}
          aria-label={`Open acquired cards sheet (${selectedForAcquire.length} selected)`}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:bottom-6 right-6 h-16 w-16 rounded-full shadow-lg z-[60] flex flex-col items-center justify-center"
          style={cookieBannerInset > 0 ? { bottom: `calc(env(safe-area-inset-bottom) + ${cookieBannerInset + 16}px)` } : undefined}
        >
          <PackageCheck className="h-6 w-6" />
          <span className="text-xs font-bold mt-1">{selectedForAcquire.length}</span>
        </Button>
      )}

      {isMobile ? (
        <AcquireSelectedCardsSheet
          selectedCards={selectedForAcquire}
          isOpen={acquireSheetOpen}
          onOpenChange={setAcquireSheetOpen}
          onQuantityChange={handleSelectedQtyChange}
          onRemoveSelected={(index: number) => {
            const cardToRemove = selectedForAcquire[index];
            if (cardToRemove) handleAcquireToggle(cardToRemove);
          }}
          onClearSelected={() => setSelectedForAcquire([])}
          onAcquireComplete={handleAcquireComplete}
        />
      ) : (
        <AcquireSelectedCardsPanel
          selectedCards={selectedForAcquire}
          onQuantityChange={handleSelectedQtyChange}
          onRemoveSelected={(index: number) => {
            const cardToRemove = selectedForAcquire[index];
            if (cardToRemove) handleAcquireToggle(cardToRemove);
          }}
          onClearSelected={() => setSelectedForAcquire([])}
          onAcquireComplete={handleAcquireComplete}
        />
      )}

    </div>
  );
}
