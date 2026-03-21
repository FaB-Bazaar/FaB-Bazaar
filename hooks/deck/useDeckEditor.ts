"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { parseBulkInput } from "@/lib/browse/parsers/bulk-input-parser";
import { selectDefaultPrinting } from "@/lib/browse/utils";
import { sortPrintings } from "@/lib/fab-constants";
import { getSetName } from "@/lib/fab-formatters";
import { getHeroInfo } from "@/lib/fab-constants/heroes";
import { OFFICIAL_TALENTS } from "@/lib/talent-constants";
import { decksClient, searchClient } from "@/lib/client";
import type { DeckDTO, DeckCategory } from "@/lib/services/contracts/IDeckService";

const TALENT_SET = new Set<string>(OFFICIAL_TALENTS);
const NON_CLASS_TYPES = new Set(['hero', 'young', 'adult', 'token', 'equipment', 'weapon',
  'action', 'attack', 'instant', 'defense reaction', 'attack reaction', 'demi-hero']);

const ESSENCE_ELEMENTS = ['lightning', 'earth', 'ice', 'fire', 'shadow', 'light', 'draconic', 'water'] as const;

function extractEssences(keywords: string[]): string[] {
  const combined = keywords.join(' ').toLowerCase();
  if (!combined.includes('essence')) return [];
  return ESSENCE_ELEMENTS.filter(el => combined.includes(el));
}

export function resolveHeroFilter(deck: DeckDTO | null): { heroClasses: string[]; heroTalents: string[]; heroEssences: string[] } | null {
  if (!deck) return null;
  // Strategy 1: derive from hero card in deck
  if (deck.hero?.length) {
    const h = deck.hero[0]?.printingDetails as any;
    if (h) {
      const directClasses = ((h.classes as string[] | undefined) || []).map((c: string) => c.toLowerCase()).filter(Boolean);
      const directTalents = ((h.talents as string[] | undefined) || []).map((t: string) => t.toLowerCase()).filter(Boolean);
      const heroEssences = extractEssences((h.keywords as string[] | undefined) || []);
      if (directClasses.length > 0 || directTalents.length > 0) return { heroClasses: directClasses, heroTalents: directTalents, heroEssences };
      // Derive from types array
      const heroTypes = ((h.types as string[] | undefined) || []).map((t: string) => t.toLowerCase());
      const classesFromTypes = heroTypes.filter(t => !TALENT_SET.has(t) && !NON_CLASS_TYPES.has(t));
      const talentsFromTypes = heroTypes.filter(t => TALENT_SET.has(t));
      if (classesFromTypes.length > 0 || talentsFromTypes.length > 0) return { heroClasses: classesFromTypes, heroTalents: talentsFromTypes, heroEssences };
    }
  }
  // Strategy 2: heroName lookup
  if (deck.heroName) {
    const info = getHeroInfo(deck.heroName);
    if (info) return { heroClasses: info.classes, heroTalents: info.talents, heroEssences: [] };
    // Strategy 3: treat heroName as a class name directly
    const nameLower = deck.heroName.toLowerCase();
    if (!TALENT_SET.has(nameLower) && !NON_CLASS_TYPES.has(nameLower)) return { heroClasses: [nameLower], heroTalents: [], heroEssences: [] };
  }
  return null;
}

// Maps deck format strings to search API format codes
const FORMAT_TO_SEARCH: Record<string, string> = {
  "Classic Constructed": "cc",
  "Blitz": "blitz",
  "Commoner": "commoner",
  "Living Legend": "ll",
  "Silver Age": "silver_age",
};

function inferCategory(printing: any): DeckCategory {
  const types: string[] = (printing.types || []).map((t: string) => t.toLowerCase());
  if (types.some(t => t === "hero")) return "hero";
  if (types.some(t => t === "action")) return "maindeck";
  if (types.some(t => t === "equipment" || t === "weapon")) return "equipment";
  return "maindeck";
}

const groupPrintingsByCard = (printings: any[], key: string) => {
  if (!printings || printings.length === 0) return new Map();
  const cardMap = new Map<string, any[]>();
  printings.forEach(p => {
    const groupKey = p[key];
    if (groupKey) {
      if (!cardMap.has(groupKey)) cardMap.set(groupKey, []);
      cardMap.get(groupKey)!.push(p);
    }
  });
  return cardMap;
};

export type OwnershipEntry = { owned: number; needed: number; binderNames?: string[]; binderIds?: string[] };

export interface SwapTarget {
  printingId: string;
  cardUniqueId: string;
  cardName: string;
  category: DeckCategory;
}

