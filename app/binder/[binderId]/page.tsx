// app/binder/[binderId]/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Plus, Search, Filter, ChevronDown, ChevronUp, Loader2, ArrowLeftRight, Package, SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useInView } from 'react-intersection-observer';
import { useDebounce } from 'use-debounce';

// Components
import BinderCard from "@/components/binder/BinderCard";
import CardSearchDialog from "@/components/dialogs/cards/card-search-dialog";
import EditCardDialog from "@/components/binder/EditCardDialog";
import TransferCardsDialog from "@/components/binder/TransferCardsDialog";
import PrintingSwapDialog from '@/components/dialogs/cards/printing-swap-dialog';
import SelectedCardsSidebar from "@/components/binder/SelectedCardsSidebar";
import BinderSettings from "@/components/binder/binder-settings";
import BinderStats from "@/components/binder/BinderStats";
import { BinderSearchAndFilters } from "@/components/binder/BinderSearchAndFilters";
import { BinderFilterSidebar } from "@/components/binder/BinderFilterSidebar";
import { LoadingScreen } from "@/components/binder/LoadingScreen";
import { ErrorScreen } from "@/components/binder/ErrorScreen";
import { BinderHeader } from "@/components/binder/BinderHeader";
import { ShareBinderButton } from "@/components/binder/ShareBinderButton"; 
import DeleteSelectedDialog from "@/components/binder/DeleteSelectedDialog";
import { AccessDeniedScreen } from "@/components/binder/AccessDeniedScreen";
import { AffiliateDisclosure } from '@/components/shared/AffiliateDisclosure'
import { ExportModal } from '@/components/binder/ExportModal';
// import { WantsListSidebar } from "@/components/binder/WantsListSidebar";
import { TradeRequestSidebar } from "@/components/binder/TradeRequestSidebar";
import { MobileTradeRequestSheet } from "@/components/binder/MobileTradeRequestSheet";
import { MobileSelectedCardsSheet } from "@/components/binder/MobileSelectedCardsSheet";
import { MobileAnchorAd } from "@/components/ads/mobile-anchor-ad";
import { DesktopAnchorAd } from "@/components/ads/desktop-anchor-ad";
import { getSetImageOrFallback } from "@/lib/set-images";
import { CARD_FILTER_SETS } from "@/lib/fab-constants/sets";

