"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, X, Loader2, ChevronDown } from "lucide-react";
import { searchClient, decksClient } from "@/lib/client";
import { sortPrintings } from "@/lib/fab-constants";
import { resolveHeroFilter } from "@/hooks/deck/useDeckEditor";
import { useToast } from "@/hooks/use-toast";
import { FABShorthandParser } from "@/lib/search/fab-shorthand-parser";
import type { DeckDTO, DeckCategory } from "@/lib/services/contracts/IDeckService";

const shorthandParser = new FABShorthandParser();

const FORMAT_TO_SEARCH: Record<string, string> = {
  "Classic Constructed": "cc",
  "Blitz": "blitz",
  "Commoner": "commoner",
  "Living Legend": "ll",
  "Silver Age": "silver_age",
};

function inferCategory(card: any): DeckCategory {
  const types: string[] = (card.types || []).map((t: string) => t.toLowerCase());
  if (types.some(t => t === "hero")) return "hero";
  if (types.some(t => t === "equipment" || t === "weapon")) return "equipment";
  return "maindeck";
}

function getMaxCopies(card: any): number {
  const types: string[] = (card.types || []).map((t: string) => t.toLowerCase());
  const rarity = (card.rarity || "").toLowerCase();
  if (types.some(t => t === "hero")) return 1;
  if (rarity === "l" || rarity === "f") return 1; // legendary / fabled
  if (types.some(t => t === "equipment" || t === "weapon")) return 2;
  return 3;
}

function printingLabel(p: any): string {
  const set = (p.set || p.set_id || "").toUpperCase();
  const ed = p.edition;
  const edLabel = ed === "f" ? "1st" : ed === "u" ? "Unl" : ed === "n" ? "New" : ed ? ed.toUpperCase() : "";
  const foil = p.foiling && p.foiling !== "S" && p.foiling !== "N" ? ` · ${p.foiling.toUpperCase()}` : "";
  return [set, edLabel].filter(Boolean).join(" ") + foil;
}

interface Props {
  deck: DeckDTO;
  deckId: string;
  onDeckChange: () => void;
}

