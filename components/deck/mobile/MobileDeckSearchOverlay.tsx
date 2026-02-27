// components/deck/mobile/MobileDeckSearchOverlay.tsx
"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { KeywordBadge } from "@/components/deck/KeywordBadge";
import { FoilingBadge } from "@/components/deck/FoilingBadge";
import { X, Search, Plus, Minus, Star, BookOpen } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { fetchMetadata } from "@/lib/metadata-service";
import {
  SET_MAP,
  FOILING_MAP,
  EDITION_MAP,
  type SetCode,
  type FoilingCode,
  type EditionCode,
} from "@/lib/fab-constants";
import type { DeckCategory, Deck } from "./types";
import { CATEGORY_LABELS } from "./types";
import { getApiFormatCode } from "@/lib/format-constants";

interface MobileDeckSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCard: (card: any, printing: any, quantity: number) => void;
  activeCategory: DeckCategory;
  onCategoryChange: (category: DeckCategory) => void;
  deckFormat?: string;
  currentDeck?: Deck;
  heroName?: string;
  onAddToWants?: (card: any) => void;
  onAddToBinder?: (card: any) => void;
}

export default function MobileDeckSearchOverlay({
  isOpen,
  onClose,
  onSelectCard,
  activeCategory,
  onCategoryChange,
  deckFormat,
  currentDeck,
  heroName,
  onAddToWants,
  onAddToBinder,
}: MobileDeckSearchOverlayProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [cards, setCards] = useState<any[]>([]);
  const [selectedCard, setSelectedCard] = useState<any | null>(null);
  const [selectedPrinting, setSelectedPrinting] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [metadata, setMetadata] = useState<any>(null);
  const [ownershipData, setOwnershipData] = useState<Map<string, any>>(
    new Map()
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Load metadata once
  useEffect(() => {
    fetchMetadata()
      .then(setMetadata)
      .catch((err) => console.error("Error loading metadata:", err));
  }, []);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setSearchQuery("");
      setDebouncedQuery("");
      setCards([]);
      setSelectedCard(null);
      setSelectedPrinting(null);
      setQuantity(1);
    }
  }, [isOpen]);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Search API - uses heroLegal filter like the catalog view
  useEffect(() => {
    if (!debouncedQuery) {
      setCards([]);
      return;
    }

    setLoading(true);
    const params = new URLSearchParams();
    params.append("name", debouncedQuery);
    params.append("limit", "50");
    params.append("sortBy", "name");
    params.append("sortOrder", "asc");
    params.append("show", "all");

    // Hero-legal filtering: only show cards legal for this hero's class/talent
    if (heroName && activeCategory !== "hero") {
      params.append("heroLegal", heroName);
    }

    // Format legality filtering (server-side)
    if (deckFormat) {
      const formatParam = getApiFormatCode(deckFormat);
      if (formatParam) {
        params.append('format', formatParam);
      }
    }

    // Category-based type filtering
    if (activeCategory === "hero") {
      params.append("types", "hero");
    } else if (activeCategory === "equipment") {
      params.append("types", "equipment,weapon");
    }

    fetch(`/api/printings/search?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.printings) {
          const grouped = data.data.printings.reduce(
            (acc: any, printing: any) => {
              const cardName =
                printing.display_name || printing.name || "Unknown";
              const cardKey =
                printing.card_unique_id || printing.cardId || cardName;

              if (!acc[cardKey]) {
                acc[cardKey] = {
                  unique_id: printing.card_unique_id || printing.cardId,
                  name: cardName,
                  type_text: printing.type_text,
                  types: printing.types,
                  power: printing.power,
                  cost: printing.cost,
                  defense: printing.defense,
                  pitch: printing.pitch,
                  color: printing.color,
                  image_url: printing.image_url,
                  printings: [],
                };
              }
              acc[cardKey].printings.push({
                ...printing,
                unique_id: printing.printing_id,
                tcgMarket: printing.tcg_market,
                tcgLow: printing.tcg_low,
              });
              return acc;
            },
            {}
          );

          setCards(Object.values(grouped));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debouncedQuery, heroName, activeCategory, deckFormat]);

  // Fetch ownership for visible cards
  useEffect(() => {
    if (cards.length === 0) {
      setOwnershipData(new Map());
      return;
    }

    const printingIds = cards.flatMap((c: any) =>
      c.printings.map((p: any) => p.printing_id)
    );

    fetch("/api/decks/ownership-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ printingIds }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setOwnershipData(new Map(Object.entries(data.ownership)));
        }
      })
      .catch(() => {});
  }, [cards]);

  // Sort cards by pitch: Red (1) → Yellow (2) → Blue (3) → No Pitch
  const sortedCards = useMemo(() => {
    return [...cards].sort((a: any, b: any) => {
      const pitchA = a.pitch?.$numberInt || a.pitch;
      const pitchB = b.pitch?.$numberInt || b.pitch;
      const numA = pitchA ? Number(pitchA) : 99;
      const numB = pitchB ? Number(pitchB) : 99;
      if (numA !== numB) return numA - numB;
      return a.name.localeCompare(b.name);
    });
  }, [cards]);

  // Helper functions
  const getSetDisplayName = (setCode: string): string => {
    if (!setCode) return "Unknown Set";
    if (metadata?.sets) {
      const setInfo = metadata.sets.find(
        (s: any) =>
          s.code === setCode?.toUpperCase() ||
          s.code === setCode?.toLowerCase() ||
          s.code === setCode
      );
      if (setInfo) return setInfo.name;
    }
    const upperCode = setCode.toUpperCase() as SetCode;
    const lowerCode = setCode.toLowerCase() as SetCode;
    return SET_MAP[lowerCode] || SET_MAP[upperCode] || setCode.toUpperCase();
  };

  const getFoilingDisplayName = (foilingCode: string): string => {
    if (!foilingCode) return "Normal";
    if (metadata?.foilings) {
      const foilingInfo = metadata.foilings.find(
        (f: any) => f.code === foilingCode
      );
      if (foilingInfo) return foilingInfo.name;
    }
    const code = foilingCode.toLowerCase() as FoilingCode;
    return FOILING_MAP[code] || foilingCode;
  };

  const getEditionDisplayName = (editionCode: string): string => {
    if (!editionCode) return "";
    const code = editionCode.toLowerCase() as EditionCode;
    return EDITION_MAP[code] || editionCode;
  };

  const getCheapestPrinting = (printings: any[]) => {
    return printings
      .filter((p) => p.tcgMarket && !isNaN(Number(p.tcgMarket)))
      .reduce(
        (min, p) =>
          min === null || Number(p.tcgMarket) < Number(min.tcgMarket) ? p : min,
        null
      );
  };

  const getCurrentQuantityInDeck = (card: any): number => {
    if (!currentDeck || !card.unique_id) return 0;
    // Check across all categories, not just active
    let total = 0;
    (["hero", "equipment", "maindeck", "inventory"] as const).forEach((cat) => {
      const arr = currentDeck[cat] || [];
      total += arr.filter(
        (p: any) => p.printingDetails?.card_unique_id === card.unique_id
      ).length;
    });
    return total;
  };

  const getMaxQuantityForCard = (card: any): number => {
    // Check for special keywords first
    const keywords = card.keywords || [];
    const keywordsLower = keywords.map((k: string) => k.toLowerCase());

    // Legendary cards: max 1 copy
    if (keywordsLower.includes("legendary")) return 1;

    // Unlimited cards: no copy limit (return 999 as practical max)
    if (keywordsLower.includes("unlimited")) return 999;

    if (!card.types || !Array.isArray(card.types)) {
      // Default max based on format
      return deckFormat?.toLowerCase() === 'silver age' ? 2 : 3;
    }
    const types = card.types.map((t: string) => t.toLowerCase());
    if (types.includes("hero")) return 1;
    if (types.includes("equipment") || types.includes("weapon")) return 1;
    // Regular cards: 2 for Silver Age, 3 for other formats
    return deckFormat?.toLowerCase() === 'silver age' ? 2 : 3;
  };

  // Card type validation for category
  // Inventory is a sideboard — accepts both equipment and non-equipment cards.
  // Evo cards are technically equipment but only exist in maindeck or inventory.
  const isCardValidForCategory = (card: any): { valid: boolean; reason?: string } => {
    if (!card.types || !Array.isArray(card.types)) return { valid: true };
    const types = card.types.map((t: string) => t.toLowerCase());
    const isEquipOrWeapon = types.includes("equipment") || types.includes("weapon");
    const isEvo = types.includes("evo");

    switch (activeCategory) {
      case "hero":
        if (!types.includes("hero"))
          return { valid: false, reason: "Only Hero cards" };
        break;
      case "equipment":
        if (!isEquipOrWeapon)
          return { valid: false, reason: "Only Equipment/Weapon cards" };
        if (isEvo)
          return { valid: false, reason: "Evo cards go in Main Deck or Inventory" };
        break;
      case "maindeck":
        if (types.includes("hero"))
          return { valid: false, reason: "Hero cards go in Hero" };
        if (isEquipOrWeapon && !isEvo)
          return { valid: false, reason: "Equipment goes in Equipment or Inventory" };
        break;
      case "inventory":
        // Inventory (sideboard) accepts everything except heroes
        if (types.includes("hero"))
          return { valid: false, reason: "Hero cards go in Hero" };
        break;
    }
    return { valid: true };
  };

  const getPitchColor = (pitch: any) => {
    const p = pitch?.$numberInt || pitch;
    if (p === 1 || p === "1") return "bg-red-500";
    if (p === 2 || p === "2") return "bg-yellow-500";
    if (p === 3 || p === "3") return "bg-blue-500";
    return "bg-gray-400";
  };

  const handleCardSelect = (card: any) => {
    setSelectedCard(card);
    setQuantity(1);
    if (card.printings?.length > 0) {
      setSelectedPrinting(
        getCheapestPrinting(card.printings) || card.printings[0]
      );
    }
  };

  const handleConfirm = () => {
    if (selectedCard && selectedPrinting) {
      onSelectCard(selectedCard, selectedPrinting, quantity);
      setSelectedCard(null);
      setSelectedPrinting(null);
      setQuantity(1);
    }
  };

  // Build a DeckPrinting-compatible object for Wants/Binder handlers
  const buildDeckPrintingLike = () => {
    if (!selectedCard || !selectedPrinting) return null;
    return {
      printingId: selectedPrinting.printing_id || selectedPrinting.unique_id,
      printingDetails: {
        display_name: selectedCard.name,
        name: selectedCard.name,
        card_unique_id: selectedCard.unique_id,
        image_url: selectedPrinting.image_url,
      },
      category: activeCategory,
    };
  };

  const handleDrawerAction = (action: () => void) => {
    setSelectedCard(null);
    setSelectedPrinting(null);
    setTimeout(action, 300);
  };

  if (!isOpen) return null;

  const maxQuantity = selectedCard ? getMaxQuantityForCard(selectedCard) : 3;
  const currentQtyInDeck = selectedCard
    ? getCurrentQuantityInDeck(selectedCard)
    : 0;
  const availableQuantity = Math.max(0, maxQuantity - currentQtyInDeck);

  // Main search view - search bar at BOTTOM for thumb reachability
  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col">
      {/* Top: close button + category pills */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 shrink-0"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-1.5 flex-1 overflow-x-auto scrollbar-hide">
          {(
            ["hero", "equipment", "maindeck", "inventory"] as DeckCategory[]
          ).map((cat) => (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0",
                activeCategory === cat
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
              )}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Results area - justify-end so results anchor near the search input */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        <div className="flex-1" />
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-sm text-gray-500">Searching...</p>
          </div>
        ) : sortedCards.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {sortedCards.map((card: any) => {
              const currentQty = getCurrentQuantityInDeck(card);
              const maxQty = getMaxQuantityForCard(card);
              const canAdd = currentQty < maxQty;
              const validation = isCardValidForCategory(card);
              const cheapest = getCheapestPrinting(card.printings || []);
              const ownedTotal = (card.printings || []).reduce(
                (sum: number, p: any) => {
                  const o = ownershipData.get(p.printing_id);
                  return sum + (o?.owned || 0);
                },
                0
              );
              const isEnabled = canAdd && validation.valid;

              return (
                <button
                  key={card.unique_id}
                  className={cn(
                    "w-full text-left px-3 py-2 active:bg-gray-100 dark:active:bg-gray-800 transition-colors",
                    !isEnabled && "opacity-40"
                  )}
                  onClick={() => isEnabled && handleCardSelect(card)}
                  disabled={!isEnabled}
                >
                  <div className="flex items-center gap-2">
                    {/* Pitch color bar */}
                    <div
                      className={cn(
                        "w-1 self-stretch rounded-full shrink-0",
                        getPitchColor(card.pitch)
                      )}
                    />

                    {/* Card image thumbnail */}
                    {card.image_url ? (
                      <img
                        src={card.image_url}
                        alt={card.name}
                        className="w-9 h-[50px] object-cover rounded shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-9 h-[50px] bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
                    )}

                    {/* Card info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {card.name}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {card.types
                          ?.slice(0, 3)
                          .map((type: string, i: number) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="text-[10px] py-0 px-1"
                            >
                              {type}
                            </Badge>
                          ))}
                        {card.keywords
                          ?.slice(0, 3)
                          .map((kw: string, i: number) => (
                            <KeywordBadge key={`kw-${i}`} keyword={kw} size="sm" />
                          ))}
                      </div>
                      {!validation.valid && (
                        <div className="text-[10px] text-red-500 mt-0.5">
                          {validation.reason}
                        </div>
                      )}
                    </div>

                    {/* Right info */}
                    <div className="text-right shrink-0">
                      <div className="text-xs text-gray-500">
                        {card.printings?.length || 0} prints
                      </div>
                      {cheapest?.tcgMarket && (
                        <div className="text-xs text-green-600 font-semibold">
                          ${Number(cheapest.tcgMarket).toFixed(2)}
                        </div>
                      )}
                      {ownedTotal > 0 && (
                        <div className="text-[10px] text-green-600">
                          Own {ownedTotal}x
                        </div>
                      )}
                      {currentQty > 0 && (
                        <div className="text-[10px] text-blue-600">
                          In deck: {currentQty}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : searchQuery ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            No cards found for &ldquo;{searchQuery}&rdquo;
          </div>
        ) : (
          <div className="text-center py-12">
            <Search className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              Search for cards to add to {CATEGORY_LABELS[activeCategory]}
            </p>
            {heroName && activeCategory !== "hero" && (
              <p className="text-xs text-gray-400 mt-1">
                Filtered to cards legal for {heroName}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Search bar at BOTTOM for thumb reachability */}
      <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            ref={inputRef}
            placeholder={`Search ${CATEGORY_LABELS[activeCategory]} cards...`}
            className="pl-8 h-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Card action drawer - opens when tapping a search result */}
      <Drawer
        open={!!selectedCard}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCard(null);
            setSelectedPrinting(null);
          }
        }}
      >
        <DrawerContent>
          {/* Pitch color stripe */}
          {selectedCard?.pitch && (
            <div className={cn(
              "h-1 w-full",
              getPitchColor(selectedCard.pitch)
            )} />
          )}
          {selectedCard && (
            <div className="mx-auto w-full max-w-sm">
              <DrawerHeader className="pb-2">
                <div className="flex items-start gap-3">
                  {/* Card image - updates with selected printing */}
                  {(selectedPrinting?.image_url || selectedCard.image_url) && (
                    <img
                      src={selectedPrinting?.image_url || selectedCard.image_url}
                      alt={selectedCard.name}
                      className="w-16 h-[90px] object-cover rounded shadow-sm shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <DrawerTitle className="text-base truncate">
                      {selectedCard.name}
                    </DrawerTitle>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedCard.types?.slice(0, 3).map((type: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-[10px] py-0 px-1">
                          {type}
                        </Badge>
                      ))}
                      {selectedCard.keywords?.slice(0, 3).map((kw: string, i: number) => (
                        <KeywordBadge key={`kw-${i}`} keyword={kw} size="sm" />
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedCard.pitch && (
                        <div className={cn("w-3 h-3 rounded-full", getPitchColor(selectedCard.pitch))} />
                      )}
                      {currentQtyInDeck > 0 && (
                        <span className="text-[10px] text-blue-600 font-medium">
                          In deck: {currentQtyInDeck}/{maxQuantity}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </DrawerHeader>

              {/* Printing selector - only show if multiple printings */}
              {selectedCard.printings?.length > 1 && (
                <div className="px-4 mb-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1.5">
                    Select Printing
                  </h3>
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {selectedCard.printings.map((printing: any) => {
                      const setName = getSetDisplayName(
                        printing.printing_data?.set_id || printing.set
                      );
                      const edition = getEditionDisplayName(printing.edition);
                      const foiling = getFoilingDisplayName(printing.foiling);
                      const price = printing.tcgMarket
                        ? `$${Number(printing.tcgMarket).toFixed(2)}`
                        : "";
                      const ownership = ownershipData.get(printing.printing_id);
                      const isSelected =
                        (selectedPrinting?.unique_id || selectedPrinting?.printing_id) ===
                        (printing.unique_id || printing.printing_id);

                      return (
                        <button
                          key={printing.unique_id || printing.printing_id}
                          className={cn(
                            "w-full text-left px-2 py-1.5 rounded-lg border transition-colors",
                            isSelected
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                              : "border-gray-200 dark:border-gray-700 active:bg-gray-100 dark:active:bg-gray-800"
                          )}
                          onClick={() => setSelectedPrinting(printing)}
                        >
                          <div className="flex items-center gap-2">
                            {printing.image_url && (
                              <img
                                src={printing.image_url}
                                alt={setName}
                                className="w-8 h-11 object-cover rounded shrink-0"
                                loading="lazy"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate">{setName}</div>
                              <div className="flex items-center gap-1.5">
                                {edition && <span className="text-[10px] text-gray-500">{edition}</span>}
                                {printing.foiling && ['R', 'C', 'G'].includes(printing.foiling) && (
                                  <FoilingBadge foiling={printing.foiling} size="sm" />
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              {price && (
                                <div className="text-xs font-semibold text-green-600">{price}</div>
                              )}
                              {ownership?.owned > 0 && (
                                <div className="text-[10px] text-green-600">Own {ownership.owned}x</div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="px-4 pb-4 space-y-2">
                {/* Quantity + Add to deck */}
                {availableQuantity > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="font-semibold text-sm w-6 text-center">{quantity}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setQuantity(Math.min(availableQuantity, quantity + 1))}
                        disabled={quantity >= availableQuantity}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <Button
                      className="flex-1 h-10"
                      onClick={handleConfirm}
                      disabled={!selectedPrinting}
                    >
                      Add {quantity}x to {CATEGORY_LABELS[activeCategory]}
                    </Button>
                  </div>
                )}
                {availableQuantity === 0 && currentQtyInDeck > 0 && (
                  <div className="text-xs text-center text-gray-500 py-1">
                    Max copies in deck ({currentQtyInDeck}/{maxQuantity})
                  </div>
                )}

                {/* Wants / Binder buttons */}
                <div className="grid grid-cols-2 gap-2">
                  {onAddToWants && (
                    <Button
                      variant="outline"
                      className="h-10 justify-start gap-2 text-sm"
                      onClick={() => {
                        const card = buildDeckPrintingLike();
                        if (card) handleDrawerAction(() => onAddToWants(card));
                      }}
                      disabled={!selectedPrinting}
                    >
                      <Star className="h-4 w-4" />
                      Wants
                    </Button>
                  )}
                  {onAddToBinder && (
                    <Button
                      variant="outline"
                      className="h-10 justify-start gap-2 text-sm"
                      onClick={() => {
                        const card = buildDeckPrintingLike();
                        if (card) handleDrawerAction(() => onAddToBinder(card));
                      }}
                      disabled={!selectedPrinting}
                    >
                      <BookOpen className="h-4 w-4" />
                      Binder
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