const CHORD_SETS = CARD_FILTER_SETS;
const CHORD_CLASSES = ['generic','adjudicator','assassin','bard','brute','guardian','illusionist','mechanologist','merchant','necromancer','ninja','pirate','ranger','runeblade','shapeshifter','thief','warrior','wizard'] as const;

  const useWindowWidth = () => {
    const [width, setWidth] = useState(0);
    useEffect(() => {
      const handleResize = () => setWidth(window.innerWidth);
      handleResize(); // Set initial width
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);
    return width;
};


// Services for client-side mutations and initial binder fetch
import { BinderActions } from "@/lib/services/binderActions";
import { BinderService } from "@/lib/services/binderService";

// Client service for API calls
import { bindersClient } from "@/lib/client";

export default function BinderPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const binderId = params.binderId as string;
  const windowWidth = useWindowWidth();

  // Ref to track the last clicked card for scroll preservation
  const lastClickedCardRef = React.useRef<string | null>(null);
  const cardRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());

  // --- REFACTORED STATE FOR PAGINATION ---
  const [binder, setBinder] = useState<any>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination and infinite scroll state
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalCards: 0, limit: 200 });
  const [loadingMore, setLoadingMore] = useState(false);
  const { ref: infiniteScrollRef, inView} = useInView({ threshold: 0.5 });

  // UI state for search, sort, and filters (sent to API)
  const [activeTab, setActiveTab] = useState("cards");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery] = useDebounce(searchQuery, 500);
  const [activeFilters, setActiveFilters] = useState<Record<string, string | null>>({});
  const [sortBy, setSortBy] = useState("tcg-low-desc");
  
  // Dialog and sidebar state
  const [isCardSearchOpen, setIsCardSearchOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<any>(null);
  const [printingSwapCard, setPrintingSwapCard] = useState<any>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [deleteSelectedDialogOpen, setDeleteSelectedDialogOpen] = useState(false);
  const [selectedCards, setSelectedCards] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [filterSidebarVisible, setFilterSidebarVisible] = useState(true);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<Date | null>(null);
  const [chordMode, setChordMode] = useState<null | 'select' | 'rarity' | 'foiling' | 'set' | 'class' | 'clear'>(null);
  const [setBuffer, setSetBuffer] = useState('');

  // Mobile state
  const [isMobileTradeSheetOpen, setIsMobileTradeSheetOpen] = useState(false);

  // Ad refresh state - increment to force ad refresh
  const [adRefreshKey, setAdRefreshKey] = useState(0);





  // Metadata state from API
  const [uniqueValues, setUniqueValues] = useState({
    rarities: [], foilings: [], sets: [], conditions: []
  });
  const [counts, setCounts] = useState({
    forTrade: 0,
    notForTrade: 0,
  });

  // Use isOwner field if available, fallback to user ID comparison
  const editable = user && binder && (binder.isOwner || user.id === binder.userId);

  const handleExportList = () => {
    setExportModalOpen(true);
  };

  // Client-side filter function
  const filterCardsClient = (cardsToFilter: any[], filters: Record<string, string | null>, search: string) => {
    return cardsToFilter.filter(card => {
      // Search filter - checks both name and type (both lowercase in DB)
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesName = card.name?.includes(searchLower);
        const matchesType = card.type_text?.includes(searchLower);

        if (!matchesName && !matchesType) {
          return false;
        }
      }

      // Exact match filters
      if (filters.rarity && card.rarity !== filters.rarity) return false;
      if (filters.foiling && card.foiling !== filters.foiling) return false;
      if (filters.set && card.set !== filters.set) return false;
      if (filters.condition && card.condition !== filters.condition) return false;

      // Boolean filters
      if (filters.forTrade === 'true' && !card.forTrade) return false;
      if (filters.forTrade === 'false' && card.forTrade) return false;

      return true;
    });
  };

  // Client-side sort function
  const sortCardsClient = (cardsToSort: any[], sortOption: string) => {
    const sorted = [...cardsToSort];

    switch (sortOption) {
      case 'name':
        return sorted.sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));
      case 'quantity-desc':
        return sorted.sort((a, b) => (b.quantity || 0) - (a.quantity || 0));
      case 'quantity-asc':
        return sorted.sort((a, b) => (a.quantity || 0) - (b.quantity || 0));
      case 'tcg-market-desc':
        return sorted.sort((a, b) => (b.tcg_market || 0) - (a.tcg_market || 0));
      case 'tcg-market-asc':
        return sorted.sort((a, b) => (a.tcg_market || 0) - (b.tcg_market || 0));
      case 'tcg-low-desc':
        return sorted.sort((a, b) => (b.tcg_low || 0) - (a.tcg_low || 0));
      case 'tcg-low-asc':
        return sorted.sort((a, b) => (a.tcg_low || 0) - (b.tcg_low || 0));
      default:
        // Default sort by addedAt descending
        return sorted.sort((a, b) => {
          const dateA = new Date(a.addedAt || 0).getTime();
          const dateB = new Date(b.addedAt || 0).getTime();
          return dateB - dateA;
        });
    }
  };



  const fetchCards = async (page = 1, shouldReset = false) => {
    if (loadingMore || (loading && page > 1)) return;
    if (page > 1) setLoadingMore(true); else setLoading(true);

    try {
      const filters = {
        search: debouncedSearchQuery || undefined,
        ...Object.fromEntries(
          Object.entries(activeFilters).filter(([, value]) => value)
        ),
      };

      const options = {
        page,
        limit: 200,
        sortBy,
      };

      const result = await bindersClient.getBinderCards(binderId, filters, options);

      if (!result.success) throw new Error(result.error || 'Failed to fetch cards');

      const data = result.data;

      // Update cards directly (server-side filtering)
      setCards(prev => (shouldReset ? data.cards : [...prev, ...data.cards]));
      setPagination(data.pagination);

      if (data.metadata) {
        if (data.metadata.counts) setCounts(data.metadata.counts);
        if (data.metadata.uniqueValues) setUniqueValues(data.metadata.uniqueValues);
        if (data.metadata.stats) {
          setBinder(prev => ({
            ...prev,
            stats: data.metadata.stats
          }));
        }
        if (data.metadata.priceUpdatedAt) {
          setPriceUpdatedAt(new Date(data.metadata.priceUpdatedAt));
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // --- USEEFFECT HOOKS ---
  useEffect(() => {
    const fetchBinderDetails = async () => {
      try {
        setLoading(true);
        const result = await BinderService.fetchBinder(binderId, router);
        if (result.shouldRedirect) return;
        setBinder(result.binder);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (binderId) fetchBinderDetails();
  }, [binderId, router]);

  useEffect(() => {
    if (binder?._id) {
      fetchCards(1, true);
    }
  }, [binder?._id]);

  // Refetch when filters change
  useEffect(() => {
    if (binder) {
      fetchCards(1, true);
    }
  }, [debouncedSearchQuery, activeFilters, sortBy]);

  // Infinite scroll for server-side pagination
  useEffect(() => {
    const hasMore = pagination.page < pagination.totalPages;
    if (inView && hasMore && !loading && !loadingMore) {
      fetchCards(pagination.page + 1);
    }
  }, [inView, pagination, loading, loadingMore]);

  useEffect(() => {
    const wasOpen = sidebarOpen;
    const shouldBeOpen = selectedCards.length > 0;
    setSidebarOpen(shouldBeOpen);
  }, [selectedCards.length]);

  // Separate effect to handle scrolling to the clicked card
  useEffect(() => {
    if (lastClickedCardRef.current && selectedCards.length > 0) {
      const clickedCardId = lastClickedCardRef.current;

      // Wait for the CSS transition to complete (300ms + buffer)
      setTimeout(() => {
        const cardElement = cardRefs.current.get(clickedCardId);
        if (cardElement) {
          // Get the card's position
          const cardTop = cardElement.getBoundingClientRect().top;
          const scrollOffset = window.scrollY;

          // Scroll with offset to account for navbar (80px) + some padding (20px)
          const targetPosition = cardTop + scrollOffset - 100;

          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        }
      }, 350); // Wait for the 300ms transition + 50ms buffer
    }
  }, [selectedCards]);

  // --- FILTER MANAGEMENT ---
  const setFilter = (type: string, value: string) => setActiveFilters(prev => ({ ...prev, [type]: value }));
  const clearFilter = (type: string) => setActiveFilters(prev => { const newFilters = { ...prev }; delete newFilters[type]; return newFilters; });
  const clearAllFilters = () => { setSearchQuery(""); setActiveFilters({}); };

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length + (searchQuery ? 1 : 0);

  // --- CMD+K CHORD SHORTCUT (letter · 1→rarity · 2→foiling) ---
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const resetChord = () => { setChordMode(null); setSetBuffer(''); clearTimeout(timeout); };
    const startTimeout = () => { clearTimeout(timeout); timeout = setTimeout(resetChord, 2000); };

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setChordMode('select');
        startTimeout();
        return;
      }

      if (e.key === 'Escape') { resetChord(); return; }
      if (!chordMode || isTyping) return;

      e.preventDefault();

      if (chordMode === 'select') {
        if (e.key === '1') { setChordMode('rarity'); startTimeout(); return; }
        if (e.key === '2') { setChordMode('foiling'); startTimeout(); return; }
        if (e.key === '3') { setChordMode('set'); setSetBuffer(''); startTimeout(); return; }
        if (e.key === '4') { setChordMode('class'); setSetBuffer(''); startTimeout(); return; }
        if (e.key === '0') { setChordMode('clear'); startTimeout(); return; }
        if (e.key === '9') { if (editable) setIsCardSearchOpen(true); resetChord(); return; }
        const letter = e.key.toUpperCase();
        if (/^[A-Z]$/.test(letter)) {
          setActiveTab('cards');
          activeFilters.startsWith === letter ? clearFilter('startsWith') : setFilter('startsWith', letter);
        }
        resetChord();
        return;
      }

      if (chordMode === 'rarity') {
        const RARITY_KEYS: Record<string, string> = { F: 'f', V: 'v', L: 'l', M: 'm', P: 'p', S: 's', R: 'r', C: 'c', B: 'b', T: 't' };
        const code = RARITY_KEYS[e.key.toUpperCase()];
        if (code) {
          setActiveTab('cards');
          activeFilters.rarity === code ? clearFilter('rarity') : setFilter('rarity', code);
        }
        resetChord();
        return;
      }

      if (chordMode === 'foiling') {
        const FOILING_KEYS: Record<string, string> = { R: 'r', C: 'c', G: 'g', S: 's' };
        const code = FOILING_KEYS[e.key.toUpperCase()];
        if (code) {
          setActiveTab('cards');
          activeFilters.foiling === code ? clearFilter('foiling') : setFilter('foiling', code);
        }
        resetChord();
        return;
      }

      if (chordMode === 'set') {
        if (e.key === 'Backspace') {
          setSetBuffer(prev => prev.slice(0, -1));
          startTimeout();
          return;
        }
        const char = e.key.toLowerCase();
        if (/^[a-z0-9]$/.test(char)) {
          const next = setBuffer + char;
          setSetBuffer(next);
          if ((CHORD_SETS as readonly string[]).includes(next)) {
            setActiveTab('cards');
            activeFilters.set === next ? clearFilter('set') : setFilter('set', next);
            resetChord();
          } else if (!(CHORD_SETS as readonly string[]).some(s => s.startsWith(next))) {
            setSetBuffer(''); // invalid prefix — reset buffer but stay in set mode
            startTimeout();
          } else {
            startTimeout();
          }
        }
        return;
      }

      if (chordMode === 'class') {
        if (e.key === 'Backspace') {
          setSetBuffer(prev => prev.slice(0, -1));
          startTimeout();
          return;
        }
        const char = e.key.toLowerCase();
        if (/^[a-z]$/.test(char)) {
          const next = setBuffer + char;
          setSetBuffer(next);
          const matches = (CHORD_CLASSES as readonly string[]).filter(c => c.startsWith(next));
          if (matches.length === 1) {
            setActiveTab('cards');
            activeFilters.class === matches[0] ? clearFilter('class') : setFilter('class', matches[0]);
            resetChord();
          } else if (matches.length === 0) {
            setSetBuffer('');
            startTimeout();
          } else {
            startTimeout();
          }
        }
        return;
      }

      if (chordMode === 'clear') {
        if (e.key === '0') {
          clearAllFilters();
        }
        resetChord();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); clearTimeout(timeout); };
  }, [chordMode, activeFilters, setBuffer]);

  // --- ACTION HANDLERS ---
  const refreshCurrentView = () => fetchCards(1, true);

  const handleRefreshStats = async () => {
    // Re-fetch binder to get updated stats
    const result = await BinderService.fetchBinder(binderId, router);
    if (!result.shouldRedirect) {
      setBinder(result.binder);
    }
    // Also refresh the cards view to show any changes
    refreshCurrentView();
  };

const handleBulkToggleForTrade = async (forTrade: boolean) => {
  // 1. Preserve the original binder state
  const originalBinder = { ...binder };
  const originalCards = [...cards];

  // Calculate total cards
  const totalCards = binder?.stats?.totalCards || binder?.totalQuantity || cards.length;

  const optimisticallyUpdatedBinder = {
    ...binder,
    stats: {
      ...binder.stats,
      totalCards: totalCards,
      forTradeCount: forTrade ? totalCards : 0,
    },
    quantityForTrade: forTrade ? totalCards : 0,
    quantityNotForTrade: forTrade ? 0 : totalCards,
  };

  // --- ADD THESE TWO LOGS ---
  console.log("Binder state BEFORE update:", originalBinder);
  console.log("Attempting to set new binder state:", optimisticallyUpdatedBinder);
  // --- END LOGS ---

  // Set the new state for both the binder and the cards
  setBinder(optimisticallyUpdatedBinder);
  setCards(prev => prev.map(c => ({ ...c, forTrade })));

  // ... rest of the function (try/catch block) remains the same
  try {
    await BinderActions.bulkToggleForTrade(binderId, forTrade, toast);
    
    const result = await BinderService.fetchBinder(binderId, router);
    if (!result.shouldRedirect) {
      setBinder(result.binder);
    }
    refreshCurrentView();

  } catch (err) {
    toast({
      title: "Error",
      description: "Bulk update failed. Restoring previous state.",
      variant: "destructive"
    });
    setBinder(originalBinder);
    setCards(originalCards);
  }
};



//   const handleBulkToggleForTrade = async (forTrade: boolean) => {
//   // Optimistic update for the cards for a snappy UI feel
//   setCards(prev => prev.map(c => ({ ...c, forTrade })));

//   // Calculate total cards for optimistic stats update
//   const totalCards = binder?.totalQuantity || 
//                      (binder?.total_cards_with_pricing || 0) + (binder?.total_cards_without_pricing || 0) ||
//                      cards.length;

//   // Optimistically update the binder's aggregate fields directly
//   setBinder(prev => ({
//     ...prev,
//     quantityForTrade: forTrade ? totalCards : 0,
//     quantityNotForTrade: forTrade ? 0 : totalCards,
//     // Update the calculated valueForTrade/valueNotForTrade if we have total value
//     ...(prev?.totalValue?.tcg_market && {
//       valueForTrade: {
//         tcg_market: forTrade ? prev.totalValue.tcg_market : 0,
//         tcg_low: forTrade ? (prev.totalValue.tcg_low || 0) : 0,
//         tcg_mid: forTrade ? (prev.totalValue.tcg_mid || 0) : 0,
//         tcg_high: forTrade ? (prev.totalValue.tcg_high || 0) : 0,
//       },
//       valueNotForTrade: {
//         tcg_market: forTrade ? 0 : prev.totalValue.tcg_market,
//         tcg_low: forTrade ? 0 : (prev.totalValue.tcg_low || 0),
//         tcg_mid: forTrade ? 0 : (prev.totalValue.tcg_mid || 0),
//         tcg_high: forTrade ? 0 : (prev.totalValue.tcg_high || 0),
//       }
//     })
//   }));
  
//   try {
//     await BinderActions.bulkToggleForTrade(binderId, forTrade, toast);
    
//     // After a successful bulk update, re-fetch the main binder object
//     // to get the new, authoritative stats from the server
//     const result = await BinderService.fetchBinder(binderId, router);
//     if (!result.shouldRedirect) {
//       setBinder(result.binder);
//     }
    
//     // Refresh the cards to ensure consistency
//     refreshCurrentView();

//   } catch (err) {
//     toast({
//       title: "Error",
//       description: "Bulk update failed. Restoring previous state.",
//       variant: "destructive"
//     });
//     // On error, re-fetch both the binder and the cards to revert to a known good state
//     const result = await BinderService.fetchBinder(binderId, router);
//     if (!result.shouldRedirect) {
//       setBinder(result.binder);
//     }
//     refreshCurrentView();
//   }
// };

// const handleAddToWants = async () => {
//   // Optional: Any additional logic after successfully adding to wants
//   // This could include analytics tracking, showing a success message, etc.
//   console.log('Cards successfully added to wants list');
// };

const handleTradeRequestSent = async () => {
  console.log('Trade request sent successfully');
};

  const handleAddCardToBinder = async ({ card, printing, quantity, forTrade }: { card: any, printing: any, quantity: number, forTrade?: boolean }, shouldContinue = false) => {
  try {
    await BinderActions.addCardToBinder(card, printing, binder, toast, quantity, forTrade);
    refreshCurrentView();

    // Refresh the desktop anchor ad after adding a card
    setAdRefreshKey(prev => prev + 1);

    if (!shouldContinue) {
      setIsCardSearchOpen(false);
    }
    // If shouldContinue is true, dialog stays open for next card
  } catch (error) {
    console.error("Add card action failed:", error);
  }
};

  const handleEditCard = async (updates: any) => {
    const cardToEdit = editingCard;
    if (!cardToEdit) return;
    setEditingCard(null);

    const cardId = cardToEdit._id || cardToEdit.id;

    try {
      // Update the card
      const updateResult = await bindersClient.updateBinderCard(binderId, cardId, updates);
      if (!updateResult.success) throw new Error(updateResult.error || "Failed to update card.");

      // Re-fetch the updated card to get full data
      const result = await bindersClient.getBinderCard(binderId, cardId);
      if (!result.success) throw new Error("Failed to re-fetch updated card.");

      // API returns { success: true, card: {...} }, so extract the card object
      const updatedCard = (result.data as any)?.card || result.data;
      setCards(prev => prev.map(c => (c._id || c.id) === cardId ? updatedCard : c));
      toast({ title: "Card updated successfully." });
    } catch (err) {
      console.error("Failed to edit card:", err);
      toast({ title: "Error", description: "Failed to save changes. Refreshing list.", variant: "destructive" });
      refreshCurrentView();
    }
  };
  
  const handleRemove = async (cardId: string) => {
    // 1. Find the card to get its details for the toast message
    const cardToRemove = cards.find(c => (c.id || c._id) === cardId);
    const cardName = cardToRemove?.display_name || cardToRemove?.name || 'Card';
    const quantity = cardToRemove?.quantity || 1;

    // 2. Optimistic UI Update: Remove the card from state immediately
    const originalCards = [...cards];

    setCards(prev => prev.filter(c => (c.id || c._id) !== cardId));

    try {
      // 3. Call the client service to delete the inventory item
      const result = await bindersClient.deleteBinderCard(binderId, cardId);

      if (!result.success) {
        throw new Error(result.error || "Failed to remove card.");
      }

      toast({
        title: "Card removed successfully",
        description: `Removed ${quantity}x ${cardName} from your binder.`,
        duration: 3000
      });

      // After a successful removal, re-fetch the binder to get updated stats
      const binderResult = await BinderService.fetchBinder(binderId, router);
      if (!binderResult.shouldRedirect) {
        setBinder(binderResult.binder);
      }

    } catch (error: any) {
      // 4. On error, revert the optimistic update and show a toast
      setCards(originalCards);
      toast({ title: "Error", description: error.message, variant: "destructive", duration: 3000 });
    }
  };

  const handleQuantityChange = async (card: any, delta: number) => {
      const cardId = card.id || card._id;
      const newQuantity = Math.max(1, (card.quantity || 1) + delta);
      setCards(prev => prev.map(c => (c.id || c._id) === cardId ? { ...c, quantity: newQuantity } : c));
      try {
          const result = await bindersClient.updateBinderCard(binderId, cardId, { quantity: newQuantity });
          if (!result.success) {
            throw new Error(result.error);
          }
      } catch (error) {
          toast({ title: "Error", description: "Failed to update quantity.", variant: "destructive" });
          refreshCurrentView();
      }
  };
  
  const handleToggleForTrade = async (card: any, forTrade: boolean) => {
    const cardId = card.id || card._id;

    // 1. Optimistic UI Update for a snappy experience
    setCards(prev => prev.map(c =>
      (c.id || c._id) === cardId
        ? { ...c, forTrade }
        : c
    ));

    try {
      // 2. Call the client service to update the single inventory item
      const result = await bindersClient.updateBinderCard(binderId, cardId, { forTrade });

      if (!result.success) {
        throw new Error(result.error || "Failed to update card status.");
      }

    } catch (error: any) {
      // 3. On error, revert the optimistic update and show a toast
      toast({ title: "Error", description: error.message, variant: "destructive" });
      refreshCurrentView();
    }
  };

  const handlePrintingSwapComplete = async (oldCardId: string) => {
    setPrintingSwapCard(null);
    try {
      const result = await bindersClient.getBinderCard(binderId, oldCardId);
      if (!result.success) throw new Error('Failed to fetch updated card data.');

      // API returns { success: true, card: {...} }, so extract the card object
      const updatedCard = (result.data as any)?.card || result.data;
      setCards(prev => prev.map(c => ((c._id || c.id) === oldCardId) ? updatedCard : c));
      toast({ title: "Printing swapped successfully." });
    } catch (error) {
      console.error(error);
      toast({ title: "Printing swapped!", description: "Refreshing list to show changes.", variant: "default" });
      refreshCurrentView();
    }
  };

  // 3. Modify the handleCardSelect function to work for non-owners too
const handleCardSelect = (card: any) => {
  const cardId = card.id || card._id;
  const isSelected = selectedCards.some(selected => selected.id === cardId);

  // Track the clicked card for scroll preservation
  lastClickedCardRef.current = cardId;

  if (isSelected) {
    // Remove from selection
    setSelectedCards(prev => prev.filter(selected => selected.id !== cardId));
  } else {
    // Add to selection using the new flat data structure.
    // All necessary fields are already at the top level of the `card` object.
    setSelectedCards(prev => [...prev, {
      ...card, // Spread all properties from the source card
      id: cardId,
      quantity: 1,                   // Selected quantity starts at 1
      maxQuantity: card.quantity,    // Total available in binder
      // Ensure printing identification for wants API
      printingId: card.printingId ||
                  card.printingDetails?.printing_id ||
                  card.printingDetails?.unique_id ||
                  card.id,
      // Keep other essential data for dialogs
      name: card.name || card.display_name,
      printingDetails: card.printingDetails,
      // Initialize wants-specific fields
      priority: 'medium',
      notes: ''
    }]);
  }
};


const SuperSlamDisclosure = () => {
  return (
    <div className="container mx-auto px-4 mt-4">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
        <div className="flex items-start gap-3">
          <img 
            src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/e252874d-eeb0-41b9-7d17-19c117f17e00/public"
            alt="Super Slam"
            className="h-8 w-auto flex-shrink-0"
          />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Super Slam cards will be available to add to your binder on the official set release date.
          </p>
        </div>
      </div>
    </div>
  )
}

  // --- Other handlers for selected cards ---
  const handleSelectedCardQuantityChange = (cardId: string, newQuantity: number) => {
    setSelectedCards(prev => prev.map(card => card.id === cardId ? { ...card, quantity: Math.max(1, Math.min(newQuantity, card.maxQuantity)) } : card));
  };
  const handleRemoveSelectedCard = (cardId: string) => {
    setSelectedCards(prev => prev.filter(card => card.id !== cardId));
  };
  const handleClearSelected = () => setSelectedCards([]);
  const handleCopySelected = () => {
    // Implementation for copying selected cards
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const handleTransferComplete = () => { refreshCurrentView(); setSelectedCards([]); };
  const handleDeleteComplete = (deletedResults: any[]) => {

    
    const deletedCardIds = deletedResults
      .filter(result => result.success)
      .map(result => {
        const originalCard = selectedCards.find(card => card.printingId === result.printingId);
        return originalCard?.id;
      })
      .filter(Boolean);
    
    
    setSelectedCards(prev => prev.filter(card => !deletedCardIds.includes(card.id)));
    refreshCurrentView();
    if (selectedCards.length <= deletedCardIds.length) setSidebarOpen(false);
  };
  const handleSaveBinderSettings = (settings: any) =>  BinderActions.saveBinderSettings(user?.id, binderId, settings, setBinder, toast);

  // Create stats from existing binder values (until Python script adds the missing fields)
  // const stats = binder?.stats || {
  //   totalCards: binder?.total_cards_with_pricing + binder?.total_cards_without_pricing || 0,
  //   forTradeCount: 0, // TODO: Add total_for_trade field to binder and populate with Python script
  //   uniqueCards: binder?.total_cards_with_pricing + binder?.total_cards_without_pricing || 0,
  //   totalQuantity: 0, // TODO: Add total_quantity field to binder and populate with Python script  
  //   estimatedValue: binder?.total_value || 0
  // };

  const stats = {
    totalCards: binder?.stats?.totalCards || binder?.totalQuantity || 0,
    forTradeCount: binder?.stats?.forTradeCount || binder?.quantityForTrade || 0,
    uniqueCards: binder?.stats?.uniqueCards || 0,
    totalQuantity: binder?.stats?.totalQuantity || binder?.totalQuantity || 0,
    estimatedValue: binder?.totalValue?.tcg_low || binder?.stats?.estimatedValue || 0
  };


  const isMobile = windowWidth > 0 && windowWidth < 768;

  const recipientInfo = cards.length > 0 ? {
    id: cards[0].userId,
    username: cards[0].discordUsername,
    discordId: cards[0].discordId 
  } : {
    id: binder?.userId, // Fallback to binder's userId
    username: binder?.user?.username || binder?.username || 'the user',
    discordId: binder?.user?.discordId || null // Fallback
  };




  // --- RENDER LOGIC ---
  if (authLoading || (loading && !binder)) return <LoadingScreen />;
  if (error) {
    if (error.includes('permission') || error.includes('Access denied') || error.includes('do not have permission')) {
      return <AccessDeniedScreen />;
    }
    return <ErrorScreen error={error} />;
  }
  if (!binder) return null;

    return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-[60px] sm:pb-0">
      {/* DIALOGS */}
      <CardSearchDialog 
        open={isCardSearchOpen} 
        onOpenChange={setIsCardSearchOpen} 
        onSelectCard={(data, shouldContinue) => { 
          handleAddCardToBinder(data, shouldContinue); 
        }} 
        destination="binder" 
      />
      {editingCard && <EditCardDialog card={editingCard} open={!!editingCard} onOpenChange={(open) => !open && setEditingCard(null)} onSave={handleEditCard} />}
      <TransferCardsDialog 
        open={transferDialogOpen} 
        onOpenChange={setTransferDialogOpen} 
        selectedCards={selectedCards} 
        sourceBinderId={binderId} 
        onTransferComplete={handleTransferComplete} 
      />
      <DeleteSelectedDialog open={deleteSelectedDialogOpen} onOpenChange={setDeleteSelectedDialogOpen} selectedCards={selectedCards} binderId={binderId} onDeleteComplete={handleDeleteComplete} />
      {printingSwapCard && (
        <PrintingSwapDialog
          open={!!printingSwapCard}
          onOpenChange={(open) => !open && setPrintingSwapCard(null)}
          currentPrinting={{
            printingId: printingSwapCard.printingId || printingSwapCard.printingDetails?.printing_id,
            cardUniqueId: printingSwapCard.card_unique_id || printingSwapCard.cardId || printingSwapCard.printingDetails?.card_unique_id,
            cardName: printingSwapCard.display_name || printingSwapCard.name || 'Unknown Card'
          }}
          onSwap={async (newPrinting) => {
            const result = await bindersClient.updateBinderCard(
              binderId,
              printingSwapCard._id || printingSwapCard.id,
              {
                action: 'swapPrinting',
                newPrintingId: newPrinting.printing_id,
              }
            );
            return { success: result.success, error: result.success ? undefined : result.error };
          }}
          onSwapComplete={() => handlePrintingSwapComplete(printingSwapCard._id || printingSwapCard.id)}
        />
      )}
      <ExportModal
        binderId={binderId}
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        isOwner={editable}
      />

      <AffiliateDisclosure />
      {/* <SuperSlamDisclosure /> */}

      <div className="container mx-auto px-4 py-4 overflow-x-hidden">
        <div className={`transition-all duration-300 ${!isMobile && sidebarOpen ? 'max-w-[calc(100%-18rem)]' : 'max-w-full'}`}>
          <BinderHeader
            binder={binder}
            stats={stats}
            editable={editable}
            selectedCards={selectedCards}
            onAddCard={() => {
              setIsCardSearchOpen(true);
            }}
            onOpenSidebar={() => setSidebarOpen(true)}
            onExportList={handleExportList}
            onRefreshStats={handleRefreshStats}
            cardsCount={pagination?.totalCards || 0}
            priceUpdatedAt={priceUpdatedAt}
          />
          
          {/* Two-column flex layout: filter sidebar + main content */}
          <div className="flex gap-8 items-start">

            {/* LEFT: filter sidebar — desktop only */}
            {filterSidebarVisible && (
              <BinderFilterSidebar
                activeFilters={activeFilters}
                activeFilterCount={activeFilterCount}
                setFilter={setFilter}
                clearFilter={clearFilter}
                clearAllFilters={clearAllFilters}
              />
            )}

            {/* RIGHT: main content */}
            <div className="flex-1 min-w-0">

              {/* Mobile: existing collapsible filters */}
              <div className="md:hidden">
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
              </div>

              {/* Desktop top bar: search + Hide/Show Filters + Sort By */}
              <div className="hidden md:flex items-center gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Filter by card name or type"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <button
                  onClick={() => setFilterSidebarVisible(v => !v)}
                  className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 whitespace-nowrap transition-colors"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  {filterSidebarVisible ? 'Hide Filters' : 'Show Filters'}
                </button>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
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

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className={`grid w-full ${editable ? 'grid-cols-3' : 'grid-cols-2'} mb-6`}>
                  <TabsTrigger value="cards" className="text-xs sm:text-sm">
                    Cards ({pagination?.totalCards || 0})
                  </TabsTrigger>
                  <TabsTrigger value="stats" className="text-xs sm:text-sm">Statistics</TabsTrigger>
                  {editable && <TabsTrigger value="settings" className="text-xs sm:text-sm">Settings</TabsTrigger>}
                </TabsList>

                <TabsContent value="cards">
                  {/* Set picker overlay */}
                  {chordMode === 'set' && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setChordMode(null); setSetBuffer(''); }}>
                      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-2xl w-full max-w-2xl mx-4" onClick={e => e.stopPropagation()}>
                        <div className="text-center mb-5">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Type set code — Esc to cancel</p>
                          <div className="text-4xl font-bold font-mono tracking-widest text-blue-500 dark:text-blue-400 min-h-[3rem]">
                            {setBuffer ? setBuffer.toUpperCase() : <span className="opacity-20">___</span>}
                          </div>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                          {CHORD_SETS.map(setKey => {
                            const matches = setBuffer === '' || setKey.startsWith(setBuffer);
                            return (
                              <button
                                key={setKey}
                                onClick={() => {
                                  setActiveTab('cards');
                                  activeFilters.set === setKey ? clearFilter('set') : setFilter('set', setKey);
                                  setChordMode(null); setSetBuffer('');
                                }}
                                className={`flex flex-col items-center p-2 rounded-xl border transition-all ${
                                  activeFilters.set === setKey
                                    ? 'border-gray-900 dark:border-gray-100 ring-2 ring-gray-900 dark:ring-gray-100'
                                    : matches
                                      ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                                      : 'border-gray-200 dark:border-gray-700 opacity-25'
                                }`}
                              >
                                <img src={getSetImageOrFallback(setKey, setKey.toUpperCase())} alt={setKey.toUpperCase()} className="w-14 h-14 object-contain" />
                                <span className="text-xs font-semibold mt-1 uppercase tracking-wide">{setKey}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Class picker overlay */}
                  {chordMode === 'class' && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setChordMode(null); setSetBuffer(''); }}>
                      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-2xl w-full max-w-xl mx-4" onClick={e => e.stopPropagation()}>
                        <div className="text-center mb-5">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Type class name — Esc to cancel</p>
                          <div className="text-4xl font-bold font-mono tracking-widest text-blue-500 dark:text-blue-400 min-h-[3rem]">
                            {setBuffer ? setBuffer : <span className="opacity-20">type...</span>}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {CHORD_CLASSES.map(cls => {
                            const matches = setBuffer === '' || cls.startsWith(setBuffer);
                            const isActive = activeFilters.class === cls;
                            return (
                              <button
                                key={cls}
                                onClick={() => {
                                  setActiveTab('cards');
                                  isActive ? clearFilter('class') : setFilter('class', cls);
                                  setChordMode(null); setSetBuffer('');
                                }}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all capitalize ${
                                  isActive
                                    ? 'border-gray-900 dark:border-gray-100 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                                    : matches
                                      ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                                      : 'border-gray-200 dark:border-gray-700 opacity-25'
                                }`}
                              >
                                {cls}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Chord mode hints for rarity / foiling */}
                  {chordMode === 'rarity' && (
                    <div className="flex flex-wrap gap-2 mb-4 p-2 rounded-md ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900">
                      <span className="w-full text-xs text-blue-500 dark:text-blue-400 font-medium">Rarity — press a key:</span>
                      {[['F','Fabled'],['V','Marvel'],['L','Legendary'],['M','Majestic'],['P','Promo'],['S','Super Rare'],['R','Rare'],['C','Common'],['B','Basic'],['T','Token']].map(([key, label]) => (
                        <span key={key} className="px-2 py-1 text-xs rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">{key} = {label}</span>
                      ))}
                    </div>
                  )}
                  {chordMode === 'clear' && (
                    <div className="flex flex-wrap gap-2 mb-4 p-2 rounded-md ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900">
                      <span className="w-full text-xs text-blue-500 dark:text-blue-400 font-medium">Press 0 again to clear all filters</span>
                    </div>
                  )}
                  {chordMode === 'foiling' && (
                    <div className="flex flex-wrap gap-2 mb-4 p-2 rounded-md ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900">
                      <span className="w-full text-xs text-blue-500 dark:text-blue-400 font-medium">Foiling — press a key:</span>
                      {[['R','Rainbow'],['C','Cold'],['G','Gold'],['S','Non-foil']].map(([key, label]) => (
                        <span key={key} className="px-2 py-1 text-xs rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">{key} = {label}</span>
                      ))}
                    </div>
                  )}

                  {/* Alphabet filter strip */}
                  <div className={`flex flex-wrap gap-1 mb-4 rounded-md transition-all ${chordMode === 'select' ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900 p-1' : ''}`}>
                    {chordMode === 'select' && (
                      <span className="w-full text-xs text-blue-500 dark:text-blue-400 font-medium mb-1">1 = Rarity · 2 = Foiling · 3 = Set · 4 = Class · 9 = Add Card · 0 = Clear · or type a letter</span>
                    )}
                    {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => {
                      const isActive = activeFilters.startsWith === letter;
                      return (
                        <button
                          key={letter}
                          onClick={() => isActive ? clearFilter('startsWith') : setFilter('startsWith', letter)}
                          className={`w-7 h-7 text-xs font-medium rounded transition-colors ${
                            isActive
                              ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                              : chordMode === 'select'
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/50'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                        >
                          {letter}
                        </button>
                      );
                    })}
                  </div>

                  {loading && !cards.length ? <LoadingScreen message="Applying filters..." />
                  : cards.length === 0 ? (
                    <div className="text-center py-12 bg-card rounded-lg border">
                      <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium">No Cards Found</h3>
                      <p className="text-muted-foreground mb-4">Try adjusting your search or filters.</p>
                      <Button onClick={clearAllFilters} variant="outline">Clear Filters</Button>
                    </div>
                  ) : (
                    <>
                      <div
                        className={`grid gap-1.5 grid-cols-2 ${
                          filterSidebarVisible
                            ? 'md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                            : 'md:grid-cols-4 lg:grid-cols-6'
                        }`}
                      >
                        {cards.map((card) => {
                          const cardId = card.id || card._id;
                          return (
                            <div
                              key={cardId}
                              ref={(el) => {
                                if (el) {
                                  cardRefs.current.set(cardId, el);
                                } else {
                                  cardRefs.current.delete(cardId);
                                }
                              }}
                            >
                              <BinderCard
                                card={card}
                                editable={editable}
                                onEdit={setEditingCard}
                                onRemove={() => handleRemove(cardId)}
                                onOpenPrintingSwap={setPrintingSwapCard}
                                isSelected={selectedCards.some(s => s.id === cardId)}
                                onSelect={user ? () => handleCardSelect(card) : undefined}
                                selectedQty={selectedCards.find(s => s.id === cardId)?.quantity || 1}
                                maxQty={card.quantity}
                                toast={toast}
                                onQuantityIncrease={() => handleQuantityChange(card, 1)}
                                onQuantityDecrease={() => handleQuantityChange(card, -1)}
                                onToggleForTrade={handleToggleForTrade}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <div ref={infiniteScrollRef} className="h-10 flex justify-center items-center mt-4">
                        {loadingMore && <Loader2 className="h-6 w-6 animate-spin" />}
                        {!loadingMore && pagination.page >= pagination.totalPages && cards.length > 0 && (
                          <span className="text-sm text-muted-foreground">You've reached the end of the results.</span>
                        )}
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="stats">
                  <BinderStats
                    binder={binder}
                    stats={stats}
                    loading={loading}
                    editable={editable}
                    onOpenSettings={() => setActiveTab("settings")}
                  />
                </TabsContent>

                {editable && (
                  <TabsContent value="settings">
                    <ShareBinderButton binder={binder} cards={cards} className="bg-secondary text-secondary-foreground hover:bg-secondary/80" />
                    <BinderSettings
                      binder={{
                        id: binderId,
                        name: binder?.name,
                        description: binder?.description,
                        isPublic: binder?.isPublic,
                        thumbnailPrintingId: binder?.thumbnailPrintingId,
                        visibility: binder?.visibility
                      }}
                      onSave={handleSaveBinderSettings}
                      onSetAllForTrade={handleBulkToggleForTrade}
                      loading={loading || loadingMore}
                    />
                  </TabsContent>
                )}
              </Tabs>
            </div>
          </div>
        </div>

        {/* --- NEW CONDITIONAL RENDERING FOR SIDEBARS --- */}
        {!isMobile && (
          editable ? (
            // Desktop Owner's sidebar
            <SelectedCardsSidebar
              selectedCards={selectedCards}
              sidebarOpen={sidebarOpen}
              onCloseSidebar={() => setSidebarOpen(false)}
              onQuantityChange={handleSelectedCardQuantityChange}
              onRemoveSelected={(index) => {
                const cardToRemove = selectedCards[index];
                if (cardToRemove) handleRemoveSelectedCard(cardToRemove.id);
              }}
              onClearSelected={handleClearSelected}
              onTransfer={() => setTransferDialogOpen(true)}
              onCopySelected={handleCopySelected}
              onDeleteSelected={() => setDeleteSelectedDialogOpen(true)} 
              copied={copied}
              editable={editable}
            />
          ) : user ? (
            // Desktop Non-owner's sidebar
            <TradeRequestSidebar
              selectedCards={selectedCards}
              sidebarOpen={sidebarOpen}
              recipientId={recipientInfo.id}
              recipientUsername={recipientInfo.username}
              recipientDiscordId={recipientInfo.discordId}
              onCloseSidebar={() => setSidebarOpen(false)}
              onQuantityChange={handleSelectedCardQuantityChange}
              onRemoveSelected={(index) => {
                const cardToRemove = selectedCards[index];
                if (cardToRemove) handleRemoveSelectedCard(cardToRemove.id);
              }}
              onClearSelected={handleClearSelected}
              onTradeRequestSent={handleTradeRequestSent}
            />
          ) : null
        )}
      </div>

      {/* --- MOBILE COMPONENTS FOR DIFFERENT USER TYPES --- */}
      {isMobile && user && (
        <>
          {editable && selectedCards.length > 0 ? (
            // Owner's mobile FAB and sheet
            <>
              <Button
                onClick={() => setSidebarOpen(true)}
                className="fixed bottom-6 right-6 h-16 w-16 rounded-full shadow-lg z-[60] flex flex-col items-center justify-center"
              >
                <Package className="h-6 w-6" />
                <span className="text-xs font-bold mt-1">{selectedCards.length}</span>
              </Button>

              <MobileSelectedCardsSheet
                selectedCards={selectedCards}
                isOpen={sidebarOpen}
                onOpenChange={setSidebarOpen}
                onQuantityChange={handleSelectedCardQuantityChange}
                onRemoveSelected={(index: number) => {
                  const cardToRemove = selectedCards[index];
                  if (cardToRemove) handleRemoveSelectedCard(cardToRemove.id);
                }}
                onClearSelected={handleClearSelected}
                onTransfer={() => setTransferDialogOpen(true)}
                onDeleteSelected={() => setDeleteSelectedDialogOpen(true)}
                onCopySelected={handleCopySelected}
                copied={copied}
              />
            </>
          ) : selectedCards.length > 0 ? (
            // Non-owner's mobile FAB and sheet for trade requests
            <>
              <Button
                onClick={() => setIsMobileTradeSheetOpen(true)}
                className="fixed bottom-6 right-6 h-16 w-16 rounded-full shadow-lg z-[60] flex flex-col items-center justify-center"
              >
                <ArrowLeftRight className="h-6 w-6" />
                <span className="text-xs font-bold mt-1">{selectedCards.length}</span>
              </Button>

              <MobileTradeRequestSheet
                selectedCards={selectedCards}
                isOpen={isMobileTradeSheetOpen}
                onOpenChange={setIsMobileTradeSheetOpen}
                recipientId={recipientInfo.id}
                recipientUsername={recipientInfo.username}
                recipientDiscordId={recipientInfo.discordId}
                onQuantityChange={handleSelectedCardQuantityChange}
                onRemoveSelected={(index: number) => {
                  const cardToRemove = selectedCards[index];
                  if (cardToRemove) handleRemoveSelectedCard(cardToRemove.id);
                }}
                onClearSelected={handleClearSelected}
                onTradeRequestSent={handleTradeRequestSent}
              />
            </>
          ) : null}
        </>
      )}

      {/* Desktop Video-Capable Ad - Shows at bottom on desktop only */}
      <DesktopAnchorAd key={adRefreshKey} />

      {/* Mobile Anchor Ad - Shows at bottom on mobile only */}
      <MobileAnchorAd key={adRefreshKey} />
    </div>
  );
}

//   return (
//     <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
//       {/* DIALOGS */}
//       <CardSearchDialog 
//         open={isCardSearchOpen} 
//         onOpenChange={setIsCardSearchOpen} 
//         onSelectCard={(data, shouldContinue) => { 
//           handleAddCardToBinder(data, shouldContinue); 
//         }} 
//         destination="binder" 
//       />
// {editingCard && <EditCardDialog card={editingCard} open={!!editingCard} onOpenChange={(open) => !open && setEditingCard(null)} onSave={handleEditCard} />}
// <TransferCardsDialog 
//   open={transferDialogOpen} 
//   onOpenChange={setTransferDialogOpen} 
//   selectedCards={selectedCards} 
//   sourceBinderId={binderId} 
//   onTransferComplete={handleTransferComplete} 
// />
// <DeleteSelectedDialog open={deleteSelectedDialogOpen} onOpenChange={setDeleteSelectedDialogOpen} selectedCards={selectedCards} binderId={binderId} onDeleteComplete={handleDeleteComplete} />
// {printingSwapCard && (
//   <BinderPrintingSwapDialog open={!!printingSwapCard} onOpenChange={(open) => !open && setPrintingSwapCard(null)} currentCard={printingSwapCard} binderId={binderId} onSwapComplete={() => handlePrintingSwapComplete(printingSwapCard._id || printingSwapCard.id)} />
// )}

// {/* ADD THIS LINE: */}
// <ExportModal 
//   binderId={binderId}
//   open={exportModalOpen}
//   onOpenChange={setExportModalOpen}
// />

// <AffiliateDisclosure />
// <SuperSlamDisclosure />
      
//       <div className="container mx-auto px-4 py-4">
//         {/* <div className={`transition-all duration-300 ${sidebarOpen ? 'max-w-[calc(100%-18rem)]' : 'max-w-full'}`}> */}
//         <div className={`transition-all duration-300 ${!isMobile && selectedCards.length > 0 ? 'max-w-[calc(100%-18rem)]' : 'max-w-full'}`}>
//           <BinderHeader 
//             binder={binder} 
//             stats={stats} 
//             editable={editable} 
//             selectedCards={selectedCards} 
//             onAddCard={() => {
//               setIsCardSearchOpen(true);
//             }} 
//             onBulkUpdateForTrade={handleBulkToggleForTrade} 
//             onOpenSidebar={() => setSidebarOpen(true)}
//             onExportList={handleExportList} 
//           />
          
//           <BinderSearchAndFilters 
//             searchQuery={searchQuery} 
//             setSearchQuery={setSearchQuery} 
//             counts={counts} 
//             filtersExpanded={filtersExpanded} 
//             setFiltersExpanded={setFiltersExpanded} 
//             activeFilters={activeFilters} 
//             activeFilterCount={activeFilterCount} 
//             sortBy={sortBy} 
//             setSortBy={setSortBy} 
//             setFilter={setFilter} 
//             clearFilter={clearFilter} 
//             clearAllFilters={clearAllFilters} 
//             uniqueValues={uniqueValues} 
//           />

//           <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
//             <TabsList className="grid w-full grid-cols-3 mb-6">
//               <TabsTrigger value="cards">Cards ({pagination?.totalCards || 0})</TabsTrigger>
//               <TabsTrigger value="stats">Statistics</TabsTrigger>
//               {editable && <TabsTrigger value="settings">Settings</TabsTrigger>}
//             </TabsList>

//             <TabsContent value="cards">
//               {loading && !cards.length ? <LoadingScreen message="Applying filters..." />
//               : cards.length === 0 ? (
//                 <div className="text-center py-12 bg-card rounded-lg border">
//                   <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
//                   <h3 className="text-lg font-medium">No Cards Found</h3>
//                   <p className="text-muted-foreground mb-4">Try adjusting your search or filters.</p>
//                   <Button onClick={clearAllFilters} variant="outline">Clear Filters</Button>
//                 </div>
//               ) : (
//                 <>
//                   <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-1.5">
//                     {cards.map((card) => (
//                       <BinderCard 
//                         key={card.id || card._id} 
//                         card={card} 
//                         editable={editable}
//                         onEdit={setEditingCard}
//                         onRemove={() => handleRemove(card.id || card._id)}
//                         onOpenPrintingSwap={setPrintingSwapCard}
//                         isSelected={selectedCards.some(s => s.id === (card.id || card._id))}
//                         onSelect={user ? () => handleCardSelect(card) : undefined} // NEW: Any authenticated user can select
//                         selectedQty={selectedCards.find(s => s.id === (card.id || card._id))?.quantity || 1}
//                         maxQty={card.quantity}
//                         toast={toast}
//                         onQuantityIncrease={() => handleQuantityChange(card, 1)}
//                         onQuantityDecrease={() => handleQuantityChange(card, -1)}
//                         onToggleForTrade={handleToggleForTrade} 
//                       />
//                     ))}
//                   </div>
//                   <div ref={infiniteScrollRef} className="h-10 flex justify-center items-center mt-4">
//                     {loadingMore && <Loader2 className="h-6 w-6 animate-spin" />}
//                     {!loadingMore && pagination.page >= pagination.totalPages && cards.length > 0 && (
//                       <span className="text-sm text-muted-foreground">You've reached the end of the results.</span>
//                     )}
//                   </div>
//                 </>
//               )}
//             </TabsContent>
            
//             <TabsContent value="stats">

//               <BinderStats 
//                 binder={binder} 
//                 stats={stats} 
//                 loading={loading} 
//                 editable={editable} 
//                 onOpenSettings={() => setActiveTab("settings")} 
//               />
//             </TabsContent>

//             {editable && (
//               <TabsContent value="settings">
//                 <ShareBinderButton binder={binder} cards={cards} className="bg-secondary text-secondary-foreground hover:bg-secondary/80" />
//                 <BinderSettings binder={{ id: binderId, name: binder?.name, description: binder?.description, isPublic: binder?.isPublic }} onSave={handleSaveBinderSettings} />
//               </TabsContent>
//             )}
//           </Tabs>
//         </div>

//        {editable ? (
//   // Owner's sidebar - existing functionality
//   <SelectedCardsSidebar
//     selectedCards={selectedCards}
//     sidebarOpen={sidebarOpen}
//     onCloseSidebar={() => setSidebarOpen(false)}
//     onQuantityChange={handleSelectedCardQuantityChange}
//     onRemoveSelected={(index) => {
//       const cardToRemove = selectedCards[index];
//       if (cardToRemove) handleRemoveSelectedCard(cardToRemove.id);
//     }}
//     onClearSelected={handleClearSelected}
//     onTransfer={() => setTransferDialogOpen(true)}
//     onCopySelected={handleCopySelected}
//     onDeleteSelected={() => setDeleteSelectedDialogOpen(true)} 
//     copied={copied}
//     editable={editable}
//   />
// ) : user ? (
//   // Non-owner but authenticated user - trade request functionality
//   <TradeRequestSidebar
//     selectedCards={selectedCards}
//     sidebarOpen={sidebarOpen}
//     recipientId={binder.userId}
//     recipientUsername={binder.username || binder.user?.username || 'Unknown User'}
//     onCloseSidebar={() => setSidebarOpen(false)}
//     onQuantityChange={handleSelectedCardQuantityChange}
//     onRemoveSelected={(index) => {
//       const cardToRemove = selectedCards[index];
//       if (cardToRemove) handleRemoveSelectedCard(cardToRemove.id);
//     }}
//     onClearSelected={handleClearSelected}
//     onTradeRequestSent={handleTradeRequestSent}
//   />
// ) : null}
//       </div>
//     </div>
//   );
// }