// components/deck/MatchupSideboardEditor.tsx
"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotateCcw, AlertCircle, List, LayoutGrid } from "lucide-react";
import { toTalisharIdentifier } from "@/lib/utils";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

type SectionKey = 'hero' | 'equipment' | 'weapon' | 'red' | 'yellow' | 'blue' | 'unpitched';
type ViewMode = 'list' | 'tile';

/** One copy of a card — each physical printing gets its own entry */
interface CardCopy {
  imageUrl?: string;
}

interface GroupedCard {
  talisharId: string;
  name: string;
  pitch?: number | null;
  available: number;
  section: SectionKey;
  copies: CardCopy[];        // one per physical copy, preserving individual images
  imageUrl?: string;         // first image, used for hover preview in list view
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
  equipment: { title: 'Equipment' },
  weapon:    { title: 'Weapons' },
  red:       { title: 'Library — Red',    pitchColor: 'bg-red-500' },
  yellow:    { title: 'Library — Yellow', pitchColor: 'bg-yellow-400' },
  blue:      { title: 'Library — Blue',   pitchColor: 'bg-blue-500' },
  unpitched: { title: 'Library' },
};

const INV_LABELS: Record<SectionKey, { title: string; pitchColor?: string }> = {
  hero:      { title: 'Hero' },
  equipment: { title: 'Equipment' },
  weapon:    { title: 'Weapons' },
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
  const types: string[] = (printing.printingDetails?.types || [])
    .map((t: string) => t.toLowerCase());
  if (defaultCat === 'hero') return 'hero';
  if (types.some(t => t === 'weapon')) return 'weapon';
  if (defaultCat === 'equipment') return 'equipment';
  const pitch = getPitch(printing);
  if (pitch === 1) return 'red';
  if (pitch === 2) return 'yellow';
  if (pitch === 3) return 'blue';
  return 'unpitched';
}

function buildSections(
  printings: Array<{ printing: any; cat: string }>,
  labels: typeof DECK_LABELS
): Section[] {
  const groups = new Map<string, GroupedCard>();

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
    } else {
      const copies = Array.from({ length: qty }, () => ({ imageUrl }));
      groups.set(talisharId, { talisharId, name, pitch, available: qty, section, copies, imageUrl });
    }
  }

  const sectionMap = new Map<SectionKey, GroupedCard[]>();
  for (const card of groups.values()) {
    if (!sectionMap.has(card.section)) sectionMap.set(card.section, []);
    sectionMap.get(card.section)!.push(card);
  }

  const sections: Section[] = [];
  for (const [key, cards] of sectionMap) {
    cards.sort((a, b) => {
      const n = a.name.localeCompare(b.name);
      return n !== 0 ? n : (a.pitch ?? 99) - (b.pitch ?? 99);
    });
    sections.push({
      key,
      title: labels[key]?.title ?? key,
      pitchColor: labels[key]?.pitchColor,
      cards,
    });
  }

  return sections.sort((a, b) => SECTION_ORDER[a.key] - SECTION_ORDER[b.key]);
}

/** Count active (true) entries in a boolean array */
function countActive(arr: boolean[]): number {
  return arr.filter(v => v).length;
}

// ─────────────────────────────────────────────────────────
// Quantity buttons  [0][1][2]  (list view)
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
              : 'bg-white dark:bg-gray-900 text-gray-500 border border-gray-200 dark:border-gray-700 hover:border-gray-400'
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
// Card hover preview (fixed position, list view only)
// ─────────────────────────────────────────────────────────

interface HoverState { imageUrl: string; x: number; y: number }

