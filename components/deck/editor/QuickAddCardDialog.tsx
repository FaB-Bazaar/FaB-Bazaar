"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo, useReducer } from "react";
import { useDebounce } from "use-debounce";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Check, Loader2, Search, ZoomIn, ArrowLeft } from "lucide-react";
import { CardDetailsLightbox, FoilBadge, PITCH_STYLE, type LightboxCard } from "@/components/cards/CardDetailsLightbox";
import { cn } from "@/lib/utils";
import type { DeckCategory } from "@/lib/services/contracts/IDeckService";
import { SET_IMAGES } from "@/lib/set-images";
import { getApiFormatCode } from "@/lib/format-constants";
import { sortPrintings } from "@/lib/fab-constants/sets";
import { groupSearchPrintingsToCards } from "@/lib/deck/group-search-results";
import { resolveHeroFilter } from "@/lib/deck/resolve-hero-filter";
import { buildDeckAddFilters } from "@/lib/search/deck-add-filters";
import { optSearchReducer } from "@/lib/search/opt-search-reducer";
import { DEFAULT_OPT_STATE } from "@/lib/search/opt-url-state";
import { useCardSearch } from "@/hooks/search/useCardSearch";
import QuickAddCommandBar from "./quick-add-command-bar";
import type { FacetDef } from "@/components/search/card-filter-facets";
import {
  type CardResult,
  type PrintingResult,
  fetchPrintingsForCard,
} from "@/lib/client/hero-pool-cache";
import { searchClient } from "@/lib/client";

interface QuickAddCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (printing: PrintingResult, quantity: number) => Promise<void>;
  targetCategory: DeckCategory;
  /** If set, restrict results to this pitch (1=red, 2=yellow, 3=blue) */
  pitchFilter?: 1 | 2 | 3;
  deckFormat?: string;
  currentDeck?: any;
  /** Swap mode (curation printing swap): pre-fills the search input and
   *  switches to an exact-name flat printing list, bypassing the catalog
   *  search chrome entirely. */
  initialSearch?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ZONE_LABELS: Partial<Record<DeckCategory, string>> = {
  hero: "Hero",
  equipment: "Equipment & Weapons",
  maindeck: "Library",
  inventory: "Inventory",
  benched: "Bench",
};

// Facets hidden in the deck-add dialog: class/talent/format are implied by the
// hero + deck format, language stays English for deck adds, price and
// foiling/edition are printing-level concerns handled by the printing picker.
const BASE_EXCLUDED_FACETS = ["class", "talent", "format", "price", "more", "language"];

// Tile quick-add quantities: 3 is the CC per-card cap (Blitz/Silver Age is 2;
// the server rejects an over-cap add, same as the printing panel's stepper).
const QUICK_ADD_QTYS = [1, 2, 3] as const;
type QuickAddQty = (typeof QUICK_ADD_QTYS)[number];


// ─── Helpers ──────────────────────────────────────────────────────────────────

function collectorLabel(p: PrintingResult): string {
  return p.collector_number || (p.set || "").toUpperCase() || "—";
}


// ─── Foil / edition badges ────────────────────────────────────────────────────

function PrintingBadges({ p }: { p: PrintingResult }) {
  const badges: React.ReactNode[] = [];

  if (p.rarity === "v") {
    return (
      <span className="text-[8px] px-1 py-px rounded font-semibold bg-amber-500/30 text-amber-300 border border-amber-400/50">
        Marvel
      </span>
    );
  }

  if (p.edition === "f") {
    badges.push(
      <span key="1st" className="text-[8px] px-1 py-px rounded bg-orange-500/20 text-orange-300 border border-orange-500/40 font-medium">
        1st
      </span>
    );
  } else if (p.edition === "u") {
    badges.push(
      <span key="unl" className="text-[8px] px-1 py-px rounded bg-gray-600/60 text-gray-400 border border-gray-600">
        UNL
      </span>
    );
  }

  if (p.foiling === "r" || p.foiling === "c" || p.foiling === "g") {
    badges.push(<FoilBadge key={p.foiling} code={p.foiling} className="text-[8px]" />);
  }

  if (p.is_extended_art) {
    badges.push(
      <span key="ea" className="text-[8px] px-1 py-px rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
        EA
      </span>
    );
  }

  if (badges.length === 0) return null;
  return <div className="flex flex-wrap gap-0.5 justify-center">{badges}</div>;
}

