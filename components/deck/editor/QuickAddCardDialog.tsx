"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Minus, Check, ChevronDown, ChevronUp, Loader2, Search, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeckCategory } from "@/lib/services/contracts/IDeckService";
import { getApiFormatCode } from "@/lib/format-constants";
import { OFFICIAL_TALENTS } from "@/lib/talent-constants";
import { getHeroInfo } from "@/lib/fab-constants";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CardResult {
  unique_id: string;
  name: string;
  types: string[];
  pitch: number | null;
  printings: PrintingResult[];
}

interface PrintingResult {
  printing_id: string;
  image_url?: string;
  set?: string;
  collector_number?: string;
  edition?: string;
  foiling?: string;
  rarity?: string;
  is_extended_art?: boolean;
  tcg_low?: number | null;
  tcg_market?: number | null;
  [key: string]: any;
}

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

const PITCH_STYLE: Record<number, { border: string; badge: string; label: string }> = {
  1: { border: "border-l-red-500",    badge: "bg-red-500 text-white",       label: "Pitch 1" },
  2: { border: "border-l-yellow-400", badge: "bg-yellow-400 text-gray-900", label: "Pitch 2" },
  3: { border: "border-l-blue-500",   badge: "bg-blue-500 text-white",      label: "Pitch 3" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function collectorLabel(p: PrintingResult): string {
  return p.collector_number || (p.set || "").toUpperCase() || "—";
}

function groupPrintings(printingsData: any[]): CardResult[] {
  const map = new Map<string, CardResult>();
  for (const p of printingsData) {
    const id = p.card_unique_id || p.cardId || p.display_name || p.name || "?";
    if (!map.has(id)) {
      map.set(id, {
        unique_id: id,
        name: p.display_name || p.name || "Unknown",
        types: (p.types || []).map((t: string) => String(t).toLowerCase()),
        pitch: p.pitch ?? null,
        printings: [],
      });
    }
    map.get(id)!.printings.push(p);
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
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
  didDrag,
}: {
  p: PrintingResult;
  isSelected: boolean;
  onSelect: (p: PrintingResult) => void;
  onEnlarge: (url: string) => void;
  didDrag: React.MutableRefObject<boolean>;
}) {
  const price = p.tcg_low ?? p.tcg_market;

  return (
    <div
      role="button"
      tabIndex={0}
      onMouseUp={() => {
        if (didDrag.current) return; // swallowed by carousel drag
        onSelect(p);
      }}
      onKeyDown={e => e.key === "Enter" && onSelect(p)}
      onDragStart={e => e.preventDefault()}
      className={cn(
        "relative flex flex-col items-center gap-1 rounded-lg p-1.5 transition-all flex-shrink-0 select-none group cursor-pointer",
        isSelected
          ? "ring-2 ring-blue-500 bg-blue-500/10"
          : "ring-1 ring-gray-600 hover:ring-gray-400 bg-gray-800/60 hover:bg-gray-700/60",
      )}
      style={{ width: 80 }}
      title={`${collectorLabel(p)}${p.edition === "f" ? " 1st" : ""}${p.foiling === "r" ? " RF" : p.foiling === "c" ? " CF" : ""}`}
    >
      {/* Card image */}
      <div className="rounded overflow-hidden w-full" style={{ aspectRatio: "63/88" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.image_url || "/cardback.webp"}
          alt={collectorLabel(p)}
          className="w-full h-full object-cover object-top"
          draggable={false}
        />
      </div>

      {/* Magnify button */}
      {p.image_url && (
        <button
          className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gray-900/80 text-gray-400 hover:text-white hover:bg-gray-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10"
          title="Enlarge image"
          onClick={e => { e.stopPropagation(); onEnlarge(p.image_url!); }}
          onMouseDown={e => e.stopPropagation()} // don't trigger carousel drag
        >
          <ZoomIn className="h-2.5 w-2.5" />
        </button>
      )}

      {/* Collector number */}
      <span className="text-[9px] font-mono text-gray-300 text-center leading-tight w-full truncate px-0.5">
        {collectorLabel(p)}
      </span>

      {/* Foil / edition badges */}
      <PrintingBadges p={p} />

      {/* TCG low price */}
      {price != null && price > 0 ? (
        <span className="text-[9px] text-green-400 font-medium">
          ${price.toFixed(2)}
        </span>
      ) : (
        <span className="text-[9px] text-gray-600">—</span>
      )}

      {isSelected && <Check className="h-3 w-3 text-blue-400 -mt-0.5" />}
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
  const [cards, setCards] = useState<CardResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      setCards([]);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setCards([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("name", debouncedQuery.trim());
    params.set("limit", "15");
    params.set("sortBy", "name");
    params.set("sortOrder", "asc");
    params.set("show", "all");

    if (targetCategory === "hero") {
      // Hero search: type filter only
      params.set("types", "hero");
    } else {
      // Hero legal filtering — precise mode (class/talent subset logic)
      if (heroClasses.length > 0) params.set("heroClasses", heroClasses.join(","));
      if (heroTalents.length > 0) params.set("heroTalents", heroTalents.join(","));
      if (heroEssences.length > 0) params.set("heroEssences", heroEssences.join(","));

      // Zone-specific type filters
      if (targetCategory === "equipment") {
        // Equipment AND weapon cards (array overlap = OR in the DB)
        params.set("types", "equipment,weapon");
      } else if (targetCategory === "maindeck" && pitchFilter != null) {
        // Pitch-specific library section
        params.set("pitch", String(pitchFilter));
      }
      // inventory: no type/pitch filter — show all legal cards
    }

    if (deckFormat) {
      const fmt = getApiFormatCode(deckFormat);
      if (fmt) params.set("format", fmt);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[QuickAdd] search params:', Object.fromEntries(params));
    }

    fetch(`/api/printings/search?${params}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data?.printings) {
          setCards(groupPrintings(data.data.printings));
        } else {
          setError("Search failed. Please try again.");
        }
      })
      .catch(() => setError("Search failed. Please try again."))
      .finally(() => setLoading(false));
  }, [debouncedQuery, targetCategory, pitchFilter, heroClasses.join(","), heroTalents.join(","), heroEssences.join(","), deckFormat]);

  const zoneLabel = ZONE_LABELS[targetCategory] ?? targetCategory;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-gray-900 border-gray-700 text-gray-100 p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-gray-700/60">
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

        <div className="px-5 py-3 border-b border-gray-700/60">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            <Input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by card name…"
              className="pl-9 bg-gray-800 border-gray-600 text-gray-100 placeholder:text-gray-500 focus-visible:ring-blue-500"
              onKeyDown={e => e.key === "Escape" && onOpenChange(false)}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
              >
                ✕
              </button>
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

        {/* No-hero notice */}
        {targetCategory !== "hero" && heroClasses.length === 0 && (
          <div className="px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2 text-xs text-amber-300">
            <span>⚠</span>
            <span>No hero set — showing all cards. Set a hero in deck settings to filter by legality.</span>
          </div>
        )}

        <div className="overflow-y-auto max-h-[65vh] px-5 py-3 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-10 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm">Searching…</span>
            </div>
          )}
          {error && <p className="text-sm text-red-400 py-4 text-center">{error}</p>}
          {!loading && !error && debouncedQuery && cards.length === 0 && (
            <p className="text-sm text-gray-500 py-8 text-center">No cards found for "{debouncedQuery}"</p>
          )}
          {!loading && !debouncedQuery && (
            <p className="text-sm text-gray-600 py-8 text-center">Start typing to search for cards</p>
          )}
          {!loading && cards.map(card => (
            <CardRow key={card.unique_id} card={card} onAdd={onAdd} onEnlarge={setEnlargedImage} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
