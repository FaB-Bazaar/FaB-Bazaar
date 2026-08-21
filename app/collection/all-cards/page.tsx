// app/collection/all-cards/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useInView } from 'react-intersection-observer';
import { useDebounce } from 'use-debounce';
import { bindersClient } from "@/lib/client";

// Components
import BinderCard from "@/components/binder/BinderCard";
import { BinderSearchAndFilters } from "@/components/binder/BinderSearchAndFilters";
import { SelectedCardsSidebar } from "@/components/collection/SelectedCardsSidebar";

export default function AllCardsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const { ref: infiniteScrollRef } = useInView({ threshold: 0.5 });

  // Card data
  const [allLoadedCards, setAllLoadedCards] = useState<any[]>([]);
  const [clientFilteredCards, setClientFilteredCards] = useState<any[]>([]);

  // Search / filter / sort
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery] = useDebounce(searchQuery, 500);
  const [activeFilters, setActiveFilters] = useState<Record<string, string | null>>({});
  const [sortBy, setSortBy] = useState("tcg-low-desc");
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Metadata
  const [uniqueValues, setUniqueValues] = useState({ rarities: [], foilings: [], sets: [], conditions: [] });
  const [counts, setCounts] = useState({ forTrade: 0, notForTrade: 0 });
  const [binders, setBinders] = useState<any[]>([]);

  // Selection (sidebar appears automatically when anything is selected)
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());

  // --- DATA FETCHING ---
  const fetchCards = async (page = 1, shouldReset = false) => {
    if (loadingMore || (loading && page > 1)) return;
    if (page > 1) setLoadingMore(true); else setLoading(true);

    try {
      const queryParams = new URLSearchParams({ page: page.toString(), limit: '200' });
      const response = await fetch(`/api/collection/all-cards?${queryParams}`);
      const data = await response.json();

      if (!data.success) throw new Error(data.error || 'Failed to fetch cards');

      setAllLoadedCards(prev => shouldReset ? data.cards : [...prev, ...data.cards]);

      if (data.metadata?.counts) setCounts(data.metadata.counts);
      if (data.metadata?.uniqueValues) setUniqueValues(data.metadata.uniqueValues);
      if (data.binders) setBinders(data.binders.names || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (user && allLoadedCards.length === 0) fetchCards(1, true);
  }, [user]);

  // --- CLIENT-SIDE FILTERING ---
  const filterCardsClient = (cardsToFilter: any[], filters: Record<string, string | null>, search: string) =>
    cardsToFilter.filter(card => {
      if (search) {
        const s = search.toLowerCase();
        if (!card.name?.includes(s) && !card.type_text?.includes(s)) return false;
      }
      if (filters.rarity && card.rarity !== filters.rarity) return false;
      if (filters.foiling && card.foiling !== filters.foiling) return false;
      if (filters.set && card.set !== filters.set) return false;
      if (filters.condition && card.condition !== filters.condition) return false;
      if (filters.forTrade === 'true' && !card.forTrade) return false;
      if (filters.forTrade === 'false' && card.forTrade) return false;
      return true;
    });

  const sortCardsClient = (cardsToSort: any[], sortOption: string) => {
    const sorted = [...cardsToSort];
    switch (sortOption) {
      case 'name': return sorted.sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));
      case 'quantity-desc': return sorted.sort((a, b) => (b.quantity || 0) - (a.quantity || 0));
      case 'quantity-asc': return sorted.sort((a, b) => (a.quantity || 0) - (b.quantity || 0));
      case 'tcg-market-desc': return sorted.sort((a, b) => (b.tcg_market || 0) - (a.tcg_market || 0));
      case 'tcg-market-asc': return sorted.sort((a, b) => (a.tcg_market || 0) - (b.tcg_market || 0));
      case 'tcg-low-desc': return sorted.sort((a, b) => (b.tcg_low || 0) - (a.tcg_low || 0));
      case 'tcg-low-asc': return sorted.sort((a, b) => (a.tcg_low || 0) - (b.tcg_low || 0));
      case 'recently-updated': return sorted.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
      case 'recently-added':
      default: return sorted.sort((a, b) => new Date(b.addedAt || 0).getTime() - new Date(a.addedAt || 0).getTime());
    }
  };

  useEffect(() => {
    if (allLoadedCards.length > 0) {
      const filtered = filterCardsClient(allLoadedCards, activeFilters, debouncedSearchQuery);
      setClientFilteredCards(sortCardsClient(filtered, sortBy));
    }
  }, [allLoadedCards, activeFilters, debouncedSearchQuery, sortBy]);

  const totalValue = clientFilteredCards.reduce((sum, card) => sum + ((card.tcg_low || 0) * (card.quantity || 1)), 0);

  // --- FILTERS ---
  const setFilter = (type: string, value: string) => setActiveFilters(prev => ({ ...prev, [type]: value }));
  const clearFilter = (type: string) => setActiveFilters(prev => { const n = { ...prev }; delete n[type]; return n; });
  const clearAllFilters = () => { setSearchQuery(""); setActiveFilters({}); };
  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length + (searchQuery ? 1 : 0);

  // --- SELECTION ---
  const toggleCardSelection = (cardId: string) => {
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId); else next.add(cardId);
      return next;
    });
  };

  const sidebarOpen = selectedCardIds.size > 0;

  // --- CARD EDIT HANDLERS ---
  const findCard = (cardId: string) => allLoadedCards.find(c => (c.id || c._id) === cardId);

  const handleQuantityIncrease = async (cardId: string) => {
    const card = findCard(cardId);
    if (!card) return;
    const newQty = (card.quantity || 1) + 1;
    setAllLoadedCards(prev => prev.map(c => (c.id || c._id) === cardId ? { ...c, quantity: newQty } : c));
    const result = await bindersClient.updateBinderCard(card.binderId, cardId, { quantity: newQty });
    if (!result.success) {
      setAllLoadedCards(prev => prev.map(c => (c.id || c._id) === cardId ? { ...c, quantity: card.quantity } : c));
      toast({ title: "Failed to update quantity", variant: "destructive" });
    }
  };

  const handleQuantityDecrease = async (cardId: string) => {
    const card = findCard(cardId);
    if (!card || (card.quantity || 1) <= 1) return;
    const newQty = card.quantity - 1;
    setAllLoadedCards(prev => prev.map(c => (c.id || c._id) === cardId ? { ...c, quantity: newQty } : c));
    const result = await bindersClient.updateBinderCard(card.binderId, cardId, { quantity: newQty });
    if (!result.success) {
      setAllLoadedCards(prev => prev.map(c => (c.id || c._id) === cardId ? { ...c, quantity: card.quantity } : c));
      toast({ title: "Failed to update quantity", variant: "destructive" });
    }
  };

  const handleRemove = async (cardId: string) => {
    const card = findCard(cardId);
    if (!card) return;
    setAllLoadedCards(prev => prev.filter(c => (c.id || c._id) !== cardId));
    const result = await bindersClient.deleteBinderCard(card.binderId, cardId);
    if (!result.success) {
      toast({ title: "Failed to remove card", variant: "destructive" });
      fetchCards(1, true);
    }
  };

  const handleToggleForTrade = async (card: any, checked: boolean) => {
    const cardId = card.id || card._id;
    setAllLoadedCards(prev => prev.map(c => (c.id || c._id) === cardId ? { ...c, forTrade: checked } : c));
    const result = await bindersClient.updateBinderCard(card.binderId, cardId, { forTrade: checked });
    if (!result.success) {
      setAllLoadedCards(prev => prev.map(c => (c.id || c._id) === cardId ? { ...c, forTrade: card.forTrade } : c));
      toast({ title: "Failed to update trade status", variant: "destructive" });
    }
  };

  const handleUpdateCard = async (cardId: string, updates: any) => {
    const card = findCard(cardId);
    if (!card) return;
    setAllLoadedCards(prev => prev.map(c => (c.id || c._id) === cardId ? { ...c, ...updates } : c));
    const result = await bindersClient.updateBinderCard(card.binderId, cardId, updates);
    if (!result.success) {
      setAllLoadedCards(prev => prev.map(c => (c.id || c._id) === cardId ? card : c));
      toast({ title: "Failed to update card", variant: "destructive" });
    }
  };

  // --- RENDER ---
  if (authLoading || (loading && !allLoadedCards.length)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">You must be logged in to view your cards.</p>
          <Button onClick={() => router.push('/auth/login')}>Log In</Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => router.push('/collection')}>Back to Collection</Button>
        </div>
      </div>
    );
  }

  const selectedCards = clientFilteredCards.filter(c => selectedCardIds.has(c.id || c._id));

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Main scrollable content */}
      <div className="flex-1 min-w-0 px-4 py-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/collection')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Collection
            </Button>
          </div>

          <div>
            <h1 className="text-3xl font-bold">All Cards</h1>
            <p className="text-muted-foreground mt-1">
              Viewing {clientFilteredCards.length.toLocaleString()} of {allLoadedCards.length.toLocaleString()} cards across {binders.length} {binders.length === 1 ? 'binder' : 'binders'}
            </p>
            <p className="text-sm font-medium mt-1">
              Total Value (TCG Low): ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            {!sidebarOpen && (
              <p className="text-xs text-muted-foreground mt-1">
                Click a card image to select it for transfer
              </p>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <BinderSearchAndFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          counts={counts}
          filtersExpanded={filtersExpanded}
          setFiltersExpanded={setFiltersExpanded}
          activeFilters={activeFilters}
          activeFilterCount={activeFilterCount}
          sortBy={sortBy}
          setSortBy={setSortBy}
          setFilter={setFilter}
          clearFilter={clearFilter}
          clearAllFilters={clearAllFilters}
          uniqueValues={uniqueValues}
        />

        {/* Cards Grid */}
        {loading && !clientFilteredCards.length ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          </div>
        ) : clientFilteredCards.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-lg border">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No Cards Found</h3>
            <p className="text-muted-foreground mb-4">Try adjusting your search or filters.</p>
            <Button onClick={clearAllFilters} variant="outline">Clear Filters</Button>
          </div>
        ) : (
          <>
            <div className={`grid gap-1.5 grid-cols-2 ${sidebarOpen ? 'md:grid-cols-3 lg:grid-cols-4' : 'md:grid-cols-4 lg:grid-cols-6'}`}>
              {clientFilteredCards.map((card) => {
                const cardId = card.id || card._id;
                const isSelected = selectedCardIds.has(cardId);
                return (
                  <div key={cardId} className="relative">
                    <BinderCard
                      card={card}
                      editable={true}
                      onEdit={() => router.push(`/binder/${card.binderId}`)}
                      onRemove={handleRemove}
                      onOpenPrintingSwap={undefined}
                      isSelected={isSelected}
                      onSelect={(c) => toggleCardSelection(c.id || c._id)}
                      selectedQty={0}
                      maxQty={card.quantity}
                      toast={toast}
                      handleUpdateCard={handleUpdateCard}
                      onQuantityIncrease={handleQuantityIncrease}
                      onQuantityDecrease={handleQuantityDecrease}
                      onToggleForTrade={handleToggleForTrade}
                    />

                    {/* Binder badge */}
                    {card.binderName && (
                      <div className="absolute top-1 left-1 z-10 pointer-events-none">
                        <Badge variant="secondary" className="text-xs opacity-80">{card.binderName}</Badge>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="h-10 flex justify-center items-center mt-4">
              {loadingMore && <Loader2 className="h-6 w-6 animate-spin" />}
              {!loadingMore && clientFilteredCards.length > 0 && (
                <span className="text-sm text-muted-foreground">You've reached the end of the results.</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Sidebar — slides in when any cards are selected */}
      {sidebarOpen && (
        <div className="w-80 shrink-0 sticky top-0 h-screen">
          <SelectedCardsSidebar
            cards={selectedCards}
            onRemove={(cardId) => setSelectedCardIds(prev => { const n = new Set(prev); n.delete(cardId); return n; })}
            onClearAll={() => setSelectedCardIds(new Set())}
            onHide={() => setSelectedCardIds(new Set())}
            onTransferComplete={() => { setSelectedCardIds(new Set()); fetchCards(1, true); }}
            onDeleteComplete={() => { setSelectedCardIds(new Set()); fetchCards(1, true); }}
          />
        </div>
      )}
    </div>
  );
}
