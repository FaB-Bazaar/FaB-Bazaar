// app/decks/[deckId]/page.tsx 
"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ArrowLeft, Plus, Search, RefreshCw, Share2, Eye, EyeOff, Settings, BarChart3, BookOpen, Upload, Swords} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

// Client services for API calls
import { decksClient, bindersClient, wantsClient } from "@/lib/client";

// DND-KIT imports
import { DndContext, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Deck components
import DeckCardSearchDialog from "@/components/deck/DeckCardSearchDialog";
import DeckSettings from "@/components/deck/DeckSettings";
import DeckAnalysis from "@/components/deck/DeckAnalysis";
import DeckExport from "@/components/deck/DeckExport";
import DeckPrintingCard from "@/components/deck/DeckPrintingCard";
import DeckBinderComparison from "@/components/deck/DeckBinderComparison";
import DeckPrintingsGrid from "@/components/deck/DeckPrintingsGrid";
import DeckListView from "@/components/deck/DeckListView";
import PrintingSwapDialog from "@/components/dialogs/cards/printing-swap-dialog";
import DeckBulkImportDialog from "@/components/deck/DeckBulkImportDialog";
import PrintingComparisonDialog from "@/components/deck/PrintingComparisonDialog";
import PlaymatView from "@/components/deck/PlaymatView";
import DeckSimulator from "@/components/deck/DeckSimulator";
import DeckBuilderSplitView from "@/components/deck/DeckBuilderSplitView";
import DeckMatchupsDialog from "@/components/deck/DeckMatchupsDialog";
import { useIsMobile } from "@/components/ui/use-mobile";
import MobileDeckLayout from "@/components/deck/mobile/MobileDeckLayout";

// Types - Updated for new structure
interface DeckPrinting {
  _id?: string;
  printingId: string;
  quantity?: number;  // ✅ ADDED: Quantity of this printing
  // Removed category field - now inferred from parent array
  condition?: string;
  notes?: string;
  addedAt: string;
  isOptimistic?: boolean;
  printingDetails?: { [key: string]: any };
  tags?: string[];
}

interface CardGroup {
  cardName: string;
  cardId: string;
  category: "hero" | "equipment" | "maindeck" | "inventory";
  printings: (DeckPrinting & { category: string })[];
}

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
  heroName?: string;
  canEdit?: boolean;
}

function SortablePrintingCard({ printing, children }: { printing: DeckPrinting & { category: string }; children: React.ReactNode }) {
  // Generate unique ID using the same logic as the grid
  const uniqueId = printing._id || `${printing.printingId}-${printing.category}-${Date.now()}`;
  
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: uniqueId,  // Use uniqueId instead of printing._id!
    data: { printing },
  });
  
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 100 : "auto",
    };
  
    const childWithProps = React.cloneElement(children as React.ReactElement<any>, {
      dragAttributes: attributes,
      dragListeners: listeners,
      isDragging,
    });
  
    return (
      <div ref={setNodeRef} style={style} className={isDragging ? "opacity-50 shadow-2xl" : ""}>
        {childWithProps}
      </div>
    );
  }

