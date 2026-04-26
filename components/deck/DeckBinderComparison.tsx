"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Loader2,
  Heart,
  BookmarkPlus
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { fuzzySearch } from "@/lib/utils";
import { WantsCard } from '@/components/wants';
import { TooltipProvider } from "@/components/ui/tooltip";
import { TcgAffiliateLink } from '@/components/tracking';
import { wantsClient, bindersClient, decksClient } from "@/lib/client";
import { FOILING_MAP, EDITION_MAP } from "@/lib/fab-constants";

// Updated interface to match new data model
interface DeckPrinting {
  _id?: string;
  printingId: string;
  condition?: string;
  notes?: string;
  addedAt: string;
  isOptimistic?: boolean;
  printingDetails?: { [key: string]: any };
}

// Updated deck interface to match new structure
interface Deck {
  _id: string;
  userId: string;
  name: string;
  description?: string;
  format: string;
  isPublic: boolean;
  // New structure - arrays by category
  hero: DeckPrinting[];
  equipment: DeckPrinting[];
  maindeck: DeckPrinting[];
  inventory: DeckPrinting[];
  maybeboard?: DeckPrinting[];
  tokens?: DeckPrinting[];
  // Computed stats
  totalCards: number;
  heroCount: number;
  equipmentCount: number;
  maindeckCount: number;
  inventoryCount: number;
  maybeboardCount?: number;
  tokensCount?: number;
  estimatedValue: number;
  createdAt: string;
  updatedAt: string;
  canEdit?: boolean;
}

// Helper type for printings with category info
interface DeckPrintingWithCategory extends DeckPrinting {
  category: "hero" | "equipment" | "maindeck" | "inventory" | "maybeboard" | "tokens";
}

interface BinderCard {
  id: string;
  printingId: string;
  name: string;
  quantity: number;
  condition?: string;
  forTrade?: boolean;
  printingDetails?: any;
}

interface ComparisonResult {
  owned: DeckPrintingWithCategory[];
  missing: DeckPrintingWithCategory[];
  partial: { card: DeckPrintingWithCategory; owned: number; needed: number }[];
  debug: {
    deckPrintingIds: string[];
    binderPrintingIds: string[];
    matches: { [key: string]: { deck: number; binder: number } };
  };
}

interface DeckBinderComparisonProps {
  deck: Deck;
}

