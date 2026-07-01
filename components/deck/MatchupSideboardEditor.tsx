// components/deck/MatchupSideboardEditor.tsx
"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, AlertCircle, List, LayoutGrid } from "lucide-react";
import { toTalisharIdentifier } from "@/lib/utils";
import { BreakdownChip, type Breakdown } from "./MatchupBreakdownChip";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

type SectionKey = 'hero' | 'equipment' | 'weapon' | 'red' | 'yellow' | 'blue' | 'unpitched';
type ViewMode = 'list' | 'tile';

interface CardCopy { imageUrl?: string; }

interface GroupedCard {
  talisharId: string;
  name: string;
  pitch?: number | null;
  available: number;          // total copies: deck + inventory
  originalDeckCount: number;  // how many start in deck (before any matchup edits)
  section: SectionKey;
  copies: CardCopy[];
  imageUrl?: string;
}

interface Section {
  key: SectionKey;
  title: string;
  pitchColor?: string;
  cards: GroupedCard[];
}

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const PITCH_BG: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-yellow-400',
  3: 'bg-blue-500',
};

const SECTION_ORDER: Record<SectionKey, number> = {
  hero: 0, equipment: 1, weapon: 2, red: 3, yellow: 4, blue: 5, unpitched: 6,
};

const DECK_LABELS: Record<SectionKey, { title: string; pitchColor?: string }> = {
  hero:      { title: 'Hero' },
  equipment: { title: 'Equipment & Weapons' },
  weapon:    { title: 'Equipment & Weapons' }, // merged into equipment section
  red:       { title: 'Library — Red',    pitchColor: 'bg-red-500' },
  yellow:    { title: 'Library — Yellow', pitchColor: 'bg-yellow-400' },
  blue:      { title: 'Library — Blue',   pitchColor: 'bg-blue-500' },
  unpitched: { title: 'Library' },
};

const INV_LABELS: Record<SectionKey, { title: string; pitchColor?: string }> = {
  hero:      { title: 'Hero' },
  equipment: { title: 'Equipment & Weapons' }, // merged into equipment section
  weapon:    { title: 'Equipment & Weapons' },
  red:       { title: 'Inventory — Red',    pitchColor: 'bg-red-500' },
  yellow:    { title: 'Inventory — Yellow', pitchColor: 'bg-yellow-400' },
  blue:      { title: 'Inventory — Blue',   pitchColor: 'bg-blue-500' },
  unpitched: { title: 'Inventory' },
};

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function buildTalisharId(printing: any): string {
  const cardName = printing.printingDetails?.name || '';
  const baseId = toTalisharIdentifier(cardName) || printing.printingId;
  const pv = printing.printingDetails?.pitch;
  let pitch: number | null = null;
  if (typeof pv === 'number') pitch = pv;
  else if (pv && typeof pv === 'object' && '$numberInt' in pv) pitch = parseInt(pv.$numberInt, 10);
  const MAP: Record<number, string> = { 1: 'red', 2: 'yellow', 3: 'blue' };
  return pitch && MAP[pitch] ? `${baseId}_${MAP[pitch]}` : baseId;
}

function getPitch(printing: any): number | null {
  const pv = printing.printingDetails?.pitch;
  if (typeof pv === 'number') return pv;
  if (pv && typeof pv === 'object' && '$numberInt' in pv) return parseInt(pv.$numberInt, 10);
  return null;
}

function getSection(printing: any, defaultCat: string): SectionKey {
  const types: string[] = (printing.printingDetails?.types || []).map((t: string) => t.toLowerCase());
  if (defaultCat === 'hero') return 'hero';
  // Weapons and non-evo equipment go into the equipment section.
  // Evo cards have the equipment type but are played as library cards — keep them in pitch sections.
  const isEvo = types.some(t => t === 'evo');
  if (
    types.some(t => t === 'weapon') ||
    (!isEvo && (types.some(t => t === 'equipment') || defaultCat === 'equipment'))
  ) return 'equipment';
  const pitch = getPitch(printing);
  if (pitch === 1) return 'red';
  if (pitch === 2) return 'yellow';
  if (pitch === 3) return 'blue';
  return 'unpitched';
}