export default function MobileCardSearch({ deck, deckId, onDeckChange }: Props) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  // Each result is the card's first printing, augmented with allPrintings[]
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // Optimistic deltas while API call is in-flight
  const [deltas, setDeltas] = useState<Map<string, number>>(new Map());
  // Currently selected printing per card_unique_id
  const [selectedPrintings, setSelectedPrintings] = useState<Map<string, any>>(new Map());

  // Debounce search query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Build map: card_unique_id → { qty, printings[] } from current deck
  const deckQtyMap = useMemo(() => {
    const map = new Map<string, { qty: number; printings: Array<{ printingId: string; quantity: number; category: DeckCategory }> }>();
    const slots = [
      ...(deck.hero || []).map(p => ({ ...p, _cat: "hero" as DeckCategory })),
      ...(deck.equipment || []).map(p => ({ ...p, _cat: "equipment" as DeckCategory })),
      ...(deck.maindeck || []).map(p => ({ ...p, _cat: "maindeck" as DeckCategory })),
      ...(deck.inventory || []).map(p => ({ ...p, _cat: "inventory" as DeckCategory })),
    ];
    slots.forEach(slot => {
      const uid = (slot.printingDetails as any)?.card_unique_id;
      if (!uid) return;
      if (!map.has(uid)) map.set(uid, { qty: 0, printings: [] });
      const entry = map.get(uid)!;
      const q = slot.quantity || 1;
      entry.qty += q;
      entry.printings.push({ printingId: slot.printingId, quantity: q, category: slot._cat });
    });
    return map;
  }, [deck]);

  const getQty = (uid: string) => Math.max(0, (deckQtyMap.get(uid)?.qty ?? 0) + (deltas.get(uid) ?? 0));

  const heroFilter = useMemo(() => resolveHeroFilter(deck), [deck]);
  const formatCode = deck.format ? FORMAT_TO_SEARCH[deck.format] : undefined;

  const doSearch = useCallback(async (q: string) => {
    setLoading(true);
    const parsed = shorthandParser.parseQuery(q.trim());
    const filters: any = { ...parsed.filters };
    if (parsed.remainingText.trim()) filters.name = parsed.remainingText.trim();
    if (heroFilter) {
      filters.heroClasses = heroFilter.heroClasses;
      filters.heroTalents = heroFilter.heroTalents;
      if (heroFilter.heroEssences.length > 0) filters.heroEssences = heroFilter.heroEssences;
    }
    if (formatCode) filters.format = formatCode;
    filters.isHero = false;

    try {
      const result = await searchClient.searchPrintingsPost(filters, { limit: 96, show: "all" });
      if (result.success && result.data?.printings) {
        // Group all printings by card_unique_id; keep one row per card with allPrintings[]
        const groups = new Map<string, { base: any; all: any[] }>();
        for (const p of result.data.printings) {
          const uid = p.card_unique_id;
          if (!groups.has(uid)) groups.set(uid, { base: p, all: [] });
          groups.get(uid)!.all.push(p);
        }
        const grouped = Array.from(groups.values()).map(g => ({
          ...g.base,
          allPrintings: sortPrintings(g.all),
        }));
        setResults(grouped);
        // Reset selected printings to defaults on new search
        setSelectedPrintings(new Map());
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [heroFilter, formatCode]);

  useEffect(() => {
    doSearch(debouncedQuery);
  }, [debouncedQuery, doSearch]);

  const applyDelta = (uid: string, delta: number) =>
    setDeltas(prev => { const m = new Map(prev); m.set(uid, (m.get(uid) ?? 0) + delta); return m; });

  const clearDelta = (uid: string) =>
    setDeltas(prev => { const m = new Map(prev); m.delete(uid); return m; });

  const getSelectedPrinting = (card: any) =>
    selectedPrintings.get(card.card_unique_id) ?? card;

  const handlePrintingChange = (card: any, printingId: string) => {
    const printing = card.allPrintings?.find((p: any) => p.printing_id === printingId);
    if (printing) {
      setSelectedPrintings(prev => new Map(prev).set(card.card_unique_id, printing));
    }
  };

  const handleAdd = async (card: any) => {
    const uid = card.card_unique_id;
    const printing = getSelectedPrinting(card);
    applyDelta(uid, 1);
    try {
      const result = await decksClient.addPrintings(deckId, [{
        printingId: printing.printing_id,
        quantity: 1,
        category: inferCategory(card),
      }]);
      if (!result.success) {
        toast({ title: "Couldn't add card", description: result.error, variant: "destructive" });
        return;
      }
      onDeckChange();
    } catch {
      toast({ title: "Couldn't add card", variant: "destructive" });
    } finally {
      clearDelta(uid);
    }
  };

  const handleRemove = async (card: any) => {
    const uid = card.card_unique_id;
    const entry = deckQtyMap.get(uid);
    if (!entry || entry.qty === 0) return;
    applyDelta(uid, -1);
    try {
      const target = entry.printings[0];
      const result = await decksClient.removePrinting(deckId, target.printingId, target.category, 1);
      if (!result.success) {
        toast({ title: "Couldn't remove card", description: result.error, variant: "destructive" });
        return;
      }
      onDeckChange();
    } catch {
      toast({ title: "Couldn't remove card", variant: "destructive" });
    } finally {
      clearDelta(uid);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Sticky search bar */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 px-3 py-2 border-b border-gray-300 dark:border-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder='Search cards… or try keyword:"go again" color:blue'
            className="w-full pl-9 pr-9 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {query ? (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <X className="h-4 w-4" />
            </button>
          ) : loading ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
          ) : null}
        </div>
        {!heroFilter && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 px-1">
            No hero set — add your hero first to filter by class.
          </p>
        )}
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-2 gap-3 p-3 pb-28">
        {results.map(card => {
          const uid = card.card_unique_id;
          const qty = getQty(uid);
          const maxQty = getMaxCopies(card);
          const atMax = qty >= maxQty;
          const selectedPrinting = getSelectedPrinting(card);
          const price = selectedPrinting.tcg_low ?? selectedPrinting.tcg_market;
          const hasMultiplePrintings = (card.allPrintings?.length ?? 1) > 1;

          return (
            <div key={uid} className="flex flex-col">
              {/* Card image */}
              <div className="relative rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800" style={{ aspectRatio: "5/7" }}>
                {selectedPrinting.image_url ? (
                  <img
                    src={selectedPrinting.image_url}
                    alt={card.display_name || card.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-gray-400 p-2 text-center">
                    {card.display_name || card.name}
                  </div>
                )}
                {/* Price badge */}
                {price != null && Number(price) > 0 && (
                  <div className="absolute bottom-1.5 right-1.5 bg-green-600 text-white text-xs px-1.5 py-0.5 rounded-md font-bold leading-none">
                    ${Number(price).toFixed(2)}
                  </div>
                )}
                {/* In-deck qty badge */}
                {qty > 0 && (
                  <div className={`absolute top-1.5 left-1.5 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold leading-none ${atMax ? "bg-orange-500" : "bg-blue-600"}`}>
                    {qty}
                  </div>
                )}
              </div>

              {/* Card name */}
              <p className="text-xs font-medium text-gray-900 dark:text-white mt-1.5 truncate leading-tight px-0.5">
                {card.display_name || card.name}
              </p>

              {/* Printing selector */}
              {hasMultiplePrintings ? (
                <div className="relative mt-1 px-0.5">
                  <select
                    value={selectedPrinting.printing_id}
                    onChange={e => handlePrintingChange(card, e.target.value)}
                    className="w-full appearance-none bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[11px] rounded-md px-2 py-1 pr-5 focus:outline-none focus:ring-1 focus:ring-blue-500 truncate"
                  >
                    {card.allPrintings.map((p: any) => (
                      <option key={p.printing_id} value={p.printing_id}>
                        {printingLabel(p)}{p.tcg_low ? ` · $${Number(p.tcg_low).toFixed(2)}` : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
                </div>
              ) : (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 px-0.5 truncate">
                  {printingLabel(selectedPrinting)}
                </p>
              )}

              {/* +/- controls */}
              <div className="flex items-center justify-between mt-1.5 px-0.5">
                <button
                  onClick={() => handleRemove(card)}
                  disabled={qty === 0}
                  className="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-200 disabled:opacity-30 active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
                  aria-label="Remove one"
                >
                  <span className="text-lg font-light leading-none select-none">−</span>
                </button>
                <span className="text-sm font-bold text-gray-900 dark:text-white w-8 text-center tabular-nums">
                  {qty}{atMax && qty > 0 ? <span className="text-[9px] text-orange-500 block leading-none">max</span> : null}
                </span>
                <button
                  onClick={() => handleAdd(card)}
                  disabled={atMax}
                  className="w-8 h-8 rounded-full border flex items-center justify-center transition-colors active:bg-gray-100 dark:active:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                  aria-label="Add one"
                >
                  <span className="text-lg font-light leading-none select-none">+</span>
                </button>
              </div>
            </div>
          );
        })}

        {!loading && results.length === 0 && (
          <div className="col-span-2 text-center text-sm text-gray-400 py-12">
            {query ? "No cards found." : "Type to search for cards."}
          </div>
        )}
      </div>
    </div>
  );
}
