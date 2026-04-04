"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Minus, Check, ChevronDown, ChevronUp, Loader2, Search, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeckCategory } from "@/lib/services/contracts/IDeckService";
import { OFFICIAL_TALENTS } from "@/lib/talent-constants";
import { getHeroInfo } from "@/lib/fab-constants";
import { getApiFormatCode } from "@/lib/format-constants";
import { FABShorthandParser } from "@/lib/search/fab-shorthand-parser";
import {
  type CardResult,
  type PrintingResult,
  type PoolParams,
  probeAvailableTypes,
  fetchTypeCards,
  getCachedCards,
} from "@/lib/client/card-pool-cache";
import {
  TYPE_CHIPS as SHARED_TYPE_CHIPS,
  GENERIC_CHIP as SHARED_GENERIC_CHIP,
  CLASS_ICONS as SHARED_CLASS_ICONS,
  PITCH_CHIPS as SHARED_PITCH_CHIPS,
  KEYWORD_CHIPS as SHARED_KEYWORD_CHIPS,
  type ChipDef,
} from "@/lib/search/card-filter-chips";

interface QuickAddCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (printing: PrintingResult, quantity: number) => Promise<void>;
  targetCategory: DeckCategory;
  /** If set, restrict results to this pitch (1=red, 2=yellow, 3=blue) */
  pitchFilter?: 1 | 2 | 3;
  deckFormat?: string;
  currentDeck?: any;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ZONE_LABELS: Partial<Record<DeckCategory, string>> = {
  hero: "Hero",
  equipment: "Equipment & Weapons",
  maindeck: "Library",
  inventory: "Inventory",
  benched: "Bench",
};

const shorthandParser = new FABShorthandParser();

// Re-export shared constants under local names for backward compat within this file
export type { ChipDef };
export const TYPE_CHIPS = SHARED_TYPE_CHIPS;
export const GENERIC_CHIP = SHARED_GENERIC_CHIP;
const CLASS_ICONS = SHARED_CLASS_ICONS;
const PITCH_CHIPS = SHARED_PITCH_CHIPS;
const KEYWORD_CHIPS = SHARED_KEYWORD_CHIPS;