/**
 * Build unified sections from both deck and inventory printings.
 * Each card appears once with `available` = total copies and
 * `originalDeckCount` = how many start in the deck.
 */
function buildUnifiedSections(
  deckPrintings: Array<{ printing: any; cat: string }>,
  invPrintings: Array<{ printing: any; cat: string }>,
  labels: typeof DECK_LABELS,
): Section[] {
  const groups = new Map<string, GroupedCard>();

  const absorb = (printings: Array<{ printing: any; cat: string }>, isDeck: boolean) => {
    for (const { printing, cat } of printings) {
      const talisharId = buildTalisharId(printing);
      const name = printing.printingDetails?.display_name || printing.printingDetails?.name || 'Unknown';
      const pitch = getPitch(printing);
      const section = getSection(printing, cat);
      const qty = printing.quantity || 1;
      const imageUrl = printing.printingDetails?.image_url;

      if (groups.has(talisharId)) {
        const g = groups.get(talisharId)!;
        for (let q = 0; q < qty; q++) g.copies.push({ imageUrl });
        g.available += qty;
        if (isDeck) g.originalDeckCount += qty;
      } else {
        const copies = Array.from({ length: qty }, () => ({ imageUrl }));
        groups.set(talisharId, {
          talisharId, name, pitch,
          available: qty,
          originalDeckCount: isDeck ? qty : 0,
          section, copies, imageUrl,
        });
      }
    }
  };

  absorb(deckPrintings, true);
  absorb(invPrintings, false);

  const sectionMap = new Map<SectionKey, GroupedCard[]>();
  for (const card of groups.values()) {
    if (!sectionMap.has(card.section)) sectionMap.set(card.section, []);
    sectionMap.get(card.section)!.push(card);
  }

  const sections: Section[] = [];
  for (const [key, cards] of sectionMap) {
    cards.sort((a, b) => a.name.localeCompare(b.name) || (a.pitch ?? 99) - (b.pitch ?? 99));
    sections.push({ key, title: labels[key]?.title ?? key, pitchColor: labels[key]?.pitchColor, cards });
  }
  return sections.sort((a, b) => SECTION_ORDER[a.key] - SECTION_ORDER[b.key]);
}

// ─────────────────────────────────────────────────────────
// Quantity buttons  [0][1][2][3]
// ─────────────────────────────────────────────────────────

