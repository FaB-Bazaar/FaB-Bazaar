// components/deck/DeckCardSearchDialog.tsx - Updated for new deck structure
"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, X, AlertCircle, HelpCircle, ArrowLeft, Plus, Target } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { fetchMetadata } from "@/lib/metadata-service"
import {
  SET_MAP,
  FOILING_MAP,
  EDITION_MAP,
  RARITY_MAP,
  type SetCode,
  type FoilingCode,
  type EditionCode,
  type RarityCode
} from "@/lib/fab-constants"
import { getApiFormatCode } from "@/lib/format-constants"

interface DeckCardSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectCard: (card: any, printing: any, quantity: number) => void
  targetCategory: 'hero' | 'equipment' | 'maindeck' | 'inventory' // Updated for new structure
  deckFormat?: string
  heroNameFilter?: string // Pre-fill search with hero name
  heroCardUniqueId?: string // Direct card_unique_id lookup for hero (more reliable than name search)
  currentDeck?: {
    // Updated for new deck structure
    hero?: any[]
    equipment?: any[]
    maindeck?: any[]
    inventory?: any[]
    maybeboard?: any[]
    tokens?: any[]
    format: string
  }
}

export default function DeckCardSearchDialog({
  open,
  onOpenChange,
  onSelectCard,
  targetCategory,
  deckFormat,
  heroNameFilter,
  heroCardUniqueId,
  currentDeck
}: DeckCardSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [cards, setCards] = useState<any[]>([])
  const [selectedCard, setSelectedCard] = useState<any | null>(null)
  const [selectedPrinting, setSelectedPrinting] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"search" | "printing">("search")
  const [quantity, setQuantity] = useState(1)
  const [metadata, setMetadata] = useState<any>(null)
  const [ownershipData, setOwnershipData] = useState<Map<string, any>>(new Map())
  const [loadingOwnership, setLoadingOwnership] = useState(false)

  // Load metadata
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const data = await fetchMetadata()
        setMetadata(data)
      } catch (err) {
        console.error("Error loading metadata:", err)
      }
    }
    loadMetadata()
  }, [])

  // Extract hero class/talent info for filtering
  const heroInfo = useMemo(() => {
    if (!currentDeck?.hero || currentDeck.hero.length === 0) return null;
    const heroDetails = currentDeck.hero[0].printingDetails;
    if (!heroDetails) return null;
    return {
      classes: (heroDetails.classes || []).map((c: string) => c.toLowerCase()),
      talents: (heroDetails.talents || []).map((t: string) => t.toLowerCase()),
    };
  }, [currentDeck]);

  // Extract hero name for heroLegal API filter
  const heroName = useMemo(() => {
    if (!currentDeck?.hero || currentDeck.hero.length === 0) return null;
    const heroDetails = currentDeck.hero[0].printingDetails;
    return heroDetails?.display_name || heroDetails?.name || null;
  }, [currentDeck]);

  // Auto-populate search when heroNameFilter is provided
  // Use first name only (before comma) to avoid MongoDB regex issues with long names
  useEffect(() => {
    if (open && heroNameFilter && targetCategory === 'hero') {
      const shortName = heroNameFilter.includes(',')
        ? heroNameFilter.split(',')[0].trim()
        : heroNameFilter;
      setSearchQuery(shortName);
    }
  }, [open, heroNameFilter, targetCategory]);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchQuery])

  // Parse search query for enhanced search
  const parseSearchQuery = (query: string) => {
    const filters: any = {};
    const searchTerms: string[] = [];

    // Extract quoted phrases as body text search (e.g. "arcane barrier")
    // Also supports text:"arcane barrier" prefix
    let remaining = query;
    const textPrefixMatch = remaining.match(/\btext:"([^"]+)"/i) || remaining.match(/\btext:'([^']+)'/i);
    if (textPrefixMatch) {
      filters.text = textPrefixMatch[1];
      remaining = remaining.replace(textPrefixMatch[0], '').trim();
    } else {
      const quotedMatch = remaining.match(/"([^"]+)"/);
      if (quotedMatch) {
        filters.text = quotedMatch[1];
        remaining = remaining.replace(quotedMatch[0], '').trim();
      }
    }

    const parts = remaining.toLowerCase().split(/\s+/).filter(Boolean);

    parts.forEach(part => {
      if (['action', 'attack', 'defense', 'equipment', 'weapon', 'hero', 'instant'].includes(part)) {
        if (!filters.types) filters.types = [];
        filters.types.push(part);
      }
      else if (['red', 'yellow', 'blue'].includes(part)) {
        filters.color = part;
      }
      else if (['common', 'rare', 'majestic', 'legendary', 'fabled'].includes(part)) {
        if (!filters.rarities) filters.rarities = [];
        filters.rarities.push(part.charAt(0));
      }
      else if (part.startsWith('$') || part.includes('under')) {
        const priceMatch = part.match(/\$?(\d+)/);
        if (priceMatch) {
          filters.priceMax = parseInt(priceMatch[1]);
        }
      }
      else if (part.match(/^power\s*(\d+)$/)) {
        const match = part.match(/^power\s*(\d+)$/);
        if (match) filters.power = parseInt(match[1]);
      }
      else if (part.match(/^cost\s*(\d+)$/)) {
        const match = part.match(/^cost\s*(\d+)$/);
        if (match) filters.cost = parseInt(match[1]);
      }
      else {
        searchTerms.push(part);
      }
    });

    if (searchTerms.length > 0) {
      filters.name = searchTerms.join(' ');
    }

    return filters;
  };

  // Fetch ownership status for cards
  useEffect(() => {
    if (cards.length === 0) {
      setOwnershipData(new Map());
      return;
    }

    const fetchOwnership = async () => {
      try {
        setLoadingOwnership(true);
        const printingIds = cards.map(card => card.printing_id);

        const response = await fetch('/api/decks/ownership-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ printingIds })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setOwnershipData(new Map(Object.entries(data.ownership)));
          }
        }
      } catch (error) {
        console.error('Failed to fetch ownership status:', error);
      } finally {
        setLoadingOwnership(false);
      }
    };

    fetchOwnership();
  }, [cards]);

  // Fetch printings using the search API
  useEffect(() => {
    // When heroCardUniqueId is available, use it directly instead of name search
    if (heroCardUniqueId && targetCategory === 'hero') {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('cardUniqueId', heroCardUniqueId);
      params.append('limit', '50');
      params.append('sortBy', 'name');
      params.append('sortOrder', 'asc');
      params.append('show', 'all');

      // Format legality filtering (server-side)
      if (deckFormat) {
        const formatParam = getApiFormatCode(deckFormat);
        if (formatParam) {
          params.append('format', formatParam);
        }
      }

      fetch(`/api/printings/search?${params.toString()}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data?.printings) {
            // Format filtering is now done server-side via format parameter
            const printingsData = data.data.printings;

            const groupedByCard = printingsData.reduce((acc: any, printing: any) => {
              const cardName = printing.display_name || printing.name || 'Unknown';
              const cardKey = printing.card_unique_id || printing.cardId || cardName;

              if (!acc[cardKey]) {
                acc[cardKey] = {
                  unique_id: printing.card_unique_id || printing.cardId,
                  name: cardName,
                  type_text: printing.type_text,
                  types: printing.types,
                  classes: printing.classes || [],
                  talents: printing.talents || [],
                  is_generic: printing.is_generic || false,
                  rarity: printing.rarity,
                  power: printing.power,
                  cost: printing.cost,
                  defense: printing.defense,
                  pitch: printing.pitch,
                  color: printing.color,
                  printings: []
                };
              }
              acc[cardKey].printings.push({
                ...printing,
                unique_id: printing.printing_id,
                tcgMarket: printing.tcg_market,
                tcgLow: printing.tcg_low,
                tcgMid: printing.tcg_mid,
                tcgHigh: printing.tcg_high
              });
              return acc;
            }, {});

            // Filter out cards invalid for hero class/talent and format
            const validCards = Object.values(groupedByCard).filter((card: any) => isCardValidForCategory(card).valid);
            setCards(validCards);
          } else {
            setError(data.error || "Failed to search cards.");
          }
        })
        .catch(() => setError("Failed to search cards."))
        .finally(() => setLoading(false));
      return;
    }

    if (!debouncedQuery) {
      setCards([]);
      return;
    }

    setLoading(true)
    setError(null)

    const filters = parseSearchQuery(debouncedQuery);

    const params = new URLSearchParams();
    if (filters.name) params.append('name', filters.name);
    if (filters.text) params.append('text', filters.text);
    if (filters.types) params.append('types', filters.types.join(','));
    if (filters.color) params.append('color', filters.color);
    if (filters.rarities) params.append('rarities', filters.rarities.join(','));
    if (filters.priceMax) params.append('priceMax', filters.priceMax.toString());
    if (filters.power) params.append('power', filters.power.toString());
    if (filters.cost) params.append('cost', filters.cost.toString());

    params.append('limit', '50');
    params.append('sortBy', 'name');
    params.append('sortOrder', 'asc');
    params.append('show', 'all');

    // When selecting a hero, restrict to hero cards using the boolean flag (avoids array &&  SQL issues)
    if (targetCategory === 'hero') {
      params.append('isHero', 'true');
    }

    // Hero-based class/talent filtering (server-side)
    if (heroName && targetCategory !== 'hero') {
      params.append('heroLegal', heroName);
    }

    // Format legality filtering (server-side)
    if (deckFormat) {
      const formatParam = getApiFormatCode(deckFormat);
      if (formatParam) {
        params.append('format', formatParam);
      }
    }

    fetch(`/api/printings/search?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data?.printings) {
          // Format filtering is now done server-side via format parameter
          const printingsData = data.data.printings;

          const groupedByCard = printingsData.reduce((acc: any, printing: any) => {
            const cardName = printing.display_name || printing.name || 'Unknown';
            const cardKey = printing.card_unique_id || printing.cardId || cardName;

            if (!acc[cardKey]) {
              acc[cardKey] = {
                unique_id: printing.card_unique_id || printing.cardId,
                name: cardName,
                type_text: printing.type_text,
                types: printing.types,
                classes: printing.classes || [],
                talents: printing.talents || [],
                is_generic: printing.is_generic || false,
                rarity: printing.rarity,
                power: printing.power,
                cost: printing.cost,
                defense: printing.defense,
                pitch: printing.pitch,
                color: printing.color,
                printings: []
              };
            }
            acc[cardKey].printings.push({
              ...printing,
              unique_id: printing.printing_id,
              tcgMarket: printing.tcg_market,
              tcgLow: printing.tcg_low,
              tcgMid: printing.tcg_mid,
              tcgHigh: printing.tcg_high
            });
            return acc;
          }, {});

          let cardsArray = Object.values(groupedByCard).sort((a: any, b: any) =>
            a.name.localeCompare(b.name)
          );

          // When selecting a specific hero, filter to exact name matches only
          if (heroNameFilter && targetCategory === 'hero') {
            const filterLower = heroNameFilter.toLowerCase();
            cardsArray = cardsArray.filter((card: any) =>
              card.name.toLowerCase() === filterLower
            );
          }

          // Filter out cards invalid for hero class/talent and format
          cardsArray = cardsArray.filter((card: any) => isCardValidForCategory(card).valid);

          setCards(cardsArray);
        } else {
          setError(data.error || "Failed to search cards. Please try again.");
        }
      })
      .catch(() => setError("Failed to search cards. Please try again."))
      .finally(() => setLoading(false))
  }, [debouncedQuery, deckFormat, heroCardUniqueId, targetCategory, heroName])

  // Helper functions for display names
  const getSetDisplayName = (setCode: string): string => {
    if (!setCode) return "Unknown Set";
    
    if (metadata?.sets) {
      const setInfo = metadata.sets.find((s: any) => 
        s.code === setCode?.toUpperCase() || 
        s.code === setCode?.toLowerCase() ||
        s.code === setCode
      );
      if (setInfo) return setInfo.name;
    }

    const upperCode = setCode.toUpperCase() as SetCode;
    const lowerCode = setCode.toLowerCase() as SetCode;
    return SET_MAP[lowerCode] || SET_MAP[upperCode] || setCode.toUpperCase();
  }

  const getFoilingDisplayName = (foilingCode: string): string => {
    if (!foilingCode) return "Normal";
    
    if (metadata?.foilings) {
      const foilingInfo = metadata.foilings.find((f: any) => f.code === foilingCode);
      if (foilingInfo) return foilingInfo.name;
    }

    const code = foilingCode.toLowerCase() as FoilingCode;
    return FOILING_MAP[code] || foilingCode;
  }

  const getEditionDisplayName = (editionCode: string): string => {
    if (!editionCode) return "";
    
    if (metadata?.editions) {
      const editionInfo = metadata.editions.find((e: any) => e.code === editionCode);
      if (editionInfo) return editionInfo.name;
    }

    const code = editionCode.toLowerCase() as EditionCode;
    return EDITION_MAP[code] || editionCode;
  }

  const getRarityDisplayName = (rarityCode: string): string => {
    if (!rarityCode) return "";
    
    if (metadata?.rarities) {
      const rarityInfo = metadata.rarities.find((r: any) => r.code === rarityCode);
      if (rarityInfo) return rarityInfo.name;
    }

    const code = rarityCode.toLowerCase() as RarityCode;
    return RARITY_MAP[code] || rarityCode;
  }

  // Find the cheapest printing
  function getCheapestPrinting(printings: any[]) {
    return printings
      .filter((p) => p.tcgLow && !isNaN(Number(p.tcgLow)))
      .reduce((min, p) => (min === null || Number(p.tcgLow) < Number(min.tcgLow) ? p : min), null)
  }

  // Get printing display name
  function getPrintingShortDisplay(printing: any) {
    const setId = printing.printing_data?.set_id || printing.set;
    const setDisplay = getSetDisplayName(setId);
    const editionDisplay = printing.edition === 'f' ? '1st' : 
                          printing.edition === 'u' ? 'UNL' : 
                          printing.edition === 'a' ? 'Alpha' : '';
    const foilingDisplay = getFoilingDisplayName(printing.foiling);
    
    let display = setDisplay;
    if (editionDisplay) display += ` ${editionDisplay}`;
    display += ` ${foilingDisplay}`;
    
    return display;
  }

  // Check if card is appropriate for target category, hero class/talent, and format
  const isCardValidForCategory = (card: any): { valid: boolean; reason?: string } => {
    if (!card.types || !Array.isArray(card.types)) {
      return { valid: true }; // Allow if we can't determine type
    }

    const types = card.types.map((t: string) => t.toLowerCase());

    // Category validation
    switch (targetCategory) {
      case 'hero':
        if (!types.includes('hero')) {
          return { valid: false, reason: 'Only Hero cards can be added to the Hero category' };
        }
        break;
      case 'equipment':
        if (!types.includes('equipment') && !types.includes('weapon')) {
          return { valid: false, reason: 'Only Equipment and Weapon cards can be added to Equipment' };
        }
        break;
      case 'maindeck':
      case 'inventory':
        if (types.includes('hero') || types.includes('equipment') || types.includes('weapon')) {
          return { valid: false, reason: `${types.includes('hero') ? 'Hero' : 'Equipment'} cards should be added to their respective categories` };
        }
        break;
    }

    // Hero class/talent validation (skip for hero category - that's where you pick the hero)
    if (heroInfo && targetCategory !== 'hero') {
      const cardClasses = (card.classes || []).map((c: string) => c.toLowerCase());
      const cardTalents = (card.talents || []).map((t: string) => t.toLowerCase());
      const isGeneric = card.is_generic || cardClasses.length === 0 || cardClasses.includes('generic');

      if (!isGeneric) {
        // Card has a class requirement - hero must match at least one
        const classMatch = cardClasses.some((c: string) => heroInfo.classes.includes(c));
        if (!classMatch) {
          return { valid: false, reason: `Requires class: ${cardClasses.join(', ')} (hero is ${heroInfo.classes.join(', ')})` };
        }
      }

      // If card has talent requirements, hero must have at least one matching talent
      if (cardTalents.length > 0) {
        if (heroInfo.talents.length === 0) {
          return { valid: false, reason: `Requires talent: ${cardTalents.join(', ')} (hero has none)` };
        }
        const talentMatch = cardTalents.some((t: string) => heroInfo.talents.includes(t));
        if (!talentMatch) {
          return { valid: false, reason: `Requires talent: ${cardTalents.join(', ')} (hero has ${heroInfo.talents.join(', ')})` };
        }
      }
    }


    return { valid: true };
  };

  // Check quantity limits for FAB
  const getMaxQuantityForCard = (card: any): number => {
    // Check for special keywords first
    const keywords = card.keywords || [];
    const keywordsLower = keywords.map((k: string) => k.toLowerCase());

    // Legendary cards: max 1 copy
    if (keywordsLower.includes('legendary')) return 1;

    // Unlimited cards: no copy limit (return 999 as practical max)
    if (keywordsLower.includes('unlimited')) return 999;

    if (!card.types || !Array.isArray(card.types)) {
      // Default max based on format
      return deckFormat?.toLowerCase() === 'silver age' ? 2 : 3;
    }

    const types = card.types.map((t: string) => t.toLowerCase());

    if (types.includes('hero')) return 1;
    if (types.includes('equipment') || types.includes('weapon')) return 1;

    // Regular cards: 1 for Blitz, 2 for Silver Age, 3 for other formats
    const format = deckFormat?.toLowerCase();
    if (format === 'blitz') return 1;
    if (format === 'silver age') return 2;
    return 3;
  };

  // UPDATED: Get current quantity of this card in deck for new structure
  const getCurrentQuantityInDeck = (card: any): number => {
    if (!currentDeck || !card.unique_id) return 0;
    
    // Get the appropriate category array from the new deck structure
    const categoryArray = currentDeck[targetCategory] || [];
    
    return categoryArray.filter((printing: any) => 
      printing.printingDetails?.card_unique_id === card.unique_id
    ).length;
  };

  const handleCardSelect = (card: any) => {
    const validation = isCardValidForCategory(card);
    if (!validation.valid) {
      setError(validation.reason || 'Invalid card for this category');
      return;
    }

    setSelectedCard(card)
    setError(null);

    if (card.printings && card.printings.length > 0) {
      setActiveTab("printing")
    } else {
      onSelectCard(card, null, quantity)
      onOpenChange(false)
    }
  }

  const handleConfirmSelection = () => {
    if (selectedCard && selectedPrinting) {
      onSelectCard(selectedCard, selectedPrinting, quantity)
      onOpenChange(false)
    }
  }

  const handleDialogClose = () => {
    setSelectedCard(null)
    setSelectedPrinting(null)
    setQuantity(1)
    setActiveTab("search")
    setError(null)
  }

  // When a card is selected, default to the cheapest printing
  useEffect(() => {
    if (selectedCard && selectedCard.printings && selectedCard.printings.length > 0) {
      setSelectedPrinting(getCheapestPrinting(selectedCard.printings))
    } else {
      setSelectedPrinting(null)
    }
  }, [selectedCard])

  // Calculate available quantity
  const maxQuantity = selectedCard ? getMaxQuantityForCard(selectedCard) : 3;
  const currentQuantity = selectedCard ? getCurrentQuantityInDeck(selectedCard) : 0;
  const availableQuantity = Math.max(0, maxQuantity - currentQuantity);

  // UPDATED: Get category display name for new structure
  const getCategoryDisplayName = (category: string) => {
    const names = {
      'hero': 'Hero',
      'equipment': 'Equipment', 
      'maindeck': 'Main Deck',
      'inventory': 'Inventory'
    };
    return names[category] || category;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        onOpenChange(newOpen)
        if (!newOpen) handleDialogClose()
      }}
    >
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Add Cards to Deck
          </DialogTitle>
          <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <span>Adding to:</span>
            <Badge variant="outline" className="capitalize">
              {getCategoryDisplayName(targetCategory)}
            </Badge>
            {deckFormat && (
              <>
                <span>•</span>
                <Badge variant="secondary">{deckFormat}</Badge>
              </>
            )}
          </div>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "search" | "printing")}
          className="flex-1 overflow-hidden flex flex-col"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search" disabled={activeTab === "printing" && !selectedCard}>
              Search Cards
            </TabsTrigger>
            <TabsTrigger
              value="printing"
              disabled={!selectedCard || !selectedCard.printings || selectedCard.printings.length === 0}
            >
              Select Printing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-shrink-0">
              <div className="relative mb-4">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  placeholder={`Search by name, or "quoted text" to search card text...`}
                  className="pl-8 pr-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="absolute right-8 top-2.5 flex gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-gray-600"
                          aria-label="Search help"
                        >
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="text-sm">
                          <p className="font-medium mb-2">Search Examples:</p>
                          <ul className="space-y-1 text-xs">
                            <li>• <strong>Name:</strong> "Command and Conquer"</li>
                            <li>• <strong>Type:</strong> "action", "weapon", "hero"</li>
                            <li>• <strong>Color:</strong> "red", "yellow", "blue"</li>
                            <li>• <strong>Rarity:</strong> "majestic", "legendary"</li>
                            <li>• <strong>Price:</strong> "under 10", "$25"</li>
                            <li>• <strong>Stats:</strong> "power 10", "cost 2"</li>
                            <li>• <strong>Combined:</strong> "red action under 10"</li>
                          </ul>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {searchQuery && (
                    <button
                      type="button"
                      className="text-gray-400 hover:text-gray-600"
                      onClick={() => setSearchQuery("")}
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p>Searching...</p>
                </div>
              ) : cards.length > 0 ? (
                <div className="grid gap-2">
                  {cards.map((card) => {
                    const currentQty = getCurrentQuantityInDeck(card);
                    const maxQty = getMaxQuantityForCard(card);
                    const canAdd = currentQty < maxQty;

                    return (
                      <Card
                        key={card.unique_id}
                        className={`cursor-pointer transition-colors ${
                          selectedCard?.unique_id === card.unique_id
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950 dark:border-blue-400"
                            : canAdd
                              ? "hover:bg-gray-50 dark:hover:bg-gray-700"
                              : "opacity-50 cursor-not-allowed"
                        }`}
                        onClick={() => canAdd && handleCardSelect(card)}
                      >
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium">{card.name}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {card.types?.map((type: string, index: number) => (
                                  <Badge key={index} variant="secondary">{type}</Badge>
                                ))}
                                {card.pitch && (
                                  <Badge
                                    className={`text-white ${
                                      card.pitch === 1 || card.pitch === "1"
                                        ? "bg-red-500 hover:bg-red-600"
                                        : card.pitch === 2 || card.pitch === "2"
                                          ? "bg-yellow-500 hover:bg-yellow-600 text-black"
                                          : card.pitch === 3 || card.pitch === "3"
                                            ? "bg-blue-500 hover:bg-blue-600"
                                            : "bg-gray-500 hover:bg-gray-600"
                                    }`}
                                  >
                                    Pitch {card.pitch}
                                  </Badge>
                                )}
                              </div>
                              {card.printings && card.printings.length > 0 && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {card.printings.length} printings • 
                                  {(() => {
                                    const cheapest = getCheapestPrinting(card.printings);
                                    if (cheapest?.tcgLow) {
                                      const displayName = getPrintingShortDisplay(cheapest);
                                      return ` Cheapest: ${displayName} ($${Number(cheapest.tcgLow).toFixed(2)})`;
                                    }
                                    return '';
                                  })()}
                                </div>
                              )}
                              {currentQty > 0 && (
                                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                  Already in deck: {currentQty}/{maxQty}
                                </div>
                              )}
                              {/* Ownership indicators */}
                              {(() => {
                                if (!card.printings || card.printings.length === 0) return null;

                                const ownedPrintings = card.printings.filter((printing: any) => {
                                  const ownership = ownershipData.get(printing.printing_id);
                                  return ownership && ownership.owned > 0;
                                });

                                if (ownedPrintings.length > 0) {
                                  const totalOwned = ownedPrintings.reduce((sum: number, printing: any) => {
                                    const ownership = ownershipData.get(printing.printing_id);
                                    return sum + (ownership?.owned || 0);
                                  }, 0);

                                  const hasForTrade = ownedPrintings.some((printing: any) => {
                                    const ownership = ownershipData.get(printing.printing_id);
                                    return ownership?.forTrade;
                                  });

                                  return (
                                    <div className="flex items-center gap-2 mt-1">
                                      <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                                        ✓ You own {totalOwned}x
                                      </div>
                                      {hasForTrade && (
                                        <Badge variant="outline" className="text-xs py-0 px-1 text-orange-600 border-orange-300">
                                          For Trade
                                        </Badge>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                              {!canAdd && (
                                <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                  Maximum quantity reached ({maxQty})
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : searchQuery ? (
                <div className="text-center py-8">
                  <p>No cards found matching "{searchQuery}"</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Try adjusting your search or check if the cards are legal in {deckFormat}
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Search className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">Search for cards to add to your {getCategoryDisplayName(targetCategory)}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Only cards valid for {getCategoryDisplayName(targetCategory)} will be shown
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="printing" className="flex-1 overflow-hidden flex flex-col">
            {selectedCard ? (
              <>
                <Button size="sm" className="mb-2" onClick={() => {
                  setSelectedCard(null)
                  setSelectedPrinting(null)
                  setActiveTab("search")
                }}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back to search
                </Button>
                <div className="mb-2 font-medium">{selectedCard.name}</div>
                <div className="mb-2 text-sm text-gray-500 dark:text-gray-400">{selectedCard.type_text}</div>
                <div className="mb-2 flex flex-wrap gap-1">
                  {selectedCard.types?.map((type: string, index: number) => (
                    <Badge key={index} variant="secondary">{type}</Badge>
                  ))}
                </div>
                
                {/* Quantity selection */}
                <div className="mb-4">
                  <Label className="text-sm font-medium mb-2 block">Quantity</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      max={availableQuantity}
                      value={quantity}
                      onChange={e => setQuantity(Math.max(1, Math.min(availableQuantity, Number(e.target.value) || 1)))}
                      className="w-20 text-center"
                      disabled={availableQuantity === 0}
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      (Max: {availableQuantity}, Currently have: {currentQuantity}/{maxQuantity})
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <Label className="text-sm font-medium mb-2 block">Select Printing</Label>
                  <Select
                    value={selectedPrinting?.unique_id || selectedPrinting?.printing_id || ""}
                    onValueChange={(value) => {
                      if (value === "cheapest") {
                        setSelectedPrinting(getCheapestPrinting(selectedCard.printings || []))
                      } else {
                        const found = (selectedCard.printings || []).find((p: any) => 
                          p.unique_id === value || p.printing_id === value
                        )
                        setSelectedPrinting(found || null)
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a printing..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cheapest">
                        Cheapest option {(() => {
                          const cheapest = getCheapestPrinting(selectedCard.printings || []);
                          return cheapest?.tcgLow ? `($${Number(cheapest.tcgLow).toFixed(2)})` : '';
                        })()}
                      </SelectItem>
                      {(selectedCard.printings || []).map((printing: any) => {
                        const price = printing.tcgLow ? `$${Number(printing.tcgLow).toFixed(2)}` : '';
                        const displayName = getPrintingShortDisplay(printing);
                        const rarityDisplay = getRarityDisplayName(printing.rarity);
                        const ownership = ownershipData.get(printing.printing_id);

                        return (
                          <SelectItem key={printing.unique_id || printing.printing_id} value={printing.unique_id || printing.printing_id}>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span>{displayName} {price ? `(${price})` : ''}</span>
                                {ownership && ownership.owned > 0 && (
                                  <span className="text-xs text-green-600 font-medium">✓ Own {ownership.owned}x</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {printing.rarity !== 'c' && rarityDisplay && (
                                  <span className="text-xs text-gray-500">{rarityDisplay}</span>
                                )}
                                {ownership && ownership.forTrade && (
                                  <span className="text-xs text-orange-600">For Trade</span>
                                )}
                              </div>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {selectedPrinting?.image_url && (
                  <div className="flex justify-center mb-4">
                    <img
                      src={selectedPrinting.image_url}
                      alt={selectedCard.name}
                      className="max-w-[120px] max-h-[180px] object-contain border rounded shadow bg-white"
                    />
                  </div>
                )}

                <div className="flex justify-end mt-auto">
                  <Button
                    onClick={handleConfirmSelection}
                    disabled={!selectedPrinting || availableQuantity === 0}
                    className="w-full sm:w-auto"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add {quantity}x to {getCategoryDisplayName(targetCategory)}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-4">No card selected.</div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {activeTab === "printing" && selectedCard && availableQuantity > 0 && (
            <Button onClick={handleConfirmSelection} disabled={!selectedPrinting}>
              <Plus className="h-4 w-4 mr-2" />
              Add to Deck
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}