const PITCH_STYLE: Record<number, { border: string; badge: string; label: string }> = {
  1: { border: "border-l-red-500",    badge: "bg-red-500 text-white",       label: "Pitch 1" },
  2: { border: "border-l-yellow-400", badge: "bg-yellow-400 text-gray-900", label: "Pitch 2" },
  3: { border: "border-l-blue-500",   badge: "bg-blue-500 text-white",      label: "Pitch 3" },
};

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

  if (p.foiling === "r") {
    badges.push(
      <span
        key="rf"
        className="text-[8px] px-1 py-px rounded font-bold text-white"
        style={{ background: "linear-gradient(90deg, #f43f5e, #a855f7, #3b82f6)" }}
      >
        RF
      </span>
    );
  } else if (p.foiling === "c") {
    badges.push(
      <span key="cf" className="text-[8px] px-1 py-px rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
        CF
      </span>
    );
  } else if (p.foiling === "g") {
    badges.push(
      <span key="gf" className="text-[8px] px-1 py-px rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold">
        GF
      </span>
    );
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
  onEnlarge: (url: string) => void;
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
        <div className="rounded overflow-hidden w-full" style={{ aspectRatio: "63/88" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.image_url || "/cardback.webp"}
            alt={collectorLabel(p)}
            className="w-full h-full object-cover object-top"
            draggable={false}
          />
        </div>
      </div>

      {/* Magnify button */}
      {p.image_url && (
        <button
          className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gray-900/80 text-gray-400 hover:text-white hover:bg-gray-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10"
          title="Enlarge image"
          onClick={e => { e.stopPropagation(); onEnlarge(p.image_url!); }}
          onMouseDown={e => e.stopPropagation()}
        >
          <ZoomIn className="h-2.5 w-2.5" />
        </button>
      )}

      {/* Info */}
      <div className="flex flex-col items-center gap-0.5 py-1.5 flex-1">
        <span className="text-[9px] font-mono text-gray-300 text-center leading-tight w-full truncate px-0.5">
          {collectorLabel(p)}
        </span>
        <PrintingBadges p={p} />
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

// ─── Card row ─────────────────────────────────────────────────────────────────

function CardRow({
  card,
  onAdd,
  onEnlarge,
}: {
  card: CardResult;
  onAdd: (printing: PrintingResult, quantity: number) => Promise<void>;
  onEnlarge: (url: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedPrinting, setSelectedPrinting] = useState<PrintingResult>(card.printings[0]);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const drag = useDragScroll();

  const pitchStyle = card.pitch ? PITCH_STYLE[card.pitch] : null;

  const handleAdd = useCallback(async () => {
    setAdding(true);
    try {
      await onAdd(selectedPrinting, quantity);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1800);
    } finally {
      setAdding(false);
    }
  }, [onAdd, selectedPrinting, quantity]);

  return (
    <div className={cn(
      "border-l-4 rounded-r-lg border-t border-r border-b border-gray-700/60 bg-gray-800/40 overflow-hidden",
      pitchStyle ? pitchStyle.border : "border-l-gray-600",
    )}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Thumbnail — 56px wide, full card aspect */}
        <div
          className="relative flex-shrink-0 rounded overflow-hidden ring-1 ring-gray-600 group/thumb"
          style={{ width: 56, aspectRatio: "63/88" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedPrinting?.image_url || "/cardback.webp"}
            alt={card.name}
            className="w-full h-full object-cover object-top"
            draggable={false}
          />
          {selectedPrinting?.image_url && (
            <button
              className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/thumb:bg-black/40 transition-all z-10"
              title="Enlarge image"
              onClick={e => { e.stopPropagation(); onEnlarge(selectedPrinting.image_url!); }}
            >
              <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity drop-shadow" />
            </button>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-100 truncate">{card.name}</div>
          <div className="flex flex-wrap items-center gap-1 mt-0.5">
            {card.types.slice(0, 4).map(t => (
              <span key={t} className="text-[10px] px-1.5 py-px rounded-full bg-gray-700 text-gray-300">
                {t}
              </span>
            ))}
            {pitchStyle && (
              <span className={cn("text-[10px] px-1.5 py-px rounded-full font-medium", pitchStyle.badge)}>
                {pitchStyle.label}
              </span>
            )}
          </div>
          {/* Selected printing info */}
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] font-mono text-gray-400">{collectorLabel(selectedPrinting)}</span>
            {selectedPrinting && <PrintingBadges p={selectedPrinting} />}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            {/* Qty stepper */}
            <div className="flex items-center gap-0.5 bg-gray-700/50 rounded px-1 py-0.5">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-200 transition-colors"
              >
                <Minus className="h-2.5 w-2.5" />
              </button>
              <span className="w-4 text-center text-xs font-medium text-gray-200 tabular-nums">{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-200 transition-colors"
              >
                <Plus className="h-2.5 w-2.5" />
              </button>
            </div>

            {/* Add button */}
            <button
              onClick={handleAdd}
              disabled={adding}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all",
                justAdded
                  ? "bg-green-600/20 text-green-400 border border-green-600/40"
                  : "bg-blue-600 hover:bg-blue-500 text-white",
                adding && "opacity-60 cursor-not-allowed",
              )}
            >
              {adding ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : justAdded ? (
                <><Check className="h-3 w-3" />Added</>
              ) : (
                <><Plus className="h-3 w-3" />Add</>
              )}
            </button>
          </div>

          {/* Printings toggle */}
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-200 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {card.printings.length} printing{card.printings.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>

      {/* Printings carousel */}
      {expanded && (
        <div className="border-t border-gray-700/50 bg-gray-900/50 px-3 py-2.5">
          <div
            ref={drag.ref}
            className={cn(
              "overflow-x-auto scrollbar-none select-none",
              drag.isDragging ? "cursor-grabbing" : "cursor-grab",
            )}
            style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
            onMouseDown={drag.onMouseDown}
            onMouseMove={drag.onMouseMove}
            onMouseUp={drag.onMouseUp}
            onMouseLeave={drag.onMouseLeave}
          >
            <div className="flex gap-2 pb-1" style={{ minWidth: "max-content" }}>
              {card.printings.map(p => (
                <PrintingTile
                  key={p.printing_id}
                  p={p}
                  isSelected={p.printing_id === selectedPrinting?.printing_id}
                  onSelect={setSelectedPrinting}
                  onEnlarge={onEnlarge}
                  didDrag={drag.didDrag}
                />
              ))}
            </div>
          </div>
          <p className="text-[9px] text-gray-600 mt-1.5">
            Drag to browse · click a printing to select it · then hit Add
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Card grid tile ───────────────────────────────────────────────────────────

function CardGridTile({
  card,
  isSelected,
  onClick,
}: {
  card: CardResult;
  isSelected: boolean;
  onClick: () => void;
}) {
  const pitchStyle = card.pitch ? PITCH_STYLE[card.pitch] : null;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      className={cn(
        "flex flex-col rounded overflow-hidden cursor-pointer transition-all border border-l-4",
        isSelected
          ? "border-blue-500/80 border-l-blue-400 ring-2 ring-blue-500/40"
          : cn("border-gray-700/60 hover:border-gray-500/60", pitchStyle ? pitchStyle.border : "border-l-gray-600"),
      )}
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
      <div className={cn("px-1 py-1 text-center", isSelected ? "bg-blue-900/30" : "bg-gray-800/80")}>
        <p className="text-[9px] font-medium text-gray-200 truncate leading-tight">{card.name}</p>
        {card.printings.length > 1 && (
          <p className="text-[8px] text-gray-600 leading-tight">{card.printings.length}p</p>
        )}
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
}: QuickAddCardDialogProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedPitch, setSelectedPitch] = useState<number | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  // null = probes not yet run, Set = available chip values for this hero
  const [availableTypes, setAvailableTypes] = useState<Set<string> | null>(null);
  const [cards, setCards] = useState<CardResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 40; // multiple of grid columns

  // Selected card expansion panel
  const [selectedCard, setSelectedCard] = useState<CardResult | null>(null);
  const [selectedPrinting, setSelectedPrinting] = useState<PrintingResult | null>(null);
  const [showCardZoom, setShowCardZoom] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const printingsDrag = useDragScroll();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Derive hero classes + talents for precise legal filtering.
  // Try multiple strategies in order; take the first that yields non-empty results.
  const TALENT_SET = new Set<string>(OFFICIAL_TALENTS);
  const NON_CLASS_TYPES = new Set(['hero', 'young', 'adult', 'token', 'equipment', 'weapon',
    'action', 'attack', 'instant', 'defense reaction', 'attack reaction', 'demi-hero']);

  // Essence elements are stored in the hero's keywords as "essence of X" (elemental heroes).
  // Join all keyword strings and scan for known element names after "essence".
  const ESSENCE_ELEMENTS = ['lightning', 'earth', 'ice', 'fire', 'shadow', 'light', 'draconic', 'water'] as const;
  const heroEssences = (() => {
    const keywords = ((currentDeck?.hero?.[0]?.printingDetails as any)?.keywords as string[] | undefined) || [];
    const combined = keywords.join(' ').toLowerCase();
    if (!combined.includes('essence')) return [] as string[];
    return ESSENCE_ELEMENTS.filter(el => combined.includes(el));
  })();

  const { heroClasses, heroTalents } = (() => {
    if (currentDeck?.hero?.length) {
      const h = currentDeck.hero[0]?.printingDetails;

      // Strategy 1a: hero card has classes/talents fields populated
      const directClasses = ((h?.classes as string[] | undefined) || []).map((c: string) => c.toLowerCase()).filter(Boolean);
      const directTalents = ((h?.talents as string[] | undefined) || []).map((t: string) => t.toLowerCase()).filter(Boolean);
      if (directClasses.length > 0 || directTalents.length > 0) {
        return { heroClasses: directClasses, heroTalents: directTalents };
      }

      // Strategy 1b: derive from hero card's types array (user suggestion)
      const heroTypes = ((h?.types as string[] | undefined) || []).map((t: string) => t.toLowerCase());
      const classesFromTypes = heroTypes.filter(t => !TALENT_SET.has(t) && !NON_CLASS_TYPES.has(t));
      const talentsFromTypes = heroTypes.filter(t => TALENT_SET.has(t));
      if (classesFromTypes.length > 0 || talentsFromTypes.length > 0) {
        return { heroClasses: classesFromTypes, heroTalents: talentsFromTypes };
      }
    }

    // Strategy 2: look up hero by deck.heroName in the fab-constants hero table
    if (currentDeck?.heroName) {
      const info = getHeroInfo(currentDeck.heroName);
      if (info) return { heroClasses: info.classes, heroTalents: info.talents };

      // Strategy 3: heroName might itself be a class name (e.g. "mechanologist")
      const nameLower = currentDeck.heroName.toLowerCase();
      if (!TALENT_SET.has(nameLower) && !NON_CLASS_TYPES.has(nameLower)) {
        return { heroClasses: [nameLower], heroTalents: [] as string[] };
      }
    }

    return { heroClasses: [] as string[], heroTalents: [] as string[] };
  })();

  useEffect(() => {
    if (open) {
      setQuery("");
      setDebouncedQuery("");
      setSelectedType(null);
      setSelectedPitch(null);
      setSelectedKeyword(null);
      setCards([]);
      setError(null);
      setEnlargedImage(null);
      setAvailableTypes(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build pool params object (stable reference via memo-like pattern)
  const poolParams: PoolParams = {
    heroClasses, heroTalents, heroEssences, format: deckFormat,
  };

  // Probe: determine available type chips (uses cache if already warmed)
  useEffect(() => {
    if (!open || targetCategory === 'hero' || targetCategory === 'equipment') return;
    probeAvailableTypes(poolParams, [...TYPE_CHIPS, GENERIC_CHIP])
      .then(available => setAvailableTypes(available));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetCategory, heroClasses.join(','), heroTalents.join(','), heroEssences.join(','), deckFormat]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const hasQuery = !!debouncedQuery.trim();
    const hasType = !!selectedType;
    const hasPitch = selectedPitch != null;
    const hasKeyword = !!selectedKeyword;

    // Nothing to search — clear results and wait for user input
    if (!hasQuery && !hasType && !hasPitch && !hasKeyword) {
      setCards([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedCard(null);
    setPage(1);

    // Browse by type chip — check cache first (skip when keyword filter active)
    if (!hasQuery && hasType && !hasKeyword && targetCategory !== 'hero' && targetCategory !== 'equipment') {
      const chip = [...TYPE_CHIPS, GENERIC_CHIP].find(c => c.value === selectedType);
      const apiType = chip ? chip.apiType : selectedType!;
      const chipValue = selectedType!;

      const applyFilters = (cards: CardResult[]) => {
        // Action chip excludes cards that are also attacks (non-attack actions only)
        let result = chip?.value === 'non-attack-action'
          ? cards.filter(c => !c.types.includes('attack'))
          : cards;
        const effectivePitch = hasPitch ? selectedPitch : (targetCategory === "maindeck" ? pitchFilter ?? null : null);
        if (effectivePitch != null) result = result.filter(c => c.pitch === effectivePitch);
        return result;
      };

      // Serve from cache immediately if available
      const cached = getCachedCards(poolParams, chipValue);
      if (cached) {
        setCards(applyFilters(cached));
        setLoading(false);
        return;
      }

      // Not cached — fetch and cache
      fetchTypeCards(poolParams, apiType, chipValue)
        .then(cards => setCards(applyFilters(cards)))
        .catch(() => setError("Search failed. Please try again."))
        .finally(() => setLoading(false));
      return;
    }

    // Name search or hero/equipment — always fetch fresh (no cache)
    const params = new URLSearchParams();
    const rawQuery = debouncedQuery.trim();
    if (hasQuery) params.set("q", rawQuery);
    // Pure filter queries (e.g. "color:blue keyword:go again") get a full browse limit;
    // name searches get a smaller limit so closest matches surface first.
    const isFilterOnly = hasQuery && shorthandParser.parseQuery(rawQuery).remainingText.trim() === "";
    params.set("limit", (!hasQuery || isFilterOnly) ? "500" : "15");
    params.set("sortBy", "name");
    params.set("sortOrder", "asc");
    params.set("show", "all");

    if (targetCategory === "hero") {
      params.set("types", "hero");
    } else {
      if (heroClasses.length > 0) params.set("heroClasses", heroClasses.join(","));
      if (heroTalents.length > 0) params.set("heroTalents", heroTalents.join(","));
      if (heroEssences.length > 0) params.set("heroEssences", heroEssences.join(","));
      if (targetCategory === "equipment") {
        params.set("types", "equipment,weapon");
      } else {
        if (hasType) {
          const chip = [...TYPE_CHIPS, GENERIC_CHIP].find(c => c.value === selectedType);
          params.set("types", chip ? chip.apiType : selectedType!);
        }
        if (hasKeyword) params.set("text", selectedKeyword!);
        const effectivePitch = hasPitch ? selectedPitch : (targetCategory === "maindeck" ? pitchFilter ?? null : null);
        if (effectivePitch != null) params.set("pitch", String(effectivePitch));
      }
    }
    if (deckFormat) {
      const code = getApiFormatCode(deckFormat);
      if (code) params.set("format", code);
    }

    fetch(`/api/printings/search?${params}`)
      .then(r => r.json())
      .then((data: { success?: boolean; data?: { printings?: PrintingResult[] } }) => {
        if (data.success && data.data?.printings) {
          // Inline group for name search results (not cached)
          const map = new Map<string, CardResult>();
          for (const p of data.data.printings) {
            const id = (p.card_unique_id || p.cardId || p.display_name || p.name || '?') as string;
            if (!map.has(id)) map.set(id, { unique_id: id, name: (p.display_name || p.name || 'Unknown') as string, types: ((p.types || []) as string[]).map(t => String(t).toLowerCase()), pitch: (p.pitch ?? null) as number | null, printings: [] });
            map.get(id)!.printings.push(p);
          }
          setCards(Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)));
        } else {
          setError("Search failed. Please try again.");
        }
      })
      .catch(() => setError("Search failed. Please try again."))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, selectedType, selectedPitch, selectedKeyword, targetCategory, pitchFilter, heroClasses.join(","), heroTalents.join(","), heroEssences.join(","), deckFormat]);

  // Sync selectedPrinting when card selection changes
  useEffect(() => {
    if (selectedCard) {
      setSelectedPrinting(selectedCard.printings[0] ?? null);
      setQuantity(1);
      setJustAdded(false);
    }
  }, [selectedCard]);

  // Tiered escape: close zoom → deselect card → close dialog
  const handleEscape = useCallback(() => {
    if (showCardZoom) {
      setShowCardZoom(false);
    } else if (selectedCard) {
      setSelectedCard(null);
    } else {
      onOpenChange(false);
    }
  }, [showCardZoom, selectedCard, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      handleEscape();
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [open, handleEscape]);

  const handleAdd = useCallback(async () => {
    if (!selectedPrinting) return;
    setAdding(true);
    try {
      await onAdd(selectedPrinting, quantity);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1800);
    } finally {
      setAdding(false);
    }
  }, [onAdd, selectedPrinting, quantity]);

  const zoneLabel = ZONE_LABELS[targetCategory] ?? targetCategory;
  const selectedPitchStyle = selectedCard?.pitch ? PITCH_STYLE[selectedCard.pitch] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[96vw] max-w-none h-[85vh] max-h-[900px] bg-gray-900 border-gray-700 text-gray-100 p-0 gap-0 overflow-hidden flex flex-col"
        onEscapeKeyDown={e => { e.preventDefault(); handleEscape(); }}
      >
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
        {targetCategory !== "hero" && heroClasses.length === 0 && (
          <div className="px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2 text-xs text-amber-300 shrink-0">
            <span>⚠</span>
            <span>No hero set — showing all cards. Set a hero in deck settings to filter by legality.</span>
          </div>
        )}

        {/* Body: left sidebar filters + right results */}
        <div className="flex flex-col sm:flex-row min-h-0 flex-1">

          {/* Left sidebar — filters */}
          {targetCategory !== "hero" && targetCategory !== "equipment" && (
            <div className="sm:w-[390px] w-full sm:shrink-0 border-b sm:border-b-0 sm:border-r border-gray-700/60 px-3 py-2 sm:py-4 flex flex-col gap-2 sm:gap-5 overflow-y-auto max-h-[40vh] sm:max-h-none">
              {/* Search + pitch row */}
              <div className="flex flex-col gap-1.5">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 pointer-events-none" />
                  <Input
                    ref={inputRef}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder='Name or keyword:"go again"…'
                    className="pl-7 h-7 text-xs bg-gray-800 border-gray-600 text-gray-100 placeholder:text-gray-500 focus-visible:ring-blue-500"
                    onKeyDown={e => e.key === "Escape" && handleEscape()}
                  />
                  {query && (
                    <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded">✕</button>
                  )}
                </div>
                {targetCategory === "maindeck" && (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-gray-600 uppercase tracking-wider mr-0.5">Pitch</span>
                    {PITCH_CHIPS.map(chip => {
                      const isActive = selectedPitch === chip.value;
                      return (
                        <button
                          key={chip.value}
                          type="button"
                          title={chip.label}
                          onClick={() => setSelectedPitch(p => p === chip.value ? null : chip.value)}
                          className={cn(
                            "p-0.5 rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                            isActive ? "bg-gray-600 ring-1 ring-white/30" : "opacity-50 hover:opacity-80",
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={chip.iconUrl} alt={chip.label} className="w-5 h-5 object-contain" draggable={false} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Type filters */}
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Type</p>
                {availableTypes === null ? (
                  <div className="grid grid-cols-4 gap-1.5">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="rounded bg-gray-800/50 animate-pulse" style={{ aspectRatio: '1/1' }} />
                    ))}
                  </div>
                ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {TYPE_CHIPS.filter(chip => availableTypes.has(chip.value)).map(chip => {
                    const isActive = selectedType === chip.value;
                    return (
                      <button
                        key={chip.value}
                        type="button"
                        title={chip.label}
                        onClick={() => setSelectedType(t => t === chip.value ? null : chip.value)}
                        className={cn(
                          "group flex flex-col items-center gap-1 p-1 rounded border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                          isActive ? chip.active : "bg-transparent border-transparent text-gray-500 hover:text-gray-200 hover:bg-gray-800"
                        )}
                      >
                        {chip.iconUrl ? (
                          <div className={cn(
                            "w-full rounded overflow-hidden ring-1 transition-all",
                            isActive ? "ring-current opacity-100" : "ring-gray-700 opacity-55 group-hover:opacity-85",
                          )} style={{ aspectRatio: '1 / 1' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={chip.iconUrl}
                              alt={chip.label}
                              className="w-full object-cover"
                              style={{ height: '220%', objectPosition: chip.iconPosition ?? 'center 24%' }}
                              draggable={false}
                            />
                          </div>
                        ) : (
                          <div className={cn(
                            "w-full rounded flex items-center justify-center ring-1 transition-all",
                            isActive ? "ring-current opacity-100 " + chip.active : "ring-gray-700 opacity-55 group-hover:opacity-85 bg-gray-800",
                          )} style={{ aspectRatio: '1 / 1' }}>
                            <span className={cn("w-2 h-2 rounded-full", isActive ? chip.dot : "bg-gray-600")} />
                          </div>
                        )}
                        <span className="text-[9px] leading-tight truncate w-full text-center">{chip.label}</span>
                      </button>
                    );
                  })}
                </div>
                )}
              </div>

              {/* Class / talent restriction filters */}
              {(heroClasses.length > 0 || heroTalents.length > 0) && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Class</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[...heroClasses, ...heroTalents].map(cls => {
                      const isActive = selectedType === cls;
                      const icon = CLASS_ICONS[cls];
                      const isTalent = heroTalents.includes(cls);
                      return (
                        <button key={cls} type="button"
                          title={cls + (isTalent ? ' (talent)' : '')}
                          onClick={() => setSelectedType(t => t === cls ? null : cls)}
                          className={cn(
                            "group flex flex-col items-center gap-1 p-1 rounded border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                            isActive
                              ? (isTalent ? "bg-violet-900/50 border-violet-600" : "bg-indigo-900/50 border-indigo-600")
                              : "bg-transparent border-transparent text-gray-500 hover:text-gray-200 hover:bg-gray-800"
                          )}
                        >
                          {icon ? (
                            <div className={cn(
                              "w-full rounded overflow-hidden ring-1 transition-all",
                              isActive ? "ring-current opacity-100" : "ring-gray-700 opacity-55 group-hover:opacity-85",
                            )} style={{ aspectRatio: '1 / 1' }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={icon.iconUrl} alt={cls} className="w-full object-cover"
                                style={{ height: '220%', objectPosition: icon.iconPosition ?? 'center 24%' }}
                                draggable={false} />
                            </div>
                          ) : (
                            <div className={cn(
                              "w-full rounded flex items-center justify-center ring-1 transition-all bg-gray-800",
                              isActive ? "ring-current opacity-100" : "ring-gray-700 opacity-55 group-hover:opacity-85",
                            )} style={{ aspectRatio: '1 / 1' }}>
                              <span className={cn("w-2 h-2 rounded-full", isActive ? (isTalent ? "bg-violet-400" : "bg-indigo-400") : "bg-gray-600")} />
                            </div>
                          )}
                          <span className="text-[9px] leading-tight truncate w-full text-center capitalize">{cls}</span>
                        </button>
                      );
                    })}
                    {/* Generic — playable by all classes */}
                    {(availableTypes !== null && availableTypes.has(GENERIC_CHIP.value)) && (() => {
                      const isActive = selectedType === GENERIC_CHIP.value;
                      return (
                        <button type="button" title="Generic"
                          onClick={() => setSelectedType(t => t === GENERIC_CHIP.value ? null : GENERIC_CHIP.value)}
                          className={cn(
                            "group flex flex-col items-center gap-1 p-1 rounded border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                            isActive ? GENERIC_CHIP.active : "bg-transparent border-transparent text-gray-500 hover:text-gray-200 hover:bg-gray-800"
                          )}
                        >
                          {GENERIC_CHIP.iconUrl ? (
                            <div className={cn(
                              "w-full rounded overflow-hidden ring-1 transition-all",
                              isActive ? "ring-current opacity-100" : "ring-gray-700 opacity-55 group-hover:opacity-85",
                            )} style={{ aspectRatio: '1 / 1' }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={GENERIC_CHIP.iconUrl} alt="Generic" className="w-full object-cover"
                                style={{ height: '220%', objectPosition: GENERIC_CHIP.iconPosition ?? 'center 24%' }}
                                draggable={false} />
                            </div>
                          ) : (
                            <div className={cn(
                              "w-full rounded flex items-center justify-center ring-1 transition-all bg-gray-800",
                              isActive ? "ring-current opacity-100" : "ring-gray-700 opacity-55 group-hover:opacity-85",
                            )} style={{ aspectRatio: '1 / 1' }}>
                              <span className={cn("w-2 h-2 rounded-full", isActive ? GENERIC_CHIP.dot : "bg-gray-600")} />
                            </div>
                          )}
                          <span className="text-[9px] leading-tight truncate w-full text-center">Generic</span>
                        </button>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Keyword filters */}
              {targetCategory !== 'hero' && targetCategory !== 'equipment' && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Keyword</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {KEYWORD_CHIPS.map(kw => {
                      const isActive = selectedKeyword === kw.value;
                      return (
                        <button key={kw.value} type="button" title={kw.label}
                          onClick={() => setSelectedKeyword(k => k === kw.value ? null : kw.value)}
                          className={cn(
                            "group flex flex-col items-center gap-1 p-1.5 rounded border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                            isActive ? "bg-teal-900/50 border-teal-600 text-teal-300" : "bg-transparent border-transparent text-gray-500 hover:text-gray-200 hover:bg-gray-800"
                          )}
                        >
                          <div className={cn(
                            "w-full rounded flex items-center justify-center ring-1 transition-all",
                            isActive ? "ring-teal-500 bg-teal-900/30" : "ring-gray-700 opacity-55 group-hover:opacity-85 bg-gray-800",
                          )} style={{ aspectRatio: '1 / 1' }}>
                            <span className={cn("text-sm font-bold", isActive ? "text-teal-300" : "text-gray-300")}>{kw.abbr}</span>
                          </div>
                          <span className="text-xs leading-tight truncate w-full text-center">{kw.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pitch filters */}
            </div>
          )}

          {/* Right panel — search (hero/equipment) + results */}
          <div className="flex flex-col flex-1 min-w-0">
            {/* Search for hero/equipment (no sidebar) */}
            {(targetCategory === "hero" || targetCategory === "equipment") && (
              <div className="px-5 py-3 border-b border-gray-700/60 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                  <Input
                    ref={inputRef}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder='Name or keyword:"go again" color:blue type:attack'
                    className="pl-9 bg-gray-800 border-gray-600 text-gray-100 placeholder:text-gray-500 focus-visible:ring-blue-500"
                    onKeyDown={e => e.key === "Escape" && handleEscape()}
                  />
                  {query && (
                    <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs">✕</button>
                  )}
                </div>
              </div>
            )}

            {/* Card grid */}
            <div className="flex-1 min-h-0 relative">
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
            <div ref={resultsRef} className="overflow-y-auto absolute inset-0 p-3">
              {loading && (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span className="text-sm">Searching…</span>
                </div>
              )}
              {error && <p className="text-sm text-red-400 py-4 text-center">{error}</p>}
              {!loading && !error && (debouncedQuery || selectedType || selectedPitch != null || selectedKeyword) && cards.length === 0 && (
                <div className="py-10 text-center flex flex-col items-center gap-2">
                  <p className="text-sm text-gray-300 font-medium">No cards found</p>
                  <p className="text-xs text-gray-500">
                    {(selectedType || selectedKeyword) && debouncedQuery
                      ? "Try removing the type or keyword filter, or broaden your search."
                      : selectedType || selectedKeyword
                      ? "No matching cards for this filter combination — try a different type or keyword."
                      : "Try a different name or check your spelling."}
                  </p>
                  {(selectedType || selectedKeyword || selectedPitch != null) && (
                    <button
                      type="button"
                      onClick={() => { setSelectedType(null); setSelectedKeyword(null); setSelectedPitch(null); }}
                      className="mt-1 text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              )}
              {!loading && !debouncedQuery && !selectedType && selectedPitch == null && !selectedKeyword && (
                <p className="text-sm text-gray-500 py-8 text-center">Pick a filter or search by name</p>
              )}
              {!loading && cards.length > 0 && (() => {
                const totalPages = Math.ceil(cards.length / PAGE_SIZE);
                const pageCards = cards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
                return (
                  <>
                    <div className="grid grid-cols-4 xl:grid-cols-5 gap-2">
                      {pageCards.map(card => (
                        <CardGridTile
                          key={card.unique_id}
                          card={card}
                          isSelected={selectedCard?.unique_id === card.unique_id}
                          onClick={() => {
                            const isAlreadySelected = selectedCard?.unique_id === card.unique_id;
                            setSelectedCard(isAlreadySelected ? null : card);
                            setShowCardZoom(!isAlreadySelected);
                          }}
                        />
                      ))}
                    </div>
                    {totalPages > 1 && (() => {
                      const goTo = (p: number) => { setPage(p); resultsRef.current?.scrollTo(0, 0); };
                      // Build windowed page list: always show first, last, current ±1, ellipsis gaps
                      const window = new Set([1, totalPages, page, page - 1, page + 1].filter(p => p >= 1 && p <= totalPages));
                      const pages = Array.from(window).sort((a, b) => a - b);
                      const items: (number | 'ellipsis')[] = [];
                      for (let i = 0; i < pages.length; i++) {
                        if (i > 0 && pages[i] - pages[i - 1] > 1) items.push('ellipsis');
                        items.push(pages[i]);
                      }
                      return (
                        <div className="flex items-center justify-center gap-1 mt-3 pt-2 border-t border-gray-700/40">
                          <button
                            onClick={() => goTo(Math.max(1, page - 1))}
                            disabled={page === 1}
                            className="px-2 py-1 rounded text-xs text-gray-400 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >←</button>
                          {items.map((item, i) =>
                            item === 'ellipsis'
                              ? <span key={`e${i}`} className="px-1 text-xs text-gray-600 select-none">…</span>
                              : <button
                                  key={item}
                                  onClick={() => goTo(item)}
                                  className={cn(
                                    "w-7 h-7 rounded text-xs font-medium transition-colors",
                                    item === page
                                      ? "bg-blue-600 text-white"
                                      : "text-gray-400 hover:bg-gray-700 hover:text-gray-200",
                                  )}
                                >{item}</button>
                          )}
                          <button
                            onClick={() => goTo(Math.min(totalPages, page + 1))}
                            disabled={page === totalPages}
                            className="px-2 py-1 rounded text-xs text-gray-400 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >→</button>
                        </div>
                      );
                    })()}
                  </>
                );
              })()}
            </div>
            </div>{/* end relative grid wrapper */}

            {/* Expansion panel — selected card printings + add */}
            {selectedCard && (
              <div className="shrink-0 border-t border-gray-700/60 bg-gray-900/80 px-5 py-4">
                <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  <div
                    className="relative flex-shrink-0 rounded overflow-hidden ring-1 ring-gray-600 group/thumb cursor-pointer"
                    style={{ width: 76, aspectRatio: '63/88' }}
                    onClick={() => selectedPrinting?.image_url && setEnlargedImage(selectedPrinting.image_url)}
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
                          onSelect={p => { setSelectedPrinting(p); setShowCardZoom(true); }}
                          onEnlarge={setEnlargedImage}
                          onAdd={async (qty) => { setSelectedPrinting(p); await onAdd(p, qty); }}
                          didDrag={printingsDrag.didDrag}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Lightbox */}
        {enlargedImage && (
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer"
            onClick={() => setEnlargedImage(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enlargedImage}
              alt="Card enlarged"
              className="max-h-[85%] max-w-[85%] rounded-xl shadow-2xl border border-gray-600"
              onClick={e => e.stopPropagation()}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
