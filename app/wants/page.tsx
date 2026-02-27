// app/wants/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  Plus,
  Share2,
  Download,
  Star,
  MoreHorizontal,
  Check,
  Clipboard
} from "lucide-react";
import { FOILING_MAP, RARITY_MAP, SET_MAP } from "@/lib/fab-constants";
import CardSearchDialog from "@/components/dialogs/cards/card-search-dialog";
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { useDarkMode } from '@/contexts/DarkModeContext';
import { WantsCard } from '@/components/wants';
// IMPORT THE TOOLTIP PROVIDER
import { TooltipProvider } from "@/components/ui/tooltip";
import { useCookieConsent } from '@/contexts/CookieConsentContext'
import { MobileAnchorAd } from "@/components/ads/mobile-anchor-ad"
import { DesktopAnchorAd } from "@/components/ads/desktop-anchor-ad"

// Client service for API calls
import { wantsClient } from "@/lib/client";

const FilterChip = ({ label, isActive, onClick, onRemove }) => (
  <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
    isActive 
      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700' 
      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
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

const AffiliateDisclosure = () => {
  const { consentOptions } = useCookieConsent()

  return (
    <div className="container mx-auto px-4 mt-4">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
        <div className="block md:flex md:items-start md:gap-2">
          <img
            src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
            alt="TCGPlayer"
            className="h-5 w-auto mb-2 md:mb-0 md:mt-0.5 md:flex-shrink-0"
          />
          <p className="text-[10px] sm:text-sm text-blue-800 dark:text-blue-200 leading-snug sm:leading-relaxed">
            {consentOptions.advertising ? (
              <>
                TCGPlayer links on this page include affiliate tracking to help support this site. You can adjust this in your <button
                  onClick={() => document.dispatchEvent(new Event('openCookiePreferences'))}
                  className="underline hover:text-blue-900 dark:hover:text-blue-100"
                >
                  cookie preferences
                </button>.
              </>
            ) : (
              <>
                Help support this site by enabling affiliate tracking in your <button
                  onClick={() => document.dispatchEvent(new Event('openCookiePreferences'))}
                  className="underline hover:text-blue-900 dark:hover:text-blue-100"
                >
                  cookie preferences
                </button>. This allows us to earn a small commission from TCGPlayer purchases at no extra cost to you.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function NewWantsPage() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    priority: null,
    rarity: null,
    foiling: null,
    set: null
  });
  const [sortBy, setSortBy] = useState("default");
  const [isCardSearchOpen, setIsCardSearchOpen] = useState(false);
  const [wantsListData, setWantsListData] = useState(null);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [isShareCopied, setIsShareCopied] = useState(false);
  const [isExportCopied, setIsExportCopied] = useState(false);

  // Fetch wants list from API
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

  // Stats calculation with same price priority as binder: low -> market -> mid -> high
  const stats = {
    totalCards: cards.length,
    highPriorityCount: cards.filter(card => card.priority === 'high').length,
    mediumPriorityCount: cards.filter(card => card.priority === 'medium').length,
    lowPriorityCount: cards.filter(card => card.priority === 'low').length,
    uniqueCards: new Set(cards.map(card => card.cardId)).size,
    totalQuantity: cards.reduce((sum, card) => sum + (card.quantity || 1), 0),
    estimatedValue: cards.reduce((total, card) => {
      // Same price priority order as binder: low -> market -> mid -> high
      const price = card.printingDetails?.tcg_low || 
                    card.printingDetails?.tcg_market ||
                    card.printingDetails?.tcg_mid ||
                    card.printingDetails?.tcg_high || 0;
      return total + (price * (card.quantity || 1));
    }, 0)
  };

  // Filter cards based on search and active filters
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

  // Sort cards
  const sortedCards = [...filteredCards].sort((a, b) => {
    if (sortBy === "price-high") {
      const aPrice = a.printingDetails?.tcg_low || 0;
      const bPrice = b.printingDetails?.tcg_low || 0;
      return bPrice - aPrice;
    }
    if (sortBy === "price-low") {
      const aPrice = a.printingDetails?.tcg_low || 0;
      const bPrice = b.printingDetails?.tcg_low || 0;
      return aPrice - bPrice;
    }
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "priority") {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return 0;
  });

  const handleQuantityChange = async (id: string, newQuantity: number) => {
    // Optimistically update UI
    setCards(prev => prev.map(card =>
      card.id === id ? { ...card, quantity: Math.max(1, newQuantity) } : card
    ));

    try {
      const result = await wantsClient.updateWantsItem(id, { quantity: Math.max(1, newQuantity) });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update quantity');
      }
    } catch (err) {
      console.error('Failed to update quantity:', err);
    }
  };

  const handlePriorityChange = async (id: string, newPriority: string) => {
    // Optimistically update UI
    setCards(prev => prev.map(card =>
      card.id === id ? { ...card, priority: newPriority } : card
    ));

    try {
      const result = await wantsClient.updateWantsItem(id, { priority: newPriority as 'high' | 'medium' | 'low' });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update priority');
      }
    } catch (err) {
      console.error('Failed to update priority:', err);
    }
  };

  const handleEdit = (card) => {
    console.log("Edit card:", card);
    // TODO: Open edit dialog
  };

  const handleRemove = async (id: string) => {
    const originalCards = cards;
    setCards(prev => prev.filter(card => card.id !== id));

    try {
      const result = await wantsClient.removeWantsItem(id);

      if (!result.success) {
        throw new Error(result.error || 'Failed to remove card');
      }
    } catch (err) {
      console.error('Failed to remove card:', err);
      setCards(originalCards);
    }
  };

  // Handle printing swap - newPrinting is the PrintingOption object from the dialog
  const handlePrintingSwap = (cardId: string, oldPrintingId: string, newPrinting: any) => {
    // Find the card in our local state
    const cardToUpdate = cards.find(c => c.id === cardId);
    if (!cardToUpdate) {
      console.error('Card not found for printing swap');
      return;
    }

    // Update the card in our local state with new printing details from the passed object
    setCards(prev => prev.map(card => {
      if (card.id === cardId) {
        return {
          ...card,
          id: newPrinting.printing_id, // Update the ID to the new printing ID
          printingDetails: {
            printing_id: newPrinting.printing_id,
            card_unique_id: newPrinting.card_unique_id,
            printing_card_id: newPrinting.printing_card_id,
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
            // Preserve all the boolean flags
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

    console.log(`Successfully swapped printing from ${oldPrintingId} to ${newPrinting.printing_id}`);
  };

const handleAddCardToWants = async ({ card, printing, quantity }: { card: any, printing: any, quantity: number }, shouldContinue = false) => {
  const printingId = printing?.printing_id || printing?.unique_id;
  if (!printingId) {
    // Assuming a toast component exists for notifications
    // toast({ title: "Error", description: "No printing was selected.", variant: "destructive" });
    console.error("No printing was selected.");
    return;
  }

  // --- 1. Perform the Optimistic UI Update ---
  // Check if this exact printing already exists in the wants list
  const existingCardIndex = cards.findIndex(c => 
    (c.printingId || c.printingDetails?.printing_id) === printingId
  );

  if (existingCardIndex !== -1) {
    // If it exists, just update the quantity
    setCards(prev => prev.map((c, index) => 
      index === existingCardIndex 
        ? { ...c, quantity: c.quantity + quantity }
        : c
    ));
  } else {
    // If it's a new card, construct the full card object and add it to the top of the list
    const newCardForUI = {
      id: printingId,
      cardId: card?.unique_id || card?.cardId,
      name: card?.name || printing?.display_name,
      quantity: quantity,
      priority: 'medium', // Default priority
      printingDetails: {
        ...printing, // Copy all details from the selected printing
        printing_id: printingId,
      }
    };
    setCards(prev => [newCardForUI, ...prev]);
  }

  if (!shouldContinue) {
    setIsCardSearchOpen(false);
  }

  // --- 2. Call the API in the background ---
  try {
    const result = await wantsClient.addWantsItem(printingId, quantity);

    if (!result.success) {
      console.error('API Error:', result.error);
      // toast({ title: "Sync Error", description: "Could not save card to server.", variant: "destructive" });
    }
  } catch (err) {
    console.error('Fetch Error:', err);
    // toast({ title: "Network Error", description: "Could not reach server.", variant: "destructive" });
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
  const highPriorityCount = cards.filter(card => card.priority === 'high').length;

  const handleExport = async () => {
    const cardList = filteredCards.map(card => {
      const set = card.printingDetails?.set?.toUpperCase() || '';
      const rarityCode = card.printingDetails?.rarity || '';
      const rarity = RARITY_MAP[rarityCode?.toLowerCase()] || rarityCode;
      const foilingCode = card.printingDetails?.foiling || 's';
      const foiling = FOILING_MAP[foilingCode?.toLowerCase()] || 'Non-foil';

      return `${card.quantity}x ${card.name} (${set}, ${rarity}, ${foiling})`;
    }).join('\n');

    try {
      await navigator.clipboard.writeText(cardList);
      setIsExportCopied(true);
      setTimeout(() => setIsExportCopied(false), 2000);
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
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
    if (!wantsListId) {
      return;
    }
    const shareUrl = `${window.location.origin}/wants/${wantsListId}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsShareCopied(true);
      setTimeout(() => setIsShareCopied(false), 2000);
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
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
  
  // Loading state
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

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">Error Loading Wants List</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Get unique values for filters
  const uniqueRarities = [...new Set(cards.map(card => card.printingDetails?.rarity).filter(Boolean))];
  const uniqueFoilings = [...new Set(cards.map(card => card.printingDetails?.foiling).filter(Boolean))];
  const uniqueSets = [...new Set(cards.map(card => card.printingDetails?.set).filter(Boolean))];
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <CardSearchDialog
        open={isCardSearchOpen}
        onOpenChange={setIsCardSearchOpen}
        onSelectCard={(data, shouldContinue) => {
          handleAddCardToWants(data, shouldContinue);
        }}
        destination="wants"
      />

      {/* Sticky Header */}
      <div className="z-10 bg-white dark:bg-gray-800 border-b shadow-sm dark:border-gray-700">
        <div className="container mx-auto px-4 py-3">
          {/* --- TOP BAR: Always Visible --- */}
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">My Wants List</h1>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsHeaderExpanded(!isHeaderExpanded)}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 md:hidden"
                aria-label={isHeaderExpanded ? "Hide details" : "Show details"}
              >
                {isHeaderExpanded 
                  ? <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" /> 
                  : <MoreHorizontal className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                }
              </button>
              <DarkModeToggle />
            </div>
          </div>
          
          {/* --- PRIMARY ACTION: ADD CARD --- */}
          <Button 
            className="w-full h-11 text-base bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 mb-4" 
            onClick={() => setIsCardSearchOpen(true)}
          >
            <Plus className="w-5 h-5 mr-2" />
            Add a Card to Your Wants
          </Button>

          {/* --- MAIN COLLAPSIBLE AREA for All Secondary Controls --- */}
          <div className={`${isHeaderExpanded ? 'block' : 'hidden'} md:block`}>
            
            {/* Stats Section */}
            <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:flex md:items-center md:gap-4">
              <Badge className="bg-blue-500 text-white col-span-1 justify-center py-1.5 md:py-1">{stats.totalCards} unique cards</Badge>
              <div className="text-gray-600 dark:text-gray-400 col-span-1 flex items-center justify-center md:justify-start">{stats.totalQuantity} total copies</div>
              <div className="flex flex-wrap gap-2 col-span-2 justify-center md:justify-start">
                {stats.highPriorityCount > 0 && <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">{stats.highPriorityCount} high priority</Badge>}
                {stats.mediumPriorityCount > 0 && <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">{stats.mediumPriorityCount} medium priority</Badge>}
                {stats.lowPriorityCount > 0 && <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">{stats.lowPriorityCount} low priority</Badge>}
              </div>
              {stats.estimatedValue > 0 && <div className="text-green-600 dark:text-green-400 font-semibold col-span-2 text-center md:text-left">~${stats.estimatedValue.toFixed(2)} (TCG Low)</div>}
            </div>

            {/* Filter, Search, and Sort Controls */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              {/* Left side: Filter and Search */}
              <div className="flex flex-col md:flex-row items-center gap-3 flex-grow">
                {/* Filter Button */}
                <button onClick={() => setFiltersExpanded(!filtersExpanded)} className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-gray-900 dark:text-gray-100 w-full md:w-auto">
                  <Filter className="w-4 h-4" />
                  <span>Filters</span>
                  {activeFilterCount > 0 && <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">{activeFilterCount}</Badge>}
                  {filtersExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {/* Search Input */}
                <div className="relative w-full md:w-auto md:flex-grow">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                  <Input
                    placeholder="Filter by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 w-full bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              {/* Right side: Sort Dropdown */}
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full md:w-auto px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center md:text-left">
                <option value="default">Sort: Default</option>
                <option value="priority">Sort: Priority</option>
                <option value="price-high">Sort: Price (High to Low)</option>
                <option value="price-low">Sort: Price (Low to High)</option>
                <option value="name">Sort: Name</option>
              </select>
            </div>

            {/* Expandable Filters */}
            {filtersExpanded && (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="space-y-3">
                  {/* Priority Filters */}
                  <div><span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Priority:</span><div className="flex gap-2 flex-wrap">{['high', 'medium', 'low'].map(p => <FilterChip key={p} label={`${p.charAt(0).toUpperCase() + p.slice(1)} (${cards.filter(c => c.priority === p).length})`} isActive={activeFilters.priority === p} onClick={() => setFilter('priority', p)} onRemove={() => clearFilter('priority')} />)}</div></div>
                  {/* Rarity Filters */}
                  <div><span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Rarity:</span><div className="flex gap-2 flex-wrap">{uniqueRarities.map(r => <FilterChip key={r} label={`${RARITY_MAP[r?.toLowerCase()] || r} (${cards.filter(c => c.printingDetails?.rarity === r).length})`} isActive={activeFilters.rarity === r} onClick={() => setFilter('rarity', r)} onRemove={() => clearFilter('rarity')} />)}</div></div>
                  {/* Foiling Filters */}
                  <div><span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Foiling:</span><div className="flex gap-2 flex-wrap">{uniqueFoilings.map(f => <FilterChip key={f} label={`${FOILING_MAP[f?.toLowerCase()] || f} (${cards.filter(c => c.printingDetails?.foiling === f).length})`} isActive={activeFilters.foiling === f} onClick={() => setFilter('foiling', f)} onRemove={() => clearFilter('foiling')} />)}</div></div>
                  {/* Set Filters */}
                  <div><span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Set:</span><div className="flex gap-2 flex-wrap">{uniqueSets.map(s => <FilterChip key={s} label={`${SET_MAP[s?.toLowerCase()] || s?.toUpperCase()} (${cards.filter(c => c.printingDetails?.set === s).length})`} isActive={activeFilters.set === s} onClick={() => setFilter('set', s)} onRemove={() => clearFilter('set')} />)}</div></div>
                  {activeFilterCount > 0 && <button onClick={clearAllFilters} className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline">Clear all filters</button>}
                </div>
              </div>
            )}

            {/* Secondary Actions */}
            {highPriorityCount > 0 && (
              <div className="flex gap-2 justify-center md:justify-start md:ml-auto flex-wrap">
                <Button variant="outline" size="sm" onClick={() => setFilter('priority', 'high')} className="border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                  <Star className="w-4 h-4 mr-1" /> High Priority ({highPriorityCount})
                </Button>
              </div>
            )}
          </div>

          {/* --- Item Count with Export and Share Buttons --- */}
          <div className="flex items-center justify-between gap-2 mt-3 text-sm">
            <span className="text-gray-600 dark:text-gray-400">Showing {sortedCards.length} of {cards.length}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className={`transition-all duration-200 ${
                  isExportCopied
                    ? 'bg-green-100 dark:bg-green-900/30 border-green-500 dark:border-green-600 text-green-700 dark:text-green-300'
                    : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {isExportCopied ? (
                  <>
                    <Check className="w-4 h-4 md:mr-1" />
                    <span className="hidden md:inline">Copied!</span>
                  </>
                ) : (
                  <>
                    <Clipboard className="w-4 h-4 md:mr-1" />
                    <span className="hidden md:inline">Export</span>
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className={`transition-all duration-200 ${
                  isShareCopied
                    ? 'bg-green-100 dark:bg-green-900/30 border-green-500 dark:border-green-600 text-green-700 dark:text-green-300'
                    : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {isShareCopied ? (
                  <>
                    <Check className="w-4 h-4 md:mr-1" />
                    <span className="hidden md:inline">Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 md:mr-1" />
                    <span className="hidden md:inline">Share</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Affiliate Disclosure */}
      <AffiliateDisclosure />

      {/* Cards Grid */}
      <TooltipProvider>
        <div className="container mx-auto px-2 py-4">
          {sortedCards.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100">No cards found</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">Try adjusting your search or filters</p>
              <Button onClick={clearAllFilters} variant="outline" className="border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-1.5">
              {sortedCards.map((card) => (
                <WantsCard
                  key={`${card.id}-${card.printingDetails?.printing_id || card.id}`}
                  card={card}
                  onQuantityChange={handleQuantityChange}
                  onPriorityChange={handlePriorityChange}
                  onEdit={handleEdit}
                  onRemove={handleRemove}
                  onPrintingSwap={handlePrintingSwap}
                />
              ))}
            </div>
          )}
        </div>
      </TooltipProvider>

      {/* Desktop Video-Capable Ad - Shows at bottom on desktop only */}
      <DesktopAnchorAd />

      {/* Mobile Anchor Ad - Shows at bottom on mobile only */}
      <MobileAnchorAd />
    </div>
  );
}