function QuantityButtons({
  max, value, onChange, activeClass,
}: {
  max: number; value: number; onChange: (v: number) => void; activeClass: string;
}) {
  return (
    <div className="flex gap-0.5 flex-shrink-0">
      {Array.from({ length: max + 1 }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className={`
            w-6 h-6 rounded text-xs font-semibold leading-none transition-colors select-none
            ${i === value
              ? `${activeClass} text-white`
              : 'bg-white dark:bg-gray-900 text-gray-500 border border-gray-300 dark:border-gray-700 hover:border-gray-400'
            }
          `}
        >
          {i}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Pitch dot
// ─────────────────────────────────────────────────────────

function PitchDot({ pitch }: { pitch?: number | null }) {
  if (!pitch || !PITCH_BG[pitch]) return null;
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${PITCH_BG[pitch]}`} />;
}

// ─────────────────────────────────────────────────────────
// Card hover preview
// ─────────────────────────────────────────────────────────

interface HoverState { imageUrl: string; x: number; y: number }

function CardHoverPreview({ hover }: { hover: HoverState | null }) {
  if (!hover) return null;
  const left = Math.min(hover.x + 16, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 210);
  const top = Math.max(8, Math.min(hover.y - 80, (typeof window !== 'undefined' ? window.innerHeight : 800) - 320));
  return (
    <div className="fixed z-[9999] pointer-events-none" style={{ left, top }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={hover.imageUrl} alt="Card preview" className="w-48 rounded-xl shadow-2xl border-2 border-gray-600" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// List section — shared by both columns
// ─────────────────────────────────────────────────────────

function ListSection({
  section, deckCounts, isRight, onSetCount, onHover, onLeave,
}: {
  section: Section;
  deckCounts: Map<string, number>;
  isRight: boolean;
  onSetCount: (id: string, newDeckCount: number) => void;
  onHover: (card: GroupedCard, e: React.MouseEvent) => void;
  onLeave: () => void;
}) {
  const total = section.cards.reduce((s, c) => s + c.available, 0);
  const deckTotal = section.cards.reduce((s, c) => s + (deckCounts.get(c.talisharId) ?? c.originalDeckCount), 0);
  const displayCount = isRight ? total - deckTotal : deckTotal;

  return (
    <div>
      <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 dark:bg-gray-900/60 border-b border-gray-300 dark:border-gray-700">
        {section.pitchColor && (
          <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${section.pitchColor}`} />
        )}
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{section.title}</span>
        <span className="text-xs text-gray-400">({displayCount}/{total})</span>
      </div>

      {section.cards.map(card => {
        const dc = deckCounts.get(card.talisharId) ?? card.originalDeckCount;
        const invCount = card.available - dc;

        // value displayed in this column
        const value = isRight ? invCount : dc;
        // default value for this column (no swaps applied)
        const defaultValue = isRight ? (card.available - card.originalDeckCount) : card.originalDeckCount;
        const isChanged = value !== defaultValue;

        // green = gaining cards in this column, amber = losing cards
        const rowClass = isChanged
          ? (value > defaultValue
            ? 'bg-green-50 dark:bg-green-950/20'
            : 'bg-amber-50 dark:bg-amber-950/20')
          : '';

        const activeClass = isRight ? 'bg-green-600' : 'bg-gray-800 dark:bg-gray-200 dark:text-gray-900';

        return (
          <div
            key={card.talisharId}
            className={`flex items-center gap-2 px-2 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0 transition-colors ${rowClass}`}
          >
            <QuantityButtons
              max={card.available}
              value={value}
              onChange={n => onSetCount(card.talisharId, isRight ? card.available - n : n)}
              activeClass={activeClass}
            />
            <div
              className="flex items-center gap-1.5 min-w-0 flex-1 cursor-default"
              onMouseEnter={e => card.imageUrl && onHover(card, e)}
              onMouseLeave={onLeave}
            >
              <PitchDot pitch={card.pitch} />
              <span className={`text-sm truncate ${isChanged ? 'font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                {card.name}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Tile hover state — feeds the sticky right rail
// ─────────────────────────────────────────────────────────

interface TileHover { imageUrl: string; name: string; pitch?: number | null }

function TilePreviewRail({ hover }: { hover: TileHover | null }) {
  return (
    <div className="hidden lg:block w-[260px] flex-shrink-0">
      <div className="sticky top-2 rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3">
        {hover ? (
          <>
            <div className="aspect-[63/88] rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={hover.imageUrl} alt={hover.name} className="w-full h-full object-cover" />
            </div>
            <div className="mt-2 flex items-center gap-1.5 min-w-0">
              <PitchDot pitch={hover.pitch} />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate" title={hover.name}>
                {hover.name}
              </p>
            </div>
          </>
        ) : (
          <div className="aspect-[63/88] rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center p-4">
            <p className="text-xs text-gray-400 text-center leading-snug">
              Hover a tile to preview the card
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Unified tile section — single column, top-60% crop, simple toggle
// ─────────────────────────────────────────────────────────

function TileSectionUnified({
  section, deckCounts, copyMask, readOnly, onToggle, onHover, onLeave, tileWidth = 108,
}: {
  section: Section;
  deckCounts: Map<string, number>;
  copyMask: Map<string, boolean[]>;
  readOnly: boolean;
  onToggle: (id: string, copyIndex: number) => void;
  onHover: (info: TileHover) => void;
  onLeave: () => void;
  tileWidth?: number;
}) {
  const total = section.cards.reduce((s, c) => s + c.available, 0);
  const deckTotal = section.cards.reduce((s, c) => s + (deckCounts.get(c.talisharId) ?? c.originalDeckCount), 0);

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 px-0.5 pb-1 mb-1 border-b border-gray-700/40">
        {section.pitchColor && (
          <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${section.pitchColor}`} />
        )}
        <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {section.title}
        </span>
        <span className="text-[10px] text-gray-500">({deckTotal}/{total})</span>
      </div>

      <div className="flex flex-wrap gap-1">
        {section.cards.map(card => {
          const dc = deckCounts.get(card.talisharId) ?? card.originalDeckCount;
          const mask = copyMask.get(card.talisharId);
          const isHero = section.key === 'hero';
          const interactive = !readOnly && !isHero;

          return card.copies.map((copy, i) => {
            const inDeck = mask ? !!mask[i] : i < dc;

            const ringClass = isHero
              ? 'ring-2 ring-white/60'
              : inDeck ? 'ring-[1.5px] ring-gray-400 dark:ring-gray-500'
              : '';
            const opacityClass = (!isHero && !inDeck) ? 'opacity-25 hover:opacity-50' : '';

            return (
              <div
                key={`${card.talisharId}-${i}`}
                onClick={() => interactive && onToggle(card.talisharId, i)}
                onMouseEnter={() => copy.imageUrl && onHover({ imageUrl: copy.imageUrl, name: card.name, pitch: card.pitch })}
                onMouseLeave={onLeave}
                title={card.name}
                className={`relative rounded transition-all select-none ${interactive ? 'cursor-pointer' : 'cursor-default'} ${ringClass} ${opacityClass}`}
                style={{ width: tileWidth }}
              >
                {copy.imageUrl ? (
                  <div className="w-full overflow-hidden rounded" style={{ aspectRatio: '63/53' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={copy.imageUrl}
                      alt={card.name}
                      className="w-full block"
                      style={{ aspectRatio: '63/88', objectFit: 'cover', objectPosition: 'top' }}
                      draggable={false}
                    />
                  </div>
                ) : (
                  <div
                    className="w-full bg-gray-700 dark:bg-gray-800 rounded flex items-center justify-center p-1"
                    style={{ aspectRatio: '63/53' }}
                  >
                    <span className="text-[7px] text-center text-gray-300 leading-tight">{card.name}</span>
                  </div>
                )}
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────

interface MatchupSideboardEditorProps {
  deck: any;
  format?: string;
  initialSwaps?: { in: string[]; out: string[] };
  onChange: (swaps: { in: string[]; out: string[] }) => void;
  readOnly?: boolean;
}

export default function MatchupSideboardEditor({
  deck,
  format,
  initialSwaps,
  onChange,
  readOnly = false,
}: MatchupSideboardEditorProps) {
  // Per-copy in-deck mask. `mask[i] === true` means copy i is in the deck (not the inventory).
  // Source of truth — `deckCounts` is derived. This lets a click on a specific tile dim that
  // exact tile, instead of always dimming the last copy via a count-based model.
  const [copyMask, setCopyMask] = useState<Map<string, boolean[]>>(new Map());
  const [viewMode, setViewMode] = useState<ViewMode>('tile');
  const [hovered, setHovered] = useState<HoverState | null>(null);
  const [tileHovered, setTileHovered] = useState<TileHover | null>(null);
  const TILE_SIZES = [
    { key: 'compact', label: 'Compact', width: 108 },
    { key: 'normal',  label: 'Normal',  width: 150 },
    { key: 'large',   label: 'Large',   width: 200 },
  ] as const;
  type TileSizeKey = typeof TILE_SIZES[number]['key'];
  const [tileSizeKey, setTileSizeKey] = useState<TileSizeKey>('compact');
  const tileSizeIdx = TILE_SIZES.findIndex(s => s.key === tileSizeKey);
  const tileWidth = TILE_SIZES[tileSizeIdx].width;
  const hasInit = useRef(false);
  const didInteract = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Unified sections (same cards in both columns)
  const deckSections = useMemo(() => {
    if (!deck) return [];
    return buildUnifiedSections(
      [
        ...(deck.hero || []).map((p: any) => ({ printing: p, cat: 'hero' })),
        ...(deck.equipment || []).map((p: any) => ({ printing: p, cat: 'equipment' })),
        ...(deck.maindeck || []).map((p: any) => ({ printing: p, cat: 'maindeck' })),
      ],
      (deck.inventory || []).map((p: any) => ({ printing: p, cat: 'inventory' })),
      DECK_LABELS,
    );
  }, [deck]);

  // Same cards, but with inventory section labels for the right column
  const invSections = useMemo(() => {
    if (!deck) return [];
    return buildUnifiedSections(
      [
        ...(deck.hero || []).map((p: any) => ({ printing: p, cat: 'hero' })),
        ...(deck.equipment || []).map((p: any) => ({ printing: p, cat: 'equipment' })),
        ...(deck.maindeck || []).map((p: any) => ({ printing: p, cat: 'maindeck' })),
      ],
      (deck.inventory || []).map((p: any) => ({ printing: p, cat: 'inventory' })),
      INV_LABELS,
    );
  }, [deck]);

  const allCards = useMemo(() => deckSections.flatMap(s => s.cards), [deckSections]);

  // Helper: build a default mask for one card (first N copies in deck).
  const defaultMaskFor = (c: GroupedCard, target: number) =>
    Array.from({ length: c.available }, (_, i) => i < target);

  // Initialize copyMask from the deck's actual quantities, then apply saved swaps.
  useEffect(() => {
    if (!deck || hasInit.current) return;
    hasInit.current = true;

    const targetCount = new Map<string, number>();
    for (const c of allCards) targetCount.set(c.talisharId, c.originalDeckCount);

    if (initialSwaps && (initialSwaps.out.length > 0 || initialSwaps.in.length > 0)) {
      const outC = new Map<string, number>();
      initialSwaps.out.forEach(id => outC.set(id, (outC.get(id) || 0) + 1));
      const inC = new Map<string, number>();
      initialSwaps.in.forEach(id => inC.set(id, (inC.get(id) || 0) + 1));

      for (const c of allCards) {
        let v = targetCount.get(c.talisharId)!;
        v = Math.max(0, v - (outC.get(c.talisharId) || 0));
        v = Math.min(c.available, v + (inC.get(c.talisharId) || 0));
        targetCount.set(c.talisharId, v);
      }
    }

    const init = new Map<string, boolean[]>();
    for (const c of allCards) {
      init.set(c.talisharId, defaultMaskFor(c, targetCount.get(c.talisharId)!));
    }
    setCopyMask(init);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck]);

  // Derived count map — kept here so list-mode buttons and stats can reuse the prior shape.
  const deckCounts = useMemo<Map<string, number>>(() => {
    const m = new Map<string, number>();
    for (const [id, mask] of copyMask) {
      m.set(id, mask.reduce((s, b) => s + (b ? 1 : 0), 0));
    }
    return m;
  }, [copyMask]);

  // Emit changes whenever copyMask updates
  useEffect(() => {
    if (!didInteract.current) return;
    const out: string[] = [];
    const inList: string[] = [];
    for (const c of allCards) {
      const dc = deckCounts.get(c.talisharId) ?? c.originalDeckCount;
      const delta = dc - c.originalDeckCount;
      if (delta < 0) for (let i = 0; i < -delta; i++) out.push(c.talisharId);
      else if (delta > 0) for (let i = 0; i < delta; i++) inList.push(c.talisharId);
    }
    onChangeRef.current({ in: inList, out });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copyMask]);

  // Set deck count for a card (list mode — discrete quantity picker).
  // Rebuilds the mask as "first N copies in deck", since the user is choosing a count
  // rather than toggling a specific copy.
  const setCount = (id: string, newDeckCount: number) => {
    if (readOnly) return;
    didInteract.current = true;
    setCopyMask(prev => {
      const card = allCards.find(c => c.talisharId === id);
      if (!card) return prev;
      const target = Math.max(0, Math.min(card.available, newDeckCount));
      const map = new Map(prev);
      map.set(id, defaultMaskFor(card, target));
      return map;
    });
  };

  // Toggle the *specific* copy the user clicked, so the dimming follows the click.
  const toggleTile = (id: string, copyIndex: number) => {
    if (readOnly) return;
    didInteract.current = true;
    setCopyMask(prev => {
      const card = allCards.find(c => c.talisharId === id);
      if (!card) return prev;
      const cur = prev.get(id) ?? defaultMaskFor(card, card.originalDeckCount);
      if (copyIndex < 0 || copyIndex >= cur.length) return prev;
      const next = cur.slice();
      next[copyIndex] = !next[copyIndex];
      const map = new Map(prev);
      map.set(id, next);
      return map;
    });
  };

  const handleReset = () => {
    didInteract.current = true;
    const m = new Map<string, boolean[]>();
    for (const c of allCards) m.set(c.talisharId, defaultMaskFor(c, c.originalDeckCount));
    setCopyMask(m);
  };

  // Stats
  const totalOut = allCards.reduce((sum, c) => {
    const dc = deckCounts.get(c.talisharId) ?? c.originalDeckCount;
    return sum + Math.max(0, c.originalDeckCount - dc);
  }, 0);
  const totalIn = allCards.reduce((sum, c) => {
    const dc = deckCounts.get(c.talisharId) ?? c.originalDeckCount;
    return sum + Math.max(0, dc - c.originalDeckCount);
  }, 0);
  const mainTotal = allCards.reduce((s, c) => s + c.originalDeckCount, 0);
  const postSwap = mainTotal - totalOut + totalIn;
  const maxSize = format === 'Silver Age' ? 40 : null;
  const isOverLimit = maxSize !== null && postSwap > maxSize;
  const hasChanges = totalOut > 0 || totalIn > 0;

  // Per-section breakdown for live counts (post-swap deck + remaining inventory)
  const computeBreakdown = (getCount: (c: GroupedCard) => number) => {
    let red = 0, yellow = 0, blue = 0, equipment = 0, hero = 0, other = 0;
    for (const c of allCards) {
      const n = getCount(c);
      if (n <= 0) continue;
      switch (c.section) {
        case 'red':       red += n; break;
        case 'yellow':    yellow += n; break;
        case 'blue':      blue += n; break;
        case 'equipment':
        case 'weapon':    equipment += n; break;
        case 'hero':      hero += n; break;
        default:          other += n;
      }
    }
    const library = red + yellow + blue + other;
    return { red, yellow, blue, equipment, hero, other, library, total: library + equipment + hero };
  };
  const mainBd = computeBreakdown(c => deckCounts.get(c.talisharId) ?? c.originalDeckCount);
  const invBd  = computeBreakdown(c => c.available - (deckCounts.get(c.talisharId) ?? c.originalDeckCount));

  const handleHover = (card: GroupedCard, e: React.MouseEvent) => {
    if (card.imageUrl) setHovered({ imageUrl: card.imageUrl, x: e.clientX, y: e.clientY });
  };

  return (
    <div className="space-y-1.5">
      {/* Stats bar */}
      <div className="flex items-center justify-between flex-wrap gap-1">
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-gray-500 dark:text-gray-400">
            {mainTotal}{hasChanges && ' → '}
            {hasChanges && (
              <span className={`font-medium ${isOverLimit ? 'text-red-600' : 'text-gray-200'}`}>
                {postSwap}
              </span>
            )}
            {maxSize && <span className="text-gray-500"> / {maxSize}</span>}
          </span>
          {totalOut > 0 && (
            <Badge variant="outline" className="text-[10px] font-normal h-4 px-1 text-amber-700 border-amber-300">−{totalOut}</Badge>
          )}
          {totalIn > 0 && (
            <Badge className="bg-green-600 text-[10px] font-normal h-4 px-1">+{totalIn}</Badge>
          )}
          {isOverLimit && (
            <Badge variant="destructive" className="flex items-center gap-0.5 text-[10px] h-4 px-1">
              <AlertCircle className="h-2.5 w-2.5" />Over
            </Badge>
          )}
          <BreakdownChip label="Main"      bd={mainBd} />
          <BreakdownChip label="Inventory" bd={invBd} />
        </div>

        <div className="flex items-center gap-1">
          {!readOnly && hasChanges && (
            <button type="button" onClick={handleReset} className="text-[10px] text-gray-400 hover:text-gray-200 flex items-center gap-0.5">
              <RotateCcw className="h-2.5 w-2.5" />Reset
            </button>
          )}
          {viewMode === 'tile' && (
            <div className="flex items-center rounded border border-gray-700 overflow-hidden">
              <button
                type="button"
                disabled={tileSizeIdx === 0}
                onClick={() => setTileSizeKey(TILE_SIZES[tileSizeIdx - 1].key)}
                className="px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >−</button>
              <span className="px-1.5 py-0.5 text-[10px] text-gray-300 border-x border-gray-700 min-w-[44px] text-center">{TILE_SIZES[tileSizeIdx].label}</span>
              <button
                type="button"
                disabled={tileSizeIdx === TILE_SIZES.length - 1}
                onClick={() => setTileSizeKey(TILE_SIZES[tileSizeIdx + 1].key)}
                className="px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >+</button>
            </div>
          )}
          <div className="flex rounded border border-gray-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-1.5 py-0.5 text-[10px] flex items-center gap-0.5 transition-colors ${viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:bg-gray-800'}`}
            >
              <List className="h-2.5 w-2.5" />List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tile')}
              className={`px-1.5 py-0.5 text-[10px] flex items-center gap-0.5 border-l border-gray-700 transition-colors ${viewMode === 'tile' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:bg-gray-800'}`}
            >
              <LayoutGrid className="h-2.5 w-2.5" />Tiles
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'list' ? (
        /* List mode — two columns: Deck | Inventory */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <div className="flex items-center gap-1.5 mb-1 px-0.5">
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Deck</span>
              {!readOnly && (
                <span className="text-[10px] text-gray-500">— set how many you&apos;re playing</span>
              )}
            </div>
            <div className="rounded-md border border-gray-300 dark:border-gray-700 overflow-hidden">
              {deckSections.length === 0
                ? <p className="text-xs text-gray-500 p-3 text-center">No cards</p>
                : deckSections.map(s => (
                    <ListSection
                      key={s.key}
                      section={s}
                      deckCounts={deckCounts}
                      isRight={false}
                      onSetCount={setCount}
                      onHover={handleHover}
                      onLeave={() => setHovered(null)}
                    />
                  ))
              }
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1 px-0.5">
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Inventory</span>
              {!readOnly && (
                <span className="text-[10px] text-gray-500">— set how many to bring in</span>
              )}
            </div>
            <div className="rounded-md border border-gray-300 dark:border-gray-700 overflow-hidden">
              {invSections.length === 0
                ? <p className="text-xs text-gray-500 p-3 text-center">No cards</p>
                : invSections.map(s => (
                    <ListSection
                      key={s.key}
                      section={s}
                      deckCounts={deckCounts}
                      isRight={true}
                      onSetCount={setCount}
                      onHover={handleHover}
                      onLeave={() => setHovered(null)}
                    />
                  ))
              }
            </div>
          </div>
        </div>
      ) : (
        /* Tile mode — unified card grid + sticky preview rail (lg+) */
        <div className="flex gap-3 items-start">
          <div className="flex-1 min-w-0 rounded border border-gray-700/50 p-2">
            {deckSections.length === 0
              ? <p className="text-xs text-gray-500 p-2 text-center">No cards</p>
              : (() => {
                  const topSections = deckSections.filter(s => s.key === 'hero' || s.key === 'equipment');
                  const restSections = deckSections.filter(s => s.key !== 'hero' && s.key !== 'equipment');
                  return (
                    <>
                      {topSections.length > 0 && (
                        <div className="flex flex-col sm:flex-row gap-4 mb-1">
                          {topSections.map(s => (
                            <div key={s.key} className="min-w-0">
                              <TileSectionUnified
                                section={s}
                                deckCounts={deckCounts}
                                copyMask={copyMask}
                                readOnly={readOnly}
                                onToggle={toggleTile}
                                onHover={setTileHovered}
                                onLeave={() => setTileHovered(null)}
                                tileWidth={tileWidth}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      {restSections.map(s => (
                        <TileSectionUnified
                          key={s.key}
                          section={s}
                          deckCounts={deckCounts}
                          copyMask={copyMask}
                          readOnly={readOnly}
                          onToggle={toggleTile}
                          onHover={setTileHovered}
                          onLeave={() => setTileHovered(null)}
                          tileWidth={tileWidth}
                        />
                      ))}
                    </>
                  );
                })()
            }
          </div>
          <TilePreviewRail hover={tileHovered} />
        </div>
      )}

      {viewMode === 'list' && <CardHoverPreview hover={hovered} />}
    </div>
  );
}

