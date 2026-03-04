"use client";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/components/ui/use-mobile";
import { decksClient, bindersClient, wantsClient, searchClient } from "@/lib/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DeckPrinting {
  _id?: string;
  printingId: string;
  quantity?: number;
  condition?: string;
  notes?: string;
  addedAt: string;
  isOptimistic?: boolean;
  printingDetails?: { [key: string]: any };
  tags?: string[];
}

export interface CardGroup {
  cardName: string;
  cardId: string;
  category: "hero" | "equipment" | "maindeck" | "inventory";
  printings: (DeckPrinting & { category: string })[];
}

export interface Deck {
  _id: string;
  userId: string;
  name: string;
  description?: string;
  format: string;
  isPublic: boolean;
  hero: DeckPrinting[];
  equipment: DeckPrinting[];
  maindeck: DeckPrinting[];
  inventory: DeckPrinting[];
  maybeboard?: DeckPrinting[];
  tokens?: DeckPrinting[];
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

// ─── Helper ──────────────────────────────────────────────────────────────────

export function groupCardsByCardAndCategory(
  printings: (DeckPrinting & { category: string })[]
): Record<string, CardGroup> {
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
}

const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDeckPage(deckId: string) {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

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

  // Optimistic deck state
  const [optimisticDeck, setOptimisticDeck] = useState<Deck | null>(null);

  // ─── Computed values ────────────────────────────────────────────────────────

  const displayDeck = useMemo(() => optimisticDeck || deck, [optimisticDeck, deck]);

  const printings = useMemo(() => {
    if (!displayDeck) return [];
    return [
      ...(displayDeck.hero || []).map(p => ({ ...p, category: 'hero' as const })),
      ...(displayDeck.equipment || []).map(p => ({ ...p, category: 'equipment' as const })),
      ...(displayDeck.maindeck || []).map(p => ({ ...p, category: 'maindeck' as const })),
      ...(displayDeck.inventory || []).map(p => ({ ...p, category: 'inventory' as const })),
      ...(displayDeck.maybeboard || []).map(p => ({ ...p, category: 'maybeboard' as const })),
      ...(displayDeck.tokens || []).map(p => ({ ...p, category: 'tokens' as const })),
    ];
  }, [displayDeck]);

  const canEdit = useMemo(
    () => displayDeck?.canEdit || (user && displayDeck && user.id === displayDeck.userId),
    [displayDeck, user]
  );

  const groupedCards = useMemo(() => groupCardsByCardAndCategory(printings), [printings]);

  const filteredPrintings = useMemo(() => {
    if (!searchQuery) return printings;
    return printings.filter(p => {
      const name = (p.printingDetails?.display_name || p.printingDetails?.name || '').toLowerCase();
      const setName = (p.printingDetails?.set_name || '').toLowerCase();
      const notes = (p.notes || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      return name.includes(query) || setName.includes(query) || notes.includes(query);
    });
  }, [printings, searchQuery]);

  const filteredGroupedCards = useMemo(
    () => groupCardsByCardAndCategory(filteredPrintings),
    [filteredPrintings]
  );

  const deckStats = useMemo(() => {
    const actualTotalCards =
      (displayDeck?.hero?.length || 0) +
      (displayDeck?.equipment?.length || 0) +
      (displayDeck?.maindeck?.length || 0) +
      (displayDeck?.inventory?.length || 0);

    return {
      totalCards: actualTotalCards,
      uniqueCards: Object.keys(groupedCards).length,
      estimatedValue: displayDeck?.estimatedValue || 0,
      categoryBreakdown: [
        {
          category: 'hero',
          count: displayDeck?.hero?.length || 0,
          unique: Object.values(groupedCards).filter(g => g.category === 'hero').length,
        },
        {
          category: 'equipment',
          count: displayDeck?.equipment?.length || 0,
          unique: Object.values(groupedCards).filter(g => g.category === 'equipment').length,
        },
        {
          category: 'maindeck',
          count: displayDeck?.maindeck?.length || 0,
          unique: Object.values(groupedCards).filter(g => g.category === 'maindeck').length,
        },
        {
          category: 'inventory',
          count: displayDeck?.inventory?.length || 0,
          unique: Object.values(groupedCards).filter(g => g.category === 'inventory').length,
        },
      ],
    };
  }, [displayDeck, groupedCards]);

  const deckForAnalysis = useMemo(() => ({
    ...displayDeck,
    cards: printings.map(printing => ({
      id: printing._id || printing.printingId,
      cardId: printing.printingDetails?.card_unique_id || printing.printingId,
      name:
        printing.printingDetails?.display_name ||
        printing.printingDetails?.name ||
        `Card ${printing.printingId}`,
      quantity: 1,
      category: printing.category,
      printingDetails: printing.printingDetails,
    })),
  }), [displayDeck, printings]);

  const deckCardCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!displayDeck) return counts;
    const allCards = [
      ...(displayDeck.hero || []),
      ...(displayDeck.equipment || []),
      ...(displayDeck.maindeck || []),
      ...(displayDeck.inventory || []),
      ...(displayDeck.tokens || []),
      ...(displayDeck.maybeboard || []),
    ];
    allCards.forEach(card => {
      counts.set(card.printingId, (counts.get(card.printingId) || 0) + 1);
    });
    return counts;
  }, [displayDeck]);

  // ─── Effects ────────────────────────────────────────────────────────────────

  // Sync optimisticDeck when deck changes and !optimisticDeck
  useEffect(() => {
    if (deck && !optimisticDeck) {
      setOptimisticDeck(deck);
    }
  }, [deck, optimisticDeck]);

  // Fetch deck on deckId change
  useEffect(() => {
    fetchDeck();
  }, [deckId]);

  // viewMode fallback: catalog → list when no hero
  useEffect(() => {
    if (displayDeck) {
      if (viewMode === "catalog" && (!displayDeck.hero || displayDeck.hero.length === 0)) {
        setViewMode("list");
      }
    }
  }, [displayDeck, viewMode]);

  // Fetch user's binders on user change
  useEffect(() => {
    const fetchBinders = async () => {
      if (!user?.id) return;
      try {
        const result = await bindersClient.getUserBinders();
        if (!result.success) return;

        setBinders(result.data.binders || []);

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

  // Save selectedBinderId to localStorage
  useEffect(() => {
    if (selectedBinderId) {
      localStorage.setItem('selectedBinderId', selectedBinderId);
    }
  }, [selectedBinderId]);

  // Fetch wants list on user change
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

  // Fetch ownership data on deck._id / user.id / ownershipRefreshKey
  useEffect(() => {
    const fetchOwnershipData = async () => {
      if (!deck?._id || !user?.id) return;

      try {
        const result = await decksClient.getInventoryComparison(deck._id, { binderMode: 'all' });
        if (!result.success || !result.data.comparison) return;

        const ownershipMap = new Map();
        const comparison = result.data.comparison;

        comparison.owned?.forEach((item: any) => {
          ownershipMap.set(item.printingId, {
            owned: item.exactOwned || item.ownedQuantity,
            needed: item.neededQuantity,
            alternative: item.alternativeOwned || 0,
            forTrade: item.forTrade || false,
            binderSlugs: item.binderSlugs || [],
            binderNames: item.binderNames || [],
            binderIds: item.binderIds || [],
          });
        });

        comparison.partial?.forEach((item: any) => {
          ownershipMap.set(item.printingId, {
            owned: item.exactOwned || item.ownedQuantity || 0,
            needed: item.neededQuantity,
            alternative: item.alternativeOwned || 0,
            forTrade: item.forTrade || false,
            binderSlugs: item.binderSlugs || [],
            binderNames: item.binderNames || [],
            binderIds: item.binderIds || [],
          });
        });

        comparison.missing?.forEach((item: any) => {
          ownershipMap.set(item.printingId, {
            owned: 0,
            needed: item.neededQuantity,
            alternative: item.alternativeOwned || 0,
            forTrade: false,
            binderSlugs: [],
            binderNames: [],
            binderIds: [],
          });
        });

        setOwnershipStatus(ownershipMap);
      } catch (error) {
        console.error('Error fetching ownership data:', error);
      }
    };

    fetchOwnershipData();
  }, [deck?._id, user?.id, ownershipRefreshKey]);

  // Fetch binder inventory on selectedBinderId / user / ownershipRefreshKey
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
              cardId: card._id || card.id,
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

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleOptimisticSwap = (oldPrinting: DeckPrinting & { category: string }, newPrintingData: any) => {
    if (!optimisticDeck) return;

    const category = oldPrinting.category;
    const categoryKey = category as keyof Pick<Deck, 'hero' | 'equipment' | 'maindeck' | 'inventory' | 'maybeboard' | 'tokens'>;
    const categoryArray = optimisticDeck[categoryKey] as DeckPrinting[];

    if (!categoryArray) return;

    const printingIndex = oldPrinting._id
      ? categoryArray.findIndex(p => p._id === oldPrinting._id)
      : categoryArray.findIndex(p => p.printingId === oldPrinting.printingId);

    if (printingIndex !== -1) {
      const newPrinting = {
        ...oldPrinting,
        printingId: newPrintingData.printing_id || newPrintingData.printingId,
        printingDetails: newPrintingData,
      };

      const updatedCategoryArray = [
        ...categoryArray.slice(0, printingIndex),
        newPrinting,
        ...categoryArray.slice(printingIndex + 1),
      ];

      const updatedDeck = {
        ...optimisticDeck,
        [categoryKey]: updatedCategoryArray,
      };

      setOptimisticDeck(updatedDeck);
    }
  };

  const fetchDeck = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await decksClient.getDeck(deckId);
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch deck");
      }

      const deckData = result.data as unknown as Deck;
      setDeck(deckData);
      setOptimisticDeck(null);
    } catch (err: any) {
      setError(err.message || "Failed to load deck");
    } finally {
      setLoading(false);
    }
  };

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

  const handleDragEnd = (event: any) => {
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

    if (sourceCategory !== destinationCategory && (destinationCategory === "maindeck" || destinationCategory === "inventory")) {
      handleMovePrintingToCategory(activePrinting, destinationCategory);
    }
  };

  const handleAddPrintingToDeck = async (card: any, printing: any, quantity = 1) => {
    if (!canEdit) return;

    try {
      if (optimisticDeck) {
        const updatedDeck = { ...optimisticDeck };
        const categoryArray = [...(updatedDeck[activeCategory] || [])];

        for (let i = 0; i < quantity; i++) {
          const newPrinting: DeckPrinting = {
            _id: generateTempId(),
            printingId: printing.printing_id || printing.unique_id,
            condition: 'NM',
            notes: '',
            addedAt: new Date().toISOString(),
            isOptimistic: true,
            printingDetails: {
              ...printing,
              card_unique_id: card.unique_id,
              display_name: card.name,
              name: card.name,
            },
          };
          categoryArray.push(newPrinting);
        }

        (updatedDeck as any)[activeCategory] = categoryArray;

        const countField = `${activeCategory}Count` as keyof Deck;
        if (typeof updatedDeck[countField] === 'number') {
          (updatedDeck as any)[countField] = (updatedDeck[countField] as number) + quantity;
        }

        if (typeof updatedDeck.totalCards === 'number') {
          updatedDeck.totalCards = updatedDeck.totalCards + quantity;
        }

        setOptimisticDeck(updatedDeck);
      }

      const result = await decksClient.addPrinting(deckId, {
        category: activeCategory as any,
        printingId: printing.printing_id || printing.unique_id,
        quantity: quantity,
        condition: 'NM',
        notes: '',
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to add printing');
      }

      await fetchDeck();

      toast({
        title: "Card added",
        description: `Added ${quantity}x ${card.name} to ${activeCategory}.`,
        duration: isMobile ? 1000 : undefined,
      });
    } catch (err) {
      console.error('Error adding printing:', err);

      if (deck) {
        setOptimisticDeck(deck);
      }

      toast({
        title: "Error",
        description: "Failed to add card to deck.",
        variant: "destructive",
      });
    }
  };

  const handleMovePrintingToCategory = async (
    printing: DeckPrinting & { category: string },
    newCategory: "maindeck" | "inventory" | "equipment"
  ) => {
    if (!canEdit || printing.category === newCategory) return;

    const cardKey = `${printing.printingId}-${printing.category}`;
    if (movingCards.has(cardKey)) return;

    try {
      setMovingCards(prev => new Set(prev).add(cardKey));

      if (optimisticDeck) {
        const updatedDeck = { ...optimisticDeck };

        const sourceArray = [...(updatedDeck[printing.category as keyof Pick<Deck, 'hero' | 'equipment' | 'maindeck' | 'inventory' | 'maybeboard' | 'tokens'>] as DeckPrinting[])];

        const printingIndex = sourceArray.findIndex(p =>
          p._id === printing._id || p.printingId === printing.printingId
        );

        if (printingIndex !== -1) {
          const [movedPrinting] = sourceArray.splice(printingIndex, 1);
          (updatedDeck as any)[printing.category] = sourceArray;

          if (newCategory === 'equipment') {
            const types = movedPrinting.printingDetails?.types || [];
            const subtypes = movedPrinting.printingDetails?.subtypes || [];
            const isWeapon = types.includes('weapon');
            const isOffHand = types.includes('off-hand');
            const isHead = types.includes('head');
            const isChest = types.includes('chest');
            const isArms = types.includes('arms');
            const isLegs = types.includes('legs');
            const is2H = types.includes('2h') || subtypes.includes('2h');
            const is1H = types.includes('1h') || subtypes.includes('1h') || (isWeapon && !is2H);

            if (isHead || isChest || isArms || isLegs) {
              const slotType = isHead ? 'head' : isChest ? 'chest' : isArms ? 'arms' : 'legs';
              const equipmentArray = [...(updatedDeck.equipment || [])];
              const armorToMove: DeckPrinting[] = [];

              equipmentArray.forEach(item => {
                const itemTypes = item.printingDetails?.types || [];
                if (itemTypes.includes(slotType)) {
                  armorToMove.push(item);
                }
              });

              if (armorToMove.length > 0) {
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

                toast({
                  title: "Equipment replaced",
                  description: `Moved existing ${slotType} equipment to inventory.`,
                });
              }
            }

            if (is2H) {
              const equipmentArray = [...(updatedDeck.equipment || [])];
              const weaponsToMove: DeckPrinting[] = [];

              equipmentArray.forEach(item => {
                const itemTypes = item.printingDetails?.types || [];
                if (itemTypes.includes('weapon')) {
                  weaponsToMove.push(item);
                }
              });

              if (weaponsToMove.length > 0) {
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

                toast({
                  title: "Weapons moved",
                  description: `Moved ${weaponsToMove.length} weapon${weaponsToMove.length > 1 ? 's' : ''} to inventory to make room for 2H weapon.`,
                });
              }
            }

            if (is1H || isOffHand) {
              const equipmentArray = [...(updatedDeck.equipment || [])];
              const twoHandedWeapons: DeckPrinting[] = [];

              equipmentArray.forEach(item => {
                const itemTypes = item.printingDetails?.types || [];
                const itemSubtypes = item.printingDetails?.subtypes || [];
                if (itemTypes.includes('weapon') && (itemTypes.includes('2h') || itemSubtypes.includes('2h'))) {
                  twoHandedWeapons.push(item);
                }
              });

              if (twoHandedWeapons.length > 0) {
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

                toast({
                  title: "2H weapon moved",
                  description: `Moved 2H weapon to inventory to make room for ${isOffHand ? 'off-hand item' : '1H weapon'}.`,
                });
              }
            }
          }

          const destArray = [...(updatedDeck[newCategory] || [])];
          destArray.push({ ...movedPrinting, isOptimistic: true });
          (updatedDeck as any)[newCategory] = destArray;

          const sourceCountField = `${printing.category}Count` as keyof Deck;
          const destCountField = `${newCategory}Count` as keyof Deck;

          if (typeof updatedDeck[sourceCountField] === 'number') {
            (updatedDeck as any)[sourceCountField] = (updatedDeck[sourceCountField] as number) - 1;
          }
          if (typeof updatedDeck[destCountField] === 'number') {
            (updatedDeck as any)[destCountField] = (updatedDeck[destCountField] as number) + 1;
          }

          setOptimisticDeck(updatedDeck);
        }
      }

      // Validate Evo equipment
      if (newCategory === 'equipment' && viewMode !== 'playmat') {
        const types = printing.printingDetails?.types || [];
        const isEquipment = types.includes('equipment') || types.includes('weapon');
        const isEvo = types.includes('evo');

        if (isEquipment && isEvo) {
          toast({
            title: "Cannot move to equipment",
            description: "Evo equipment can only be in the library or inventory during deck building. Use playmat view to simulate gameplay.",
            variant: "destructive",
          });
          return;
        }
      }

      const removeResult = await decksClient.removePrinting(deckId, printing.printingId, printing.category as any);

      if (!removeResult.success) {
        throw new Error(removeResult.error || 'Failed to remove printing');
      }

      const addResult = await decksClient.addPrinting(deckId, {
        category: newCategory as any,
        printingId: printing.printingId,
        quantity: 1,
        condition: printing.condition || 'NM',
        notes: printing.notes || '',
      });

      if (!addResult.success) {
        await decksClient.addPrinting(deckId, {
          category: printing.category as any,
          printingId: printing.printingId,
          quantity: 1,
          condition: printing.condition || 'NM',
          notes: printing.notes || '',
        });
        throw new Error(addResult.error || 'Failed to add printing to destination');
      }

      if (newCategory === 'equipment') {
        const types = printing.printingDetails?.types || [];
        const isWeaponOrOffHand = types.includes('weapon') || types.includes('off-hand');
        if (isWeaponOrOffHand) {
          await fetchDeck();
          toast({
            title: `${types.includes('off-hand') ? 'off-hand item' : 'weapon'} moved`,
            description: `Moved to equipment. Any conflicting weapons were automatically moved to inventory.`,
          });
          return;
        }
      }

      toast({
        title: "Card moved",
        description: `Moved card from ${printing.category} to ${newCategory}.`,
      });
    } catch (err) {
      console.error('[MovePrinting] Error:', err);

      if (deck) {
        setOptimisticDeck(deck);
      }

      toast({
        title: "Error",
        description: "Failed to move card between categories.",
        variant: "destructive",
      });
    } finally {
      setMovingCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(cardKey);
        return newSet;
      });
    }
  };

  const handleAddAnother = async (printing: DeckPrinting & { category: string }) => {
    if (!canEdit) return;

    try {
      const card = {
        unique_id: printing.printingDetails?.card_unique_id,
        name: printing.printingDetails?.display_name || printing.printingDetails?.name,
      };

      const printingData = {
        printing_id: printing.printingId,
        unique_id: printing.printingId,
        ...printing.printingDetails,
      };

      const originalCategory = activeCategory;
      setActiveCategory(printing.category as any);

      await handleAddPrintingToDeck(card, printingData, 1);

      setActiveCategory(originalCategory);
    } catch (err) {
      console.error('Error adding another printing:', err);
      toast({
        title: "Error",
        description: "Failed to add another copy of this card.",
        variant: "destructive",
      });
    }
  };

  const handleRemovePrinting = async (printingToRemove: DeckPrinting & { category: string }) => {
    if (!canEdit) return;

    const cardKey = printingToRemove._id || printingToRemove.printingId;

    if (removingCards.has(cardKey)) return;

    try {
      setRemovingCards(prev => new Set([...prev, cardKey]));

      await new Promise(resolve => setTimeout(resolve, 300));

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
            categoryArray[printingIndex] = { ...categoryArray[printingIndex], quantity: currentQty - 1 };
          } else {
            categoryArray.splice(printingIndex, 1);
          }
          (updatedDeck as any)[category] = categoryArray;

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

      const result = await decksClient.removePrinting(deckId, printingToRemove.printingId, printingToRemove.category as any);

      if (!result.success) {
        throw new Error(result.error || 'Failed to remove printing');
      }

      toast({
        title: "Card removed",
        description: "Card has been removed from your deck.",
      });
    } catch (err) {
      console.error('Error removing printing:', err);

      setRemovingCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(cardKey);
        return newSet;
      });

      await fetchDeck();

      toast({
        title: "Error",
        description: "Failed to remove card from deck.",
        variant: "destructive",
      });
    } finally {
      setRemovingCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(cardKey);
        return newSet;
      });
    }
  };

  const handleMovePrinting = async (printing: DeckPrinting & { category: string }) => {
    const types = printing.printingDetails?.types || [];
    const isEquipment = types.includes('equipment') || types.includes('weapon');
    const isHero = types.includes('hero');

    let newCategory: "maindeck" | "inventory" | "equipment";

    if (isHero) {
      toast({
        title: "Cannot move hero",
        description: "Hero cards cannot be moved to other categories.",
        variant: "destructive",
      });
      return;
    }

    if (isEquipment) {
      const isEvo = types.includes('evo');

      if (isEvo && viewMode !== 'playmat') {
        newCategory = printing.category === 'maindeck' ? 'inventory' : 'maindeck';
      } else {
        newCategory = printing.category === 'equipment' ? 'inventory' : 'equipment';
      }
    } else {
      newCategory = printing.category === 'maindeck' ? 'inventory' : 'maindeck';
    }

    await handleMovePrintingToCategory(printing, newCategory);
  };

  const handleMoveMultiple = async (printing: DeckPrinting & { category: string }, quantity: number) => {
    const types = printing.printingDetails?.types || [];
    const isEquipment = types.includes('equipment') || types.includes('weapon');
    const isHero = types.includes('hero');

    let newCategory: "maindeck" | "inventory" | "equipment";

    if (isHero) {
      toast({
        title: "Cannot move hero",
        description: "Hero cards cannot be moved to other categories.",
        variant: "destructive",
      });
      return;
    }

    if (isEquipment) {
      const isEvo = types.includes('evo');

      if (isEvo && viewMode !== 'playmat') {
        newCategory = printing.category === 'maindeck' ? 'inventory' : 'maindeck';
      } else {
        newCategory = printing.category === 'equipment' ? 'inventory' : 'equipment';
      }
    } else {
      newCategory = printing.category === 'maindeck' ? 'inventory' : 'maindeck';
    }

    const cardName = printing.printingDetails?.display_name || printing.printingDetails?.name || 'card';

    try {
      for (let i = 0; i < quantity; i++) {
        const currentPrinting = printings.find(
          p => p.printingId === printing.printingId && p.category === printing.category
        );

        if (!currentPrinting) break;

        await handleMovePrintingToCategory(currentPrinting, newCategory);
      }

      toast({
        title: "Cards moved",
        description: `Moved ${quantity} ${quantity === 1 ? 'copy' : 'copies'} of ${cardName} to ${newCategory}.`,
        duration: isMobile ? 1500 : undefined,
      });
    } catch (err) {
      console.error('[handleMoveMultiple] Error:', err);
      toast({
        title: "Error",
        description: "Failed to move all copies. Some may have been moved.",
        variant: "destructive",
      });
    }
  };

  const handleOpenPrintingSwap = (printing: DeckPrinting & { category: string }) => {
    setSwappingPrinting(printing);
    setPrintingSwapOpen(true);
  };

  const handlePrintingSwapComplete = async (oldPrintingId: string, newPrintingId: string) => {
    await fetchDeck();
    toast({
      title: "Printing updated",
      description: "Card printing has been changed successfully.",
    });
  };

  const handleOpenOwnershipComparison = (printing: DeckPrinting & { category: string }) => {
    const cardUniqueId = printing.printingDetails?.card_unique_id;
    if (!cardUniqueId || !displayDeck) return;

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
    const deckCopy = comparingCardCopies.find(copy => copy._id === deckCopyId);
    if (!deckCopy) {
      console.error('[SwapFromComparison] Deck copy not found:', deckCopyId);
      return;
    }

    try {
      const swapResult = await decksClient.swapPrinting(
        deckId,
        deckCopy.printingId,
        newPrintingId,
        deckCopy.category as any
      );

      if (!swapResult.success) {
        throw new Error(swapResult.error || 'Failed to swap printing');
      }

      const printingResult = await searchClient.getPrintingById(newPrintingId);
      if (printingResult.success) {
        setComparingCardCopies(prev => prev.map(copy =>
          copy._id === deckCopyId
            ? { ...copy, printingId: newPrintingId, printingDetails: printingResult.data }
            : copy
        ));
      }

      toast({
        title: "Printing swapped",
        description: `Copy ${comparingCardCopies.findIndex(c => c._id === deckCopyId) + 1} swapped successfully.`,
      });
    } catch (error) {
      console.error('[SwapFromComparison] Error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to swap printing.",
        variant: "destructive",
      });
    }
  };

  const handleBulkImport = async (importResults: any[]) => {
    if (!canEdit) return;

    const result = await decksClient.addPrintings(deckId, importResults.map(card => ({
      printingId: card.printingId,
      quantity: card.quantity || 1,
      category: card.category || 'maindeck',
    })));

    if (!result.success) {
      throw new Error(result.error || 'Import failed');
    }

    setOptimisticDeck(null);
    await fetchDeck();

    toast({
      title: "Import successful",
      description: `Added ${result.data.summary?.totalAdded || importResults.length} cards to your deck`,
    });
  };

  const handleAddToWants = async (card: DeckPrinting & { category: string }) => {
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
  };

  const handleAddToBinder = async (card: DeckPrinting & { category: string }) => {
    if (!selectedBinderId) {
      toast({ title: "No binder selected", description: "Please select a binder from the menu first.", variant: "destructive" });
      return;
    }
    try {
      const result = await bindersClient.addCardsToBinder(selectedBinderId, [{
        printingId: card.printingId,
        quantity: 1,
        condition: 'NM',
        notes: `From deck: ${displayDeck?.name}`,
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
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to add card to binder.", variant: "destructive" });
    }
  };

  const handleRemoveFromBinder = async (card: DeckPrinting & { category: string }) => {
    if (!selectedBinderId) {
      toast({ title: "No binder selected", description: "Please select a binder first.", variant: "destructive" });
      return;
    }

    const binderInfo = binderMap.get(card.printingId);
    if (!binderInfo || binderInfo.quantity === 0) return;

    try {
      const newQty = binderInfo.quantity - 1;

      if (newQty === 0) {
        const result = await bindersClient.deleteBinderCard(selectedBinderId, binderInfo.cardId);

        if (result.success) {
          const binderName = binders.find(b => b._id === selectedBinderId)?.name || 'binder';
          toast({
            title: "Removed from binder",
            description: `Removed ${card.printingDetails?.display_name || card.printingDetails?.name || 'card'} from ${binderName}.`,
          });
          setOwnershipRefreshKey(prev => prev + 1);
        }
      } else {
        const result = await bindersClient.updateBinderCard(selectedBinderId, binderInfo.cardId, {
          quantity: newQty,
        });

        if (result.success) {
          const binderName = binders.find(b => b._id === selectedBinderId)?.name || 'binder';
          toast({
            title: "Updated binder",
            description: `Have ${newQty} ${newQty === 1 ? 'copy' : 'copies'} of ${card.printingDetails?.display_name || card.printingDetails?.name || 'card'} in ${binderName}.`,
          });
          setOwnershipRefreshKey(prev => prev + 1);
        }
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove card from binder.", variant: "destructive" });
    }
  };

  const handleRemoveFromWants = async (card: DeckPrinting & { category: string }) => {
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
          setWantsMap(prev => new Map(prev).set(card.printingId, newQty));
        }
      } else {
        throw new Error('Failed to remove from wants');
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update wants list.", variant: "destructive" });
    }
  };

  const handleToggleForTrade = async (card: DeckPrinting & { category: string }, forTrade: boolean) => {
    try {
      const response = await fetch('/api/inventory/toggle-for-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printingId: card.printingId,
          forTrade: forTrade,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: forTrade ? "Marked for trade" : "Unmarked for trade",
          description: `Updated ${data.updatedCount} ${data.updatedCount === 1 ? 'copy' : 'copies'} of ${card.printingDetails?.display_name || card.printingDetails?.name || 'card'}.`,
        });
        setOwnershipRefreshKey(prev => prev + 1);
      } else {
        throw new Error('Failed to update forTrade status');
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update trade status.", variant: "destructive" });
    }
  };

  const handleUpdateTags = async (card: DeckPrinting & { category: string }, tags: string[]) => {
    try {
      if (optimisticDeck) {
        const updatedDeck = { ...optimisticDeck };
        const category = card.category;
        const categoryArray = [...updatedDeck[category as keyof Pick<Deck, 'hero' | 'equipment' | 'maindeck' | 'inventory' | 'maybeboard' | 'tokens'>] as DeckPrinting[]];

        const printingIndex = categoryArray.findIndex(p =>
          p._id === card._id || p.printingId === card.printingId
        );

        if (printingIndex !== -1) {
          categoryArray[printingIndex] = { ...categoryArray[printingIndex], tags };
          (updatedDeck as any)[category] = categoryArray;
          setOptimisticDeck(updatedDeck);
        }
      }

      toast({
        title: "Tags updated",
        description: `Updated tags for ${card.printingDetails?.display_name || card.printingDetails?.name || 'card'}.`,
      });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update tags.", variant: "destructive" });
    }
  };

  // ─── Return ──────────────────────────────────────────────────────────────────

  return {
    authLoading,
    isMobile,
    state: {
      deck,
      loading,
      error,
      saving,
      isRefreshing,
      removingCards,
      movingCards,
      binders,
      selectedBinderId,
      ownershipRefreshKey,
      ownershipStatus,
      wantsMap,
      binderMap,
      activeTab,
      searchQuery,
      activeCategory,
      viewMode,
      stackGrouping,
      isCardSearchOpen,
      settingsOpen,
      printingSwapOpen,
      swappingPrinting,
      bulkImportOpen,
      comparisonDialogOpen,
      comparingPrinting,
      comparingCardCopies,
      optimisticDeck,
      // computed
      displayDeck,
      printings,
      canEdit,
      groupedCards,
      filteredPrintings,
      filteredGroupedCards,
      deckStats,
      deckForAnalysis,
      deckCardCounts,
    },
    handlers: {
      setActiveTab,
      setSearchQuery,
      setActiveCategory,
      setViewMode,
      setStackGrouping,
      setIsCardSearchOpen,
      setSettingsOpen,
      setPrintingSwapOpen,
      setSwappingPrinting,
      setBulkImportOpen,
      setComparisonDialogOpen,
      setComparingPrinting,
      setComparingCardCopies,
      setSelectedBinderId,
      setDeck,
      setOptimisticDeck,
      setOwnershipRefreshKey,
      handleOptimisticSwap,
      fetchDeck,
      handleSaveSettings,
      handleDragEnd,
      handleAddPrintingToDeck,
      handleMovePrintingToCategory,
      handleAddAnother,
      handleRemovePrinting,
      handleMovePrinting,
      handleMoveMultiple,
      handleOpenPrintingSwap,
      handlePrintingSwapComplete,
      handleOpenOwnershipComparison,
      handleSwapPrintingFromComparison,
      handleBulkImport,
      handleAddToWants,
      handleAddToBinder,
      handleRemoveFromBinder,
      handleRemoveFromWants,
      handleToggleForTrade,
      handleUpdateTags,
    },
  };
}