export default function DeckDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const deckId = params.deckId as string;

  // Core state
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [removingCards, setRemovingCards] = useState<Set<string>>(new Set());
  const [movingCards, setMovingCards] = useState<Set<string>>(new Set());

  // Binder selection state
  const [binders, setBinders] = useState<any[]>([]);
  const [selectedBinderId, setSelectedBinderId] = useState<string>("");
  const [ownershipRefreshKey, setOwnershipRefreshKey] = useState(0);

  // Ownership status - Map of printingId to ownership info
  const [ownershipStatus, setOwnershipStatus] = useState<Map<string, any>>(new Map());

  // Wants list state - Map of printingId to wants quantity
  const [wantsMap, setWantsMap] = useState<Map<string, number>>(new Map());

  // Binder inventory state - Map of printingId to { quantity, cardId } for selected binder
  const [binderMap, setBinderMap] = useState<Map<string, { quantity: number; cardId: string }>>(new Map());

  // UI state
  const [activeTab, setActiveTab] = useState("builder");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"hero" | "equipment" | "maindeck" | "inventory">("maindeck");
  const [viewMode, setViewMode] = useState<"list" | "grouped" | "individual" | "compact" | "playmat" | "catalog">("catalog");
  const [stackGrouping, setStackGrouping] = useState<"by-name" | "by-printing">("by-name");


  // Dialog state
  const [isCardSearchOpen, setIsCardSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [printingSwapOpen, setPrintingSwapOpen] = useState(false);
  const [swappingPrinting, setSwappingPrinting] = useState<(DeckPrinting & { category: string }) | null>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [comparisonDialogOpen, setComparisonDialogOpen] = useState(false);
  const [comparingPrinting, setComparingPrinting] = useState<(DeckPrinting & { category: string }) | null>(null);
  const [comparingCardCopies, setComparingCardCopies] = useState<(DeckPrinting & { category: string })[]>([]);

  // FIXED: Optimistic deck state - properly initialized
  const [optimisticDeck, setOptimisticDeck] = useState<Deck | null>(null);

  // Update optimistic deck when main deck changes
  useEffect(() => {
    // Only set optimistic deck if we don't already have one
    // This prevents overwriting optimistic changes
    if (deck && !optimisticDeck) {
      setOptimisticDeck(deck);
    }
  }, [deck, optimisticDeck]);

  // FIXED: Optimistic swap handler - moved inside component
  const handleOptimisticSwap = (oldPrinting: DeckPrinting & { category: string }, newPrintingData: any) => {
    if (!optimisticDeck) return;

    const category = oldPrinting.category;
    const categoryKey = category as keyof Pick<Deck, 'hero' | 'equipment' | 'maindeck' | 'inventory' | 'maybeboard' | 'tokens'>;
    const categoryArray = optimisticDeck[categoryKey] as DeckPrinting[];

    if (!categoryArray) return;

    // Use _id to find the specific printing instance (handles multiple copies of same card)
    const printingIndex = oldPrinting._id
      ? categoryArray.findIndex(p => p._id === oldPrinting._id)
      : categoryArray.findIndex(p => p.printingId === oldPrinting.printingId);

    if (printingIndex !== -1) {
      const newPrinting = {
        ...oldPrinting,
        printingId: newPrintingData.printing_id || newPrintingData.printingId,
        printingDetails: newPrintingData
      };

      // Create a completely new array with the updated printing
      const updatedCategoryArray = [
        ...categoryArray.slice(0, printingIndex),
        newPrinting,
        ...categoryArray.slice(printingIndex + 1)
      ];

      // Create a completely new deck object
      const updatedDeck = {
        ...optimisticDeck,
        [categoryKey]: updatedCategoryArray
      };

      setOptimisticDeck(updatedDeck);
    }
  };

  // Use optimistic deck for UI, fallback to regular deck
  const displayDeck = optimisticDeck || deck;

  // Updated printings flattening logic - use display deck
  const printings = displayDeck ? [
    ...(displayDeck.hero || []).map(p => ({ ...p, category: 'hero' as const })),
    ...(displayDeck.equipment || []).map(p => ({ ...p, category: 'equipment' as const })),
    ...(displayDeck.maindeck || []).map(p => {
      const withCategory = { ...p, category: 'maindeck' as const };
      // 🔍 LOG: Check if quantity survives the spread
      if (p.printingDetails?.name === 'command and conquer') {
        console.log('[DeckPage] Command and Conquer after spread:', {
          hasQuantity: 'quantity' in withCategory,
          quantity: withCategory.quantity,
          originalQuantity: p.quantity
        });
      }
      return withCategory;
    }),
    ...(displayDeck.inventory || []).map(p => ({ ...p, category: 'inventory' as const })),
    ...(displayDeck.maybeboard || []).map(p => ({ ...p, category: 'maybeboard' as const })),
    ...(displayDeck.tokens || []).map(p => ({ ...p, category: 'tokens' as const }))
  ] : [];

  const canEdit = displayDeck?.canEdit || (user && displayDeck && user.id === displayDeck.userId);

  // DND sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Helpers
  const groupCardsByCardAndCategory = (printings: (DeckPrinting & { category: string })[]): Record<string, CardGroup> => {
    const grouped: Record<string, CardGroup> = {};
    printings.forEach((printing) => {
      const cardId = printing.printingDetails?.card_unique_id || printing.printingId || "unknown";
      const cardName =
        printing.printingDetails?.display_name ||
        printing.printingDetails?.name ||
        `Card ${printing.printingId}` ||
        "Unknown Card";
      const key = `${printing.category}-${cardId}`;
      if (!grouped[key]) {
        grouped[key] = { cardName, cardId, category: printing.category as any, printings: [] };
      }
      grouped[key].printings.push(printing);
    });
    return grouped;
  };

  const groupedCards = groupCardsByCardAndCategory(printings);

  // Filter printings based on search query (card name, set name, or notes)
  const filteredPrintings = searchQuery
    ? printings.filter(p => {
        const name = (p.printingDetails?.display_name || p.printingDetails?.name || '').toLowerCase();
        const setName = (p.printingDetails?.set_name || '').toLowerCase();
        const notes = (p.notes || '').toLowerCase();
        const query = searchQuery.toLowerCase();
        return name.includes(query) || setName.includes(query) || notes.includes(query);
      })
    : printings;

  // Create grouped cards from filtered printings
  const filteredGroupedCards = groupCardsByCardAndCategory(filteredPrintings);

  // Calculate accurate total cards from actual arrays
  const actualTotalCards = (displayDeck?.hero?.length || 0) +
                          (displayDeck?.equipment?.length || 0) +
                          (displayDeck?.maindeck?.length || 0) +
                          (displayDeck?.inventory?.length || 0);

  const deckStats = {
    totalCards: actualTotalCards,
    uniqueCards: Object.keys(groupedCards).length,
    estimatedValue: displayDeck?.estimatedValue || 0,
    categoryBreakdown: [
      {
        category: 'hero',
        count: displayDeck?.hero?.length || 0,
        unique: Object.values(groupedCards).filter(g => g.category === 'hero').length
      },
      {
        category: 'equipment',
        count: displayDeck?.equipment?.length || 0,
        unique: Object.values(groupedCards).filter(g => g.category === 'equipment').length
      },
      {
        category: 'maindeck',
        count: displayDeck?.maindeck?.length || 0,
        unique: Object.values(groupedCards).filter(g => g.category === 'maindeck').length
      },
      {
        category: 'inventory',
        count: displayDeck?.inventory?.length || 0,
        unique: Object.values(groupedCards).filter(g => g.category === 'inventory').length
      }
    ]
  };

  const deckForAnalysis = {
    ...displayDeck,
    cards: printings.map(printing => ({
      id: printing._id || printing.printingId,
      cardId: printing.printingDetails?.card_unique_id || printing.printingId,
      name: printing.printingDetails?.display_name || 
            printing.printingDetails?.name || 
            `Card ${printing.printingId}`,
      quantity: 1, // Each printing represents 1 card
      category: printing.category,
      printingDetails: printing.printingDetails
    }))
  };

  // Fetch deck
  useEffect(() => {
    fetchDeck();
  }, [deckId]);

  // Set viewMode based on hero availability
  useEffect(() => {
    if (displayDeck) {
      // If catalog mode but no hero, fall back to list view
      if (viewMode === "catalog" && (!displayDeck.hero || displayDeck.hero.length === 0)) {
        setViewMode("list");
      }
    }
  }, [displayDeck, viewMode]);

  // Fetch user's binders
  useEffect(() => {
    const fetchBinders = async () => {
      if (!user?.id) return;
      try {
        const result = await bindersClient.getUserBinders();
        if (!result.success) return;

        setBinders(result.data.binders || []);

        // Load from localStorage or default to first binder
        const storedBinderId = localStorage.getItem('selectedBinderId');
        if (storedBinderId && result.data.binders.some((b: any) => b._id === storedBinderId)) {
          setSelectedBinderId(storedBinderId);
        } else if (result.data.binders.length > 0) {
          setSelectedBinderId(result.data.binders[0]._id);
        }
      } catch (error) {
        console.error('Error fetching binders:', error);
      }
    };
    fetchBinders();
  }, [user]);

  // Save selected binder to localStorage
  useEffect(() => {
    if (selectedBinderId) {
      localStorage.setItem('selectedBinderId', selectedBinderId);
    }
  }, [selectedBinderId]);

  // Fetch wants list to check which cards are wanted and their quantities
  useEffect(() => {
    const fetchWantsList = async () => {
      if (!user?.id) return;
      try {
        const result = await wantsClient.getUserWants({}, { limit: 1000 });
        if (!result.success) return;

        if (result.data.cards) {
          const wantsQuantityMap = new Map<string, number>();
          result.data.cards.forEach((card: any) => {
            wantsQuantityMap.set(card.printing_id, card.quantity || 1);
          });
          setWantsMap(wantsQuantityMap);
        }
      } catch (error) {
        console.error('Error fetching wants list:', error);
      }
    };
    fetchWantsList();
  }, [user]);

  // Fetch ownership data for compact view indicators
  useEffect(() => {
    const fetchOwnershipData = async () => {
      if (!deck?._id || !user?.id) return;

      try {
        const result = await decksClient.getInventoryComparison(deck._id, { binderMode: 'all' });
        if (!result.success || !result.data.comparison) return;

        const ownershipMap = new Map();
        const comparison = result.data.comparison;

        // Process owned cards (full exact printing matches)
        comparison.owned?.forEach((item: any) => {
          ownershipMap.set(item.printingId, {
            owned: item.exactOwned || item.ownedQuantity,
            needed: item.neededQuantity,
            alternative: item.alternativeOwned || 0,
            forTrade: item.forTrade || false,
            binderSlugs: item.binderSlugs || [],
            binderNames: item.binderNames || [],
            binderIds: item.binderIds || []
          });
        });

        // Process partial cards (some owned, not enough exact printing)
        comparison.partial?.forEach((item: any) => {
          ownershipMap.set(item.printingId, {
            owned: item.exactOwned || item.ownedQuantity || 0,
            needed: item.neededQuantity,
            alternative: item.alternativeOwned || 0,
            forTrade: item.forTrade || false,
            binderSlugs: item.binderSlugs || [],
            binderNames: item.binderNames || [],
            binderIds: item.binderIds || []
          });
        });

        // Process missing cards (may have alternative printings)
        comparison.missing?.forEach((item: any) => {
          ownershipMap.set(item.printingId, {
            owned: 0,
            needed: item.neededQuantity,
            alternative: item.alternativeOwned || 0,
            forTrade: false,
            binderSlugs: [],
            binderNames: [],
            binderIds: []
          });
        });

        setOwnershipStatus(ownershipMap);
      } catch (error) {
        console.error('Error fetching ownership data:', error);
      }
    };

    fetchOwnershipData();
  }, [deck?._id, user?.id, ownershipRefreshKey]);

  // Fetch binder inventory when selectedBinderId changes
  useEffect(() => {
    const fetchBinderInventory = async () => {
      if (!selectedBinderId || !user?.id) {
        setBinderMap(new Map());
        return;
      }
      try {
        const result = await bindersClient.getBinderCards(selectedBinderId, {}, {});
        if (!result.success) return;

        if (result.data.cards) {
          const binderQuantityMap = new Map<string, { quantity: number; cardId: string }>();
          result.data.cards.forEach((card: any) => {
            binderQuantityMap.set(card.printingId || card.printing_id, {
              quantity: card.quantity || 1,
              cardId: card._id || card.id
            });
          });
          setBinderMap(binderQuantityMap);
        }
      } catch (error) {
        console.error('Error fetching binder inventory:', error);
      }
    };
    fetchBinderInventory();
  }, [selectedBinderId, user, ownershipRefreshKey]);

  const handleSaveSettings = async (settings: {
    name: string;
    description: string;
    format: string;
    hero?: string;
    isPublic: boolean;
  }) => {
    const result = await decksClient.updateDeck(deckId, {
      name: settings.name,
      description: settings.description,
      format: settings.format,
      heroName: settings.hero,
      isPublic: settings.isPublic,
    });
    if (!result.success) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      throw new Error(result.error);
    }
    setDeck(prev => prev ? { ...prev, ...settings, heroName: settings.hero } : prev);
    toast({ title: "Settings saved" });
  };

  const fetchDeck = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await decksClient.getDeck(deckId);
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch deck");
      }

      // 🔍 LOG: Check what we received from API
      const deckData = result.data as unknown as Deck;
      console.log('[DeckPage] Received deck data:', {
        name: deckData.name,
        maindeckCount: deckData.maindeck?.length || 0,
        sampleMaindeck: deckData.maindeck?.slice(0, 3).map(p => ({
          name: p.printingDetails?.name,
          quantity: p.quantity,
          hasQuantityField: 'quantity' in p
        }))
      });

      setDeck(deckData);
      // Clear optimistic state since we have fresh data
      setOptimisticDeck(null);
    } catch (err: any) {
      setError(err.message || "Failed to load deck");
    } finally {
      setLoading(false);
    }
  };

  // Drag end handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activePrinting = active.data.current?.printing as (DeckPrinting & { category: string });
    if (!activePrinting) return;

    const sourceCategory = activePrinting.category;
    const overId = over.id;

    const overIsContainer = overId === "maindeck" || overId === "inventory";
    const overPrinting = printings.find((p) => p._id === overId);
    const destinationCategory = overIsContainer ? (overId as "maindeck" | "inventory") : overPrinting?.category;

    if (!destinationCategory) return;

    // Move between maindeck/inventory
    if (sourceCategory !== destinationCategory && (destinationCategory === "maindeck" || destinationCategory === "inventory")) {
      handleMovePrintingToCategory(activePrinting, destinationCategory);
      return;
    }

    // Reorder within same category - this would need to be updated for the new structure
    // For now, we'll skip this since it requires backend support for the new structure
  };


  const handleAddPrintingToDeck = async (card: any, printing: any, quantity = 1) => {
    if (!canEdit) return;
    
    try {
      // Optimistic update - immediately add to UI
      if (optimisticDeck) {
        const updatedDeck = { ...optimisticDeck };
        const categoryArray = [...(updatedDeck[activeCategory] || [])];
        
        // Add the specified quantity
        for (let i = 0; i < quantity; i++) {
          const newPrinting: DeckPrinting = {
            _id: generateTempId(), // Temporary ID for optimistic update
            printingId: printing.printing_id || printing.unique_id,
            condition: 'NM',
            notes: '',
            addedAt: new Date().toISOString(),
            isOptimistic: true, // Mark as optimistic
            printingDetails: {
              ...printing,
              card_unique_id: card.unique_id,
              display_name: card.name,
              name: card.name
            }
          };
          categoryArray.push(newPrinting);
        }
        
        (updatedDeck as any)[activeCategory] = categoryArray;
        
        // Update counts optimistically
        const countField = `${activeCategory}Count` as keyof Deck;
        if (typeof updatedDeck[countField] === 'number') {
          (updatedDeck as any)[countField] = (updatedDeck[countField] as number) + quantity;
        }
        
        if (typeof updatedDeck.totalCards === 'number') {
          updatedDeck.totalCards = updatedDeck.totalCards + quantity;
        }
        
        setOptimisticDeck(updatedDeck);
      }
  
      // Make API call using client service
      const result = await decksClient.addPrinting(deckId, {
        category: activeCategory as any,
        printingId: printing.printing_id || printing.unique_id,
        quantity: quantity,
        condition: 'NM',
        notes: ''
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to add printing');
      }

      // Success! Fetch fresh deck data to ensure UI is in sync
      await fetchDeck();

      toast({
        title: "Card added",
        description: `Added ${quantity}x ${card.name} to ${activeCategory}.`,
        duration: isMobile ? 1000 : undefined // 1s on mobile, default on desktop
      });

    } catch (err) {
      console.error('Error adding printing:', err);
      
      // Rollback optimistic update on error
      if (deck) {
        setOptimisticDeck(deck);
      }
      
      toast({
        title: "Error",
        description: "Failed to add card to deck.",
        variant: "destructive"
      });
    }
  };
  
  const handleMovePrintingToCategory = async (printing: DeckPrinting & { category: string }, newCategory: "maindeck" | "inventory" | "equipment") => {
    if (!canEdit || printing.category === newCategory) return;

    console.log('[MovePrinting] ========== MOVE STARTED ==========');
    console.log('[MovePrinting] Card:', printing.printingDetails?.display_name || printing.printingDetails?.name);
    console.log('[MovePrinting] PrintingId:', printing.printingId);
    console.log('[MovePrinting] From category:', printing.category);
    console.log('[MovePrinting] To category:', newCategory);
    console.log('[MovePrinting] Card types:', printing.printingDetails?.types);
    console.log('[MovePrinting] Card subtypes:', printing.printingDetails?.subtypes);

    // Validate Evo equipment cannot go to equipment zone (except in playmat view for gameplay)
    if (newCategory === 'equipment' && viewMode !== 'playmat') {
      const types = printing.printingDetails?.types || [];
      const isEquipment = types.includes('equipment') || types.includes('weapon');
      const isEvo = types.includes('evo');

      if (isEquipment && isEvo) {
        console.log('[MovePrinting] ❌ Blocked: Evo equipment cannot be moved to equipment zone during deck building');
        toast({
          title: "Cannot move to equipment",
          description: "Evo equipment can only be in the library or inventory during deck building. Use playmat view to simulate gameplay.",
          variant: "destructive"
        });
        return;
      }
    }

    // Prevent double-clicks by checking if this card is already being moved
    const cardKey = `${printing.printingId}-${printing.category}`;
    if (movingCards.has(cardKey)) {
      console.log('[MovePrinting] ❌ Already moving this card, ignoring duplicate request');
      return;
    }

    try {
      // Mark card as being moved
      setMovingCards(prev => new Set(prev).add(cardKey));
      console.log('[MovePrinting] ✓ Card marked as moving');

      // Optimistic update - move between categories
      if (optimisticDeck) {
        console.log('[MovePrinting] Starting optimistic update...');
        const updatedDeck = { ...optimisticDeck };

        // Remove from source category
        const sourceArray = [...(updatedDeck[printing.category as keyof Pick<Deck, 'hero' | 'equipment' | 'maindeck' | 'inventory' | 'maybeboard' | 'tokens'>] as DeckPrinting[])];
        console.log('[MovePrinting] Source category array length:', sourceArray.length);

        const printingIndex = sourceArray.findIndex(p =>
          p._id === printing._id || p.printingId === printing.printingId
        );
        console.log('[MovePrinting] Found printing at index:', printingIndex);

        if (printingIndex !== -1) {
          const [movedPrinting] = sourceArray.splice(printingIndex, 1);
          (updatedDeck as any)[printing.category] = sourceArray;
          console.log('[MovePrinting] ✓ Removed from source, new length:', sourceArray.length);

          // Handle equipment slot conflicts when moving to equipment
          if (newCategory === 'equipment') {
            console.log('[MovePrinting] Moving to equipment - checking for equipment conflicts...');
            const types = movedPrinting.printingDetails?.types || [];
            const subtypes = movedPrinting.printingDetails?.subtypes || [];
            const isWeapon = types.includes('weapon');
            const isOffHand = types.includes('off-hand');
            const isHead = types.includes('head');
            const isChest = types.includes('chest');
            const isArms = types.includes('arms');
            const isLegs = types.includes('legs');
            // Check BOTH types and subtypes for 1H/2H designation
            const is2H = types.includes('2h') || subtypes.includes('2h');
            const is1H = types.includes('1h') || subtypes.includes('1h') || (isWeapon && !is2H); // Default to 1H if not specified

            console.log('[MovePrinting] Is weapon:', isWeapon, '| Is off-hand:', isOffHand, '| Is 2H:', is2H, '| Is 1H:', is1H);
            console.log('[MovePrinting] Is head:', isHead, '| Is chest:', isChest, '| Is arms:', isArms, '| Is legs:', isLegs);

            // Handle armor slot conflicts (head, chest, arms, legs)
            if (isHead || isChest || isArms || isLegs) {
              const slotType = isHead ? 'head' : isChest ? 'chest' : isArms ? 'arms' : 'legs';
              console.log(`[MovePrinting] 🛡️ Moving ${slotType} armor - checking for existing ${slotType} equipment...`);
              const equipmentArray = [...(updatedDeck.equipment || [])];
              const armorToMove: DeckPrinting[] = [];

              // Find existing items in this armor slot
              equipmentArray.forEach(item => {
                const itemTypes = item.printingDetails?.types || [];
                if (itemTypes.includes(slotType)) {
                  console.log(`[MovePrinting]   Found existing ${slotType}:`, item.printingDetails?.display_name, '- will move to inventory');
                  armorToMove.push(item);
                }
              });

              // Move conflicting armor to inventory
              if (armorToMove.length > 0) {
                console.log(`[MovePrinting] Moving ${armorToMove.length} ${slotType} item(s) to inventory`);
                const inventoryArray = [...(updatedDeck.inventory || [])];
                armorToMove.forEach(armor => {
                  const idx = equipmentArray.findIndex(e => e._id === armor._id || e.printingId === armor.printingId);
                  if (idx !== -1) {
                    equipmentArray.splice(idx, 1);
                    inventoryArray.push(armor);
                  }
                });
                updatedDeck.equipment = equipmentArray;
                updatedDeck.inventory = inventoryArray;
                console.log('[MovePrinting] ✓ Optimistically moved armor to inventory');

                toast({
                  title: "Equipment replaced",
                  description: `Moved existing ${slotType} equipment to inventory.`
                });
              } else {
                console.log(`[MovePrinting] No existing ${slotType} equipment found`);
              }
            }

            // If moving a 2H weapon, kick out all other weapons to inventory
            if (is2H) {
              console.log('[MovePrinting] 🔨 Moving 2H weapon - checking for existing weapons...');
              const equipmentArray = [...(updatedDeck.equipment || [])];
              const weaponsToMove: DeckPrinting[] = [];

              // Find all weapons currently in equipment
              equipmentArray.forEach(item => {
                const itemTypes = item.printingDetails?.types || [];
                if (itemTypes.includes('weapon')) {
                  console.log('[MovePrinting]   Found existing weapon:', item.printingDetails?.display_name, '- will move to inventory');
                  weaponsToMove.push(item);
                }
              });

              // Move conflicting weapons to inventory
              if (weaponsToMove.length > 0) {
                console.log('[MovePrinting] Moving', weaponsToMove.length, 'weapons to inventory');
                const inventoryArray = [...(updatedDeck.inventory || [])];
                weaponsToMove.forEach(weapon => {
                  const idx = equipmentArray.findIndex(e => e._id === weapon._id || e.printingId === weapon.printingId);
                  if (idx !== -1) {
                    equipmentArray.splice(idx, 1);
                    inventoryArray.push(weapon);
                  }
                });
                updatedDeck.equipment = equipmentArray;
                updatedDeck.inventory = inventoryArray;
                console.log('[MovePrinting] ✓ Optimistically moved weapons to inventory');

                toast({
                  title: "Weapons moved",
                  description: `Moved ${weaponsToMove.length} weapon${weaponsToMove.length > 1 ? 's' : ''} to inventory to make room for 2H weapon.`
                });
              } else {
                console.log('[MovePrinting] No existing weapons found in equipment');
              }
            }

            // If moving a 1H weapon OR off-hand, kick out any 2H weapons to inventory
            if (is1H || isOffHand) {
              console.log('[MovePrinting] ⚔️ Moving 1H weapon or off-hand - checking for 2H weapons...');
              const equipmentArray = [...(updatedDeck.equipment || [])];
              const twoHandedWeapons: DeckPrinting[] = [];

              // Find all 2H weapons currently in equipment
              equipmentArray.forEach(item => {
                const itemTypes = item.printingDetails?.types || [];
                const itemSubtypes = item.printingDetails?.subtypes || [];
                // Check BOTH types and subtypes for 2H designation
                if (itemTypes.includes('weapon') && (itemTypes.includes('2h') || itemSubtypes.includes('2h'))) {
                  console.log('[MovePrinting]   Found 2H weapon:', item.printingDetails?.display_name, '- will move to inventory');
                  twoHandedWeapons.push(item);
                }
              });

              // Move 2H weapons to inventory
              if (twoHandedWeapons.length > 0) {
                console.log('[MovePrinting] Moving', twoHandedWeapons.length, '2H weapons to inventory');
                const inventoryArray = [...(updatedDeck.inventory || [])];
                twoHandedWeapons.forEach(weapon => {
                  const idx = equipmentArray.findIndex(e => e._id === weapon._id || e.printingId === weapon.printingId);
                  if (idx !== -1) {
                    equipmentArray.splice(idx, 1);
                    inventoryArray.push(weapon);
                  }
                });
                updatedDeck.equipment = equipmentArray;
                updatedDeck.inventory = inventoryArray;
                console.log('[MovePrinting] ✓ Optimistically moved 2H weapons to inventory');

                toast({
                  title: "2H weapon moved",
                  description: `Moved 2H weapon to inventory to make room for ${isOffHand ? 'off-hand item' : '1H weapon'}.`
                });
              } else {
                console.log('[MovePrinting] No 2H weapons found in equipment');
              }
            }
          }

          // Add to destination category
          const destArray = [...(updatedDeck[newCategory] || [])];
          destArray.push({
            ...movedPrinting,
            isOptimistic: true // Mark as optimistic
          });
          (updatedDeck as any)[newCategory] = destArray;
          console.log('[MovePrinting] ✓ Added to destination, new length:', destArray.length);

          // Update counts optimistically
          const sourceCountField = `${printing.category}Count` as keyof Deck;
          const destCountField = `${newCategory}Count` as keyof Deck;

          if (typeof updatedDeck[sourceCountField] === 'number') {
            (updatedDeck as any)[sourceCountField] = (updatedDeck[sourceCountField] as number) - 1;
          }
          if (typeof updatedDeck[destCountField] === 'number') {
            (updatedDeck as any)[destCountField] = (updatedDeck[destCountField] as number) + 1;
          }

          setOptimisticDeck(updatedDeck);
          console.log('[MovePrinting] ✓ Optimistic update complete');
        } else {
          console.log('[MovePrinting] ❌ Could not find printing in source array');
        }
      } else {
        console.log('[MovePrinting] ⚠️ No optimistic deck available');
      }

      // Make API call - remove from source and add to destination
      // Note: The backend API will automatically handle weapon conflicts when adding to equipment
      console.log('[MovePrinting] ========== BACKEND API CALLS ==========');

      console.log('[MovePrinting] Removing from source:', { category: printing.category, printingId: printing.printingId, quantity: 1 });

      const removeResult = await decksClient.removePrinting(deckId, printing.printingId, printing.category as any);

      console.log('[MovePrinting] Remove result:', removeResult);

      if (!removeResult.success) {
        console.log('[MovePrinting] ❌ Remove unsuccessful:', removeResult.error);
        throw new Error(removeResult.error || 'Failed to remove printing');
      }

      console.log('[MovePrinting] ✓ Successfully removed from source');

      // Add to new category
      console.log('[MovePrinting] Adding to destination:', { category: newCategory, printingId: printing.printingId, quantity: 1 });

      const addResult = await decksClient.addPrinting(deckId, {
        category: newCategory as any,
        printingId: printing.printingId,
        quantity: 1,
        condition: printing.condition || 'NM',
        notes: printing.notes || ''
      });

      console.log('[MovePrinting] Add result:', addResult);

      if (!addResult.success) {
        console.log('[MovePrinting] ❌ Add unsuccessful:', addResult.error);
        // Restore to original category
        await decksClient.addPrinting(deckId, {
          category: printing.category as any,
          printingId: printing.printingId,
          quantity: 1,
          condition: printing.condition || 'NM',
          notes: printing.notes || ''
        });
        throw new Error(addResult.error || 'Failed to add printing to destination');
      }

      console.log('[MovePrinting] ✓ Successfully added to destination');

      // Success! The backend has handled any weapon conflicts
      // Check if we need to refetch to get the updated weapon positions
      if (newCategory === 'equipment') {
        const types = printing.printingDetails?.types || [];
        const isWeaponOrOffHand = types.includes('weapon') || types.includes('off-hand');
        if (isWeaponOrOffHand) {
          const itemType = types.includes('off-hand') ? 'off-hand item' : 'weapon';
          console.log(`[MovePrinting] ${itemType} added to equipment - refetching deck to sync backend changes...`);
          // Refetch to get the accurate state after backend conflict resolution
          await fetchDeck();
          console.log('[MovePrinting] ✓ Deck refetched after weapon/off-hand move');
          toast({
            title: `${itemType} moved`,
            description: `${itemType} moved to equipment. Any conflicting weapons were automatically moved to inventory.`
          });
          console.log('[MovePrinting] ========== MOVE COMPLETE (with refetch) ==========');
          return;
        }
      }

      toast({
        title: "Card moved",
        description: `Moved card from ${printing.category} to ${newCategory}.`
      });
      console.log('[MovePrinting] ========== MOVE COMPLETE ==========');

    } catch (err) {
      console.error('[MovePrinting] ❌❌❌ ERROR OCCURRED ❌❌❌');
      console.error('[MovePrinting] Error details:', err);

      // Rollback optimistic update on error
      if (deck) {
        console.log('[MovePrinting] Rolling back to last known good state');
        setOptimisticDeck(deck);
      }

      toast({
        title: "Error",
        description: "Failed to move card between categories.",
        variant: "destructive"
      });
      console.log('[MovePrinting] ========== MOVE FAILED ==========');
    } finally {
      // Always remove card from moving set
      setMovingCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(cardKey);
        return newSet;
      });
      console.log('[MovePrinting] Card unmarked from moving set');
    }
  };

  const handleAddAnother = async (printing: DeckPrinting & { category: string }) => {
    if (!canEdit) return;
    
    try {
      // Get the card details from the existing printing
      const card = {
        unique_id: printing.printingDetails?.card_unique_id,
        name: printing.printingDetails?.display_name || printing.printingDetails?.name
      };
      
      const printingData = {
        printing_id: printing.printingId,
        unique_id: printing.printingId,
        ...printing.printingDetails
      };
      
      // Use the existing add function but set the active category to the printing's category
      const originalCategory = activeCategory;
      setActiveCategory(printing.category as any);
      
      await handleAddPrintingToDeck(card, printingData, 1);
      
      // Restore original category
      setActiveCategory(originalCategory);
      
    } catch (err) {
      console.error('Error adding another printing:', err);
      toast({
        title: "Error",
        description: "Failed to add another copy of this card.",
        variant: "destructive"
      });
    }
  };




  const handleRemovePrinting = async (printingToRemove: DeckPrinting & { category: string }) => {
    if (!canEdit) return;
    
    const cardKey = printingToRemove._id || printingToRemove.printingId;
    
    // Prevent double-clicks
    if (removingCards.has(cardKey)) return;
    
    try {
      // Step 1: Mark card as being removed (triggers animation)
      setRemovingCards(prev => new Set([...prev, cardKey]));
      
      // Step 2: Wait for animation to complete (300ms fade out)
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Step 3: Optimistic update - decrement quantity or remove from UI
      if (optimisticDeck) {
        const updatedDeck = { ...optimisticDeck };
        const category = printingToRemove.category;
        const categoryArray = [...updatedDeck[category as keyof Pick<Deck, 'hero' | 'equipment' | 'maindeck' | 'inventory' | 'maybeboard' | 'tokens'>] as DeckPrinting[]];

        const printingIndex = categoryArray.findIndex(p =>
          p._id === printingToRemove._id ||
          (p.printingId === printingToRemove.printingId &&
           JSON.stringify(p) === JSON.stringify(printingToRemove))
        );

        if (printingIndex !== -1) {
          const currentQty = categoryArray[printingIndex].quantity || 1;
          if (currentQty > 1) {
            // Decrement quantity, keep the item
            categoryArray[printingIndex] = { ...categoryArray[printingIndex], quantity: currentQty - 1 };
          } else {
            // Remove the item entirely
            categoryArray.splice(printingIndex, 1);
          }
          (updatedDeck as any)[category] = categoryArray;

          // Update counts optimistically
          const countField = `${category}Count` as keyof Deck;
          if (typeof updatedDeck[countField] === 'number') {
            (updatedDeck as any)[countField] = (updatedDeck[countField] as number) - 1;
          }

          if (typeof updatedDeck.totalCards === 'number') {
            updatedDeck.totalCards = updatedDeck.totalCards - 1;
          }

          setOptimisticDeck(updatedDeck);
        }
      }
  
      // Step 4: Make API call using client service
      const result = await decksClient.removePrinting(deckId, printingToRemove.printingId, printingToRemove.category as any);

      if (!result.success) {
        throw new Error(result.error || 'Failed to remove printing');
      }
  
      // Success! Card is already removed from UI
      toast({
        title: "Card removed",
        description: "Card has been removed from your deck."
      });
      
    } catch (err) {
      console.error('Error removing printing:', err);
      
      // Rollback: Remove from removing set and refetch real data
      setRemovingCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(cardKey);
        return newSet;
      });
      
      await fetchDeck();
      
      toast({
        title: "Error",
        description: "Failed to remove card from deck.",
        variant: "destructive"
      });
    } finally {
      // Clean up removing state (in case of success)
      setRemovingCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(cardKey);
        return newSet;
      });
    }
  };

  const handleMovePrinting = async (printing: DeckPrinting & { category: string }) => {
    console.log('[handleMovePrinting] ========== MOVE STARTED ==========');
    console.log('[handleMovePrinting] Card:', printing.printingDetails?.display_name || printing.printingDetails?.name);
    console.log('[handleMovePrinting] PrintingId:', printing.printingId);
    console.log('[handleMovePrinting] Current category:', printing.category);
    console.log('[handleMovePrinting] printingDetails exists:', !!printing.printingDetails);
    console.log('[handleMovePrinting] Card types:', printing.printingDetails?.types);
    console.log('[handleMovePrinting] Card subtypes:', printing.printingDetails?.subtypes);

    // Determine target category based on card type and current location
    const types = printing.printingDetails?.types || [];
    const isEquipment = types.includes('equipment') || types.includes('weapon');
    const isHero = types.includes('hero');

    console.log('[handleMovePrinting] types array:', types);
    console.log('[handleMovePrinting] isEquipment:', isEquipment);
    console.log('[handleMovePrinting] isHero:', isHero);

    let newCategory: "maindeck" | "inventory" | "equipment";

    // Hero cards can't be moved
    if (isHero) {
      toast({
        title: "Cannot move hero",
        description: "Hero cards cannot be moved to other categories.",
        variant: "destructive"
      });
      return;
    }

    // If it's equipment/weapon
    if (isEquipment) {
      // Check if this is Evo equipment (can be played as actions in the deck)
      const isEvo = types.includes('evo');

      if (isEvo && viewMode !== 'playmat') {
        // Evo equipment during deck building: can only be in maindeck or inventory
        if (printing.category === 'maindeck') {
          newCategory = 'inventory';
        } else {
          newCategory = 'maindeck';
        }
      } else {
        // Normal equipment OR playmat view: can move between equipment and inventory
        if (printing.category === 'equipment') {
          // Equipment → Inventory
          newCategory = 'inventory';
        } else {
          // Inventory/Maindeck → Equipment
          newCategory = 'equipment';
        }
      }
    } else {
      // Non-equipment cards toggle between maindeck and inventory
      if (printing.category === 'maindeck') {
        newCategory = 'inventory';
      } else {
        newCategory = 'maindeck';
      }
    }

    console.log('[handleMovePrinting] Target category:', newCategory);
    console.log('[handleMovePrinting] ========== CALLING handleMovePrintingToCategory ==========');

    await handleMovePrintingToCategory(printing, newCategory);
  };

  const handleMoveMultiple = async (printing: DeckPrinting & { category: string }, quantity: number) => {
    console.log('[handleMoveMultiple] ========== MOVE MULTIPLE STARTED ==========');
    console.log('[handleMoveMultiple] Card:', printing.printingDetails?.display_name || printing.printingDetails?.name);
    console.log('[handleMoveMultiple] Quantity:', quantity);
    console.log('[handleMoveMultiple] Current category:', printing.category);

    // Determine target category (same logic as handleMovePrinting)
    const types = printing.printingDetails?.types || [];
    const isEquipment = types.includes('equipment') || types.includes('weapon');
    const isHero = types.includes('hero');

    let newCategory: "maindeck" | "inventory" | "equipment";

    // Hero cards can't be moved
    if (isHero) {
      toast({
        title: "Cannot move hero",
        description: "Hero cards cannot be moved to other categories.",
        variant: "destructive"
      });
      return;
    }

    // If it's equipment/weapon
    if (isEquipment) {
      const isEvo = types.includes('evo');

      if (isEvo && viewMode !== 'playmat') {
        if (printing.category === 'maindeck') {
          newCategory = 'inventory';
        } else {
          newCategory = 'maindeck';
        }
      } else {
        if (printing.category === 'equipment') {
          newCategory = 'inventory';
        } else {
          newCategory = 'equipment';
        }
      }
    } else {
      if (printing.category === 'maindeck') {
        newCategory = 'inventory';
      } else {
        newCategory = 'maindeck';
      }
    }

    console.log('[handleMoveMultiple] Target category:', newCategory);

    // Move N copies sequentially
    const cardName = printing.printingDetails?.display_name || printing.printingDetails?.name || 'card';

    try {
      for (let i = 0; i < quantity; i++) {
        console.log(`[handleMoveMultiple] Moving copy ${i + 1}/${quantity}`);

        // Find a printing of this card in the source category
        const currentPrinting = printings.find(
          p => p.printingId === printing.printingId && p.category === printing.category
        );

        if (!currentPrinting) {
          console.log(`[handleMoveMultiple] No more copies found after moving ${i} copies`);
          break;
        }

        await handleMovePrintingToCategory(currentPrinting, newCategory);
      }

      toast({
        title: "Cards moved",
        description: `Moved ${quantity} ${quantity === 1 ? 'copy' : 'copies'} of ${cardName} to ${newCategory}.`,
        duration: isMobile ? 1500 : undefined
      });

      console.log('[handleMoveMultiple] ========== MOVE MULTIPLE COMPLETE ==========');
    } catch (err) {
      console.error('[handleMoveMultiple] Error:', err);
      toast({
        title: "Error",
        description: "Failed to move all copies. Some may have been moved.",
        variant: "destructive"
      });
    }
  };

  // Printing swap handlers
  const handleOpenPrintingSwap = (printing: DeckPrinting & { category: string }) => {
    setSwappingPrinting(printing);
    setPrintingSwapOpen(true);
  };

  const handlePrintingSwapComplete = async (oldPrintingId: string, newPrintingId: string) => {
    // Refetch deck data to get the updated printing information
    await fetchDeck();

    toast({
      title: "Printing updated",
      description: "Card printing has been changed successfully."
    });
  };

  // Ownership comparison handlers
  const handleOpenOwnershipComparison = (printing: DeckPrinting & { category: string }) => {
    // Find all copies of this card in the deck (by card_unique_id)
    const cardUniqueId = printing.printingDetails?.card_unique_id;
    if (!cardUniqueId || !displayDeck) return;

    // Collect all copies from all categories
    const allCopies: (DeckPrinting & { category: string })[] = [];

    (['hero', 'equipment', 'maindeck', 'inventory'] as const).forEach(category => {
      const categoryCards = displayDeck[category] as DeckPrinting[];
      if (categoryCards) {
        categoryCards.forEach(card => {
          if (card.printingDetails?.card_unique_id === cardUniqueId) {
            allCopies.push({ ...card, category });
          }
        });
      }
    });

    setComparingPrinting(printing);
    setComparingCardCopies(allCopies);
    setComparisonDialogOpen(true);
  };

  const handleSwapPrintingFromComparison = async (deckCopyId: string, newPrintingId: string) => {
    // Find the specific deck copy to swap
    const deckCopy = comparingCardCopies.find(copy => copy._id === deckCopyId);
    if (!deckCopy) {
      console.error('[SwapFromComparison] Deck copy not found:', deckCopyId);
      return;
    }

    console.log('[SwapFromComparison] Swapping:', deckCopy.printingId, '->', newPrintingId, 'in category:', deckCopy.category);

    try {
      // Use the swap endpoint via client service
      console.log('[SwapFromComparison] Swap payload:', {
        oldPrintingId: deckCopy.printingId,
        newPrintingId: newPrintingId,
        category: deckCopy.category
      });

      const swapResult = await decksClient.swapPrinting(
        deckId,
        deckCopy.printingId,
        newPrintingId,
        deckCopy.category as any
      );

      console.log('[SwapFromComparison] Swap result:', swapResult);

      if (!swapResult.success) {
        throw new Error(swapResult.error || 'Failed to swap printing');
      }

      // Fetch the new printing details to update the UI
      const { searchClient } = await import('@/lib/client');
      const printingResult = await searchClient.getPrintingById(newPrintingId);
      if (printingResult.success) {
        // Update the local state to reflect the change without closing the dialog
        setComparingCardCopies(prev => prev.map(copy =>
          copy._id === deckCopyId
            ? {
                ...copy,
                printingId: newPrintingId,
                printingDetails: printingResult.data
              }
            : copy
        ));
      }

      toast({
        title: "Printing swapped",
        description: `Copy ${comparingCardCopies.findIndex(c => c._id === deckCopyId) + 1} swapped successfully.`
      });

      // Don't close the dialog - user might want to swap other copies
      // They can click Close when done

    } catch (error) {
      console.error('[SwapFromComparison] Error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to swap printing.",
        variant: "destructive"
      });
    }
  };

  // Bulk import handler
  const handleBulkImport = async (importResults: any[]) => {
    if (!canEdit) return;

    console.log('[DeckPage] Bulk import called with:', importResults);

    // Use client service for bulk import
    const result = await decksClient.addPrintings(deckId, importResults.map(card => ({
      printingId: card.printingId,
      quantity: card.quantity || 1,
      category: card.category || 'maindeck'
    })));

    if (!result.success) {
      throw new Error(result.error || 'Import failed');
    }

    // Clear optimistic deck and refetch to get updated data
    setOptimisticDeck(null);
    await fetchDeck();

    toast({
      title: "Import successful",
      description: `Added ${result.data.summary?.totalAdded || importResults.length} cards to your deck`
    });
  };

  // Calculate deck card counts per printing for wants comparison
  const deckCardCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    if (!displayDeck) return counts;

    const allCards = [
      ...(displayDeck.hero || []),
      ...(displayDeck.equipment || []),
      ...(displayDeck.maindeck || []),
      ...(displayDeck.inventory || []),
      ...(displayDeck.tokens || []),
      ...(displayDeck.maybeboard || [])
    ];
    allCards.forEach(card => {
      counts.set(card.printingId, (counts.get(card.printingId) || 0) + 1);
    });
    return counts;
  }, [displayDeck]);

  // Conditional renders
  if (authLoading || loading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  if (error) return <div className="flex justify-center items-center min-h-screen">{error}</div>;
  if (!displayDeck) return <div className="flex justify-center items-center min-h-screen">Deck not found</div>;

  // MOBILE RENDER
  if (isMobile) {
    return (
      <>
        {/* Shared dialogs */}
        <DeckCardSearchDialog
          open={isCardSearchOpen}
          onOpenChange={setIsCardSearchOpen}
          onSelectCard={handleAddPrintingToDeck}
          targetCategory={activeCategory}
          deckFormat={displayDeck.format}
          currentDeck={displayDeck}
        />
        <DeckSettings
          deck={{ ...displayDeck, hero: displayDeck.heroName }}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onSave={handleSaveSettings}
          loading={saving}
          deckId={deckId}
          fullDeck={displayDeck}
        />
        {printingSwapOpen && swappingPrinting && (
          <PrintingSwapDialog
            open={printingSwapOpen}
            onOpenChange={setPrintingSwapOpen}
            currentPrinting={{
              printingId: swappingPrinting.printingId,
              cardUniqueId: swappingPrinting.printingDetails?.card_unique_id,
              cardName: swappingPrinting.printingDetails?.display_name || swappingPrinting.printingDetails?.name || 'Card'
            }}
            onSwap={async (newPrinting) => {
              handleOptimisticSwap(swappingPrinting, newPrinting);
              const swapResult = await decksClient.swapPrinting(
                deckId,
                swappingPrinting.printingId,
                newPrinting.printing_id,
                swappingPrinting.category as any
              );
              return { success: swapResult.success, error: swapResult.success ? undefined : swapResult.error };
            }}
            onSwapComplete={() => handlePrintingSwapComplete(swappingPrinting.printingId, '')}
          />
        )}
        <DeckBulkImportDialog
          open={bulkImportOpen}
          onOpenChange={setBulkImportOpen}
          onImport={handleBulkImport}
          deckFormat={displayDeck.format}
          currentDeck={displayDeck}
        />
        {comparingPrinting && comparingCardCopies.length > 0 && (
          <PrintingComparisonDialog
            open={comparisonDialogOpen}
            onOpenChange={setComparisonDialogOpen}
            deckCopies={comparingCardCopies.map(copy => ({
              _id: copy._id || '',
              printingId: copy.printingId,
              printingDetails: copy.printingDetails
            }))}
            cardName={comparingPrinting.printingDetails?.display_name || comparingPrinting.printingDetails?.name || 'Card'}
            cardUniqueId={comparingPrinting.printingDetails?.card_unique_id || ''}
            onSwapPrinting={handleSwapPrintingFromComparison}
          />
        )}

        <MobileDeckLayout
          deck={displayDeck as any}
          printings={printings}
          groupedCards={groupedCards}
          filteredPrintings={filteredPrintings}
          filteredGroupedCards={filteredGroupedCards}
          canEdit={!!canEdit}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          ownershipStatus={ownershipStatus}
          wantsMap={wantsMap}
          binderMap={binderMap}
          deckCardCounts={deckCardCounts}
          removingCards={removingCards}
          movingCards={movingCards}
          binders={binders}
          selectedBinderId={selectedBinderId}
          setSelectedBinderId={setSelectedBinderId}
          onRemove={handleRemovePrinting}
          onAddAnother={handleAddAnother}
          onMove={handleMovePrinting}
          onMoveMultiple={handleMoveMultiple}
          onOpenPrintingSwap={handleOpenPrintingSwap}
          onOpenOwnershipComparison={handleOpenOwnershipComparison}
          onAddCard={(category) => {
            setActiveCategory(category);
            setIsCardSearchOpen(true);
          }}
          onAddToWants={async (card) => {
            try {
              const result = await wantsClient.addWantsItem(card.printingId, 1, 'medium');
              if (result.success) {
                const currentQty = wantsMap.get(card.printingId) || 0;
                const newQty = currentQty + 1;
                toast({
                  title: "Added to wants!",
                  description: `Want ${newQty} ${newQty === 1 ? 'copy' : 'copies'} of ${card.printingDetails?.display_name || card.printingDetails?.name || 'card'}.`,
                });
                setWantsMap(prev => new Map(prev).set(card.printingId, newQty));
              }
            } catch (error) {
              toast({ title: "Error", description: "Failed to add card to wants list.", variant: "destructive" });
            }
          }}
          onAddToBinder={async (card) => {
            if (!selectedBinderId) {
              toast({ title: "No binder selected", description: "Please select a binder from the menu first.", variant: "destructive" });
              return;
            }
            try {
              const result = await bindersClient.addCardsToBinder(selectedBinderId, [{
                printingId: card.printingId,
                quantity: 1,
                condition: 'NM',
                notes: `From deck: ${displayDeck.name}`
              }]);
              if (result.success) {
                const binderName = binders.find(b => b._id === selectedBinderId)?.name || 'binder';
                const currentBinderInfo = binderMap.get(card.printingId);
                const newQty = (currentBinderInfo?.quantity || 0) + 1;
                toast({
                  title: "Added to binder!",
                  description: `Have ${newQty} ${newQty === 1 ? 'copy' : 'copies'} in ${binderName}.`,
                });
                setOwnershipRefreshKey(prev => prev + 1);
              }
            } catch (error) {
              toast({ title: "Error", description: "Failed to add card to binder.", variant: "destructive" });
            }
          }}
          onSelectCard={handleAddPrintingToDeck}
          onOpenSearch={() => setIsCardSearchOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenBulkImport={() => setBulkImportOpen(true)}
        />
      </>
    );
  }

  // DESKTOP RENDER
  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <DeckCardSearchDialog 
          open={isCardSearchOpen} 
          onOpenChange={setIsCardSearchOpen} 
          onSelectCard={handleAddPrintingToDeck} 
          targetCategory={activeCategory} 
          deckFormat={displayDeck.format} 
          currentDeck={displayDeck} 
        />
        
        <DeckSettings
          deck={{ ...displayDeck, hero: displayDeck.heroName }}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onSave={handleSaveSettings}
          loading={saving}
          deckId={deckId}
          fullDeck={displayDeck}
        />
        
        {printingSwapOpen && swappingPrinting && (
          <PrintingSwapDialog
            open={printingSwapOpen}
            onOpenChange={setPrintingSwapOpen}
            currentPrinting={{
              printingId: swappingPrinting.printingId,
              cardUniqueId: swappingPrinting.printingDetails?.card_unique_id,
              cardName: swappingPrinting.printingDetails?.display_name || swappingPrinting.printingDetails?.name || 'Card'
            }}
            onSwap={async (newPrinting) => {
              // Call optimistic update
              handleOptimisticSwap(swappingPrinting, newPrinting);

              // Use the client service for swap
              const swapResult = await decksClient.swapPrinting(
                deckId,
                swappingPrinting.printingId,
                newPrinting.printing_id,
                swappingPrinting.category as any
              );

              return { success: swapResult.success, error: swapResult.success ? undefined : swapResult.error };
            }}
            onSwapComplete={() => handlePrintingSwapComplete(swappingPrinting.printingId, '')}
          />
        )}

        <DeckBulkImportDialog
          open={bulkImportOpen}
          onOpenChange={setBulkImportOpen}
          onImport={handleBulkImport}
          deckFormat={displayDeck.format}
          currentDeck={displayDeck}
        />

        {comparingPrinting && comparingCardCopies.length > 0 && (
          <PrintingComparisonDialog
            open={comparisonDialogOpen}
            onOpenChange={setComparisonDialogOpen}
            deckCopies={comparingCardCopies.map(copy => ({
              _id: copy._id || '',
              printingId: copy.printingId,
              printingDetails: copy.printingDetails
            }))}
            cardName={comparingPrinting.printingDetails?.display_name || comparingPrinting.printingDetails?.name || 'Card'}
            cardUniqueId={comparingPrinting.printingDetails?.card_unique_id || ''}
            onSwapPrinting={handleSwapPrintingFromComparison}
          />
        )}

        <div className="container mx-auto px-4 py-2">
          {/* Header */}
          <div className="flex items-center gap-4 mb-2">
            <Button variant="ghost" onClick={() => router.push("/decks")} className="p-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{displayDeck.name}</h1>
              <Badge>{displayDeck.format}</Badge>
              <Badge>{displayDeck.isPublic ? "Public" : "Private"}</Badge>
              {displayDeck.heroName && <Badge variant="outline">Hero: {displayDeck.heroName}</Badge>}
              <span className="text-sm text-gray-400">{deckStats.totalCards} cards</span>
              {deckStats.estimatedValue > 0 && <span className="text-sm text-gray-400">~${deckStats.estimatedValue.toFixed(2)}</span>}
            </div>
            <div className="flex items-center gap-2">
              {canEdit && binders.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Default binder:</span>
                  <Select value={selectedBinderId} onValueChange={setSelectedBinderId}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Select binder..." />
                    </SelectTrigger>
                    <SelectContent>
                      {binders.map((binder) => (
                        <SelectItem key={binder._id} value={binder._id}>
                          {binder.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {canEdit && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setBulkImportOpen(true)}>
                    <Upload className="h-4 w-4 mr-2" />Import Decklist
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                    <Settings className="h-4 w-4 mr-2" />Settings
                  </Button>
                </>
              )}
            </div>
          </div>

           {/* Tabs */}
           <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Tabs Row */}
            <div className="flex items-center gap-3 mb-2">
              <TabsList className="flex-shrink-0">
                <TabsTrigger value="builder">Builder</TabsTrigger>
                <TabsTrigger value="simulator">Simulator</TabsTrigger>
                <TabsTrigger value="matchups" className="relative">
                  <Swords className="h-4 w-4 mr-2" />
                  Matchups
                  <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-blue-500 text-white rounded-full">
                    NEW
                  </span>
                </TabsTrigger>
                <TabsTrigger value="analysis">
                  <BarChart3 className="h-4 w-4 mr-2" />Analysis
                </TabsTrigger>
                <TabsTrigger value="collection">
                  <BookOpen className="h-4 w-4 mr-2" />Collection
                </TabsTrigger>
                <TabsTrigger value="export">Export</TabsTrigger>
              </TabsList>

              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input placeholder="Search cards..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
            </div>

            {/* View Controls Row */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex gap-1">
                {/* Catalog view only available when hero is selected */}
                {displayDeck?.hero?.length > 0 && (
                  <Button variant={viewMode === "catalog" ? "default" : "outline"} size="sm" onClick={() => setViewMode("catalog")}>
                    Catalog
                  </Button>
                )}
                <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")}>
                  List
                </Button>
                <Button variant={viewMode === "compact" ? "default" : "outline"} size="sm" onClick={() => setViewMode("compact")}>
                  Compact
                </Button>
                <Button variant={viewMode === "grouped" ? "default" : "outline"} size="sm" onClick={() => setViewMode("grouped")}>
                  Grouped
                </Button>
                <Button variant={viewMode === "individual" ? "default" : "outline"} size="sm" onClick={() => setViewMode("individual")}>
                  Individual
                </Button>
                <Button variant={viewMode === "playmat" ? "default" : "outline"} size="sm" onClick={() => setViewMode("playmat")}>
                  Playmat
                </Button>
              </div>

              {/* Compact view grouping toggle */}
              {viewMode === "compact" && (
                <div className="flex items-center gap-2 border-l border-gray-300 dark:border-gray-700 pl-3">
                  <span className="text-sm text-gray-500">Stack by:</span>
                  <ToggleGroup type="single" value={stackGrouping} onValueChange={(value) => value && setStackGrouping(value as "by-name" | "by-printing")}>
                    <ToggleGroupItem value="by-name" aria-label="Group by card name" size="sm">
                      Card Name
                    </ToggleGroupItem>
                    <ToggleGroupItem value="by-printing" aria-label="Group by printing" size="sm">
                      Printing
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              )}
            </div>

            <TabsContent value="builder" className="space-y-0">
              {/* Show split-view catalog if viewMode is "catalog" (only when hero is selected) */}
              {viewMode === "catalog" ? (
                <DeckBuilderSplitView
                  deckId={deckId}
                  deck={displayDeck}
                  deckFormat={displayDeck.format}
                  onDeckUpdate={fetchDeck}
                  setDeck={(updater) => {
                    // Update both deck and optimisticDeck to ensure UI updates
                    setDeck(updater)
                    setOptimisticDeck(updater)
                  }}
                />
              ) : viewMode === "playmat" ? (
                <PlaymatView
                  deck={displayDeck}
                  editable={!!canEdit}
                  ownershipRefreshKey={ownershipRefreshKey}
                  wantsMap={wantsMap}
                  deckCardCounts={deckCardCounts}
                  binderMap={binderMap}
                  onZoneClick={(zone) => {
                    // Map zone names to categories
                    const zoneMap: Record<string, typeof activeCategory> = {
                      hero: "hero",
                      equipment: "equipment",
                      maindeck: "maindeck",
                      inventory: "inventory",
                    };
                    if (zoneMap[zone]) {
                      setActiveCategory(zoneMap[zone]);
                      setViewMode("individual"); // Switch to individual view when clicking a zone
                    }
                  }}
                  onShuffle={() => {
                    toast({
                      title: "Deck shuffled",
                      description: "Your deck has been shuffled (visual only)."
                    });
                  }}
                  onSwap={(card) => {
                    setSwappingPrinting(card);
                    setPrintingSwapOpen(true);
                  }}
                  onMove={handleMovePrinting}
                  onRemove={handleRemovePrinting}
                  onAddCard={(category) => {
                    // Map category to activeCategory type
                    const categoryMap: Record<string, typeof activeCategory> = {
                      hero: "hero",
                      equipment: "equipment",
                      maindeck: "maindeck",
                      inventory: "inventory",
                    };
                    if (categoryMap[category]) {
                      setActiveCategory(categoryMap[category]);
                      setIsCardSearchOpen(true);
                    }
                  }}
                  onAddToWants={async (card) => {
                    try {
                      const result = await wantsClient.addWantsItem(card.printingId, 1, 'medium');

                      if (result.success) {
                        const currentQty = wantsMap.get(card.printingId) || 0;
                        const newQty = currentQty + 1;
                        toast({
                          title: "Added to wants!",
                          description: `Want ${newQty} ${newQty === 1 ? 'copy' : 'copies'} of ${card.printingDetails?.display_name || card.printingDetails?.name || 'card'}.`,
                        });
                        // Update wants map with new quantity
                        setWantsMap(prev => new Map(prev).set(card.printingId, newQty));
                      } else {
                        throw new Error('Failed to add to wants');
                      }
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to add card to wants list.",
                        variant: "destructive",
                      });
                    }
                  }}
                  onAddToBinder={async (card) => {
                    if (!selectedBinderId) {
                      toast({
                        title: "No binder selected",
                        description: "Please select a binder from the dropdown first.",
                        variant: "destructive",
                      });
                      return;
                    }

                    try {
                      const result = await bindersClient.addCardsToBinder(selectedBinderId, [{
                        printingId: card.printingId,
                        quantity: 1,
                        condition: 'NM',
                        notes: `From deck: ${displayDeck.name}`
                      }]);

                      if (result.success) {
                        const binderName = binders.find(b => b._id === selectedBinderId)?.name || 'binder';
                        const currentBinderInfo = binderMap.get(card.printingId);
                        const newQty = (currentBinderInfo?.quantity || 0) + 1;
                        toast({
                          title: "Added to binder!",
                          description: `Have ${newQty} ${newQty === 1 ? 'copy' : 'copies'} of ${card.printingDetails?.display_name || card.printingDetails?.name || 'card'} in ${binderName}.`,
                        });
                        // Refresh ownership status and binder inventory to update badges
                        setOwnershipRefreshKey(prev => prev + 1);
                      } else {
                        throw new Error('Failed to add to binder');
                      }
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to add card to binder.",
                        variant: "destructive",
                      });
                    }
                  }}
                  onRemoveFromBinder={async (card) => {
                    if (!selectedBinderId) {
                      toast({
                        title: "No binder selected",
                        description: "Please select a binder first.",
                        variant: "destructive",
                      });
                      return;
                    }

                    const binderInfo = binderMap.get(card.printingId);
                    if (!binderInfo || binderInfo.quantity === 0) return;

                    try {
                      const newQty = binderInfo.quantity - 1;

                      if (newQty === 0) {
                        // Delete the card entirely
                        const result = await bindersClient.deleteBinderCard(selectedBinderId, binderInfo.cardId);

                        if (result.success) {
                          const binderName = binders.find(b => b._id === selectedBinderId)?.name || 'binder';
                          toast({
                            title: "Removed from binder",
                            description: `Removed ${card.printingDetails?.display_name || card.printingDetails?.name || 'card'} from ${binderName}.`,
                          });
                          // Refresh ownership status and binder inventory
                          setOwnershipRefreshKey(prev => prev + 1);
                        }
                      } else {
                        // Update quantity
                        const result = await bindersClient.updateBinderCard(selectedBinderId, binderInfo.cardId, {
                          quantity: newQty
                        });

                        if (result.success) {
                          const binderName = binders.find(b => b._id === selectedBinderId)?.name || 'binder';
                          toast({
                            title: "Updated binder",
                            description: `Have ${newQty} ${newQty === 1 ? 'copy' : 'copies'} of ${card.printingDetails?.display_name || card.printingDetails?.name || 'card'} in ${binderName}.`,
                          });
                          // Refresh ownership status and binder inventory
                          setOwnershipRefreshKey(prev => prev + 1);
                        }
                      }
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to remove card from binder.",
                        variant: "destructive",
                      });
                    }
                  }}
                  onRemoveFromWants={async (card) => {
                    const currentQty = wantsMap.get(card.printingId) || 0;
                    if (currentQty === 0) return;

                    try {
                      const result = await wantsClient.removeWantsItem(card.printingId);

                      if (result.success) {
                        const newQty = currentQty - 1;
                        if (newQty === 0) {
                          toast({
                            title: "Removed from wants",
                            description: `Removed ${card.printingDetails?.display_name || card.printingDetails?.name || 'card'} from wants list.`,
                          });
                          // Remove from map
                          setWantsMap(prev => {
                            const newMap = new Map(prev);
                            newMap.delete(card.printingId);
                            return newMap;
                          });
                        } else {
                          toast({
                            title: "Updated wants",
                            description: `Want ${newQty} ${newQty === 1 ? 'copy' : 'copies'} of ${card.printingDetails?.display_name || card.printingDetails?.name || 'card'}.`,
                          });
                          // Update quantity
                          setWantsMap(prev => new Map(prev).set(card.printingId, newQty));
                        }
                      } else {
                        throw new Error('Failed to remove from wants');
                      }
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to update wants list.",
                        variant: "destructive",
                      });
                    }
                  }}
                  onToggleForTrade={async (card, forTrade) => {
                    try {
                      // Note: This endpoint may need a client service method if frequently used
                      const response = await fetch('/api/inventory/toggle-for-trade', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          printingId: card.printingId,
                          forTrade: forTrade
                        }),
                      });

                      if (response.ok) {
                        const data = await response.json();
                        toast({
                          title: forTrade ? "Marked for trade" : "Unmarked for trade",
                          description: `Updated ${data.updatedCount} ${data.updatedCount === 1 ? 'copy' : 'copies'} of ${card.printingDetails?.display_name || card.printingDetails?.name || 'card'}.`,
                        });
                        // Refresh ownership status to update forTrade badge
                        setOwnershipRefreshKey(prev => prev + 1);
                      } else {
                        throw new Error('Failed to update forTrade status');
                      }
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to update trade status.",
                        variant: "destructive",
                      });
                    }
                  }}
                  onUpdateTags={async (card, tags) => {
                    try {
                      // Update the local optimistic deck state
                      if (optimisticDeck) {
                        const updatedDeck = { ...optimisticDeck };
                        const category = card.category;
                        const categoryArray = [...updatedDeck[category as keyof Pick<Deck, 'hero' | 'equipment' | 'maindeck' | 'inventory' | 'maybeboard' | 'tokens'>] as DeckPrinting[]];

                        const printingIndex = categoryArray.findIndex(p =>
                          p._id === card._id || p.printingId === card.printingId
                        );

                        if (printingIndex !== -1) {
                          categoryArray[printingIndex] = {
                            ...categoryArray[printingIndex],
                            tags: tags
                          };
                          (updatedDeck as any)[category] = categoryArray;
                          setOptimisticDeck(updatedDeck);
                        }
                      }

                      toast({
                        title: "Tags updated",
                        description: `Updated tags for ${card.printingDetails?.display_name || card.printingDetails?.name || 'card'}.`,
                      });
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to update tags.",
                        variant: "destructive",
                      });
                    }
                  }}
                />
              ) : viewMode === "list" ? (
                (["hero", "equipment", "maindeck", "inventory"] as const).map((category) => (
                  <DeckListView
                    key={category}
                    printings={filteredPrintings}
                    groupedCards={filteredGroupedCards}
                    category={category}
                    editable={!!canEdit}
                    ownershipStatus={ownershipStatus}
                    wantsMap={wantsMap}
                    binderMap={binderMap}
                    deckCardCounts={deckCardCounts}
                    onRemove={handleRemovePrinting}
                    onAddAnother={handleAddAnother}
                    onMove={handleMovePrinting}
                    onOpenPrintingSwap={handleOpenPrintingSwap}
                    onOpenOwnershipComparison={handleOpenOwnershipComparison}
                    onAddCard={() => {
                      setActiveCategory(category);
                      setIsCardSearchOpen(true);
                    }}
                    removingCards={removingCards}
                  />
                ))
              ) : (
                (["maindeck", "equipment", "inventory"] as const).map((category) => (
                  <DeckPrintingsGrid
                    key={category}
                    printings={filteredPrintings}
                    groupedCards={filteredGroupedCards}
                    category={category}
                    editable={!!canEdit}
                    viewMode={viewMode}
                    stackGrouping={stackGrouping}
                    ownershipStatus={ownershipStatus}
                    onRemove={handleRemovePrinting}
                    onAddAnother={handleAddAnother}
                    onMove={handleMovePrinting}
                    onOpenPrintingSwap={handleOpenPrintingSwap}
                    onAddCard={() => {
                      setActiveCategory(category);
                      setIsCardSearchOpen(true);
                    }}
                    SortablePrintingCard={SortablePrintingCard}
                    removingCards={removingCards}
                    movingCards={movingCards}
                    onAddToWants={async (card) => {
                      try {
                        const result = await wantsClient.addWantsItem(card.printingId, 1, 'medium');

                        if (result.success) {
                          const currentQty = wantsMap.get(card.printingId) || 0;
                          const newQty = currentQty + 1;
                          toast({
                            title: "Added to wants!",
                            description: `Want ${newQty} ${newQty === 1 ? 'copy' : 'copies'} of ${card.printingDetails?.display_name || card.printingDetails?.name || 'card'}.`,
                          });
                          setWantsMap(prev => new Map(prev).set(card.printingId, newQty));
                        } else {
                          throw new Error('Failed to add to wants');
                        }
                      } catch (error) {
                        toast({
                          title: "Error",
                          description: "Failed to add card to wants list.",
                          variant: "destructive",
                        });
                      }
                    }}
                    onAddToBinder={async (card) => {
                      if (!selectedBinderId) {
                        toast({
                          title: "No binder selected",
                          description: "Please select a binder from the dropdown first.",
                          variant: "destructive",
                        });
                        return;
                      }

                      try {
                        const result = await bindersClient.addCardsToBinder(selectedBinderId, [{
                          printingId: card.printingId,
                          quantity: 1,
                          condition: 'NM',
                          notes: `From deck: ${displayDeck.name}`
                        }]);

                        if (result.success) {
                          const binderName = binders.find(b => b._id === selectedBinderId)?.name || 'binder';
                          const currentBinderInfo = binderMap.get(card.printingId);
                          const newQty = (currentBinderInfo?.quantity || 0) + 1;
                          toast({
                            title: "Added to binder!",
                            description: `Have ${newQty} ${newQty === 1 ? 'copy' : 'copies'} of ${card.printingDetails?.display_name || card.printingDetails?.name || 'card'} in ${binderName}.`,
                          });
                          setOwnershipRefreshKey(prev => prev + 1);
                        } else {
                          throw new Error('Failed to add to binder');
                        }
                      } catch (error) {
                        toast({
                          title: "Error",
                          description: "Failed to add card to binder.",
                          variant: "destructive",
                        });
                      }
                    }}
                    wantsMap={wantsMap}
                    binderMap={binderMap}
                    deckCardCounts={deckCardCounts}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="simulator">
              <DeckSimulator deck={displayDeck} />
            </TabsContent>

            <TabsContent value="matchups">
              {displayDeck && (
                <DeckMatchupsDialog
                  open={true}
                  onOpenChange={() => {}}
                  deckId={deckId}
                  deck={displayDeck}
                  inline={true}
                />
              )}
            </TabsContent>

            <TabsContent value="analysis">
                <DeckAnalysis deck={deckForAnalysis} stats={deckStats} loading={loading} />
            </TabsContent>

            <TabsContent value="collection">
              <DeckBinderComparison deck={displayDeck} />
            </TabsContent>

            <TabsContent value="export">
              <DeckExport deck={displayDeck} onCopyList={() => {}} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DndContext>
  );
}