function CardHoverPreview({ hover }: { hover: HoverState | null }) {
  if (!hover) return null;
  const left = Math.min(hover.x + 16, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 210);
  const top = Math.max(8, Math.min(hover.y - 80, (typeof window !== 'undefined' ? window.innerHeight : 800) - 320));
  return (
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ left, top }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={hover.imageUrl}
        alt="Card preview"
        className="w-48 rounded-xl shadow-2xl border-2 border-gray-600"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Section block — list view
// ─────────────────────────────────────────────────────────

function ListSection({
  section, sel, onSetCount, activeClass, isIncoming, onHover, onLeave,
}: {
  section: Section;
  sel: Map<string, boolean[]>;
  onSetCount: (id: string, count: number) => void;
  activeClass: string;
  isIncoming: boolean;
  onHover: (card: GroupedCard, e: React.MouseEvent) => void;
  onLeave: () => void;
}) {
  const total = section.cards.reduce((s, c) => s + c.available, 0);

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700">
        {section.pitchColor && (
          <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${section.pitchColor}`} />
        )}
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{section.title}</span>
        <span className="text-xs text-gray-400">({total})</span>
      </div>

      {section.cards.map(card => {
        const arr = sel.get(card.talisharId);
        const value = arr ? countActive(arr) : (isIncoming ? 0 : card.available);
        const isDefault = value === (isIncoming ? 0 : card.available);

        return (
          <div
            key={card.talisharId}
            className={`flex items-center gap-2 px-2 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0 transition-colors ${
              !isDefault
                ? isIncoming
                  ? 'bg-green-50 dark:bg-green-950/20'
                  : 'bg-amber-50 dark:bg-amber-950/20'
                : ''
            }`}
          >
            <QuantityButtons
              max={card.available}
              value={value}
              onChange={v => onSetCount(card.talisharId, v)}
              activeClass={activeClass}
            />
            <div
              className="flex items-center gap-1.5 min-w-0 flex-1 cursor-default"
              onMouseEnter={e => card.imageUrl && onHover(card, e)}
              onMouseLeave={onLeave}
            >
              <PitchDot pitch={card.pitch} />
              <span className={`text-sm truncate ${!isDefault ? 'font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
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
// Section block — tile view
// ─────────────────────────────────────────────────────────

function TileSection({
  section, sel, onToggle, isIncoming,
}: {
  section: Section;
  sel: Map<string, boolean[]>;
  onToggle: (id: string, copyIndex: number) => void;
  isIncoming: boolean;
}) {
  const total = section.cards.reduce((s, c) => s + c.available, 0);

  const activeBorderClass = isIncoming
    ? 'ring-[1.5px] ring-green-400'
    : 'ring-[1.5px] ring-amber-400';

  return (
    <div className="mb-1.5">
      {/* Section header — compact inline */}
      <div className="flex items-center gap-1 px-0.5 mb-0.5">
        {section.pitchColor && (
          <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${section.pitchColor}`} />
        )}
        <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">{section.title}</span>
        <span className="text-[10px] text-gray-400">({total})</span>
      </div>

      {/* Tiles — tight grid */}
      <div className="flex flex-wrap gap-[3px]">
        {section.cards.map(card => {
          const arr = sel.get(card.talisharId);
          // Default: deck cards all active, inventory all inactive
          const defaultActive = !isIncoming;

          return card.copies.map((copy, i) => {
            const isActive = arr ? arr[i] ?? defaultActive : defaultActive;

            return (
              <div
                key={`${card.talisharId}-${i}`}
                onClick={() => onToggle(card.talisharId, i)}
                title={card.name}
                className={`
                  relative rounded cursor-pointer transition-all select-none
                  ${isActive ? activeBorderClass : 'opacity-30 hover:opacity-50'}
                `}
                style={{ width: '60px' }}
              >
                {copy.imageUrl ? (
                  <div className="w-full overflow-hidden rounded" style={{ aspectRatio: '63/48' }}>
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
                    className="w-full bg-gray-700 dark:bg-gray-800 rounded flex items-center justify-center p-0.5"
                    style={{ aspectRatio: '63/48' }}
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
  // Selection: per-copy boolean arrays.  true = active (playing/bringing in)
  const [deckSel, setDeckSel] = useState<Map<string, boolean[]>>(new Map());
  const [sideSel, setSideSel] = useState<Map<string, boolean[]>>(new Map());
  const [viewMode, setViewMode] = useState<ViewMode>('tile');
  const [hovered, setHovered] = useState<HoverState | null>(null);
  const hasInit = useRef(false);
  const didInteract = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const deckSections = useMemo(() => {
    if (!deck) return [];
    return buildSections([
      ...(deck.hero || []).map((p: any) => ({ printing: p, cat: 'hero' })),
      ...(deck.equipment || []).map((p: any) => ({ printing: p, cat: 'equipment' })),
      ...(deck.maindeck || []).map((p: any) => ({ printing: p, cat: 'maindeck' })),
    ], DECK_LABELS);
  }, [deck]);

  const invSections = useMemo(() => {
    if (!deck) return [];
    return buildSections(
      (deck.inventory || []).map((p: any) => ({ printing: p, cat: 'inventory' })),
      INV_LABELS
    );
  }, [deck]);

  const allDeckCards = useMemo(() => deckSections.flatMap(s => s.cards), [deckSections]);
  const allInvCards = useMemo(() => invSections.flatMap(s => s.cards), [invSections]);

  // Initialize selection arrays
  useEffect(() => {
    if (!deck || hasInit.current) return;
    hasInit.current = true;

    // Deck: all copies start active (playing)
    const initDeck = new Map<string, boolean[]>();
    for (const c of allDeckCards) initDeck.set(c.talisharId, Array(c.available).fill(true));

    // Inventory: all copies start inactive (not bringing in)
    const initSide = new Map<string, boolean[]>();
    for (const c of allInvCards) initSide.set(c.talisharId, Array(c.available).fill(false));

    // Apply initial swaps
    if (initialSwaps && (initialSwaps.out.length > 0 || initialSwaps.in.length > 0)) {
      // Mark N copies as inactive in deck (from the end)
      const outCounts = new Map<string, number>();
      initialSwaps.out.forEach(id => outCounts.set(id, (outCounts.get(id) || 0) + 1));
      for (const c of allDeckCards) {
        const arr = initDeck.get(c.talisharId)!;
        let remaining = outCounts.get(c.talisharId) || 0;
        for (let i = arr.length - 1; i >= 0 && remaining > 0; i--) {
          arr[i] = false;
          remaining--;
        }
      }

      // Mark N copies as active in inventory (from the start)
      const inCounts = new Map<string, number>();
      initialSwaps.in.forEach(id => inCounts.set(id, (inCounts.get(id) || 0) + 1));
      for (const c of allInvCards) {
        const arr = initSide.get(c.talisharId)!;
        let remaining = Math.min(c.available, inCounts.get(c.talisharId) || 0);
        for (let i = 0; i < arr.length && remaining > 0; i++) {
          arr[i] = true;
          remaining--;
        }
      }
    }

    setDeckSel(initDeck);
    setSideSel(initSide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck]);

  // Emit changes
  useEffect(() => {
    if (!didInteract.current) return;
    const out: string[] = [];
    for (const c of allDeckCards) {
      const arr = deckSel.get(c.talisharId);
      if (!arr) continue;
      const inactive = c.available - countActive(arr);
      for (let i = 0; i < inactive; i++) out.push(c.talisharId);
    }
    const inList: string[] = [];
    for (const c of allInvCards) {
      const arr = sideSel.get(c.talisharId);
      if (!arr) continue;
      const active = countActive(arr);
      for (let i = 0; i < active; i++) inList.push(c.talisharId);
    }
    onChangeRef.current({ in: inList, out });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckSel, sideSel]);

  // Toggle a specific copy by index
  const toggleDeckCopy = (id: string, copyIndex: number) => {
    if (readOnly) return;
    didInteract.current = true;
    setDeckSel(prev => {
      const next = new Map(prev);
      const arr = [...(next.get(id) || [])];
      arr[copyIndex] = !arr[copyIndex];
      next.set(id, arr);
      return next;
    });
  };

  const toggleInvCopy = (id: string, copyIndex: number) => {
    if (readOnly) return;
    didInteract.current = true;
    setSideSel(prev => {
      const next = new Map(prev);
      const arr = [...(next.get(id) || [])];
      arr[copyIndex] = !arr[copyIndex];
      next.set(id, arr);
      return next;
    });
  };

  // Set count for list view (activates first N copies)
  const setDeckCount = (id: string, count: number) => {
    didInteract.current = true;
    setDeckSel(prev => {
      const next = new Map(prev);
      const old = next.get(id) || [];
      const arr = Array(old.length).fill(false);
      for (let i = 0; i < Math.min(count, arr.length); i++) arr[i] = true;
      next.set(id, arr);
      return next;
    });
  };

  const setInvCount = (id: string, count: number) => {
    didInteract.current = true;
    setSideSel(prev => {
      const next = new Map(prev);
      const old = next.get(id) || [];
      const arr = Array(old.length).fill(false);
      for (let i = 0; i < Math.min(count, arr.length); i++) arr[i] = true;
      next.set(id, arr);
      return next;
    });
  };

  const handleReset = () => {
    didInteract.current = true;
    const d = new Map<string, boolean[]>();
    for (const c of allDeckCards) d.set(c.talisharId, Array(c.available).fill(true));
    const s = new Map<string, boolean[]>();
    for (const c of allInvCards) s.set(c.talisharId, Array(c.available).fill(false));
    setDeckSel(d);
    setSideSel(s);
  };

  // Stats
  const totalOut = allDeckCards.reduce((sum, c) => {
    const arr = deckSel.get(c.talisharId);
    return sum + (arr ? c.available - countActive(arr) : 0);
  }, 0);
  const totalIn = allInvCards.reduce((sum, c) => {
    const arr = sideSel.get(c.talisharId);
    return sum + (arr ? countActive(arr) : 0);
  }, 0);
  const mainTotal = allDeckCards.reduce((s, c) => s + c.available, 0);
  const postSwap = mainTotal - totalOut + totalIn;
  const maxSize = format === 'Silver Age' ? 40 : null;
  const isOverLimit = maxSize !== null && postSwap > maxSize;
  const hasChanges = totalOut > 0 || totalIn > 0;

  const handleHover = (card: GroupedCard, e: React.MouseEvent) => {
    if (card.imageUrl) setHovered({ imageUrl: card.imageUrl, x: e.clientX, y: e.clientY });
  };

  return (
    <div className="space-y-1.5">
      {/* Stats bar — compact single line */}
      <div className="flex items-center justify-between flex-wrap gap-1">
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-gray-500 dark:text-gray-400">
            {mainTotal}{hasChanges && ` → `}
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
        </div>

        <div className="flex items-center gap-1">
          {!readOnly && hasChanges && (
            <button type="button" onClick={handleReset} className="text-[10px] text-gray-400 hover:text-gray-200 flex items-center gap-0.5">
              <RotateCcw className="h-2.5 w-2.5" />Reset
            </button>
          )}
          <div className="flex rounded border border-gray-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-1.5 py-0.5 text-[10px] flex items-center gap-0.5 transition-colors ${
                viewMode === 'list'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-500 hover:bg-gray-800'
              }`}
            >
              <List className="h-2.5 w-2.5" />List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tile')}
              className={`px-1.5 py-0.5 text-[10px] flex items-center gap-0.5 border-l border-gray-700 transition-colors ${
                viewMode === 'tile'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-500 hover:bg-gray-800'
              }`}
            >
              <LayoutGrid className="h-2.5 w-2.5" />Tiles
            </button>
          </div>
        </div>
      </div>

      {/* Two columns — deck takes ~75% in tile view, 50/50 in list */}
      <div className={`grid grid-cols-1 gap-2 ${viewMode === 'tile' ? 'md:grid-cols-[3fr_1fr]' : 'md:grid-cols-2'}`}>

        {/* LEFT — Your Deck */}
        <div>
          <div className="flex items-center gap-1.5 mb-1 px-0.5">
            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Deck
            </span>
            {!readOnly && viewMode === 'list' && (
              <span className="text-[10px] text-gray-500">— set how many you&apos;re playing</span>
            )}
          </div>

          {viewMode === 'list' ? (
            <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
              {deckSections.length === 0
                ? <p className="text-xs text-gray-500 p-3 text-center">No cards</p>
                : deckSections.map(s => (
                    <ListSection
                      key={s.key}
                      section={s}
                      sel={deckSel}
                      onSetCount={setDeckCount}
                      activeClass="bg-gray-800 dark:bg-gray-200 dark:text-gray-900"
                      isIncoming={false}
                      onHover={handleHover}
                      onLeave={() => setHovered(null)}
                    />
                  ))
              }
            </div>
          ) : (
            <div className="rounded border border-gray-700/50 p-1">
              {deckSections.length === 0
                ? <p className="text-xs text-gray-500 p-2 text-center">No cards</p>
                : deckSections.map(s => (
                    <TileSection
                      key={s.key}
                      section={s}
                      sel={deckSel}
                      onToggle={toggleDeckCopy}
                      isIncoming={false}
                    />
                  ))
              }
            </div>
          )}
        </div>

        {/* RIGHT — Inventory */}
        <div>
          <div className="flex items-center gap-1.5 mb-1 px-0.5">
            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Inventory
            </span>
            {!readOnly && viewMode === 'list' && (
              <span className="text-[10px] text-gray-500">— set how many to bring in</span>
            )}
          </div>

          {viewMode === 'list' ? (
            <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
              {invSections.length === 0
                ? <p className="text-xs text-gray-500 p-3 text-center">No cards in inventory</p>
                : invSections.map(s => (
                    <ListSection
                      key={s.key}
                      section={s}
                      sel={sideSel}
                      onSetCount={setInvCount}
                      activeClass="bg-green-600"
                      isIncoming={true}
                      onHover={handleHover}
                      onLeave={() => setHovered(null)}
                    />
                  ))
              }
            </div>
          ) : (
            <div className="rounded border border-gray-700/50 p-1">
              {invSections.length === 0
                ? <p className="text-xs text-gray-500 p-2 text-center">No inventory cards</p>
                : invSections.map(s => (
                    <TileSection
                      key={s.key}
                      section={s}
                      sel={sideSel}
                      onToggle={toggleInvCopy}
                      isIncoming={true}
                    />
                  ))
              }
            </div>
          )}
        </div>
      </div>

      {/* Hover card preview (list view only) */}
      {viewMode === 'list' && <CardHoverPreview hover={hovered} />}
    </div>
  );
}
