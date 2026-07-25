"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Search, X, Loader2, ChevronDown, Sparkles, LayoutGrid, List } from "lucide-react";
import { searchClient, decksClient } from "@/lib/client";
import { sortPrintings } from "@/lib/fab-constants";
import { resolveHeroFilter } from "@/hooks/deck/useDeckEditor";
import { useToast } from "@/hooks/use-toast";
import { FABShorthandParser } from "@/lib/search/fab-shorthand-parser";
import { buildKitSections, type KitBrowseBuild } from "@/lib/deck-flow/kit-browse";
import {
  buildMobileSearchFilters, isKitBrowse, hasChipFilters,
  type MobileSearchFilterState,
} from "@/lib/deck-flow/mobile-search-filters";
import { groupSearchPrintings, hasMoreSearchPages } from "@/lib/deck-flow/search-pagination";
import { TYPE_CHIPS, GENERIC_CHIP } from "@/lib/search/card-filter-chips";
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
  /** Curated starter kits for this hero — when present, the grid defaults to
      browsing their cards (grouped by kit) until the user types a search. */
  kitBuilds?: KitBrowseBuild[];
  /** Increment to reset back to the kit-browse view (clears the query and
      scrolls the grid into view) — wired to the header's Explore button. */
  exploreSignal?: number;
}

