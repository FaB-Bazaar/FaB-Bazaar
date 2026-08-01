// Mobile-optimized Binder Page
"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { 
  ArrowLeft, 
  BookOpen, 
  BarChart3, 
  Settings, 
  AlertCircle, 
  Plus,
  Search,
  Filter,
  X,
  ToggleLeft,
  ToggleRight,
  Clock,
  CheckCircle,
  Info,
  MoreVertical,
  ChevronRight,
  Layers,
  Edit3,
  Trash2,
  ExternalLink
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/components/ui/use-mobile";
import { FOILING_MAP, RARITY_MAP, SET_MAP } from "@/lib/fab-constants";
import { RarityIcon } from '@/components/shared/RarityIcon';
import { Switch } from "@/components/ui/switch";
import DeckUsageButton from '@/components/binder/DeckUsageButton';

// Import your existing components
import CardSearchDialog from "@/components/dialogs/cards/card-search-dialog";
import EditCardDialog from "@/components/dialogs/cards/edit-card-dialog";
import TransferCardsDialog from "@/components/TransferCardsDialog";
import PrintingSwapDialog from '@/components/dialogs/cards/printing-swap-dialog';
import BinderSettings from "@/components/binder/binder-settings";
import BinderStats from "@/components/binder/BinderStats";