// ─── Drag-scroll hook ─────────────────────────────────────────────────────────

function useDragScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const didDrag = useRef(false); // true if mouse moved enough to count as a drag
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    dragging.current = true;
    didDrag.current = false;
    setIsDragging(true);
    startX.current = e.pageX - ref.current.getBoundingClientRect().left;
    scrollLeft.current = ref.current.scrollLeft;
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.getBoundingClientRect().left;
    const delta = x - startX.current;
    if (Math.abs(delta) > 4) didDrag.current = true;
    ref.current.scrollLeft = scrollLeft.current - delta * 1.1;
  }, []);

  const stopDrag = useCallback(() => {
    dragging.current = false;
    setIsDragging(false);
  }, []);

  return {
    ref,
    isDragging,
    /** True if the user actually moved the mouse during this drag (suppress click) */
    didDrag,
    onMouseDown,
    onMouseMove,
    onMouseUp: stopDrag,
    onMouseLeave: stopDrag,
  };
}

// ─── Printing tile ────────────────────────────────────────────────────────────

function PrintingTile({
  p,
  isSelected,
  onSelect,
  onEnlarge,
  onAdd,
  didDrag,
}: {
  p: PrintingResult;
  isSelected: boolean;
  onSelect: (p: PrintingResult) => void;
  onEnlarge: (p: PrintingResult) => void;
  onAdd?: (qty: number) => Promise<void>;
  didDrag: React.MutableRefObject<boolean>;
}) {
  const price = p.tcg_low ?? p.tcg_market;
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [qty, setQty] = useState(1);

  const handleTileAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onAdd || adding) return;
    setAdding(true);
    try {
      await onAdd(qty);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1500);
    } catch {
      // onAdd already surfaced the failure (toast); just don't flash "Added".
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      onDragStart={e => e.preventDefault()}
      className={cn(
        "relative flex flex-col rounded-lg p-1.5 transition-all flex-shrink-0 select-none group",
        isSelected
          ? "ring-2 ring-blue-500 bg-blue-500/10"
          : "ring-1 ring-gray-600 hover:ring-gray-400 bg-gray-800/60 hover:bg-gray-700/60",
      )}
      style={{ width: 130 }}
    >
      {/* Card image — clickable to select */}
      <div
        role="button"
        tabIndex={0}
        className="cursor-pointer"
        onMouseUp={() => { if (!didDrag.current) onSelect(p); }}
        onKeyDown={e => e.key === "Enter" && onSelect(p)}
      >
        <div className="relative rounded overflow-hidden w-full" style={{ aspectRatio: "63/88" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.image_url || "/cardback.webp"}
            alt={collectorLabel(p)}
            className="w-full h-full object-cover object-top"
            draggable={false}
          />
          {isSelected && (
            <div className="absolute top-1.5 right-1.5 bg-blue-500 rounded-full p-0.5">
              <Check className="h-3 w-3 text-white" />
            </div>
          )}
        </div>
      </div>

      {/* Magnify button */}
      {p.image_url && (
        <button
          className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gray-900/80 text-gray-400 hover:text-white hover:bg-gray-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10"
          title="Enlarge image"
          onClick={e => { e.stopPropagation(); onEnlarge(p); }}
          onMouseDown={e => e.stopPropagation()}
        >
          <ZoomIn className="h-2.5 w-2.5" />
        </button>
      )}

      {/* Info */}
      <div className="flex flex-col items-center gap-0.5 py-1.5 flex-1">
        <span className="text-xs font-mono text-gray-300 leading-tight truncate w-full px-1">
          {collectorLabel(p)}
        </span>
        <div className="flex items-center justify-center gap-2 w-full px-1">
          {SET_IMAGES[(p.set || '').toLowerCase()] && (
            <img
              src={`https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${SET_IMAGES[(p.set || '').toLowerCase()]}/public`}
              alt={p.set || ''}
              className="w-14 h-14 object-contain flex-shrink-0"
            />
          )}
          <PrintingBadges p={p} />
        </div>
        {price != null && price > 0 ? (
          <span className="text-[10px] text-green-400 font-medium">${price.toFixed(2)}</span>
        ) : (
          <span className="text-[9px] text-gray-600">—</span>
        )}
      </div>

      {/* Qty stepper + Add — always at bottom */}
      {onAdd ? (
        <div className="flex flex-col gap-1 mt-auto">
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={e => { e.stopPropagation(); setQty(q => Math.max(1, q - 1)); }}
              onMouseDown={e => e.stopPropagation()}
              className="w-5 h-5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 flex items-center justify-center text-xs transition-colors"
            >−</button>
            <span className="w-5 text-center text-xs font-medium text-gray-200 tabular-nums">{qty}</span>
            <button
              onClick={e => { e.stopPropagation(); setQty(q => Math.min(3, q + 1)); }}
              onMouseDown={e => e.stopPropagation()}
              className="w-5 h-5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 flex items-center justify-center text-xs transition-colors"
            >+</button>
          </div>
          <button
            onClick={handleTileAdd}
            onMouseDown={e => e.stopPropagation()}
            disabled={adding}
            className={cn(
              "w-full rounded text-xs font-medium py-1 transition-all flex items-center justify-center gap-1",
              justAdded
                ? "bg-green-600/20 text-green-400 border border-green-600/40"
                : isSelected
                  ? "bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60"
                  : "bg-gray-700 hover:bg-blue-600 hover:text-white text-gray-300",
            )}
          >
            {adding
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : justAdded
                ? <><Check className="h-3 w-3" />Added</>
                : <><Plus className="h-3 w-3" />Add</>}
          </button>
        </div>
      ) : (
        isSelected && <Check className="h-3 w-3 text-blue-400 mx-auto mt-1" />
      )}
    </div>
  );
}

