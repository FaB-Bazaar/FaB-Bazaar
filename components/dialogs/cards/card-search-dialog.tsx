"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, X, AlertCircle, HelpCircle, ArrowLeft, Check } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Pagination } from "@/components/ui/pagination"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { QuantityStepper } from "@/components/QuantityStepper"; 
import { fetchMetadata } from "@/lib/metadata-service"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  SET_MAP,
  FOILING_MAP,
  EDITION_MAP,
  RARITY_MAP,
  sortPrintings,
  type SetCode,
  type FoilingCode,
  type EditionCode,
  type RarityCode
} from "@/lib/fab-constants"
import { sortPrintingsByLanguage, languageFlag } from "@/lib/utils/printing-language"
import { TcgAffiliateLink } from '@/components/tracking'

// --- MODIFICATION START ---
// 1. Import the new FABShorthandParser
import { FABShorthandParser } from "@/lib/fab-shorthand-parser" 
// --- MODIFICATION END ---


interface CardSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectCard: (card: any, printing?: any, quantity?: number, shouldContinue?: boolean) => void
  destination?: "binder" | "wants" | "event-wants"
  /** Seed the search box with this query each time the dialog opens (e.g. from a binder "no results" shortcut). */
  initialQuery?: string
}

// --- MODIFICATION START ---
// 2. Instantiate the parser. This can be done once outside the component.
const fabShorthandParser = new FABShorthandParser();
// --- MODIFICATION END ---