export default function MobileCardSearch({ deck, deckId, onDeckChange, kitBuilds, exploreSignal }: Props) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  // Each result is the card's first printing, augmented with allPrintings[]
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // Raw (ungrouped) printings accumulated across pages — regrouped after each
  // fetch so a card whose printings straddle a page boundary stays one row.
  const rawResultsRef = useRef<any[]>([]);
  const lastSearchFiltersRef = useRef<any>(null);
  const [searchPage, setSearchPage] = useState(1);
  const [searchPages, setSearchPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  // Optimistic deltas while API call is in-flight
  const [deltas, setDeltas] = useState<Map<string, number>>(new Map());
  // Currently selected printing per card_unique_id
  const [selectedPrintings, setSelectedPrintings] = useState<Map<string, any>>(new Map());
  // Filter row state — the curated kits are the default SOURCE filter when
  // kits exist; pitch/type chips apply to both sources.
  const [filterState, setFilterState] = useState<MobileSearchFilterState>({ source: "kits", pitches: [], type: null });
  // Results presentation — image tiles (default) or a compact list.
  const [view, setView] = useState<"grid" | "list">("grid");

  // ── Kit-browse mode ──────────────────────────────────────────────────────
  // With no search query, the grid shows the starter kits' cards grouped by
  // kit instead of an empty prompt, so builders can scroll the curated pool.
  const { sections: kitSections, allPrintingIds: kitPrintingIds } = useMemo(
    () => buildKitSections(kitBuilds ?? []),
    [kitBuilds],
  );
  // printingId → full printing row, hydrated once per kit set
  const [kitCards, setKitCards] = useState<Map<string, any> | null>(null);
  const [kitLoading, setKitLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const kitIdsKey = kitPrintingIds.join(",");

  useEffect(() => {
    if (kitPrintingIds.length === 0) { setKitCards(null); return; }
    let cancelled = false;
    setKitLoading(true);
    (async () => {
      const map = new Map<string, any>();
      // /api/search/core clamps limit; hydrate in chunks
      const CHUNK = 90;
      for (let i = 0; i < kitPrintingIds.length; i += CHUNK) {
        const chunk = kitPrintingIds.slice(i, i + CHUNK);
        try {
          const result = await searchClient.searchPrintingsPost(
            { printingIds: chunk },
            { limit: chunk.length, show: "all" },
          );
          if (result.success && result.data?.printings) {
            for (const p of result.data.printings) map.set(p.printing_id, p);
          }
        } catch {
          // Partial hydration is fine — missing rows just don't render
        }
        if (cancelled) return;
      }
      if (!cancelled) {
        setKitCards(map);
        setKitLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitIdsKey]);

  // Explore button: clear the search AND the filter chips so the kit-browse
  // view is showing, and bring the grid into view.
  useEffect(() => {
    if (!exploreSignal) return;
    setQuery("");
    setFilterState({ source: "kits", pitches: [], type: null });
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [exploreSignal]);

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

  // Kits only count as a source when the hero actually has curated kits.
  const hasKits = kitSections.length > 0;
  const effectiveFilters: MobileSearchFilterState = useMemo(
    () => (hasKits ? filterState : { ...filterState, source: "all" }),
    [hasKits, filterState],
  );

  const doSearch = useCallback(async (q: string) => {
    setLoading(true);
    const parsed = shorthandParser.parseQuery(q.trim());
    const filters: any = buildMobileSearchFilters({
      state: effectiveFilters,
      parsed: { filters: parsed.filters, nameText: parsed.remainingText ?? "" },
      kitPrintingIds,
      heroFilter,
      formatCode,
    });

    try {
      const result = await searchClient.searchPrintingsPost(filters, { limit: 96, show: "all" });
      if (result.success && result.data?.printings) {
        lastSearchFiltersRef.current = filters;
        rawResultsRef.current = result.data.printings;
        setSearchPage(result.data.page ?? 1);
        setSearchPages(result.data.pages ?? 1);
        setResults(groupSearchPrintings(rawResultsRef.current));
        // Reset selected printings to defaults on new search
        setSelectedPrintings(new Map());
      } else {
        rawResultsRef.current = [];
        setResults([]);
        setSearchPages(1);
      }
    } catch {
      rawResultsRef.current = [];
      setResults([]);
      setSearchPages(1);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroFilter, formatCode, effectiveFilters.source, effectiveFilters.pitches, effectiveFilters.type, kitIdsKey]);

  // Fetch the next page with the same filters and merge into the grid.
  // Selected printings and optimistic deltas survive — only a NEW search resets them.
  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !lastSearchFiltersRef.current) return;
    setLoadingMore(true);
    try {
      const result = await searchClient.searchPrintingsPost(
        lastSearchFiltersRef.current,
        { limit: 96, page: searchPage + 1, show: "all" },
      );
      if (result.success && result.data?.printings) {
        rawResultsRef.current = [...rawResultsRef.current, ...result.data.printings];
        setSearchPage(result.data.page ?? searchPage + 1);
        setSearchPages(result.data.pages ?? searchPages);
        setResults(groupSearchPrintings(rawResultsRef.current));
      }
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, searchPage, searchPages]);

  const kitMode = isKitBrowse(effectiveFilters, debouncedQuery, hasKits);

  useEffect(() => {
    // Kit-browse mode owns the untouched default state — don't run a search
    if (kitMode) {
      setResults([]);
      setLoading(false);
      return;
    }
    doSearch(debouncedQuery);
  }, [debouncedQuery, doSearch, kitMode]);

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

  const handleAdd = async (card: any, pinnedPrinting?: any) => {
    const uid = card.card_unique_id;
    // Kit tiles pin the curator's exact printing; search tiles use the picker
    const printing = pinnedPrinting ?? getSelectedPrinting(card);
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

  // Pitch 1/2/3 → red/yellow/blue. Count + color double-encode (SC 1.4.1).
  // CSS dots, deliberately NOT /fab/symbols/pitchN.png — the card-frame pips
  // are red at every pitch and unreadable at text size (see app/volzar).
  const PITCH_DOT: Record<number, string> = { 1: "bg-red-500", 2: "bg-yellow-400", 3: "bg-blue-500" };
  const PITCH_NAME: Record<number, string> = { 1: "red", 2: "yellow", 3: "blue" };
  // Official card-frame glyphs (same set app/volzar/rule-glyphs.ts uses).
  const statChip = (iconSrc: string, value: number, label: string) => (
    <span
      className="inline-flex items-center gap-0.5 rounded bg-gray-100 dark:bg-gray-800 px-1 py-px text-[11px] font-semibold tabular-nums text-gray-800 dark:text-gray-200"
      role="img"
      aria-label={`${label} ${value}`}
      title={`${label} ${value}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={iconSrc} alt="" aria-hidden="true" className="h-3 w-3 object-contain" />
      {value}
    </span>
  );

  // Compact list row — same add/remove semantics as the tile, one card per
  // line: thumb · name + stats + printing/price · − qty +. Printing swaps stay
  // a grid-view affordance; the list is for fast scanning and quick adds.
  const renderRow = (card: any, opts: { key: string; kitQty?: number; pinned?: boolean }) => {
    const uid = card.card_unique_id;
    const qty = getQty(uid);
    const maxQty = getMaxCopies(card);
    const atMax = qty >= maxQty;
    const selectedPrinting = opts.pinned ? card : getSelectedPrinting(card);
    const price = selectedPrinting.tcg_low ?? selectedPrinting.tcg_market;
    const pitch: number | null = typeof card.pitch === "number" && card.pitch >= 1 && card.pitch <= 3 ? card.pitch : null;

    return (
      <div key={opts.key} className="flex items-center gap-2.5 py-1.5">
        <div className="relative w-10 h-14 shrink-0 rounded overflow-hidden bg-gray-200 dark:bg-gray-800">
          {selectedPrinting.image_url ? (
            <img src={selectedPrinting.image_url} alt="" aria-hidden="true" className="w-full h-full object-cover" loading="lazy" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate leading-tight">
            {card.display_name || card.name}
            {(opts.kitQty ?? 0) > 1 && <span className="ml-1.5 text-xs font-bold text-gray-500 dark:text-gray-400">×{opts.kitQty}</span>}
          </p>
          {/* Stats: pitch pips (count = pitch), cost, attack, then defense OR
              health — a card never has both (weapons attack; other equipment
              is defense-or-nothing). Zero is a real value — print it. */}
          <p className="flex items-center gap-1.5 mt-0.5">
            {pitch != null && (
              <span className="flex items-center gap-0.5" role="img" aria-label={`Pitch ${pitch} (${PITCH_NAME[pitch]})`} title={`Pitch ${pitch} (${PITCH_NAME[pitch]})`}>
                {Array.from({ length: pitch }).map((_, i) => (
                  <span key={i} className={`h-2 w-2 rounded-full ${PITCH_DOT[pitch]}`} />
                ))}
              </span>
            )}
            {card.cost != null && statChip("/fab/symbols/cost.png", card.cost, "Cost")}
            {card.power != null && statChip("/fab/symbols/power.png", card.power, "Attack")}
            {card.defense != null
              ? statChip("/fab/symbols/block.png", card.defense, "Defense")
              : card.health != null
                ? statChip("/fab/symbols/health.png", card.health, "Health")
                : null}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-0.5">
            {printingLabel(selectedPrinting)}
            {price != null && Number(price) > 0 ? ` · $${Number(price).toFixed(2)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => handleRemove(card)}
            disabled={qty === 0}
            className="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-200 disabled:opacity-30 active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
            aria-label="Remove one"
          >
            <span className="text-lg font-light leading-none select-none">−</span>
          </button>
          <span className={`text-sm font-bold w-6 text-center tabular-nums ${qty > 0 ? (atMax ? "text-orange-500" : "text-gray-900 dark:text-white") : "text-gray-400 dark:text-gray-500"}`}>
            {qty}
          </span>
          <button
            onClick={() => handleAdd(card, opts.pinned ? card : undefined)}
            disabled={atMax}
            className="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
            aria-label="Add one"
          >
            <span className="text-lg font-light leading-none select-none">+</span>
          </button>
        </div>
      </div>
    );
  };

  // Shared tile renderer for both the search grid and kit-browse sections.
  // Kit tiles pin the curator's chosen printing (no picker) and show the
  // kit's recommended count as a ×N badge.
  const renderTile = (card: any, opts: { key: string; kitQty?: number; pinned?: boolean }) => {
    const uid = card.card_unique_id;
    const qty = getQty(uid);
    const maxQty = getMaxCopies(card);
    const atMax = qty >= maxQty;
    const selectedPrinting = opts.pinned ? card : getSelectedPrinting(card);
    const price = selectedPrinting.tcg_low ?? selectedPrinting.tcg_market;
    const hasMultiplePrintings = !opts.pinned && (card.allPrintings?.length ?? 1) > 1;

    return (
      <div key={opts.key} className="flex flex-col">
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
          {/* Kit recommended-count badge */}
          {(opts.kitQty ?? 0) > 1 && (
            <div className="absolute top-1.5 right-1.5 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-md font-bold leading-none">
              ×{opts.kitQty}
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
            onClick={() => handleAdd(card, opts.pinned ? card : undefined)}
            disabled={atMax}
            className="w-8 h-8 rounded-full border flex items-center justify-center transition-colors active:bg-gray-100 dark:active:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
            aria-label="Add one"
          >
            <span className="text-lg font-light leading-none select-none">+</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div ref={rootRef} className="flex flex-col">
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

        {/* Filter row — the curated kits are just the default SOURCE filter;
            pitch/type chips narrow either source. Wraps (never h-scrolls) so
            every control stays on screen at phone widths. */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2">
          {hasKits && (
            <div className="flex shrink-0 overflow-hidden rounded-full border border-gray-300 dark:border-gray-700" role="group" aria-label="Card source">
              {([["kits", "Kits"], ["all", "All cards"]] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilterState(s => ({ ...s, source: value }))}
                  aria-pressed={filterState.source === value}
                  className={`px-2.5 py-1 text-xs whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                    filterState.source === value
                      ? "bg-blue-600 font-semibold text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {filterState.source === value ? "✓ " : ""}{label}
                </button>
              ))}
            </div>
          )}
          {([[1, "R", "bg-red-500"], [2, "Y", "bg-yellow-400"], [3, "B", "bg-blue-500"]] as const).map(([pitch, label, dot]) => {
            const active = filterState.pitches.includes(pitch);
            return (
              <button
                key={pitch}
                type="button"
                onClick={() => setFilterState(s => ({
                  ...s,
                  pitches: active ? s.pitches.filter(p => p !== pitch) : [...s.pitches, pitch],
                }))}
                aria-pressed={active}
                aria-label={`Pitch ${pitch}`}
                className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  active
                    ? "border-blue-500 bg-blue-600/10 font-semibold text-gray-900 dark:text-gray-100"
                    : "border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden="true" />
                {active ? "✓ " : ""}{label}
              </button>
            );
          })}
          <select
            value={filterState.type ?? ""}
            onChange={e => setFilterState(s => ({ ...s, type: e.target.value || null }))}
            aria-label="Card type filter"
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              filterState.type
                ? "border-blue-500 bg-blue-600/10 font-semibold text-gray-900 dark:text-gray-100"
                : "border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            }`}
          >
            <option value="">Any type</option>
            {[...TYPE_CHIPS, GENERIC_CHIP].map(chip => (
              <option key={chip.value} value={chip.value}>{chip.label.replace(/­/g, "")}</option>
            ))}
          </select>
          {/* Grid / list results toggle */}
          <div className="flex shrink-0 overflow-hidden rounded-full border border-gray-300 dark:border-gray-700" role="group" aria-label="Results view">
            {([["grid", LayoutGrid, "Tile view"], ["list", List, "List view"]] as const).map(([value, Icon, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setView(value)}
                aria-pressed={view === value}
                aria-label={label}
                className={`px-2.5 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  view === value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ))}
          </div>
          {(hasChipFilters(filterState) || (hasKits && filterState.source !== "kits")) && (
            <button
              type="button"
              onClick={() => setFilterState({ source: "kits", pitches: [], type: null })}
              className="shrink-0 rounded-full px-2 py-1 text-xs text-gray-600 dark:text-gray-400 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {kitMode ? (
        /* Kit-browse mode: the starter kits' cards, grouped by kit */
        <div className="p-3 pb-28 space-y-5">
          {kitLoading && !kitCards ? (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400 py-12">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading starter kits…
            </div>
          ) : (
            kitSections.map(section => {
              const tiles = section.entries
                .map(entry => ({ entry, row: kitCards?.get(entry.printingId) }))
                .filter(t => t.row);
              if (tiles.length === 0) return null;
              return (
                <section key={section.id}>
                  <header className="flex items-baseline gap-2 mb-2 px-0.5">
                    <Sparkles className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0 self-center" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{section.name}</h3>
                    <span className="text-xs text-gray-600 dark:text-gray-300 shrink-0">
                      {section.totalCards} cards{section.curatorName ? ` · ${section.curatorName}` : ""}
                    </span>
                  </header>
                  {view === "grid" ? (
                    <div className="grid grid-cols-2 gap-3">
                      {tiles.map(({ entry, row }) =>
                        renderTile(row, { key: `${section.id}-${entry.printingId}`, kitQty: entry.qty, pinned: true })
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-800">
                      {tiles.map(({ entry, row }) =>
                        renderRow(row, { key: `${section.id}-${entry.printingId}`, kitQty: entry.qty, pinned: true })
                      )}
                    </div>
                  )}
                </section>
              );
            })
          )}
          {!kitLoading && kitCards && kitCards.size === 0 && (
            <div className="text-center text-sm text-gray-400 py-12">
              Couldn&apos;t load starter kit cards. Type above to search instead.
            </div>
          )}
        </div>
      ) : (
        /* Search results — tiles or compact list */
        <div className={view === "grid" ? "grid grid-cols-2 gap-3 p-3 pb-28" : "p-3 pb-28 divide-y divide-gray-200 dark:divide-gray-800"}>
          {results.map(card =>
            view === "grid"
              ? renderTile(card, { key: card.card_unique_id })
              : renderRow(card, { key: card.card_unique_id })
          )}

          {!loading && results.length > 0 && hasMoreSearchPages(searchPage, searchPages) && (
            <div className="col-span-2 py-3">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-base text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
                  </>
                ) : (
                  <>Load more <span className="text-gray-500 dark:text-gray-400">(page {searchPage} of {searchPages})</span></>
                )}
              </button>
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="col-span-2 text-center text-sm text-gray-400 py-12">
              {query || hasChipFilters(effectiveFilters) ? (
                <>
                  No cards found{effectiveFilters.source === "kits" ? " in the starter kits" : ""}.
                  {effectiveFilters.source === "kits" && (
                    <button
                      type="button"
                      onClick={() => setFilterState(s => ({ ...s, source: "all" }))}
                      className="mt-2 block mx-auto text-blue-500 dark:text-blue-400 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
                    >
                      Search all cards instead
                    </button>
                  )}
                </>
              ) : "Type to search for cards."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