// ─── Card grid tile ───────────────────────────────────────────────────────────

function CardGridTile({
  card,
  isSelected,
  inDeckCount,
  onClick,
  onQuickAdd,
  onMagnify,
  quickAddStatus,
}: {
  card: CardResult;
  isSelected: boolean;
  inDeckCount: number;
  onClick: () => void;
  onQuickAdd: (qty: QuickAddQty) => void;
  onMagnify: () => void;
  quickAddStatus: 'idle' | 'adding' | 'added';
}) {
  const pitchStyle = card.pitch ? PITCH_STYLE[card.pitch] : null;
  return (
    <div
      data-testid="card-grid-tile"
      className={cn(
        "relative group/tile flex flex-col rounded overflow-hidden transition-all border border-l-4",
        isSelected
          ? "border-blue-500/80 border-l-blue-400 ring-2 ring-blue-500/40"
          : cn("border-gray-700/60 hover:border-gray-500/60", pitchStyle ? pitchStyle.border : "border-l-gray-600"),
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col w-full text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <div className="w-full overflow-hidden" style={{ aspectRatio: '63/88' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.printings[0]?.image_url || '/cardback.webp'}
            alt={card.name}
            className="w-full h-full object-cover object-top"
            draggable={false}
          />
        </div>
        <div className={cn("w-full px-1 py-1 text-center", isSelected ? "bg-blue-900/30" : "bg-gray-800/80")}>
          <p className="text-[9px] font-medium text-gray-200 truncate leading-tight">{card.name}</p>
          {/* True printing count — uses the synthesized __printingsCount when the
              grouped search provides only the representative printing. */}
          {(() => {
            const count = (card as any).__printingsCount ?? card.printings.length;
            return count > 1 ? (
              <p className="text-[8px] text-gray-600 leading-tight">{count}p</p>
            ) : null;
          })()}
        </div>
      </button>
      {/* Already-in-deck badge */}
      {inDeckCount > 0 && (
        <div data-testid="tile-indeck-count" className="absolute top-1 left-1 bg-blue-600/90 text-white text-[9px] font-bold px-1 py-px rounded leading-tight">
          {inDeckCount}
        </div>
      )}
      {/* Hover magnifier — read the card without selecting it */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onMagnify(); }}
        aria-label={`View card details for ${card.name}`}
        title="View card details"
        className="absolute top-1 right-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-gray-900/80 text-gray-300 opacity-0 transition-all hover:bg-gray-700 hover:text-white group-hover/tile:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <ZoomIn className="h-3.5 w-3.5" />
      </button>
      {/* Hover/focus action bar — quick add (default printing) or open the printing picker */}
      <div
        className={cn(
          "absolute inset-x-1 bottom-8 flex flex-col gap-1 transition-opacity",
          quickAddStatus === 'idle'
            ? "opacity-0 pointer-events-none group-hover/tile:opacity-100 group-hover/tile:pointer-events-auto group-focus-within/tile:opacity-100 group-focus-within/tile:pointer-events-auto"
            : "opacity-100",
        )}
      >
        {quickAddStatus === 'idle' ? (
          <div
            role="group"
            aria-label={`Quick add ${card.name}`}
            className="flex w-full items-stretch rounded shadow-md overflow-hidden bg-blue-600 text-white"
          >
            <span className="flex items-center pl-2 pr-1 text-[11px] font-semibold whitespace-nowrap" aria-hidden="true">
              Quick add
            </span>
            {QUICK_ADD_QTYS.map(qty => (
              <button
                key={qty}
                type="button"
                onClick={() => onQuickAdd(qty)}
                aria-label={`Quick add ${qty}× ${card.name}`}
                title={`Add ${qty}× of the default printing`}
                className="flex-1 border-l border-blue-400/60 px-1 py-1 text-xs font-bold tabular-nums transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-200"
              >
                +{qty}
              </button>
            ))}
          </div>
        ) : (
          <div
            role="status"
            className={cn(
              "w-full rounded px-1.5 py-1 text-center text-xs font-semibold shadow-md text-white",
              quickAddStatus === 'added' ? "bg-green-600" : "bg-blue-600 opacity-80",
            )}
          >
            {quickAddStatus === 'added' ? '✓ Added' : 'Adding…'}
          </div>
        )}
        <button
          type="button"
          onClick={onClick}
          aria-label={`Choose printing for ${card.name}`}
          className="w-full rounded bg-gray-900/90 px-1.5 py-1 text-xs font-medium text-gray-100 shadow-md hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
        >
          Choose printing
        </button>
      </div>
    </div>
  );
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

export default function QuickAddCardDialog({
  open,
  onOpenChange,
  onAdd,
  targetCategory,
  pitchFilter,
  deckFormat,
  currentDeck,
  initialSearch,
}: QuickAddCardDialogProps) {
  const isSwapMode = !!initialSearch;

  // ── /opt-style search state (main mode) ──
  // Same reducer + debounce as /opt, minus the URL sync (dialog state is
  // ephemeral). Reset on every open via HYDRATE (replaces onto defaults).
  const [state, dispatch] = useReducer(optSearchReducer, DEFAULT_OPT_STATE);
  const [debouncedQuery] = useDebounce(state.query, 300);
  const [matchBroad, setMatchBroad] = useState(false);

  // ── Swap-mode state (curation printing swap; separate minimal pipeline) ──
  const [swapQuery, setSwapQuery] = useState("");
  const [debouncedSwapQuery] = useDebounce(swapQuery, 300);
  const [swapCards, setSwapCards] = useState<CardResult[]>([]);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);

  // Curated facet vocabulary for the Tags facet (public read, fetched once).
  const [facetDefs, setFacetDefs] = useState<FacetDef[]>([]);
  const facetsLoadedRef = useRef(false);

  // Selected card expansion panel
  const [selectedCard, setSelectedCard] = useState<CardResult | null>(null);
  const [selectedPrinting, setSelectedPrinting] = useState<PrintingResult | null>(null);
  const [showCardZoom, setShowCardZoom] = useState(false);
  const [enlarged, setEnlarged] = useState<LightboxCard | null>(null);
  const printingsDrag = useDragScroll();
  const inputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const didAutoSelectRef = useRef(false);

  // Hero legality context — shared derivation with the deck editor.
  const heroFilter = useMemo(() => resolveHeroFilter(currentDeck ?? null), [currentDeck]);

  // Reset on open; seed pitch from the section "+ Add" buttons.
  useEffect(() => {
    if (open) {
      dispatch({ type: 'HYDRATE', state: { selectedPitch: pitchFilter ? [pitchFilter] : [] } });
      setSwapQuery(initialSearch ?? "");
      setMatchBroad(false);
      setSelectedCard(null);
      setShowCardZoom(false);
      setEnlarged(null);
      setSwapCards([]);
      setSwapError(null);
      didAutoSelectRef.current = false;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, pitchFilter, initialSearch]);

  // Facet vocabulary — once per session, first open (main mode only).
  useEffect(() => {
    if (!open || isSwapMode || facetsLoadedRef.current) return;
    facetsLoadedRef.current = true;
    let cancelled = false;
    fetch('/api/card-facets/tags')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j?.success) setFacetDefs((j.data as any[]).filter((d) => !d.draft)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, isSwapMode]);

  // ── Main-mode server search (shared /opt machinery + baked-in legality) ──
  const filters = useMemo(
    () => buildDeckAddFilters(state, debouncedQuery, {
      hero: heroFilter,
      deckFormat,
      targetCategory,
    }),
    [state, debouncedQuery, heroFilter, deckFormat, targetCategory],
  );
  // Legality keys make filters non-empty for any deck with a hero or format,
  // so the dialog opens onto the full legal pool. Hero-less + format-less
  // decks idle until the user types or picks a filter.
  const hasAnyFilter = Object.keys(filters).length > 0;

  const search = useCardSearch({
    filters,
    languages: ['en'],
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
    groupByCard: true,
    enabled: open && !isSwapMode && hasAnyFilter,
    matchMode: matchBroad ? 'broad' : 'strict',
  });

  const groupedCards = useMemo(
    () => (isSwapMode ? [] : groupSearchPrintingsToCards(search.results as any)),
    [isSwapMode, search.results],
  );

  // ── Swap-mode fetch: exact-name flat printing list of one known card ──
  useEffect(() => {
    if (!open || !isSwapMode) return;
    const q = debouncedSwapQuery.trim();
    if (!q) {
      setSwapCards([]);
      setSwapError(null);
      return;
    }
    setSwapLoading(true);
    setSwapError(null);
    setSelectedCard(null);
    const controller = new AbortController();
    let cancelled = false;

    const params = new URLSearchParams();
    // Bypass the parser: name= + exact=true matches one specific card name.
    params.set("name", q);
    params.set("exact", "true");
    params.set("limit", "100");
    params.set("sortBy", "name");
    params.set("sortOrder", "asc");
    params.set("show", "all");
    if (pitchFilter != null) params.set("pitch", String(pitchFilter));
    if (deckFormat) {
      const code = getApiFormatCode(deckFormat);
      if (code) params.set("format", code);
    }

    const {
      limit: qLimit,
      sortBy: qSortBy,
      sortOrder: qSortOrder,
      ...qFilters
    } = Object.fromEntries(params) as Record<string, string>;
    searchClient.searchPrintings(qFilters, {
      limit: Number(qLimit),
      sortBy: qSortBy as any,
      sortOrder: qSortOrder as any,
      signal: controller.signal,
    })
      .then((data) => {
        if (cancelled) return;
        if (data.success && data.data?.printings) {
          setSwapCards(groupSearchPrintingsToCards(data.data.printings as any));
        } else {
          setSwapError("Search failed. Please try again.");
        }
      })
      .catch((err) => {
        if (cancelled || err?.name === 'AbortError') return;
        setSwapError("Search failed. Please try again.");
      })
      .finally(() => { if (!cancelled) setSwapLoading(false); });

    return () => { cancelled = true; controller.abort(); };
  }, [open, isSwapMode, debouncedSwapQuery, pitchFilter, deckFormat]);

  // Unified view of whichever pipeline is active.
  const cards = isSwapMode ? swapCards : groupedCards;
  const loading = isSwapMode ? swapLoading : search.loading;
  const error = isSwapMode ? swapError : search.error;

  // Auto-select card when opening in swap mode and search returns exactly one result.
  // Uses a ref so Escape can clear selectedCard without triggering re-selection.
  useEffect(() => {
    if (isSwapMode && cards.length === 1 && !didAutoSelectRef.current) {
      didAutoSelectRef.current = true;
      setSelectedCard(cards[0]);
    }
  }, [cards, isSwapMode]);

  // Sync selectedPrinting when card selection changes — use sortPrintings to pick the best default
  useEffect(() => {
    if (selectedCard) {
      const sorted = sortPrintings([...selectedCard.printings]);
      setSelectedPrinting(sorted[0] ?? null);
    }
  }, [selectedCard]);

  // Lazy-load real printings when a card is selected but we only have the grouped
  // representative. Triggers a one-shot fetch per card.
  useEffect(() => {
    if (!selectedCard) return;
    const trueCount = (selectedCard as { __printingsCount?: number }).__printingsCount ?? selectedCard.printings.length;
    if (trueCount <= 1 || selectedCard.printings.length > 1) return;
    const cardId = selectedCard.unique_id;
    fetchPrintingsForCard(cardId)
      .then((printings) => {
        setSelectedCard((prev) => {
          if (!prev || prev.unique_id !== cardId) return prev;
          return { ...prev, printings: printings as unknown as typeof prev.printings };
        });
      })
      .catch(() => {
        // Silent fail — picker stays on the single representative printing
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCard?.unique_id]);

  // An open facet popover claims Escape for itself (its own document listener
  // closes it) — both dialog escape paths must stand down while one is open.
  const hasOpenFacetPopover = useCallback(() =>
    !!contentRef.current?.querySelector('button[aria-haspopup="true"][aria-expanded="true"]'),
  []);

  // Tiered escape: close lightbox → close zoom → deselect card → close dialog
  const handleEscape = useCallback(() => {
    if (enlarged) {
      setEnlarged(null);
    } else if (showCardZoom) {
      setShowCardZoom(false);
    } else if (selectedCard) {
      setSelectedCard(null);
    } else {
      onOpenChange(false);
    }
  }, [enlarged, showCardZoom, selectedCard, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Tier 0: let an open facet popover consume this Escape.
      if (hasOpenFacetPopover()) return;
      e.stopPropagation();
      handleEscape();
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [open, handleEscape, hasOpenFacetPopover]);

  // Quick add from a grid tile: N× (1/2/3) the canonical printing (English-first
  // via sortPrintings; grouped-search representatives are already server-canonical).
  // Skips the printing panel entirely.
  const [quickAdd, setQuickAdd] = useState<{ id: string; status: 'adding' | 'added' } | null>(null);
  const handleQuickAdd = useCallback(async (card: CardResult, qty: QuickAddQty) => {
    const printing = sortPrintings([...card.printings])[0];
    if (!printing) return;
    setQuickAdd({ id: card.unique_id, status: 'adding' });
    try {
      await onAdd(printing, qty);
      setQuickAdd({ id: card.unique_id, status: 'added' });
      setTimeout(
        () => setQuickAdd(s => (s?.id === card.unique_id && s.status === 'added' ? null : s)),
        1500,
      );
    } catch {
      setQuickAdd(s => (s?.id === card.unique_id ? null : s));
    }
  }, [onAdd]);

  // Build a map of card_unique_id → total qty across all deck zones for "already in deck" badge
  const inDeckMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!currentDeck) return map;
    for (const arr of [currentDeck.maindeck ?? [], currentDeck.equipment ?? [], currentDeck.inventory ?? []] as any[][]) {
      for (const c of arr) {
        const uid = c.printingDetails?.card_unique_id;
        if (uid) map.set(uid, (map.get(uid) ?? 0) + (c.quantity ?? 1));
      }
    }
    return map;
  }, [currentDeck]);

  // Facets hidden for this zone: hero/equipment pickers force types (and
  // heroes/equipment have no pitch), so those facets would be dead controls.
  const excludeFacets = useMemo(() => (
    targetCategory === 'hero' || targetCategory === 'equipment'
      ? [...BASE_EXCLUDED_FACETS, 'type', 'pitch']
      : BASE_EXCLUDED_FACETS
  ), [targetCategory]);

  const zoneLabel = ZONE_LABELS[targetCategory] ?? targetCategory;
  const selectedPitchStyle = selectedCard?.pitch ? PITCH_STYLE[selectedCard.pitch] : null;

  // Lightbox ←/→ navigation through the current search results. Position is
  // derived from the enlarged printing's card (uid first, name fallback for
  // lazy-loaded printing rows that may not carry card_unique_id).
  const lightboxIndex = useMemo(() => {
    if (!enlarged) return -1;
    const uid = enlarged.printing.card_unique_id;
    const byUid = uid ? cards.findIndex(c => c.unique_id === uid) : -1;
    return byUid >= 0 ? byUid : cards.findIndex(c => c.name === enlarged.name);
  }, [enlarged, cards]);

  const openLightboxAt = useCallback((i: number) => {
    const card = cards[i];
    const printing = card?.printings[0];
    if (printing) setEnlarged({ printing, name: card.name });
  }, [cards]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[96vw] max-w-none h-[85vh] max-h-[900px] bg-gray-900 border-gray-700 text-gray-100 p-0 gap-0 overflow-hidden flex flex-col"
        onEscapeKeyDown={e => {
          e.preventDefault();
          if (hasOpenFacetPopover()) return;
          handleEscape();
        }}
      >
        {/* `.dark` wrapper: the shared /opt facet components are theme-aware;
            the dialog is hard-dark, so force their dark: variants on. */}
        <div ref={contentRef} className="dark flex flex-col flex-1 min-h-0">
          {/* Header */}
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-gray-700/60 shrink-0">
            <DialogTitle className="text-base font-semibold">Add Card</DialogTitle>
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
              <span>Adding to:</span>
              <span className="px-2 py-0.5 rounded-full bg-gray-700 text-gray-200 font-medium">{zoneLabel}</span>
              {deckFormat && (
                <>
                  <span className="text-gray-600">•</span>
                  <span className="px-2 py-0.5 rounded-full bg-gray-700 text-gray-200 font-medium">{deckFormat}</span>
                </>
              )}
            </div>
          </DialogHeader>

          {/* No-hero notice */}
          {!isSwapMode && targetCategory !== "hero" && !heroFilter && (
            <div className="px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2 text-xs text-amber-300 shrink-0">
              <span>⚠</span>
              <span>No hero set — showing all cards. Set a hero in deck settings to filter by legality.</span>
            </div>
          )}

          {/* Search chrome: /opt-style command bar, or the minimal swap input */}
          {isSwapMode ? (
            <div className="px-5 py-3 border-b border-gray-700/60 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                <Input
                  ref={inputRef}
                  value={swapQuery}
                  onChange={e => setSwapQuery(e.target.value)}
                  placeholder="Card name"
                  className="pl-9 bg-gray-800 border-gray-600 text-gray-100 placeholder:text-gray-500 focus-visible:ring-blue-500"
                />
                {swapQuery && (
                  <button onClick={() => setSwapQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded">✕</button>
                )}
              </div>
            </div>
          ) : (
            <QuickAddCommandBar
              state={state}
              dispatch={dispatch}
              facetDefs={facetDefs}
              excludeFacets={excludeFacets}
              total={search.total}
              loading={search.loading}
              error={search.error}
              idle={!hasAnyFilter}
              matchBroad={matchBroad}
              onToggleMatchBroad={() => setMatchBroad(b => !b)}
              inputRef={inputRef}
            />
          )}

          {/* Card grid — hidden while a card's printings are showing */}
          <div className={cn("flex-1 min-h-0 relative", selectedCard && "hidden")}>
            {showCardZoom && selectedCard && (
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
              <div
                className="absolute inset-0 z-10 flex items-center justify-center bg-gray-950 cursor-pointer"
                onClick={() => setShowCardZoom(false)}
              >
                {/* Fixed aspect-ratio wrapper — consistent size regardless of source image dimensions */}
                <div
                  className="rounded-xl shadow-2xl overflow-hidden flex-shrink-0"
                  style={{ height: 'calc(100% - 3rem)', aspectRatio: '63/88' }}
                  onClick={e => e.stopPropagation()}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedPrinting?.image_url || selectedCard.printings[0]?.image_url || '/cardback.webp'}
                    alt={selectedCard.name}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </div>
              </div>
            )}
            <div className="overflow-y-auto overscroll-contain absolute inset-0 p-3">
              {loading && (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span className="text-sm">Searching…</span>
                </div>
              )}
              {error && <p className="text-sm text-red-400 py-4 text-center">{error}</p>}
              {!loading && !error && !isSwapMode && !hasAnyFilter && (
                <p className="text-sm text-gray-400 py-8 text-center">Search by name or pick a filter above</p>
              )}
              {!loading && !error && (isSwapMode ? !!debouncedSwapQuery.trim() : hasAnyFilter) && cards.length === 0 && (
                <div className="py-10 text-center flex flex-col items-center gap-2">
                  <p className="text-sm text-gray-300 font-medium">No cards found</p>
                  <p className="text-xs text-gray-400">
                    Try a different name, or remove a filter below.
                  </p>
                  {!isSwapMode && (
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'RESET' })}
                      className="mt-1 text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              )}
              {!loading && cards.length > 0 && (
                <>
                  <div className="grid grid-cols-4 xl:grid-cols-5 gap-2">
                    {cards.map(card => (
                      <CardGridTile
                        key={card.unique_id}
                        card={card}
                        isSelected={selectedCard?.unique_id === card.unique_id}
                        inDeckCount={inDeckMap.get(card.unique_id) ?? 0}
                        onClick={() => {
                          const isAlreadySelected = selectedCard?.unique_id === card.unique_id;
                          setSelectedCard(isAlreadySelected ? null : card);
                          setShowCardZoom(!isAlreadySelected);
                        }}
                        onQuickAdd={qty => handleQuickAdd(card, qty)}
                        onMagnify={() => {
                          const printing = card.printings[0];
                          if (printing) setEnlarged({ printing, name: card.name });
                        }}
                        quickAddStatus={quickAdd?.id === card.unique_id ? quickAdd.status : 'idle'}
                      />
                    ))}
                  </div>
                  {/* Infinite scroll sentinel (main mode) */}
                  {!isSwapMode && search.hasMore && (
                    <div ref={search.sentinelRef} className="flex items-center justify-center py-6">
                      {search.loadingMore
                        ? <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        : <span className="text-xs text-gray-400">Scroll for more</span>}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>{/* end relative grid wrapper */}

          {/* Expansion panel — selected card printings + add */}
          {selectedCard && (
            <div className="flex-1 min-h-0 border-t border-gray-700/60 bg-gray-900/80 px-5 py-4 overflow-y-auto">
              <button
                onClick={() => { setSelectedCard(null); setShowCardZoom(false); }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 mb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to search results
              </button>
              <div className="flex items-start gap-4">
                {/* Thumbnail */}
                <div
                  className="relative flex-shrink-0 rounded overflow-hidden ring-1 ring-gray-600 group/thumb cursor-pointer"
                  style={{ width: 76, aspectRatio: '63/88' }}
                  onClick={() => selectedPrinting && setEnlarged({ printing: selectedPrinting, name: selectedCard.name })}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedPrinting?.image_url || '/cardback.webp'}
                    alt={selectedCard.name}
                    className="w-full h-full object-cover object-top"
                    draggable={false}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/thumb:bg-black/40 transition-all">
                    <ZoomIn className="h-3 w-3 text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  {/* Card name + types */}
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-gray-100 truncate">{selectedCard.name}</p>
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                      {selectedCard.types.slice(0, 3).map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-px rounded-full bg-gray-700 text-gray-300">{t}</span>
                      ))}
                      {selectedPitchStyle && (
                        <span className={cn("text-[10px] px-1.5 py-px rounded-full font-medium", selectedPitchStyle.badge)}>
                          {selectedPitchStyle.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Printings — each tile has its own qty stepper + Add button */}
                  <div className="flex flex-wrap items-stretch gap-3">
                    {selectedCard.printings.map(p => (
                      <PrintingTile
                        key={p.printing_id}
                        p={p}
                        isSelected={p.printing_id === selectedPrinting?.printing_id}
                        onSelect={p => { setSelectedPrinting(p); }}
                        onEnlarge={p => setEnlarged({ printing: p, name: selectedCard.name })}
                        onAdd={async (qty) => {
                          setSelectedPrinting(p);
                          await onAdd(p, qty);
                          // Clear search so user can immediately find the next card
                          setSelectedCard(null);
                          setShowCardZoom(false);
                          if (isSwapMode) setSwapQuery("");
                          else dispatch({ type: 'PATCH', patch: { query: '' } });
                          setTimeout(() => inputRef.current?.focus(), 50);
                        }}
                        didDrag={printingsDrag.didDrag}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Card details lightbox */}
        {enlarged && (
          <CardDetailsLightbox
            card={enlarged}
            onClose={() => setEnlarged(null)}
            onPrev={lightboxIndex > 0 ? () => openLightboxAt(lightboxIndex - 1) : undefined}
            onNext={lightboxIndex >= 0 && lightboxIndex < cards.length - 1 ? () => openLightboxAt(lightboxIndex + 1) : undefined}
            onSelectPrinting={printing => setEnlarged(prev => (prev ? { ...prev, printing } : prev))}
            deckFormat={deckFormat}
            inDeckCount={inDeckMap.get((lightboxIndex >= 0 ? cards[lightboxIndex]?.unique_id : undefined) ?? enlarged.printing.card_unique_id ?? '') ?? 0}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