// Mobile-specific card component
const MobileBinderCard = ({ 
  card, 
  editable, 
  onEdit, 
  onRemove, 
  onToggleForTrade, 
  onQuantityIncrease,
  onQuantityDecrease,
  onOpenPrintingSwap,
  isSelected,
  onSelect 
}) => {
  const getImageUrl = () => {
    return card.image_url || card.printingDetails?.image_url || "/cardback.webp";
  };

  const getFoilingInfo = (foiling) => {
    const foilingMap = {
      'R': { name: 'Rainbow', color: 'text-purple-600' },
      'C': { name: 'Cold', color: 'text-blue-600' },
      'G': { name: 'Gold', color: 'text-yellow-600' },
      'S': { name: 'Non-foil', color: 'text-gray-600' }
    };
    const code = foiling?.toUpperCase();
    return foilingMap[code] || { name: 'Non-foil', color: 'text-gray-600' };
  };

  const rarity = card.printingDetails?.rarity || card.rarity;
  const foiling = card.printingDetails?.foiling || card.foiling;
  const set = card.printingDetails?.set_id || card.printingDetails?.set || card.set;
  const foilingInfo = getFoilingInfo(foiling);
  
  // Price selection with priority: low -> market -> mid -> high
  const price = card.tcg_low || card.printingDetails?.tcg_low || 
                card.tcg_market || card.printingDetails?.tcg_market ||
                card.tcg_mid || card.printingDetails?.tcg_mid ||
                card.tcg_high || card.printingDetails?.tcg_high || 0;
  const totalValue = price * (card.quantity || 1);

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border ${
        isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-700'
      } p-3 transition-all`}
      onClick={() => onSelect && onSelect(card)}
    >
      <div className="flex gap-3">
        {/* Image */}
        <div className="w-20 h-28 flex-shrink-0 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
          <img
            src={getImageUrl()}
            alt={card.name || card.display_name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { e.currentTarget.src = "/cardback.webp" }}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1">
            <h3 className="font-semibold text-sm truncate pr-2">
              {card.name || card.display_name}
            </h3>
            {editable && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(card);
                }}
                className="p-1"
              >
                <MoreVertical className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 mb-2">
            {rarity && <RarityIcon rarityCode={rarity} size="xs" />}
            <span className={`text-xs ${foilingInfo.color}`}>{foilingInfo.name}</span>
            {set && <span className="text-xs text-gray-500">{set.toUpperCase()}</span>}
          </div>

          {card.deckUsage && card.card_unique_id && (
            <div className="mb-2">
              <DeckUsageButton cardUniqueId={card.card_unique_id} deckUsage={card.deckUsage} className="w-auto" />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Quantity controls */}
              <div className="flex items-center gap-1">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuantityDecrease(card.id);
                  }}
                  className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center"
                >
                  <span className="text-xs">-</span>
                </button>
                <span className="text-sm font-medium px-2">{card.quantity}</span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuantityIncrease(card.id);
                  }}
                  className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center"
                >
                  <span className="text-xs">+</span>
                </button>
              </div>

              {/* For Trade toggle */}
              <Switch
                checked={!!card.forTrade}
                onCheckedChange={(checked) => onToggleForTrade(card, checked)}
                className="scale-75"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Price */}
            {price > 0 && (
              <div className="text-right">
                <div className="text-xs text-gray-500">TCG Low</div>
                <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                  ${totalValue.toFixed(2)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Mobile Filter Sheet Component
const MobileFilterSheet = ({ 
  isOpen, 
  onClose, 
  filters, 
  onApplyFilters,
  uniqueRarities,
  uniqueFoilings,
  uniqueSets,
  uniqueConditions,
  cardCounts 
}) => {
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleApply = () => {
    onApplyFilters(localFilters);
    onClose();
  };

  const handleReset = () => {
    const resetFilters = {
      forTrade: null,
      rarity: null,
      foiling: null,
      set: null,
      condition: null
    };
    setLocalFilters(resetFilters);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle>Filter Cards</SheetTitle>
          <SheetDescription>
            Apply filters to narrow down your card collection
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* For Trade Filter */}
          <div>
            <label className="text-sm font-medium mb-2 block">For Trade Status</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setLocalFilters(prev => ({ 
                  ...prev, 
                  forTrade: prev.forTrade === 'forTrade' ? null : 'forTrade' 
                }))}
                className={`p-2 rounded-lg border text-sm ${
                  localFilters.forTrade === 'forTrade' 
                    ? 'bg-blue-100 border-blue-500 text-blue-700' 
                    : 'border-gray-300'
                }`}
              >
                For Trade ({cardCounts.forTrade})
              </button>
              <button
                onClick={() => setLocalFilters(prev => ({ 
                  ...prev, 
                  forTrade: prev.forTrade === 'notForTrade' ? null : 'notForTrade' 
                }))}
                className={`p-2 rounded-lg border text-sm ${
                  localFilters.forTrade === 'notForTrade' 
                    ? 'bg-blue-100 border-blue-500 text-blue-700' 
                    : 'border-gray-300'
                }`}
              >
                Not For Trade ({cardCounts.notForTrade})
              </button>
            </div>
          </div>

          {/* Rarity Filter */}
          {uniqueRarities.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-2 block">Rarity</label>
              <div className="flex flex-wrap gap-2">
                {uniqueRarities.map(rarity => (
                  <button
                    key={rarity}
                    onClick={() => setLocalFilters(prev => ({ 
                      ...prev, 
                      rarity: prev.rarity === rarity ? null : rarity 
                    }))}
                    className={`px-3 py-1 rounded-full border text-xs ${
                      localFilters.rarity === rarity 
                        ? 'bg-blue-100 border-blue-500 text-blue-700' 
                        : 'border-gray-300'
                    }`}
                  >
                    {RARITY_MAP[rarity?.toLowerCase()] || rarity}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Foiling Filter */}
          {uniqueFoilings.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-2 block">Foiling</label>
              <div className="flex flex-wrap gap-2">
                {uniqueFoilings.map(foiling => (
                  <button
                    key={foiling}
                    onClick={() => setLocalFilters(prev => ({ 
                      ...prev, 
                      foiling: prev.foiling === foiling ? null : foiling 
                    }))}
                    className={`px-3 py-1 rounded-full border text-xs ${
                      localFilters.foiling === foiling 
                        ? 'bg-blue-100 border-blue-500 text-blue-700' 
                        : 'border-gray-300'
                    }`}
                  >
                    {FOILING_MAP[foiling?.toLowerCase()] || foiling}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Set Filter */}
          {uniqueSets.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-2 block">Set</label>
              <div className="flex flex-wrap gap-2">
                {uniqueSets.map(set => (
                  <button
                    key={set}
                    onClick={() => setLocalFilters(prev => ({ 
                      ...prev, 
                      set: prev.set === set ? null : set 
                    }))}
                    className={`px-3 py-1 rounded-full border text-xs ${
                      localFilters.set === set 
                        ? 'bg-blue-100 border-blue-500 text-blue-700' 
                        : 'border-gray-300'
                    }`}
                  >
                    {SET_MAP[set?.toLowerCase()] || set?.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={handleReset} variant="outline" className="flex-1">
            Reset
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Main Component
export default function MobileOptimizedBinderPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const binderId = params.binderId as string;

  // Core state
  const [binder, setBinder] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state
  const [activeTab, setActiveTab] = useState("cards");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    forTrade: null,
    rarity: null,
    foiling: null,
    set: null,
    condition: null
  });
  const [sortBy, setSortBy] = useState("default");

  // Dialog state
  const [isCardSearchOpen, setIsCardSearchOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [printingSwapCard, setPrintingSwapCard] = useState(null);
  const [selectedCards, setSelectedCards] = useState([]);

  // Determine if user can edit
  const editable = user && binder && user.id === binder.userId;

  // Your existing fetch and handler functions here...
  // (I'll include the key ones for brevity)

  useEffect(() => {
    fetchBinder();
  }, [binderId]);

  const fetchBinder = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let response = await fetch(`/api/binder/${binderId}`);
      
      if (response.status === 404) {
        const userResponse = await fetch(`/api/binder/user/${binderId}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          if (userData.success && userData.binders?.length > 0) {
            router.replace(`/binder/${userData.binders[0]._id}`);
            return;
          }
        }
        throw new Error('Binder not found');
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch binder');
      }
      
      const data = await response.json();
      
      if (data.success && data.binder) {
        setBinder(data.binder);
        setCards(data.binder.cards || []);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      setError(err.message || 'Failed to load binder');
      console.error('Error fetching binder:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort cards
  const filteredCards = cards.filter(card => {
    const matchesSearch = !searchQuery || 
      card.name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesForTrade = !activeFilters.forTrade ||
      (activeFilters.forTrade === "forTrade" && card.forTrade) ||
      (activeFilters.forTrade === "notForTrade" && !card.forTrade);
    
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

  const sortedCards = [...filteredCards].sort((a, b) => {
    if (sortBy === "name") return a.name?.localeCompare(b.name) || 0;
    if (sortBy === "price-desc") {
      const aPrice = a.tcg_low || a.printingDetails?.tcg_low || 0;
      const bPrice = b.tcg_low || b.printingDetails?.tcg_low || 0;
      return bPrice - aPrice;
    }
    if (sortBy === "price-asc") {
      const aPrice = a.tcg_low || a.printingDetails?.tcg_low || 0;
      const bPrice = b.tcg_low || b.printingDetails?.tcg_low || 0;
      return aPrice - bPrice;
    }
    if (sortBy === "quantity") return b.quantity - a.quantity;
    return 0;
  });

  // Get unique values for filters
  const uniqueRarities = [...new Set(cards.map(card => card.printingDetails?.rarity).filter(Boolean))];
  const uniqueFoilings = [...new Set(cards.map(card => card.printingDetails?.foiling).filter(Boolean))];
  const uniqueSets = [...new Set(cards.map(card => card.printingDetails?.set).filter(Boolean))];
  const uniqueConditions = [...new Set(cards.map(card => card.condition).filter(Boolean))];

  const cardCounts = {
    forTrade: cards.filter(c => c.forTrade).length,
    notForTrade: cards.filter(c => !c.forTrade).length
  };

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  // Stats calculation
  const stats = {
    totalCards: cards.length,
    forTradeCount: cards.filter(card => card.forTrade).length,
    uniqueCards: new Set(cards.map(card => card.cardId)).size,
    estimatedValue: cards.reduce((total, card) => {
      const price = card.tcg_low || card.printingDetails?.tcg_low || 
                    card.tcg_market || card.printingDetails?.tcg_market ||
                    card.tcg_mid || card.printingDetails?.tcg_mid ||
                    card.tcg_high || card.printingDetails?.tcg_high || 0;
      return total + (price * (card.quantity || 1));
    }, 0)
  };

  // Your existing handler functions...
  const handleToggleForTrade = async (card, checked) => {
    const originalCards = cards;
    setCards(prev => prev.map(c => 
      c.id === card.id ? { ...c, forTrade: checked } : c
    ));
    
    try {
      const response = await fetch(`/api/binder/${binderId}/for-trade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          forTrade: checked,
          cardId: card.id
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update');
      }
    } catch (err) {
      setCards(originalCards);
      toast({
        title: "Error",
        description: "Failed to update for trade status",
        variant: "destructive"
      });
    }
  };

  const handleQuantityIncrease = async (cardId) => {
    const currentCard = cards.find(card => card.id === cardId);
    if (!currentCard) return;

    setCards(prev => prev.map(card => 
      card.id === cardId ? { ...card, quantity: card.quantity + 1 } : card
    ));
    
    try {
      const response = await fetch('/api/binder/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printingId: cardId,
          quantity: 1,
          slug: binder?.slug || binder?.discordExternalId,
          condition: currentCard.condition || "NM",
          forTrade: currentCard.forTrade ?? true,
        })
      });
      
      if (!response.ok) throw new Error('Failed to increase quantity');
    } catch (err) {
      setCards(prev => prev.map(card => 
        card.id === cardId ? { ...card, quantity: Math.max(1, card.quantity - 1) } : card
      ));
    }
  };

  const handleQuantityDecrease = async (cardId) => {
    const currentCard = cards.find(card => card.id === cardId);
    if (!currentCard) return;
    
    if (currentCard.quantity <= 1) {
      return handleRemove(cardId);
    }
    
    setCards(prev => prev.map(card => 
      card.id === cardId ? { ...card, quantity: card.quantity - 1 } : card
    ));
    
    try {
      const response = await fetch('/api/binder/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printingId: cardId,
          quantity: 1,
          removeAll: false,
          slug: binder?.slug || binder?.discordExternalId,
        })
      });
      
      if (!response.ok) throw new Error('Failed to decrease quantity');
    } catch (err) {
      setCards(prev => prev.map(card => 
        card.id === cardId ? { ...card, quantity: card.quantity + 1 } : card
      ));
    }
  };

  const handleRemove = async (cardId) => {
    const originalCards = cards;
    setCards(prev => prev.filter(card => card.id !== cardId));
    
    try {
      const response = await fetch('/api/binder/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printingId: cardId,
          removeAll: true,
          slug: binder?.slug || binder?.discordExternalId,
        })
      });
      
      if (!response.ok) throw new Error('Failed to remove card');
    } catch (err) {
      setCards(originalCards);
      toast({
        title: "Error",
        description: "Failed to remove card",
        variant: "destructive"
      });
    }
  };

  // Mobile-specific layout
  if (!isMobile) {
    // Return your existing desktop layout here
    return null; // Placeholder - use your existing desktop code
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Dialogs */}
      <CardSearchDialog
        open={isCardSearchOpen}
        onOpenChange={setIsCardSearchOpen}
        onSelectCard={() => {}} // Your handler
        destination="binder"
      />

      {editingCard && (
        <EditCardDialog
          card={editingCard}
          open={!!editingCard}
          onOpenChange={(open) => !open && setEditingCard(null)}
          onSave={() => {}} // Your handler
        />
      )}

      {/* Mobile Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-lg font-bold truncate">
              {binder?.name || "Trade Binder"}
            </h1>
            {editable && (
              <Button
                size="sm"
                onClick={() => setIsCardSearchOpen(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Badge variant={binder?.isPublic ? "default" : "secondary"}>
              {binder?.isPublic ? "Public" : "Private"}
            </Badge>
            <span className="text-gray-600 dark:text-gray-400">
              {stats.totalCards} cards
            </span>
            {stats.estimatedValue > 0 && (
              <span className="text-green-600 dark:text-green-400 font-semibold">
                ${stats.estimatedValue.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="px-4 pb-3 flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFilterSheetOpen(true)}
            className="px-3"
          >
            <Filter className="h-4 w-4 mr-1" />
            {activeFilterCount > 0 && `(${activeFilterCount})`}
          </Button>
        </div>
      </div>

      {/* Sort Bar */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700">
        <select 
          value={sortBy} 
          onChange={(e) => setSortBy(e.target.value)}
          className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
        >
          <option value="default">Sort: Default</option>
          <option value="name">Sort: Name</option>
          <option value="price-desc">Sort: Price (High to Low)</option>
          <option value="price-asc">Sort: Price (Low to High)</option>
          <option value="quantity">Sort: Quantity</option>
        </select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="w-full rounded-none border-b">
          <TabsTrigger value="cards" className="flex-1">Cards</TabsTrigger>
          <TabsTrigger value="stats" className="flex-1">Stats</TabsTrigger>
          {editable && <TabsTrigger value="settings" className="flex-1">Settings</TabsTrigger>}
        </TabsList>

        <TabsContent value="cards" className="px-4 pb-4">
          {sortedCards.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No cards found</h3>
              <p className="text-gray-500 mb-4">
                {cards.length === 0 ? "Add cards to get started" : "Try adjusting your filters"}
              </p>
              {editable && cards.length === 0 && (
                <Button onClick={() => setIsCardSearchOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Card
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedCards.map((card) => (
                <MobileBinderCard
                  key={card.id}
                  card={card}
                  editable={editable}
                  onEdit={setEditingCard}
                  onRemove={handleRemove}
                  onToggleForTrade={handleToggleForTrade}
                  onQuantityIncrease={handleQuantityIncrease}
                  onQuantityDecrease={handleQuantityDecrease}
                  onOpenPrintingSwap={setPrintingSwapCard}
                  isSelected={selectedCards.some(s => s.id === card.id)}
                  onSelect={(card) => {
                    // Handle selection
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="stats" className="px-4">
          <BinderStats
            binder={binder}
            stats={stats}
            loading={loading}
            editable={editable || false}
            onOpenSettings={() => setActiveTab("settings")}
          />
        </TabsContent>

        {editable && (
          <TabsContent value="settings" className="px-4">
            <BinderSettings
              binder={{
                id: binder?._id || binder?.id || binderId,
                name: binder?.name || "My Trade Binder",
                description: binder?.description || "",
                isPublic: binder?.isPublic || false
              }}
              onSave={handleSaveBinderSettings}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Mobile Filter Sheet */}
      <MobileFilterSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        filters={activeFilters}
        onApplyFilters={setActiveFilters}
        uniqueRarities={uniqueRarities}
        uniqueFoilings={uniqueFoilings}
        uniqueSets={uniqueSets}
        uniqueConditions={uniqueConditions}
        cardCounts={cardCounts}
      />

      {/* Floating Action Button for quick actions */}
      {editable && activeTab === "cards" && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:bottom-4 right-4 z-50">
          <Button
            size="lg"
            className="rounded-full h-14 w-14 shadow-lg bg-blue-600 hover:bg-blue-700"
            onClick={() => setIsCardSearchOpen(true)}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  );
}