export default function CardSearchDialog({ open, onOpenChange, onSelectCard, destination, initialQuery }: CardSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [cards, setCards] = useState<any[]>([])
  const [selectedCard, setSelectedCard] = useState<any | null>(null)
  const [selectedPrinting, setSelectedPrinting] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [activeTab, setActiveTab] = useState<"search" | "printing">("search")
  const [quantity, setQuantity] = useState(1)
  const [defaultForTrade, setDefaultForTrade] = useState(true)
  const [lastAdded, setLastAdded] = useState<string | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const [metadata, setMetadata] = useState<any>(null)
  const [metadataLoading, setMetadataLoading] = useState(true)

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        setMetadataLoading(true)
        const data = await fetchMetadata()
        setMetadata(data)
      } catch (err) {
        console.error("Error loading metadata:", err)
      } finally {
        setMetadataLoading(false)
      }
    }
    loadMetadata()
  }, [])

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(searchQuery), 500)
    return () => clearTimeout(handler)
  }, [searchQuery])

  // Seed the search box from `initialQuery` when the dialog transitions from
  // closed to open, so a caller (e.g. the binder "no results" shortcut) can
  // prefill what the user already typed. Only fires on the open transition so
  // it never clobbers what the user types while the dialog is open.
  const prevOpenRef = useRef(false)
  useEffect(() => {
    if (open && !prevOpenRef.current && initialQuery) {
      setSearchQuery(initialQuery)
    }
    prevOpenRef.current = open
  }, [open, initialQuery])

  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => handleDialogClose(), 150); 
      return () => clearTimeout(timer);
    }
  }, [open]);

  // --- MODIFICATION START ---
  // 3. The old `parseSearchQuery` function is no longer needed and has been removed.
  // --- MODIFICATION END ---

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.trim().length < 3) {
      setCards([]); // Clear cards for short queries
      return;
    }
    setLoading(true)
    setError(null)

    // Check if query contains any shorthand syntax
    const hasShorthand = /\b(cost|power|pow|defense|def|type|t|talent|tal|rarity|r|foil|f|set|edition|color|class|c|hero|h|keyword|k|text|format|p):/.test(debouncedQuery);

    const params = new URLSearchParams();

    if (hasShorthand) {
      // Advanced search: Use parser for shorthand syntax
      const { filters } = fabShorthandParser.parseQuery(debouncedQuery);

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            if (value.length > 0) {
              params.append(key, value.join(','));
            }
          } else {
            params.append(key, String(value));
          }
        }
      });
    } else {
      // Simple search: Just search by name using Atlas
      params.append('name', debouncedQuery);
    }

    // Add static parameters
    params.append('limit', '50');
    params.append('sortBy', 'name');
    params.append('sortOrder', 'asc');
    params.append('show', 'summary');
    params.append('searchMode', 'strict'); // Use strict mode for card-search-dialog

    fetch(`/api/printings/search?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data?.printings) {
          const groupedByCard = data.data.printings.reduce((acc: any, printing: any) => {
            const cardName = printing.display_name || printing.name || 'Unknown';
            // Include color in the grouping key to separate color variants
            const baseKey = printing.card_unique_id || printing.cardId || cardName;
            const cardKey = `${baseKey}_${printing.color || 'colorless'}`;
            if (!acc[cardKey]) {
              acc[cardKey] = {
                unique_id: printing.card_unique_id || printing.cardId, name: cardName, type_text: printing.type_text, types: printing.types,
                power: printing.power, cost: printing.cost, defense: printing.defense, pitch: printing.pitch, color: printing.color, printings: []
              };
            }
            acc[cardKey].printings.push({ ...printing, unique_id: printing.printing_id, tcgMarket: printing.tcg_market, tcgLow: printing.tcg_low, tcgMid: printing.tcg_mid, tcgHigh: printing.tcg_high });
            return acc;
          }, {});
          const query = debouncedQuery.toLowerCase().trim();
          const getRelevanceScore = (name: string): number => {
            const n = name.toLowerCase();
            if (n === query) return 100;
            if (n.startsWith(query)) return 90;
            if (n.includes(query)) return 80;
            if (query.split(/\s+/).every((w: string) => n.includes(w))) return 60;
            return 10;
          };
          const pitchOrder = (p: any) => p.pitch == null ? 0 : Number(p.pitch);
          const cardsArray = Object.values(groupedByCard)
            .sort((a: any, b: any) => {
              const scoreDiff = getRelevanceScore(b.name) - getRelevanceScore(a.name);
              if (scoreDiff !== 0) return scoreDiff;
              const nameDiff = a.name.localeCompare(b.name);
              if (nameDiff !== 0) return nameDiff;
              return pitchOrder(a) - pitchOrder(b);
            })
            .map((card: any) => ({ ...card, printings: sortPrintingsByLanguage(sortPrintings(card.printings) as any[]) }));
          setCards(cardsArray);
        } else {
          setError(data.error || "Failed to search printings. Please try again.");
          setCards([]); // Clear cards on error
        }
      })
      .catch(() => {
        setError("Failed to search printings. Please try again.")
        setCards([]); // Clear cards on network failure
      })
      .finally(() => setLoading(false))
  }, [debouncedQuery])

  const handleCardSelect = (card: any) => {
    setSelectedCard(card)
    if (card.printings && card.printings.length > 0) {
      setActiveTab("printing")
    } else {
      // This case is unlikely with the new API but good to have as a fallback
      onSelectCard({ card: card, printing: card, quantity: quantity, forTrade: defaultForTrade }, false);
      onOpenChange(false);
    }
  }

  const handleConfirmSelection = (shouldContinue = false) => {
    if (selectedCard && selectedPrinting) {
      onSelectCard({ card: selectedCard, printing: selectedPrinting, quantity: quantity, forTrade: defaultForTrade }, shouldContinue);
      if (!shouldContinue) {
        onOpenChange(false);
      } else {
        const addedName = selectedPrinting.display_name || selectedCard.name;
        setSelectedCard(null);
        setSelectedPrinting(null);
        setQuantity(1);
        setActiveTab("search");
        setLastAdded(addedName);
        setTimeout(() => setLastAdded(null), 1500);
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 100);
      }
    }
  };

  const handleDialogClose = () => {
    setSelectedCard(null); setSelectedPrinting(null); setQuantity(1); setActiveTab("search"); setCards([]);
    setError(null); setSearchQuery(""); setDebouncedQuery(""); setPage(1); setTotalPages(1);
    setDefaultForTrade(true); setLastAdded(null);
  }

  const getSetDisplayName = (setCode: string): string => {
    if (!setCode) return "Unknown Set";
    if (metadata?.sets) {
      const setInfo = metadata.sets.find((s: any) => s.code === setCode?.toUpperCase() || s.code === setCode?.toLowerCase() || s.code === setCode);
      if (setInfo) return setInfo.name;
    }
    const upperCode = setCode.toUpperCase() as SetCode;
    const lowerCode = setCode.toLowerCase() as SetCode;
    return SET_MAP[lowerCode] || SET_MAP[upperCode] || setCode.toUpperCase();
  }

  const getFoilingDisplayName = (foilingCode: string): string => {
    if (!foilingCode) return "Non-foil";
    if (metadata?.foilings) {
      const foilingInfo = metadata.foilings.find((f: any) => f.code === foilingCode);
      if (foilingInfo) return foilingInfo.name;
    }
    return FOILING_MAP[foilingCode.toLowerCase() as FoilingCode] || foilingCode;
  }

  const getEditionDisplayName = (editionCode: string): string => {
    if (!editionCode) return "";
    if (metadata?.editions) {
      const editionInfo = metadata.editions.find((e: any) => e.code === editionCode);
      if (editionInfo) return editionInfo.name;
    }
    return EDITION_MAP[editionCode.toLowerCase() as EditionCode] || editionCode;
  }

  const getRarityDisplayName = (rarityCode: string): string => {
    if (!rarityCode) return "";
    if (metadata?.rarities) {
      const rarityInfo = metadata.rarities.find((r: any) => r.code === r.code);
      if (rarityInfo) return rarityInfo.name;
    }
    return RARITY_MAP[rarityCode.toLowerCase() as RarityCode] || rarityCode;
  }

  function getCheapestPrinting(printings: any[]) {
    if (!printings || printings.length === 0) return null;
    return printings.filter((p) => p.tcgLow && !isNaN(Number(p.tcgLow)))
      .reduce((min, p) => (min === null || Number(p.tcgLow) < Number(min.tcgLow) ? p : min), null)
  }

  function getColorBorderClass(color: string | undefined): string {
    if (!color || color === '') return 'border-l-4 border-l-gray-400 dark:border-l-gray-500';

    switch (color.toLowerCase()) {
      case 'red':
        return 'border-l-4 border-l-red-500 dark:border-l-red-400';
      case 'yellow':
        return 'border-l-4 border-l-yellow-500 dark:border-l-yellow-400';
      case 'blue':
        return 'border-l-4 border-l-blue-500 dark:border-l-blue-400';
      default:
        return 'border-l-4 border-l-gray-400 dark:border-l-gray-500';
    }
  }

  const renderPriceLine = (printing: any, priceField: string, label: string, showAffiliate = false) => {
    const price = printing[priceField];
    if (!price || price === "N/A" || isNaN(Number(price))) return null;
    
    const unitPrice = Number(price);
    const tcgPlayerUrl = printing.tcgplayer_url;
    
    return (
      <div className={`${showAffiliate ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-gray-600 dark:text-gray-400'} text-xs`}>
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">{label}:</span>
          <div className="flex items-center gap-2">
            <span>${unitPrice.toFixed(2)}</span>
            {showAffiliate && tcgPlayerUrl && (
              <TcgAffiliateLink
                tcgplayerUrl={tcgPlayerUrl}
                feature="CardSearchDialogPriceClick"
                onClick={(e) => e.stopPropagation()}
                className="hover:opacity-80 rounded transition-opacity"
                title="View on TCGPlayer"
              >
                <img 
                  src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
                  alt="TCGPlayer"
                  className="h-4 w-auto"
                />
              </TcgAffiliateLink>
            )}
          </div>
        </div>
      </div>
    );
  };

  function getPrintingDisplayName(printing: any) {
    const setId = printing.printing_data?.set_id || printing.set;
    const setDisplay = getSetDisplayName(setId);
    const editionDisplay = getEditionDisplayName(printing.edition);
    const foilingDisplay = getFoilingDisplayName(printing.foiling);
    const rarityDisplay = getRarityDisplayName(printing.rarity);
    const cardIdDisplay = printing.collector_number ? `(${printing.collector_number})` : '';
    
    let display = `${setDisplay} ${editionDisplay} ${foilingDisplay} ${cardIdDisplay}`.replace(/\s+/g, ' ').trim();
    if (printing.rarity !== 'c' && rarityDisplay !== 'Token') { 
        display += ` (${rarityDisplay})`; 
    } else if (rarityDisplay === 'Token') {
        display += ` (Token)`;
    }
    
    return display;
  }

  function getPrintingShortDisplay(printing: any) {
    const setId = printing.printing_data?.set_id || printing.set;
    const setDisplay = getSetDisplayName(setId);
    const editionDisplay = printing.edition === 'f' ? '1st' : printing.edition === 'u' ? 'UNL' : printing.edition === 'a' ? 'Alpha' : '';
    const foilingDisplay = printing.foiling === 's' ? 'Normal' : printing.foiling === 'r' ? 'Rainbow' : printing.foiling === 'c' ? 'Cold' : printing.foiling;
    
    return `${setDisplay} ${editionDisplay} ${foilingDisplay}`.replace(/\s+/g, ' ').trim();
  }

  useEffect(() => {
    if (selectedCard && selectedCard.printings && selectedCard.printings.length > 0) {
      setSelectedPrinting(getCheapestPrinting(selectedCard.printings) || selectedCard.printings[0])
    } else {
      setSelectedPrinting(null)
    }
  }, [selectedCard])

  useEffect(() => {
    if (open && activeTab === "search") {
      setTimeout(() => { searchInputRef.current?.focus(); searchInputRef.current?.select() }, 150)
    }
  }, [open, activeTab])

  return (
    <Dialog open={open} onOpenChange={(newOpen) => { onOpenChange(newOpen); if (!newOpen) handleDialogClose() }}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle>Search Cards</DialogTitle></DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "search" | "printing")} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search" onClick={() => {
              if (activeTab === "printing") {
                setSelectedCard(null); setSelectedPrinting(null); setCards([]); setError(null);
                setTimeout(() => { searchInputRef.current?.focus(); searchInputRef.current?.select(); }, 100)
              }
            }}>Search</TabsTrigger>
            <TabsTrigger value="printing" disabled={!selectedCard || !selectedCard.printings || selectedCard.printings.length === 0}>Select Printing</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-shrink-0">
              <div className="relative mb-4">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
                <Input ref={searchInputRef} placeholder="Search by card name..." className="pl-8 pr-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                <div className="absolute right-8 top-2.5 flex gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild><button type="button" className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" aria-label="Search help"><HelpCircle className="h-4 w-4" /></button></TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="text-sm">
                          <p className="font-medium mb-2">Search Tips:</p>
                          <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                            <strong>Simple search:</strong> Just type a card name (e.g., "command and conquer")
                          </p>
                          <p className="text-xs font-medium mb-1">Advanced filters (optional):</p>
                          <ul className="space-y-1 text-xs list-disc pl-4">
                            <li><pre>hero:levia cost:0,1</pre></li>
                            <li><pre>tal:light t:equipment</pre></li>
                            <li><pre>p:&lt;10 r:m,l keyword:dominate</pre></li>
                            <li><pre>set:wtr,arc,!out</pre></li>
                            <li><pre>t:action,!attack color:red</pre></li>
                            <li><pre>text:"create a gold"</pre></li>
                            <li><pre>power&gt;6 defense!3</pre></li>
                          </ul>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {searchQuery && (<button type="button" className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" onClick={() => setSearchQuery("")} aria-label="Clear search"><X className="h-4 w-4" /></button>)}
                </div>
              </div>
              {lastAdded && (
                <div className="mb-3 flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded px-3 py-1.5">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  Added {lastAdded}
                </div>
              )}
              {error && (<Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {loading ? (<div className="text-center py-8"><div className="animate-spin h-6 w-6 border-2 border-red-600 border-t-transparent rounded-full mx-auto mb-2"></div><p>Searching...</p></div>
              ) : cards.length > 0 ? (<div className="grid gap-2">{cards.map((card) => (
                    <Card key={card.unique_id} className={`cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${getColorBorderClass(card.color)}`} onClick={() => handleCardSelect(card)}>
                      <CardContent className="p-2.5 md:p-3"><div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm md:text-base truncate">{card.name}</p>
                            <div className="flex flex-wrap gap-1 mt-1">{card.types?.slice(0, 2).map((type: string) => (<Badge key={`${card.unique_id}-${type}`} variant="secondary" className="text-xs">{type}</Badge>))}{card.pitch && (<Badge className={`text-xs text-white ${card.pitch === 1 || card.pitch === "1" ? "bg-red-500 hover:bg-red-600" : card.pitch === 2 || card.pitch === "2" ? "bg-yellow-500 hover:bg-yellow-600 text-black" : card.pitch === 3 || card.pitch === "3" ? "bg-blue-500 hover:bg-blue-600" : "bg-gray-500 hover:bg-gray-600"}`}>Pitch {card.pitch}</Badge>)}</div>
                            {card.printings && card.printings.length > 0 && (<div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.printings.length} printing{card.printings.length !== 1 ? 's' : ''}{(() => { const cheapest = getCheapestPrinting(card.printings); if (cheapest?.tcgLow) { const displayName = getPrintingShortDisplay(cheapest); return ` • Cheapest: ${displayName} ($${Number(cheapest.tcgLow).toFixed(2)})`; } return ''; })()}</div>)}
                          </div>
                          {card.printings && card.printings.length > 0 && (() => { const cheapest = getCheapestPrinting(card.printings); if (cheapest?.tcgLow) { return (<div className="flex-shrink-0 text-right">{renderPriceLine(cheapest, 'tcgLow', 'Low', true)}</div>); } return null; })()}
                        </div></CardContent>
                    </Card>
                  ))}</div>
              ) : searchQuery && searchQuery.trim().length < 3 ? (<div className="text-center py-8"><Search className="h-8 w-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" /><p className="text-gray-500 dark:text-gray-400">Type at least 3 characters to search</p></div>
              ) : debouncedQuery ? (<div className="text-center py-8"><p>No cards found matching "{debouncedQuery}"</p></div>
              ) : (<div className="text-center py-8"><Search className="h-8 w-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" /><p className="text-gray-500 dark:text-gray-400">Search for a card by name</p></div>)}
            </div>
            {totalPages > 1 && (<div className="mt-4 flex justify-center"><Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => { if (p >= 1 && p <= totalPages) setPage(p); }} /></div>)}
          </TabsContent>

          <TabsContent value="printing" className="flex-1 overflow-hidden flex flex-col">
           {selectedCard ? (
             <div className="flex-1 flex flex-col min-h-0">
               
               <div className="flex-1 overflow-y-auto p-3 md:p-4">
                 <div className="flex-shrink-0">
                   <Button size="sm" className="mb-2" onClick={() => { setSelectedCard(null); setSelectedPrinting(null); setActiveTab("search"); setCards([]); setQuantity(1); setError(null); setTimeout(() => { searchInputRef.current?.focus(); searchInputRef.current?.select(); }, 100) }}><ArrowLeft className="h-4 w-4 mr-1" /> Back to search</Button>
                   <div className="mb-1 font-medium text-base md:text-lg">{selectedCard.name}</div>
                   <div className="mb-2 text-xs md:text-sm text-gray-600 dark:text-gray-400">{selectedCard.type_text}</div>
                   <div className="mb-3 flex flex-wrap gap-1">{selectedCard.types?.map((type: string, index: number) => (<Badge key={index} variant="secondary" className="text-xs">{type}</Badge>))}</div>
                 </div>

                 <div className="flex flex-col md:flex-row md:items-start md:gap-4">
                   <div className="flex-1 min-w-0 mb-3 md:mb-0">
                     <div className="mb-3">
                       <Label className="text-sm font-medium mb-1.5 block">Select Printing</Label>
                        <Select value={selectedPrinting?.unique_id || selectedPrinting?.printing_id || ""} onValueChange={(value) => { if (value === "cheapest") { setSelectedPrinting(getCheapestPrinting(selectedCard.printings || [])) } else { const found = (selectedCard.printings || []).find((p: any) => p.unique_id === value || p.printing_id === value); setSelectedPrinting(found || null) }}}>
                          <SelectTrigger className="w-full text-sm"><SelectValue placeholder="Choose a printing..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cheapest">Cheapest option {(() => { const cheapest = getCheapestPrinting(selectedCard.printings || []); return cheapest?.tcgLow ? `($${Number(cheapest.tcgLow).toFixed(2)})` : ''; })()}</SelectItem>
                            {(selectedCard.printings || []).map((printing: any) => {
                              const price = printing.tcgLow ? `$${Number(printing.tcgLow).toFixed(2)}` : '';
                              const displayName = getPrintingShortDisplay(printing);
                              const rarityDisplay = getRarityDisplayName(printing.rarity);
                              const cardIdDisplay = printing.collector_number ? `(${printing.collector_number})` : '';
                              const lang = (printing.language || 'en').toLowerCase();
                              return (<SelectItem key={printing.unique_id || printing.printing_id} value={printing.unique_id || printing.printing_id}><div className="flex flex-col"><span><span className="mr-1.5" aria-label={`Language: ${lang}`}>{languageFlag(lang)}</span><span className="mr-1.5 text-xs uppercase text-gray-500 dark:text-gray-400">{lang}</span>{displayName} {cardIdDisplay} {price ? `- ${price}` : ''}</span>{(rarityDisplay && rarityDisplay !== 'Common') && (<span className="text-xs text-gray-600 dark:text-gray-400">{rarityDisplay}</span>)}</div></SelectItem>);
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedPrinting && (
                        <div className="p-2.5 md:p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                          <p className="text-xs md:text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">{getPrintingDisplayName(selectedPrinting)}</p>

                          <div className="space-y-0.5 md:space-y-1">
                            {renderPriceLine(selectedPrinting, 'tcgLow', 'TCG Low', true)}
                            {!selectedPrinting.tcgLow && (<div className="text-xs text-gray-600 dark:text-gray-400 italic">No pricing information available</div>)}
                          </div>
                        </div>
                      )}
                   </div>
                   {selectedPrinting?.image_url && (<div className="flex-shrink-0 w-full flex justify-center md:w-[150px] items-start p-2 md:p-0"><img src={selectedPrinting.image_url} alt={selectedCard.name} className="max-w-[90px] md:max-w-[120px] max-h-[120px] md:max-h-[160px] w-auto h-auto object-contain border rounded shadow bg-white dark:bg-gray-900" /></div>)}
                 </div>
               </div>

               <div className="flex-shrink-0 p-4 border-t border-gray-300 dark:border-gray-700">
                 <div className="flex flex-col items-center gap-2 mb-4">
                    <Label htmlFor="quantity-stepper" className="font-medium text-sm">Quantity:</Label>
                    <QuantityStepper value={quantity} onChange={setQuantity} minValue={1} />
                </div>
                {destination === "binder" && (
                  <div className="flex items-center justify-between mb-4 px-2">
                    <Label htmlFor="for-trade-toggle" className="font-medium text-sm">Add as available for trade:</Label>
                    <Switch
                      id="for-trade-toggle"
                      checked={defaultForTrade}
                      onCheckedChange={setDefaultForTrade}
                    />
                  </div>
                )}
                <div className="flex gap-2 w-full">
                  <Button
                    className="flex-1"
                    onClick={() => handleConfirmSelection(false)}
                    disabled={!selectedPrinting}
                  >
                    Add to {destination === "event-wants" ? "Event Wants" : destination === "wants" ? "Wants List" : "Binder"}
                  </Button>
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => handleConfirmSelection(true)}
                    disabled={!selectedPrinting}
                  >
                    Add and Continue
                  </Button>
                </div>
               </div>
             </div>
            ) : (<div className="text-center text-gray-500 dark:text-gray-400 py-4">No card selected.</div>)}
          </TabsContent>
        </Tabs>
        
      </DialogContent>
    </Dialog>
  )
}