export function useDeckEditor(deckId: string) {
  const { toast } = useToast();
  const { user } = useAuth();

  const [deck, setDeck] = useState<DeckDTO | null>(null);
  const [deckLoading, setDeckLoading] = useState(true);
  const [ownershipMap, setOwnershipMap] = useState<Map<string, OwnershipEntry>>(new Map());
  const [bulkInput, setBulkInput] = useState("");
  const [bulkResults, setBulkResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const buildOwnershipMap = (data: {
    owned: Array<{ printingId: string; owned: number; needed: number; binderNames?: string[]; binderIds?: string[] }>;
    missing: Array<{ printingId: string; needed: number }>;
    partial: Array<{ printingId: string; owned: number; needed: number; binderNames?: string[]; binderIds?: string[] }>;
  }) => {
    const map = new Map<string, OwnershipEntry>();
    data.owned.forEach(item => map.set(item.printingId, { owned: item.owned, needed: item.needed, binderNames: item.binderNames, binderIds: item.binderIds }));
    data.missing.forEach(item => map.set(item.printingId, { owned: 0, needed: item.needed }));
    data.partial.forEach(item => map.set(item.printingId, { owned: item.owned, needed: item.needed, binderNames: item.binderNames, binderIds: item.binderIds }));
    setOwnershipMap(map);
  };

  const fetchOwnership = async () => {
    try {
      const compResult = await decksClient.getInventoryComparison(deckId);
      if (compResult.success) buildOwnershipMap(compResult.data);
    } catch {
      // Ownership data is best-effort — silently fail
    }
  };

  const loadDeck = async () => {
    setDeckLoading(true);
    try {
      const deckResult = await decksClient.getDeck(deckId);
      if (deckResult.success) {
        setDeck(deckResult.data);
      } else {
        toast({ title: "Failed to load deck", description: deckResult.error, variant: "destructive" });
      }
    } finally {
      setDeckLoading(false);
    }
    // Fetch ownership separately so it never blocks deck loading
    fetchOwnership();
  };

  // Load the deck on mount
  useEffect(() => {
    if (!deckId) return;
    loadDeck();
  }, [deckId]);

  // Re-fetch deck + ownership (used after save, swap, remove)
  const refreshDeck = async () => {
    try {
      const deckResult = await decksClient.getDeck(deckId);
      if (deckResult.success) setDeck(deckResult.data);
    } catch {}
    fetchOwnership();
  };

  const handleBulkSearch = async (e: React.FormEvent, inputOverride?: string) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const parsedCards = parseBulkInput(inputOverride ?? bulkInput, "cardlist");
      if (parsedCards.length === 0) throw new Error("Input is empty or could not be parsed.");

      // Build hero + format constraints from the loaded deck
      const heroFilter = resolveHeroFilter(deck);
      const formatCode = deck?.format ? FORMAT_TO_SEARCH[deck.format] : undefined;

      const apiCallPromises = parsedCards.map(card => {
        const filters: any = { name: card.name };

        if (!card.isPartialMatch) filters.exact = true;
        if (card.color) filters.color = card.color;
        if (card.foiling) filters.foilings = [card.foiling];
        if (card.set) filters.sets = [card.set];
        if (card.edition) filters.editions = [card.edition];

        // Deck-building constraints
        if (heroFilter) {
          filters.heroClasses = heroFilter.heroClasses;
          filters.heroTalents = heroFilter.heroTalents;
        }
        if (formatCode) filters.format = formatCode;

        return searchClient.searchPrintingsPost(filters, { limit: 50 });
      });

      const allResponses = await Promise.all(apiCallPromises);
      const allPrintings: any[] = [];
      allResponses.forEach((response, index) => {
        if (response.success && response.data?.printings) {
          const originalCard = parsedCards[index];
          const printingsWithQuantity = response.data.printings.map((p: any) => ({
            ...p,
            importQuantity: originalCard.quantity,
          }));
          allPrintings.push(...printingsWithQuantity);
        }
      });

      if (allPrintings.length === 0) throw new Error("No cards found for your query.");

      const groupedByCard = groupPrintingsByCard(allPrintings, "card_unique_id");

      const newCardInstances = Array.from(groupedByCard.entries()).map(([cardUniqueId, printings]) => {
        const sorted = sortPrintings(printings);
        const defaultPrinting = sorted[0] ?? selectDefaultPrinting({ printings });
        return {
          instanceId: `${cardUniqueId}-${Date.now()}-${Math.random()}`,
          card_unique_id: cardUniqueId,
          selectedPrinting: defaultPrinting,
          quantity: printings[0].importQuantity,
          forTrade: false,
          allPrintings: printings,
          isStaged: false,
          // Auto-infer deck category from card types
          deckCategory: inferCategory(defaultPrinting || printings[0]),
        };
      });

      let addedCount = 0;
      let updatedCount = 0;

      setBulkResults(currentResults => {
        const newCardUniqueIds = new Set(newCardInstances.map(c => c.card_unique_id));
        const existingStagedCards = currentResults.filter(card => card.isStaged);
        const nonStagedKeepers = currentResults.filter(
          card => !card.isStaged && !newCardUniqueIds.has(card.card_unique_id)
        );

        const nextBulkResults = [...existingStagedCards, ...nonStagedKeepers];

        newCardInstances.forEach(newCard => {
          const existingNonStagedIndex = nextBulkResults.findIndex(
            card => !card.isStaged && card.card_unique_id === newCard.card_unique_id
          );

          if (existingNonStagedIndex !== -1) {
            nextBulkResults[existingNonStagedIndex] = {
              ...nextBulkResults[existingNonStagedIndex],
              quantity: nextBulkResults[existingNonStagedIndex].quantity + newCard.quantity,
              selectedPrinting: newCard.selectedPrinting,
              allPrintings: newCard.allPrintings,
              deckCategory: newCard.deckCategory,
            };
            updatedCount++;
          } else {
            nextBulkResults.push(newCard);
            addedCount++;
          }
        });

        return nextBulkResults.sort((a, b) => {
          if (a.isStaged && !b.isStaged) return -1;
          if (!a.isStaged && b.isStaged) return 1;
          return (a.selectedPrinting?.display_name || "").localeCompare(b.selectedPrinting?.display_name || "");
        });
      });

      setBulkInput("");
      toast({
        title: "Search Complete",
        description: `${addedCount} new card(s) added, ${updatedCount} existing card(s) updated.`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(errorMessage);
      toast({ title: "Search Error", description: errorMessage, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToDeck = async () => {
    const stagedCards = bulkResults.filter(c => c.isStaged);
    if (stagedCards.length === 0) {
      toast({ title: "Nothing to save", description: "Stage cards first using the 'To Stage' button.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const printingsPayload = stagedCards.map(instance => ({
        printingId: instance.selectedPrinting.printing_id,
        quantity: instance.quantity,
        category: instance.deckCategory as DeckCategory,
      }));

      const result = await decksClient.addPrintings(deckId, printingsPayload);

      if (result.success) {
        toast({
          title: "Saved to Deck",
          description: `${result.data.summary?.added ?? stagedCards.length} card(s) added successfully.`,
        });
        // Clear staged cards and re-fetch the deck + ownership
        setBulkResults(current => current.filter(c => !c.isStaged));
        await refreshDeck();
      } else {
        throw new Error(result.error || "Failed to save cards to deck.");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      toast({ title: "Save Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStagedStatus = (instanceId: string) => {
    setBulkResults(current =>
      current.map(card => (card.instanceId === instanceId ? { ...card, isStaged: !card.isStaged } : card))
    );
  };

  const clearStaged = () => {
    setBulkResults(current => current.map(card => ({ ...card, isStaged: false })));
    toast({ title: "Cleared" });
  };

  const clearBulkResults = () => setBulkResults([]);

  const stageAll = () => {
    setBulkResults(current => current.map(card => ({ ...card, isStaged: true })));
  };

  const updateCardQuantity = (instanceId: string, newQuantity: number) => {
    setBulkResults(current =>
      current.map(card => (card.instanceId === instanceId ? { ...card, quantity: Math.max(1, newQuantity) } : card))
    );
  };

  const updateCardPrinting = (instanceId: string, newPrinting: any) => {
    setBulkResults(current =>
      current.map(card => {
        if (card.instanceId !== instanceId) return card;
        return {
          ...card,
          selectedPrinting: newPrinting,
          deckCategory: inferCategory(newPrinting),
        };
      })
    );
    toast({ title: "Printing Updated", description: `Switched to ${getSetName(newPrinting.set || newPrinting.set_id)}.` });
  };

  const removeCard = (instanceId: string) => {
    setBulkResults(current => current.filter(card => card.instanceId !== instanceId));
    toast({ title: "Card Removed" });
  };

  const duplicateCard = (instanceId: string) => {
    setBulkResults(current => {
      const cardToDuplicate = current.find(c => c.instanceId === instanceId);
      if (!cardToDuplicate) return current;
      const newInstance = {
        ...cardToDuplicate,
        instanceId: `${cardToDuplicate.card_unique_id}-${Date.now()}-${Math.random()}`,
        quantity: 1,
        isStaged: false,
      };
      const insertIndex = current.findIndex(c => c.instanceId === instanceId);
      const newResults = [...current];
      newResults.splice(insertIndex + 1, 0, newInstance);
      return newResults;
    });
    toast({ title: "Card Duplicated" });
  };

  // Computed counts from the saved deck (not staged)
  const deckCounts = {
    hero: deck?.hero?.reduce((s, c) => s + (c.quantity || 1), 0) ?? 0,
    equipment: deck?.equipment?.reduce((s, c) => s + (c.quantity || 1), 0) ?? 0,
    maindeck: deck?.maindeck?.reduce((s, c) => s + (c.quantity || 1), 0) ?? 0,
    inventory: deck?.inventory?.reduce((s, c) => s + (c.quantity || 1), 0) ?? 0,
    benched: deck?.benched?.reduce((s, c) => s + (c.quantity || 1), 0) ?? 0,
  };

  return {
    state: {
      deck,
      deckLoading,
      ownershipMap,
      bulkInput,
      bulkResults,
      loading,
      error,
      isSaving,
      deckCounts,
    },
    handlers: {
      setBulkInput,
      handleBulkSearch,
      handleSaveToDeck,
      toggleStagedStatus,
      clearStaged,
      clearBulkResults,
      stageAll,
      updateCardQuantity,
      updateCardPrinting,
      removeCard,
      duplicateCard,
      refreshDeck,
    },
  };
}