export default function DeckBinderComparison({ deck }: DeckBinderComparisonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Updated state for new inventory_items integration
  const [binders, setBinders] = useState<any[]>([]);
  const [selectedMode, setSelectedMode] = useState<"all" | "specific">("all");
  const [selectedBinder, setSelectedBinder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "owned" | "missing" | "partial">("all");
  const [showDebug, setShowDebug] = useState(false);
  const [addTargetBinderId, setAddTargetBinderId] = useState<string>("");
  // Tiles removed optimistically after user adds them to binder/wants
  const [removedTileKeys, setRemovedTileKeys] = useState<Set<string>>(new Set());
  
  // New state for wants checking
  const [wantsList, setWantsList] = useState<Set<string>>(new Set());
  const [loadingWants, setLoadingWants] = useState(false);

  // New state for wants tab
  const [wantsCards, setWantsCards] = useState<any[]>([]);
  const [loadingWantsTab, setLoadingWantsTab] = useState(false);

  // Helper function to flatten deck printings with category info
  const getAllPrintingsWithCategories = (deck: Deck): DeckPrintingWithCategory[] => {
    const printings: DeckPrintingWithCategory[] = [];
    
    // Add printings from each category array
    (deck.hero || []).forEach(p => printings.push({ ...p, category: 'hero' }));
    (deck.equipment || []).forEach(p => printings.push({ ...p, category: 'equipment' }));
    (deck.maindeck || []).forEach(p => printings.push({ ...p, category: 'maindeck' }));
    (deck.inventory || []).forEach(p => printings.push({ ...p, category: 'inventory' }));
    (deck.maybeboard || []).forEach(p => printings.push({ ...p, category: 'maybeboard' }));
    (deck.tokens || []).forEach(p => printings.push({ ...p, category: 'tokens' }));
    
    return printings;
  };

  // Fetch user's wants list using client service
  useEffect(() => {
    if (!user) return;

    const fetchWants = async () => {
      try {
        setLoadingWants(true);
        setLoadingWantsTab(true); // Load both at the same time

        const result = await wantsClient.getUserWants({}, { limit: 1000 });
        if (result.success) {
          const cards = result.data.cards || [];

          // Set both the wants list for checking AND the full cards for the tab
          const wantsSet = new Set(cards.map((card: any) => card.printing_id));
          setWantsList(wantsSet);
          setWantsCards(cards); // Set the full cards data immediately

          console.log(`Loaded ${wantsSet.size} cards from wants list`);
        } else {
          console.error('API returned error:', result.error);
        }
      } catch (err) {
        console.error('Failed to fetch wants list:', err);
      } finally {
        setLoadingWants(false);
        setLoadingWantsTab(false);
      }
    };

    fetchWants();
  }, [user]);

  // Fetch user's binders
  useEffect(() => {
    if (!user) return;

    const fetchBinders = async () => {
      try {
        setLoading(true);
        const result = await bindersClient.getUserBinders();
        if (!result.success) throw new Error(result.error || 'Failed to fetch binders');

        if (result.data.binders && result.data.binders.length > 0) {
          setBinders(result.data.binders);
          if (selectedMode === "specific" && !selectedBinder) {
            setSelectedBinder(result.data.binders[0]);
          }
          const stored = localStorage.getItem("selectedBinderId");
          if (stored && result.data.binders.some((b: any) => b._id === stored)) {
            setAddTargetBinderId(stored);
          } else {
            setAddTargetBinderId(result.data.binders[0]._id);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load binders');
      } finally {
        setLoading(false);
      }
    };

    fetchBinders();
  }, [user]);

  // Compare deck with inventory using client service
  useEffect(() => {
    if (!deck || !user) return;

    const compareWithInventory = async () => {
      try {
        setComparisonLoading(true);
        setError(null);

        // Build options for the API call
        const options: { binderMode?: 'all' | 'specific'; binderId?: string } = {};
        if (selectedMode === "specific" && selectedBinder?._id) {
          options.binderMode = 'specific';
          options.binderId = selectedBinder._id;
        } else {
          options.binderMode = 'all';
        }

        const result = await decksClient.getInventoryComparison(deck._id, options);
        if (!result.success) {
          throw new Error(result.error || 'Comparison failed');
        }

        // Transform API response to match existing ComparisonResult interface
        const apiComparison = result.data;

        // Convert API format to component format
        const owned: DeckPrintingWithCategory[] = [];
        const missing: DeckPrintingWithCategory[] = [];
        const partial: { card: DeckPrintingWithCategory; owned: number; needed: number }[] = [];

        // Get all deck printings for creating the detailed objects
        const deckPrintings = getAllPrintingsWithCategories(deck);
        const printingMap = new Map<string, DeckPrintingWithCategory[]>();
        deckPrintings.forEach(p => {
          const existing = printingMap.get(p.printingId) || [];
          printingMap.set(p.printingId, [...existing, p]);
        });

        // Process owned cards
        apiComparison.owned.forEach((item: any) => {
          const deckCards = printingMap.get(item.printingId) || [];
          owned.push(...deckCards.slice(0, item.neededQuantity));
        });

        // Process missing cards — explode into one instance per copy needed
        apiComparison.missing.forEach((item: any) => {
          const base = printingMap.get(item.printingId)?.[0];
          if (base) {
            for (let i = 0; i < item.neededQuantity; i++) {
              missing.push({ ...base, _instanceKey: `${item.printingId}-m-${i}` } as any);
            }
          }
        });

        // Process partial cards — explode the shortfall into individual missing instances
        apiComparison.partial.forEach((item: any) => {
          const deckCards = printingMap.get(item.printingId) || [];
          if (deckCards.length > 0) {
            partial.push({
              card: deckCards[0],
              owned: item.ownedQuantity,
              needed: item.neededQuantity
            });
            const shortage = item.neededQuantity - item.ownedQuantity;
            for (let i = 0; i < shortage; i++) {
              missing.push({ ...deckCards[0], _instanceKey: `${item.printingId}-p-${i}` } as any);
            }
          }
        });

        // Create debug info for compatibility
        const deckPrintingIds = deckPrintings.map(p => p.printingId);
        const matches: { [key: string]: { deck: number; binder: number } } = {};

        [...apiComparison.owned, ...apiComparison.missing, ...apiComparison.partial].forEach((item: any) => {
          matches[item.printingId] = {
            deck: item.neededQuantity,
            binder: item.ownedQuantity || 0
          };
        });

        setComparison({
          owned,
          missing,
          partial,
          debug: {
            deckPrintingIds,
            binderPrintingIds: Object.keys(matches),
            matches
          }
        });
        setRemovedTileKeys(new Set());

        console.log(`[DeckBinderComparison] Updated comparison using inventory_items API`);
        console.log(`[DeckBinderComparison] Summary:`, apiComparison.summary);

      } catch (error) {
        console.error('[DeckBinderComparison] Error:', error);
        setError(error instanceof Error ? error.message : 'Failed to compare with inventory');
      } finally {
        setComparisonLoading(false);
      }
    };

    compareWithInventory();
  }, [selectedMode, selectedBinder, deck, user]);

  // Enhanced wants management functions for the tab
  const handleWantsQuantityChange = async (id: string, newQuantity: number) => {
    // Optimistically update UI
    setWantsCards(prev => prev.map(card =>
      card.printing_id === id ? { ...card, quantity: Math.max(1, newQuantity) } : card
    ));

    try {
      const result = await wantsClient.updateWantsItem(id, { quantity: Math.max(1, newQuantity) });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update quantity');
      }
    } catch (err) {
      console.error('Failed to update quantity:', err);
      toast({
        title: "Error",
        description: "Failed to update quantity. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleWantsPriorityChange = async (id: string, newPriority: string) => {
    // Optimistically update UI
    setWantsCards(prev => prev.map(card =>
      card.printing_id === id ? { ...card, priority: newPriority } : card
    ));

    try {
      const result = await wantsClient.updateWantsItem(id, { priority: newPriority as 'high' | 'medium' | 'low' });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update priority');
      }
    } catch (err) {
      console.error('Failed to update priority:', err);
      toast({
        title: "Error",
        description: "Failed to update priority. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleWantsRemove = async (id: string) => {
    const originalCards = wantsCards;
    setWantsCards(prev => prev.filter(card => card.printing_id !== id));

    // Also update the local wants set for consistency
    const updatedWants = new Set(wantsList);
    updatedWants.delete(id);
    setWantsList(updatedWants);

    try {
      const result = await wantsClient.removeWantsItem(id);

      if (!result.success) {
        throw new Error(result.error || 'Failed to remove card');
      }

      toast({
        title: "Removed from wants",
        description: "Card removed from your wants list.",
      });
    } catch (err) {
      console.error('Failed to remove card:', err);
      setWantsCards(originalCards);
      // Restore to wants set
      setWantsList(wantsList);
      toast({
        title: "Error",
        description: "Failed to remove card. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Per-tile: add one copy to binder, optimistically remove tile
  const handleTileAddToBinder = async (printing: DeckPrintingWithCategory, instanceKey: string) => {
    if (!addTargetBinderId) {
      toast({ title: "Select a binder", description: "Please select a binder first.", variant: "destructive" });
      return;
    }
    setRemovedTileKeys(prev => new Set([...prev, instanceKey]));
    try {
      const result = await bindersClient.addCardsToBinder(addTargetBinderId, [{
        printingId: printing.printingId,
        quantity: 1,
        condition: 'NM' as const,
        notes: `For deck: ${deck.name}`,
      }]);
      if (result.success) {
        const binderName = binders.find(b => b._id === addTargetBinderId)?.name || 'binder';
        toast({ title: "Added to binder!", description: `Added to ${binderName}.` });
      } else {
        throw new Error(result.error || 'Failed to add to binder');
      }
    } catch {
      setRemovedTileKeys(prev => { const next = new Set(prev); next.delete(instanceKey); return next; });
      toast({ title: "Error", description: "Failed to add card to binder.", variant: "destructive" });
    }
  };

  // Per-tile: add one copy to wants, optimistically remove tile
  const handleTileAddToWants = async (printing: DeckPrintingWithCategory, instanceKey: string) => {
    setRemovedTileKeys(prev => new Set([...prev, instanceKey]));
    try {
      const result = await wantsClient.bulkAddWants([{
        printingId: printing.printingId,
        quantity: 1,
        priority: 'medium' as const,
        notes: `For deck: ${deck.name}`,
      }]);
      if (result.success) {
        const updatedWants = new Set(wantsList);
        updatedWants.add(printing.printingId);
        setWantsList(updatedWants);
        toast({ title: "Added to wants!", description: "Card added to your wants list." });
      } else {
        throw new Error('Failed to add to wants');
      }
    } catch {
      setRemovedTileKeys(prev => { const next = new Set(prev); next.delete(instanceKey); return next; });
      toast({ title: "Error", description: "Failed to add card to wants list.", variant: "destructive" });
    }
  };

  // Filter cards based on search and status
  const getFilteredCards = () => {
    if (!comparison) return { owned: [], missing: [], partial: [] };

    const filterBySearch = (cards: DeckPrintingWithCategory[]) => {
      if (!searchQuery) return cards;
      return cards.filter(card =>
        fuzzySearch(searchQuery, card.printingDetails?.display_name || card.printingDetails?.name || "Unknown")
      );
    };

    const visibleMissing = comparison.missing.filter(p =>
      !removedTileKeys.has((p as any)._instanceKey || '')
    );

    const filtered = {
      owned: filterBySearch(comparison.owned),
      missing: filterBySearch(visibleMissing),
      partial: comparison.partial.filter(p =>
        !searchQuery || fuzzySearch(searchQuery, p.card.printingDetails?.display_name || p.card.printingDetails?.name || "Unknown")
      )
    };

    switch (filterStatus) {
      case "owned": return { ...filtered, missing: [], partial: [] };
      case "missing": return { ...filtered, owned: [], partial: [] };
      case "partial": return { ...filtered, owned: [], missing: [] };
      default: return filtered;
    }
  };

  const filteredCards = getFilteredCards();
  
  // UPDATED: Calculate stats using new data structure
  const stats = comparison && deck ? {
    owned: comparison.owned.length,
    missing: comparison.missing.length,
    partial: comparison.partial.length,
    total: getAllPrintingsWithCategories(deck).length,
    completion: Math.round((comparison.owned.length / getAllPrintingsWithCategories(deck).length) * 100)
  } : null;

  // Per-tile missing card component
  function MissingCardItem({
    printing,
    onAddToBinder,
    onAddToWants,
  }: {
    printing: DeckPrintingWithCategory;
    onAddToBinder: () => void;
    onAddToWants: () => void;
  }) {
    const imageUrl = printing.printingDetails?.image_url || "/cardback.webp";
    const cardName = printing.printingDetails?.display_name || printing.printingDetails?.name || "Unknown Card";
    const isInWants = wantsList.has(printing.printingId);

    return (
      <div className="border rounded-lg overflow-hidden transition-all hover:shadow-md relative flex flex-col group">
        <div className="relative w-full h-[230px] sm:h-[322px] bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center p-2">
          <img
            src={imageUrl}
            alt={cardName}
            className="max-w-full max-h-full object-contain rounded"
            onError={(e) => {
              e.currentTarget.src = "/cardback.webp";
            }}
          />

          {/* Wants indicator */}
          {isInWants && (
            <div className="absolute top-2 left-2">
              <div className="bg-pink-500 rounded-full p-1">
                <Heart className="w-3 h-3 text-white fill-white" />
              </div>
            </div>
          )}

          <Badge variant="destructive" className="absolute bottom-2 left-2 text-xs">
            Missing
          </Badge>

          {/* Per-tile action buttons — visible on hover */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="w-7 h-7 rounded-full bg-gray-900/80 text-gray-300 hover:text-white hover:bg-green-600 flex items-center justify-center transition-colors"
              title="Add to binder"
              onClick={(e) => { e.stopPropagation(); onAddToBinder(); }}
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
            </button>
            <button
              className="w-7 h-7 rounded-full bg-gray-900/80 text-gray-300 hover:text-white hover:bg-pink-600 flex items-center justify-center transition-colors"
              title="Add to wants"
              onClick={(e) => { e.stopPropagation(); onAddToWants(); }}
            >
              <Heart className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="p-2 flex-1 flex flex-col">
          <p className="text-sm font-medium truncate">{cardName}</p>
          {printing.printingDetails?.set_name && (
            <p className="text-xs text-muted-foreground truncate">
              {printing.printingDetails.set_name}
            </p>
          )}
          <PrintingInfoLine details={printing.printingDetails} />
          <div className="flex-1"></div>
          {printing.printingDetails?.tcg_low && (
            <p className="text-xs text-green-600 font-medium">
              ${Number(printing.printingDetails.tcg_low).toFixed(2)}
            </p>
          )}
          {printing.printingDetails?.tcgplayer_url && (
            <div className="text-xs mt-1 pt-1 border-t border-gray-100 dark:border-gray-600">
              <TcgAffiliateLink
                tcgplayerUrl={printing.printingDetails.tcgplayer_url}
                feature="DeckMissingPurchaseLink"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                title="Purchase on TCGPlayer"
              >
                <span className="text-xs">Buy on</span>
                <img
                  src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
                  alt="TCGPlayer"
                  className="h-3 w-auto"
                />
              </TcgAffiliateLink>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className="text-muted-foreground">Sign in to compare this deck with your collection.</p>
          </div>

        </CardContent>
      </Card>
    );
  }

  if (loading || comparisonLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2">
              {loading ? "Loading your collection..." : "Comparing with your inventory..."}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || binders.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">{error || "No binders found"}</p>
            <Button variant="outline" onClick={() => window.location.href = "/binder"}>
              Create Your First Binder
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with comparison mode selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Collection Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Comparison mode:</label>
                <Select 
                  value={selectedMode} 
                  onValueChange={(value: "all" | "specific") => setSelectedMode(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select comparison mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All Binders ({binders.reduce((total, b) => total + (b.cards?.length || 0), 0)} total cards)
                    </SelectItem>
                    <SelectItem value="specific">Specific Binder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {selectedMode === "specific" && (
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Select binder:</label>
                  <Select 
                    value={selectedBinder?._id || ""} 
                    onValueChange={(binderId) => {
                      const binder = binders.find(b => b._id === binderId);
                      if (binder) setSelectedBinder(binder);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a binder" />
                    </SelectTrigger>
                    <SelectContent>
                      {binders.map((binder) => (
                        <SelectItem key={binder._id} value={binder._id}>
                          {binder.name} ({binder.cards?.length || 0} cards)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {stats && (
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Completion:</label>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{stats.completion}% ({stats.owned}/{stats.total})</span>
                    </div>
                    <Progress value={stats.completion} className="h-2" />
                  </div>
                </div>
              )}
            </div>
            
            {/* Debug toggle */}
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowDebug(!showDebug)}
              >
                {showDebug ? "Hide" : "Show"} Debug Info
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debug Information */}
      {showDebug && comparison && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-xs font-mono">
              <div>
                <strong>Deck Printing IDs ({comparison.debug.deckPrintingIds.length}):</strong>
                <div className="bg-gray-100 p-2 rounded max-h-32 overflow-y-auto">
                  {comparison.debug.deckPrintingIds.map(id => <div key={id}>{id}</div>)}
                </div>
              </div>
              
              <div>
                <strong>Binder Printing IDs ({comparison.debug.binderPrintingIds.length}):</strong>
                <div className="bg-gray-100 p-2 rounded max-h-32 overflow-y-auto">
                  {comparison.debug.binderPrintingIds.map(id => <div key={id}>{id}</div>)}
                </div>
              </div>
              
              <div>
                <strong>Matches:</strong>
                <div className="bg-gray-100 p-2 rounded max-h-32 overflow-y-auto">
                  {Object.entries(comparison.debug.matches).map(([id, counts]) => (
                    <div key={id} className={counts.binder > 0 ? "text-green-600" : "text-red-600"}>
                      {id}: need {counts.deck}, have {counts.binder}
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <strong>Wants List:</strong>
                <div className="bg-gray-100 p-2 rounded max-h-32 overflow-y-auto">
                  <p>Total wants: {wantsList.size}</p>
                  {Array.from(wantsList).slice(0, 10).map(id => (
                    <div key={id} className="text-pink-600">{id}</div>
                  ))}
                  {wantsList.size > 10 && <div>... and {wantsList.size - 10} more</div>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced stats overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.owned}</p>
                  <p className="text-xs text-muted-foreground">Owned</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <div>
                  <p className="text-2xl font-bold text-red-600">{stats.missing}</p>
                  <p className="text-xs text-muted-foreground">Missing</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{stats.partial}</p>
                  <p className="text-xs text-muted-foreground">Partial</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold text-blue-600">{stats.completion}%</p>
                  <p className="text-xs text-muted-foreground">Complete</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* New wants indicator card */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-pink-600" />
                <div>
                  <p className="text-2xl font-bold text-pink-600">
                    {comparison?.missing.filter(p => wantsList.has(p.printingId)).length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">In Wants</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Enhanced filters and controls */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input 
                  placeholder="Search cards..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="pl-10" 
                />
              </div>
            </div>
            
            <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cards</SelectItem>
                <SelectItem value="owned">Owned</SelectItem>
                <SelectItem value="missing">Missing</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
              </SelectContent>
            </Select>

            {binders.length > 0 && (
              <div className="flex items-center gap-1.5">
                <BookmarkPlus className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground whitespace-nowrap">Add to:</span>
                <Select
                  value={addTargetBinderId}
                  onValueChange={v => { setAddTargetBinderId(v); localStorage.setItem("selectedBinderId", v); }}
                >
                  <SelectTrigger className="h-8 text-xs w-[140px]">
                    <SelectValue placeholder="Select binder" />
                  </SelectTrigger>
                  <SelectContent>
                    {binders.map(b => (
                      <SelectItem key={b._id} value={b._id} className="text-xs">{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {loadingWants && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading wants...
              </div>
            )}
          </div>

          {/* Helper text */}
          {comparison && (
            <div className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
              <Heart className="h-3 w-3 text-pink-500 shrink-0" />
              <span>Pink heart = already in your wants list. Hover a missing card to add it to your binder or wants.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results tabs */}
      <Tabs defaultValue="missing" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="missing" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Missing ({filteredCards.missing.length})
          </TabsTrigger>
          <TabsTrigger value="owned" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Owned ({filteredCards.owned.length})
          </TabsTrigger>
          <TabsTrigger value="partial" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Partial ({filteredCards.partial.length})
          </TabsTrigger>
          <TabsTrigger value="wants" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Wants ({wantsList.size})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="missing" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {filteredCards.missing.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-1.5">
                  {filteredCards.missing.map((printing) => {
                    const instanceKey = (printing as any)._instanceKey || printing._id || printing.printingId;
                    return (
                      <MissingCardItem
                        key={instanceKey}
                        printing={printing}
                        onAddToBinder={() => handleTileAddToBinder(printing, instanceKey)}
                        onAddToWants={() => handleTileAddToWants(printing, instanceKey)}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <p className="text-lg font-medium">You own all these cards!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="owned" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {filteredCards.owned.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-1.5">
                  {filteredCards.owned.map((printing) => (
                    <OwnedCardItem 
                      key={printing._id || printing.printingId}
                      printing={printing}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No owned cards found.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="partial" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {filteredCards.partial.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredCards.partial.map((item) => (
                    <PartialCardItem 
                      key={item.card._id || item.card.printingId}
                      item={item}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No partially owned cards found.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wants" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {wantsCards.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Manage your complete wants list ({wantsCards.length} cards)
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open('/wants', '_blank')}
                    >
                      Open Full Wants Page
                    </Button>
                  </div>
                  
                  <TooltipProvider>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-1.5 max-h-96 overflow-y-auto">
                      {wantsCards.map((card) => (
                        <WantsCard
                          key={card.printing_id}
                          card={{
                            ...card,
                            id: card.printing_id, // Map printing_id to id for WantsCard compatibility
                            name: card.display_name || card.name, // Ensure name is available
                            quantity: 1, // Hide quantity badge by setting to 1
                            printingDetails: {
                              printing_id: card.printing_id,
                              display_name: card.display_name,
                              name: card.display_name,
                              set: card.set,
                              set_name: card.set?.toUpperCase(),
                              edition: card.edition,
                              edition_name: card.edition_name,
                              foiling: card.foiling,
                              foiling_name: card.foiling_name,
                              rarity: card.rarity,
                              rarity_name: card.rarity_name,
                              tcg_market: card.tcg_market,
                              tcg_low: card.tcg_low,
                              tcg_mid: card.tcg_mid,
                              tcg_high: card.tcg_high,
                              tcgplayer_url: card.tcgplayer_url,
                              image_url: card.image_url || `https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${card.printing_id}/public`
                            }
                          }}
                          onQuantityChange={handleWantsQuantityChange}
                          onPriorityChange={handleWantsPriorityChange}
                          onRemove={handleWantsRemove}
                          onPrintingSwap={null} // Disable printing swap dialog
                        />
                      ))}
                    </div>
                  </TooltipProvider>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium">Your wants list is empty</p>
                  <p className="text-muted-foreground mb-4">
                    Add missing cards from this deck to get started
                  </p>
                  <Button onClick={() => window.open('/wants', '_blank')} variant="outline">
                    Go to Wants Page
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


// Shared printing info line: foiling · edition · collector number
function PrintingInfoLine({ details }: { details?: Record<string, any> | null }) {
  if (!details) return null;

  const foilingName = FOILING_MAP[details.foiling as keyof typeof FOILING_MAP];
  const editionName = EDITION_MAP[details.edition as keyof typeof EDITION_MAP];
  const showFoiling = foilingName && foilingName !== 'Standard';
  const showEdition = editionName && editionName !== 'Normal';
  const collectorNum = details.collector_number;

  if (!showFoiling && !showEdition && !collectorNum) return null;

  const parts = [
    showFoiling ? foilingName : null,
    showEdition ? editionName : null,
    collectorNum ? `#${collectorNum}` : null,
  ].filter(Boolean);

  return (
    <p className="text-xs text-muted-foreground truncate">
      {parts.join(' · ')}
    </p>
  );
}

// Card item components placed outside the main component
function OwnedCardItem({ printing }: { printing: DeckPrintingWithCategory }) {
  const imageUrl = printing.printingDetails?.image_url || "/cardback.webp";
  const cardName = printing.printingDetails?.display_name || printing.printingDetails?.name || "Unknown Card";

  return (
    <div className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative w-full h-[230px] sm:h-[322px] bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center p-2">
        <img
          src={imageUrl}
          alt={cardName}
          className="max-w-full max-h-full object-contain rounded"
          onError={(e) => {
            e.currentTarget.src = "/cardback.webp";
          }}
        />
        <Badge className="absolute bottom-2 left-2 text-xs bg-green-600">
          Owned
        </Badge>
      </div>
      <div className="p-2">
        <p className="text-sm font-medium truncate">{cardName}</p>
        {printing.printingDetails?.set_name && (
          <p className="text-xs text-muted-foreground truncate">
            {printing.printingDetails.set_name}
          </p>
        )}
        <PrintingInfoLine details={printing.printingDetails} />
        {printing.printingDetails?.tcg_low && (
          <p className="text-xs text-green-600 font-medium">
            ${Number(printing.printingDetails.tcg_low).toFixed(2)}
          </p>
        )}
      </div>
    </div>
  );
}

function PartialCardItem({ item }: { item: { card: DeckPrintingWithCategory; owned: number; needed: number } }) {
  const { card, owned, needed } = item;
  const imageUrl = card.printingDetails?.image_url || "/cardback.webp";
  const cardName = card.printingDetails?.display_name || card.printingDetails?.name || "Unknown Card";

  return (
    <div className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex">
        <div className="w-24 aspect-[63/88] relative">
          <img
            src={imageUrl}
            alt={cardName}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src = "/cardback.webp";
            }}
          />
        </div>
        <div className="flex-1 p-3">
          <p className="font-medium">{cardName}</p>
          {card.printingDetails?.set_name && (
            <p className="text-sm text-muted-foreground mb-2">
              {card.printingDetails.set_name}
            </p>
          )}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>You have:</span>
              <span className="font-medium text-green-600">{owned}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Deck needs:</span>
              <span className="font-medium">{needed}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Still need:</span>
              <span className="font-medium text-red-600">{needed - owned}</span>
            </div>
          </div>
          <PrintingInfoLine details={card.printingDetails} />
          {card.printingDetails?.tcg_low && (
            <p className="text-xs text-green-600 font-medium mt-1">
              ${Number(card.printingDetails.tcg_low).toFixed(2)} each
            </p>
          )}
        </div>
      </div>
    </div>
  );
}