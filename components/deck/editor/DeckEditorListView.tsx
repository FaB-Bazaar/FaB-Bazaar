"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, ArrowLeftRight, Loader2, Archive, ArchiveRestore, Sofa, ChevronRight, ChevronDown, List, LayoutGrid, Plus, ZoomIn, BookmarkPlus, Layers, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeckDTO, DeckPrintingDTO, DeckCategory } from "@/lib/services/contracts/IDeckService";
import type { OwnershipEntry, SwapTarget } from "@/hooks/deck/useDeckEditor";

const PITCH_DOT_CLASS: Record<number, string> = {
  1: "bg-red-500",
  2: "bg-yellow-400",
  3: "bg-blue-500",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface CardGroup {
  uid: string;
  displayName: string;
  pitch: number | null;
  totalQty: number;
  printings: DeckPrintingDTO[];
  imageUrl?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByCardName(cards: DeckPrintingDTO[]): CardGroup[] {
  const map = new Map<string, CardGroup>();
  for (const card of cards) {
    const uid = card.printingDetails?.card_unique_id || card.printingId;
    if (!map.has(uid)) {
      map.set(uid, {
        uid,
        displayName: card.printingDetails?.display_name || card.printingDetails?.name || card.printingId,
        pitch: (card.printingDetails?.pitch as number | undefined) || null,
        totalQty: 0,
        printings: [],
        imageUrl: card.printingDetails?.image_url as string | undefined,
      });
    }
    const g = map.get(uid)!;
    g.totalQty += card.quantity ?? 1;
    g.printings.push(card);
  }
  return Array.from(map.values()).sort((a, b) => {
    const pA = a.pitch ?? 4;
    const pB = b.pitch ?? 4;
    if (pA !== pB) return pA - pB;
    return a.displayName.localeCompare(b.displayName);
  });
}

function getPrintingLabel(p: any): string {
  if (!p) return "?";
  const num = p.collector_number || p.set?.toUpperCase() || "?";
  const parts: string[] = [num];
  if (p.edition === "f") parts.push("1st");
  else if (p.edition === "u") parts.push("U");
  if (p.rarity === "v") return [...parts, "Marvel"].join(" ");
  if (p.is_extended_art) parts.push("EA");
  if (p.foiling === "c") parts.push("CF");
  else if (p.foiling === "r") parts.push("RF");
  else if (p.foiling === "g") parts.push("GF");
  return parts.join(" ");
}

// ─── Hover image preview ──────────────────────────────────────────────────────

function HoverImagePreview({ imageUrl, cardName }: { imageUrl: string; cardName: string }) {
  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] pointer-events-none">
      <img
        src={imageUrl}
        alt={cardName}
        className="w-[240px] rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700"
      />
    </div>
  );
}

// ─── Grouped card row ─────────────────────────────────────────────────────────

interface GroupedCardRowProps {
  group: CardGroup;
  category: DeckCategory;
  ownershipMap: Map<string, OwnershipEntry>;
  onSwap: (target: SwapTarget) => void;
  onRemove: (printingId: string, category: DeckCategory) => Promise<void>;
  removingId: string | null;
  onMove?: (printingId: string, from: DeckCategory, to: DeckCategory, qty: number) => Promise<void>;
  onHoverImage: (url: string, name: string) => void;
  onClearImage: () => void;
}

function GroupedCardRow({
  group,
  category,
  ownershipMap,
  onSwap,
  onRemove,
  removingId,
  onMove,
  onHoverImage,
  onClearImage,
}: GroupedCardRowProps) {
  const [expanded, setExpanded] = useState(false);

  const totalOwned = group.printings.reduce((s, pr) => s + (ownershipMap.get(pr.printingId)?.owned ?? 0), 0);
  const hasOwnership = group.printings.some(pr => ownershipMap.has(pr.printingId));
  const isFullyOwned = hasOwnership && totalOwned >= group.totalQty;

  const pitchClass = group.pitch ? PITCH_DOT_CLASS[group.pitch] : "bg-gray-300 dark:bg-gray-600";

  const buildMoveButtons = (pr: DeckPrintingDTO) => {
    if (!onMove) return null;
    const qty = pr.quantity ?? 1;
    const dests: Array<{ to: DeckCategory; label: string; icon: React.ReactNode }> = [];
    const types = ((pr.printingDetails?.types as string[] | undefined) || []).map(t => t.toLowerCase());
    if (category === "maindeck") {
      dests.push({ to: "inventory", label: "Move to Inventory", icon: <Archive className="h-3 w-3" /> });
      dests.push({ to: "benched", label: "Move to Bench", icon: <Sofa className="h-3 w-3" /> });
    } else if (category === "equipment") {
      dests.push({ to: "inventory", label: "Move to Inventory", icon: <Archive className="h-3 w-3" /> });
      dests.push({ to: "benched", label: "Move to Bench", icon: <Sofa className="h-3 w-3" /> });
    } else if (category === "inventory") {
      dests.push({ to: "maindeck", label: "Move to Library", icon: <ArchiveRestore className="h-3 w-3" /> });
      dests.push({ to: "benched", label: "Move to Bench", icon: <Sofa className="h-3 w-3" /> });
    } else if (category === "benched") {
      if (isEquipmentCompatible(types)) {
        dests.push({ to: "equipment", label: "Move to Equipment", icon: <ArchiveRestore className="h-3 w-3" /> });
      }
      if (isLibraryCompatible(types)) {
        dests.push({ to: "maindeck", label: "Move to Library", icon: <ArchiveRestore className="h-3 w-3" /> });
      }
      dests.push({ to: "inventory", label: "Move to Inventory", icon: <Archive className="h-3 w-3" /> });
    }
    return dests.map(({ to, label, icon }) => (
      <Button
        key={to}
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-gray-400 hover:text-indigo-500"
        title={label}
        onClick={() => onMove(pr.printingId, category, to, qty)}
      >
        {icon}
      </Button>
    ));
  };

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-0">
      {/* Group header */}
      <div
        className="flex items-center gap-2 py-1.5 px-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 group"
      >
        {/* Thumbnail */}
        <div
          className="w-7 h-10 flex-shrink-0 rounded overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer"
          onMouseEnter={() => group.imageUrl && onHoverImage(group.imageUrl, group.displayName)}
          onMouseLeave={onClearImage}
        >
          <img
            src={group.imageUrl || "/cardback.webp"}
            alt={group.displayName}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Pitch dot */}
        <span className={cn("w-2 h-2 rounded-full flex-shrink-0", pitchClass)} />

        {/* Name */}
        <span className="text-sm text-gray-900 dark:text-gray-100 flex-1 min-w-0 truncate">{group.displayName}</span>

        {/* Total qty */}
        <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums flex-shrink-0">{group.totalQty}×</span>

        {/* Ownership */}
        {hasOwnership ? (
          isFullyOwned ? (
            <span className="text-xs text-green-600 dark:text-green-400 w-4 text-center flex-shrink-0">✓</span>
          ) : (
            <span className="text-xs text-amber-600 dark:text-amber-400 w-4 text-center flex-shrink-0">○</span>
          )
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        {/* Expand caret */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5"
          title={expanded ? "Collapse printings" : "Expand printings"}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded printing rows */}
      {expanded && (
        <div className="pl-12 bg-gray-50/50 dark:bg-gray-800/20">
          {group.printings.map(pr => {
            const prImageUrl = pr.printingDetails?.image_url as string | undefined;
            const own = ownershipMap.get(pr.printingId);
            const isRemoving = removingId === pr.printingId;
            return (
              <div
                key={pr.printingId}
                className="flex items-center gap-2 py-1 px-3 hover:bg-gray-100 dark:hover:bg-gray-800/50 group/pr border-t border-gray-100 dark:border-gray-800"
              >
                {/* Printing thumbnail */}
                <div
                  className="w-5 h-7 flex-shrink-0 rounded overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer"
                  onMouseEnter={() => prImageUrl && onHoverImage(prImageUrl, group.displayName)}
                  onMouseLeave={onClearImage}
                >
                  <img
                    src={prImageUrl || "/cardback.webp"}
                    alt={group.displayName}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Printing label */}
                <span
                  className="text-xs text-gray-500 dark:text-gray-400 font-mono flex-1 min-w-0 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                  onClick={() => onSwap({ printingId: pr.printingId, cardUniqueId: pr.printingDetails?.card_unique_id || "", cardName: group.displayName, category })}
                  title="Click to swap printing"
                >
                  {getPrintingLabel(pr.printingDetails)}
                </span>

                {/* Qty */}
                <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums flex-shrink-0">{pr.quantity ?? 1}×</span>

                {/* Ownership */}
                {own ? (
                  own.owned >= own.needed ? (
                    <span className="text-xs text-green-600 dark:text-green-400 flex-shrink-0">✓</span>
                  ) : (
                    <span className="text-xs text-amber-600 dark:text-amber-400 tabular-nums flex-shrink-0">{own.owned}/{own.needed}</span>
                  )
                ) : null}

                {/* Actions (visible on hover) */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover/pr:opacity-100 transition-opacity flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-gray-400 hover:text-blue-500"
                    onClick={() => onSwap({ printingId: pr.printingId, cardUniqueId: pr.printingDetails?.card_unique_id || "", cardName: group.displayName, category })}
                    title="Swap printing"
                  >
                    <ArrowLeftRight className="h-3 w-3" />
                  </Button>
                  {buildMoveButtons(pr)}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-gray-400 hover:text-red-500"
                    onClick={() => onRemove(pr.printingId, category)}
                    disabled={isRemoving}
                    title="Remove from deck"
                  >
                    {isRemoving ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tile view ────────────────────────────────────────────────────────────────

type TileSectionKey = 'hero' | 'equipment' | 'red' | 'yellow' | 'blue' | 'unpitched' | 'inventory' | 'bench';

const TILE_SECTION_ORDER: Record<TileSectionKey, number> = {
  hero: 0, equipment: 1, red: 2, yellow: 3, blue: 4, unpitched: 5, inventory: 6, bench: 7,
};

const TILE_SECTION_LABELS: Record<TileSectionKey, { title: string; pitchColor?: string }> = {
  hero:      { title: 'Hero' },
  equipment: { title: 'Equipment & Weapons' },
  red:       { title: 'Library — Red',    pitchColor: 'bg-red-500' },
  yellow:    { title: 'Library — Yellow', pitchColor: 'bg-yellow-400' },
  blue:      { title: 'Library — Blue',   pitchColor: 'bg-blue-500' },
  unpitched: { title: 'Library' },
  inventory: { title: 'Inventory' },
  bench:     { title: 'Bench' },
};

interface DeckTileCard {
  key: string;
  name: string;
  imageUrl?: string;
  sectionKey: TileSectionKey;
  printingId: string;
  cardUniqueId: string;
  category: DeckCategory;
  copyIndex: number;
  /** Total quantity of this printing in this category (needed for moveSingle) */
  totalQty: number;
  /** Card types in lowercase (e.g. ['action'], ['weapon'], ['equipment']) */
  types: string[];
  /** Card stats for highlight filtering */
  cost: number | null;
  defense: number | null;
  power: number | null;
  pitch: number | null;
}

interface DeckTileSectionData {
  key: TileSectionKey;
  title: string;
  pitchColor?: string;
  tiles: DeckTileCard[];
}

function classifyTileCard(printing: DeckPrintingDTO, category: DeckCategory): TileSectionKey {
  const types = ((printing.printingDetails?.types as string[] | undefined) || []).map(t => t.toLowerCase());
  // Detect hero by DB category or by card type (guards against hero stored under maindeck)
  if (category === 'hero' || types.includes('hero')) return 'hero';
  if (category === 'inventory') return 'inventory';
  if (category === 'benched') return 'bench';
  const isEvo = types.some(t => t === 'evo');
  if (types.some(t => t === 'weapon') || (!isEvo && (types.some(t => t === 'equipment') || category === 'equipment'))) return 'equipment';
  const pitch = (printing.printingDetails?.pitch as number | undefined) ?? null;
  if (pitch === 1) return 'red';
  if (pitch === 2) return 'yellow';
  if (pitch === 3) return 'blue';
  return 'unpitched';
}

function buildTileSections(deck: DeckDTO): DeckTileSectionData[] {
  const sectionMap = new Map<TileSectionKey, DeckTileCard[]>();

  const addCards = (cards: DeckPrintingDTO[], category: DeckCategory) => {
    for (const printing of cards) {
      const sectionKey = classifyTileCard(printing, category);
      const qty = printing.quantity ?? 1;
      const types = ((printing.printingDetails?.types as string[] | undefined) || []).map(t => t.toLowerCase());
      if (!sectionMap.has(sectionKey)) sectionMap.set(sectionKey, []);
      const tiles = sectionMap.get(sectionKey)!;
      const pd = printing.printingDetails as any;
      for (let i = 0; i < qty; i++) {
        tiles.push({
          key: `${printing.printingId}-${i}`,
          name: (printing.printingDetails?.display_name || printing.printingDetails?.name || printing.printingId) as string,
          imageUrl: printing.printingDetails?.image_url as string | undefined,
          sectionKey,
          printingId: printing.printingId,
          cardUniqueId: (printing.printingDetails?.card_unique_id as string | undefined) || '',
          category,
          copyIndex: i,
          totalQty: qty,
          types,
          cost: pd?.cost ?? null,
          defense: pd?.defense ?? null,
          power: pd?.power ?? null,
          pitch: pd?.pitch ?? null,
        });
      }
    }
  };

  addCards(deck.hero || [], 'hero');
  addCards(deck.equipment || [], 'equipment');
  addCards(deck.maindeck || [], 'maindeck');
  addCards(deck.inventory || [], 'inventory');
  addCards(deck.benched || [], 'benched');

  // Always show these zones even when empty so users know where to add cards
  for (const key of ['equipment', 'red', 'yellow', 'blue', 'inventory'] as TileSectionKey[]) {
    if (!sectionMap.has(key)) sectionMap.set(key, []);
  }

  const sections: DeckTileSectionData[] = [];
  for (const [key, tiles] of sectionMap) {
    tiles.sort((a, b) => a.name.localeCompare(b.name));
    const label = TILE_SECTION_LABELS[key];
    sections.push({ key, title: label.title, pitchColor: label.pitchColor, tiles });
  }
  return sections.sort((a, b) => TILE_SECTION_ORDER[a.key] - TILE_SECTION_ORDER[b.key]);
}

// ─── Drag-and-drop validation ─────────────────────────────────────────────────

function isEquipmentCompatible(types: string[]): boolean {
  const isEvo = types.includes('evo');
  return types.includes('weapon') || (!isEvo && types.includes('equipment'));
}

function isLibraryCompatible(types: string[]): boolean {
  const isEvo = types.includes('evo');
  if (types.includes('weapon')) return false;
  if (!isEvo && types.includes('equipment')) return false;
  return true;
}

function sectionToCategory(sectionKey: TileSectionKey): DeckCategory | null {
  if (sectionKey === 'equipment') return 'equipment';
  if (sectionKey === 'inventory') return 'inventory';
  if (sectionKey === 'bench') return 'benched';
  if (sectionKey === 'red' || sectionKey === 'yellow' || sectionKey === 'blue' || sectionKey === 'unpitched') return 'maindeck';
  return null; // hero — not droppable
}

function sectionToPitch(sectionKey: TileSectionKey): 1 | 2 | 3 | undefined {
  if (sectionKey === 'red') return 1;
  if (sectionKey === 'yellow') return 2;
  if (sectionKey === 'blue') return 3;
  return undefined;
}

function canDropOnSection(tile: DeckTileCard, targetSectionKey: TileSectionKey): boolean {
  const targetCategory = sectionToCategory(targetSectionKey);
  if (!targetCategory) return false;
  // Already in this category (covers same-section and cross-pitch-section drags within library)
  if (tile.category === targetCategory) return false;
  if (targetCategory === 'equipment') return isEquipmentCompatible(tile.types);
  if (targetCategory === 'maindeck') return isLibraryCompatible(tile.types);
  if (targetCategory === 'inventory') return tile.category !== 'hero';
  // Bench accepts any non-hero card
  if (targetCategory === 'benched') return tile.category !== 'hero';
  return false;
}

// ─── Tile section (with drag-and-drop) ───────────────────────────────────────

function DeckTileSection({
  section,
  onHover,
  onLeave,
  onSwap,
  ownershipMap,
  isTileDraggable,
  activeDragTile,
  onTileDragStart,
  onTileDragEnd,
  onSectionDrop,
  heroPortrait,
  onAddCard,
  onRemoveTile,
  onMoveToInventory,
  onAddTile,
  onEnlargeImage,
  onAddToBinder,
  onAddToWants,
  highlightMatchIds,
  tileWidth = 72,
}: {
  section: DeckTileSectionData;
  onHover: (url: string, name: string) => void;
  onLeave: () => void;
  onSwap?: (target: SwapTarget) => void;
  ownershipMap: Map<string, OwnershipEntry>;
  isTileDraggable?: boolean;
  activeDragTile?: DeckTileCard | null;
  onTileDragStart?: (tile: DeckTileCard) => void;
  onTileDragEnd?: () => void;
  onSectionDrop?: (tile: DeckTileCard, targetSectionKey: TileSectionKey) => void;
  /** Hero portrait shown inline in the section header — no extra vertical space */
  heroPortrait?: DeckTileCard | null;
  /** Called when the user clicks "+ Add" in a zone header */
  onAddCard?: (category: DeckCategory, pitch?: 1 | 2 | 3) => void;
  /** Remove 1 copy of a tile (X button on hover) */
  onRemoveTile?: (tile: DeckTileCard) => void;
  /** Move 1 copy of a tile to inventory */
  onMoveToInventory?: (tile: DeckTileCard) => void;
  /** Add 1 more copy of a tile (+1 button on hover) */
  onAddTile?: (tile: DeckTileCard) => void;
  /** Open enlarged image lightbox */
  onEnlargeImage?: (url: string, name: string) => void;
  /** Add a card to the selected binder */
  onAddToBinder?: (printingId: string, cardName: string) => void;
  /** Add an unowned card to the wants list */
  onAddToWants?: (printingId: string, cardName: string) => void;
  /** Set of printingIds that match the active highlight filter (null = no filter) */
  highlightMatchIds?: Set<string> | null;
  /** Width of each card tile in px — default 72 */
  tileWidth?: number;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isHeroSection = section.key === 'hero';
  const isCollapsible = !!heroPortrait; // only the equipment section (which hosts the hero portrait)
  const isDragActive = !!activeDragTile;
  const isValidDropTarget = activeDragTile ? canDropOnSection(activeDragTile, section.key) : false;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isValidDropTarget) return;
    e.preventDefault();
    setIsDragOver(true);
  }, [isValidDropTarget]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (activeDragTile && isValidDropTarget && onSectionDrop) {
      onSectionDrop(activeDragTile, section.key);
    }
  }, [activeDragTile, isValidDropTarget, onSectionDrop, section.key]);

  const zoneAccent: Record<string, { bg: string; border: string; headerBorder: string }> = {
    red:    { bg: "bg-red-500/10 dark:bg-red-500/[0.06]",    border: "border-l-[3px] border-l-red-500 rounded-r-lg",    headerBorder: "border-red-500/30" },
    yellow: { bg: "bg-yellow-400/10 dark:bg-yellow-400/[0.05]", border: "border-l-[3px] border-l-yellow-400 rounded-r-lg", headerBorder: "border-yellow-400/30" },
    blue:   { bg: "bg-blue-500/10 dark:bg-blue-500/[0.05]",   border: "border-l-[3px] border-l-blue-500 rounded-r-lg",   headerBorder: "border-blue-500/30" },
  };
  const accent = zoneAccent[section.key] ?? null;

  return (
    <div
      className={cn(
        "mb-3 p-1 transition-all",
        accent ? [accent.bg, accent.border] : "rounded-lg",
        isDragActive && isValidDropTarget && !isDragOver && "ring-1 ring-inset ring-indigo-400/50 bg-indigo-500/5",
        isDragActive && isValidDropTarget && isDragOver && "ring-2 ring-inset ring-indigo-400 bg-indigo-500/20",
        isDragActive && !isValidDropTarget && activeDragTile?.sectionKey !== section.key && "opacity-40",
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={cn("flex items-center gap-1.5 px-0.5 pb-1 mb-1 border-b", accent ? accent.headerBorder : "border-gray-700/40")}>
        {/* Hero portrait inline — no extra row, zero additional height cost */}
        {heroPortrait && (
          <>
            <div
              className="relative flex-shrink-0 rounded overflow-hidden ring-[1.5px] ring-yellow-400/70 cursor-pointer"
              style={{ width: 28 }}
              title={heroPortrait.name}
              onMouseEnter={() => heroPortrait.imageUrl && onHover(heroPortrait.imageUrl, heroPortrait.name)}
              onMouseLeave={onLeave}
              onClick={() => !isDragActive && onSwap?.({ printingId: heroPortrait.printingId, cardUniqueId: heroPortrait.cardUniqueId, cardName: heroPortrait.name, category: heroPortrait.category })}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroPortrait.imageUrl || '/cardback.webp'}
                alt={heroPortrait.name}
                className="w-full block"
                style={{ aspectRatio: '63/88', objectFit: 'cover', objectPosition: 'top' }}
                draggable={false}
              />
              <div className="absolute bottom-0 left-0 right-0 text-[5px] text-center bg-black/50 text-yellow-300 uppercase tracking-widest leading-3 py-px">
                hero
              </div>
            </div>
            <div className="w-px self-stretch bg-gray-600/50 mx-0.5 flex-shrink-0" />
            {isCollapsed && section.tiles
              .filter((t, i, arr) => arr.findIndex(x => x.printingId === t.printingId) === i)
              .map(tile => (
                <div
                  key={tile.printingId}
                  className="relative flex-shrink-0 rounded overflow-hidden ring-[1.5px] ring-gray-500"
                  style={{ width: 28 }}
                  title={tile.name}
                  onMouseEnter={() => tile.imageUrl && onHover(tile.imageUrl, tile.name)}
                  onMouseLeave={onLeave}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tile.imageUrl || '/cardback.webp'}
                    alt={tile.name}
                    className="w-full block"
                    style={{ aspectRatio: '63/88', objectFit: 'cover', objectPosition: 'top' }}
                    draggable={false}
                  />
                </div>
              ))}
          </>
        )}
        {section.pitchColor && (
          <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${section.pitchColor}`} />
        )}
        <span className={cn(
          "text-[10px] uppercase tracking-wider font-bold",
          section.key === 'red'    ? "text-red-600 dark:text-red-400" :
          section.key === 'yellow' ? "text-yellow-600 dark:text-yellow-400" :
          section.key === 'blue'   ? "text-blue-600 dark:text-blue-400" :
          "text-gray-600 dark:text-gray-300"
        )}>
          {section.title}
        </span>
        <span className={cn(
          "text-[10px]",
          section.key === 'red'    ? "text-red-500/70 dark:text-red-400/60" :
          section.key === 'yellow' ? "text-yellow-500/70 dark:text-yellow-400/60" :
          section.key === 'blue'   ? "text-blue-500/70 dark:text-blue-400/60" :
          "text-gray-500"
        )}>({section.tiles.length})</span>
        {isDragActive && isValidDropTarget && (
          <span className="text-[9px] text-indigo-400 font-medium ml-auto">drop here</span>
        )}
        {isCollapsible && !isDragActive && (
          <button
            type="button"
            className="ml-auto flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors px-1 py-0.5 rounded hover:bg-gray-700/50"
            onClick={() => setIsCollapsed(v => !v)}
            title={isCollapsed ? "Show equipment & weapons" : "Collapse equipment & weapons"}
          >
            {isCollapsed ? "show" : "collapse"}
            <ChevronDown className={cn("h-3 w-3 transition-transform", isCollapsed && "-rotate-90")} />
          </button>
        )}
      </div>
      {!isCollapsed && <div className="flex flex-wrap gap-1">
        {section.tiles.map(tile => {
          const own = ownershipMap.get(tile.printingId);
          const ownershipState = !own ? null
            : tile.copyIndex < own.owned ? 'full'
            : 'missing';
          const isBeingDragged = activeDragTile?.key === tile.key;
          // Hero and demi-hero are special permanent slots — never draggable
          const thisTileDraggable = isTileDraggable && tile.category !== 'hero' && !tile.types.includes('demi-hero');
          const isHighlighted = highlightMatchIds ? highlightMatchIds.has(tile.printingId) : null;
          return (
            <div
              key={tile.key}
              title={thisTileDraggable ? `${tile.name} — drag to move, click to swap printing` : (onSwap ? `${tile.name} — click to swap printing` : tile.name)}
              draggable={thisTileDraggable}
              onMouseEnter={() => !isDragActive && tile.imageUrl && onHover(tile.imageUrl, tile.name)}
              onMouseLeave={onLeave}
              onDragStart={thisTileDraggable ? (e) => {
                e.dataTransfer.effectAllowed = 'move';
                onTileDragStart?.(tile);
              } : undefined}
              onDragEnd={thisTileDraggable ? () => onTileDragEnd?.() : undefined}
              onClick={() => !isDragActive && onSwap?.({ printingId: tile.printingId, cardUniqueId: tile.cardUniqueId, cardName: tile.name, category: tile.category })}
              className={cn(
                "relative rounded select-none group transition-all duration-150",
                isHeroSection ? "ring-2 ring-white/60" : "ring-[1.5px] ring-gray-400 dark:ring-gray-500",
                thisTileDraggable && "cursor-grab active:cursor-grabbing",
                !thisTileDraggable && onSwap && "cursor-pointer",
                isBeingDragged && "opacity-30 scale-95",
                isHighlighted === true && "ring-2 ring-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]",
                isHighlighted === false && "opacity-25 scale-95 grayscale",
              )}
              style={{ width: tileWidth }}
            >
              {tile.imageUrl ? (
                <div className="w-full overflow-hidden rounded" style={{ aspectRatio: '63/53' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tile.imageUrl}
                    alt={tile.name}
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
                  <span className="text-[7px] text-center text-gray-300 leading-tight">{tile.name}</span>
                </div>
              )}

              {/* Ownership dot — fades on hover when missing (wants button takes over) */}
              {ownershipState !== null && (
                <div className={cn(
                  "absolute top-0.5 right-0.5 w-2 h-2 rounded-full border border-black/20 transition-opacity",
                  ownershipState === 'full' ? "bg-green-400" : "bg-red-500",
                  ownershipState === 'missing' && onAddToWants ? "group-hover:opacity-0" : "",
                )} />
              )}

              {/* Wants button — shown on hover for unowned cards */}
              {!isDragActive && onAddToWants && ownershipState === 'missing' && (
                <button
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/85 ring-1 ring-white/20 text-gray-300 hover:text-white hover:bg-pink-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10"
                  title="Add to wants list"
                  onClick={e => { e.stopPropagation(); onAddToWants(tile.printingId, tile.name); }}
                >
                  <Heart className="h-3 w-3" />
                </button>
              )}

              {/* Remove button (X) — shown on hover, hidden for hero/demi-hero */}
              {!isDragActive && onRemoveTile && tile.category !== 'hero' && !tile.types.includes('demi-hero') && (
                <button
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-black/85 ring-1 ring-white/20 text-gray-300 hover:text-white hover:bg-red-600 flex items-center justify-center opacity-20 group-hover:opacity-100 transition-all z-10"
                  title="Remove 1 copy"
                  onClick={e => { e.stopPropagation(); onRemoveTile(tile); }}
                >
                  <X className="h-3 w-3" />
                </button>
              )}

              {/* Move to inventory button — shown on hover, only for maindeck/equipment cards */}
              {!isDragActive && onMoveToInventory && tile.category !== 'hero' && tile.category !== 'inventory' && !tile.types.includes('demi-hero') && (
                <button
                  className="absolute top-6 left-0.5 w-5 h-5 rounded-full bg-black/85 ring-1 ring-white/20 text-gray-300 hover:text-white hover:bg-blue-600 flex items-center justify-center opacity-20 group-hover:opacity-100 transition-all z-10"
                  title="Move to inventory"
                  onClick={e => { e.stopPropagation(); onMoveToInventory(tile); }}
                >
                  <Archive className="h-3 w-3" />
                </button>
              )}

              {/* Add +1 button — shown on hover, hidden for hero/demi-hero */}
              {!isDragActive && onAddTile && tile.category !== 'hero' && !tile.types.includes('demi-hero') && (
                <button
                  className="absolute top-0.5 left-6 w-5 h-5 rounded-full bg-black/85 ring-1 ring-white/20 text-gray-300 hover:text-white hover:bg-green-600 flex items-center justify-center opacity-20 group-hover:opacity-100 transition-all z-10 text-[10px] font-bold leading-none"
                  title="Add 1 copy"
                  onClick={e => { e.stopPropagation(); onAddTile(tile); }}
                >
                  +1
                </button>
              )}

              {/* Binder button — shown on hover */}
              {!isDragActive && onAddToBinder && (
                <button
                  className="absolute bottom-0.5 left-0.5 w-5 h-5 rounded-full bg-black/85 ring-1 ring-white/20 text-gray-300 hover:text-white hover:bg-green-600 flex items-center justify-center opacity-20 group-hover:opacity-100 transition-all z-10"
                  title="Add to binder"
                  onClick={e => { e.stopPropagation(); onAddToBinder(tile.printingId, tile.name); }}
                >
                  <BookmarkPlus className="h-3 w-3" />
                </button>
              )}

              {/* Magnify button — shown on hover when tile has an image */}
              {!isDragActive && onEnlargeImage && tile.imageUrl && (
                <button
                  className="absolute bottom-0.5 right-0.5 w-10 h-10 rounded-full bg-black/85 ring-1 ring-white/20 text-gray-300 hover:text-white hover:bg-gray-600 flex items-center justify-center opacity-20 group-hover:opacity-100 transition-all z-10"
                  title="Enlarge image"
                  onClick={e => { e.stopPropagation(); onEnlargeImage(tile.imageUrl!, tile.name); }}
                >
                  <ZoomIn className="h-5 w-5" />
                </button>
              )}

              {/* Hover overlay: drag hint when draggable, swap hint otherwise */}
              {!isDragActive && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 rounded transition-opacity pointer-events-none">
                  {thisTileDraggable ? (
                    <svg className="h-4 w-4 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
                    </svg>
                  ) : onSwap ? (
                    <ArrowLeftRight className="h-3.5 w-3.5 text-white" />
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
        {onAddCard && sectionToCategory(section.key) && (
          <button
            type="button"
            onClick={() => !isDragActive && onAddCard(sectionToCategory(section.key)!, sectionToPitch(section.key))}
            title={`Add card to ${section.title}`}
            className="rounded border-2 border-dashed border-gray-600 hover:border-blue-500 text-gray-600 hover:text-blue-400 flex items-center justify-center transition-colors flex-shrink-0"
            style={{ width: tileWidth, aspectRatio: '63/53' }}
          >
            <Plus className="h-5 w-5" />
          </button>
        )}
      </div>}
    </div>
  );
}

// ─── Optimistic helpers ───────────────────────────────────────────────────────

function applyOptimisticRemoveOne(deck: DeckDTO, printingId: string, category: DeckCategory): DeckDTO {
  const cards = [...((deck[category as keyof DeckDTO] as DeckPrintingDTO[] | undefined) || [])];
  const idx = cards.findIndex(c => c.printingId === printingId);
  if (idx === -1) return deck;
  const qty = cards[idx].quantity ?? 1;
  if (qty <= 1) cards.splice(idx, 1);
  else cards[idx] = { ...cards[idx], quantity: qty - 1 };
  return { ...deck, [category]: cards };
}

function applyOptimisticAddOne(deck: DeckDTO, printingId: string, category: DeckCategory): DeckDTO {
  const cards = [...((deck[category as keyof DeckDTO] as DeckPrintingDTO[] | undefined) || [])];
  const idx = cards.findIndex(c => c.printingId === printingId);
  if (idx === -1) return deck;
  cards[idx] = { ...cards[idx], quantity: (cards[idx].quantity ?? 1) + 1 };
  return { ...deck, [category]: cards };
}

function applyOptimisticMove(
  deck: DeckDTO,
  printingId: string,
  fromCategory: DeckCategory,
  toCategory: DeckCategory,
): DeckDTO {
  const getCategoryCards = (d: DeckDTO, cat: DeckCategory): DeckPrintingDTO[] =>
    [...((d[cat as keyof DeckDTO] as DeckPrintingDTO[] | undefined) || [])];

  const fromCards = getCategoryCards(deck, fromCategory);
  const toCards = getCategoryCards(deck, toCategory);

  const fromIdx = fromCards.findIndex(c => c.printingId === printingId);
  if (fromIdx === -1) return deck;

  const printing = fromCards[fromIdx];
  const currentQty = printing.quantity ?? 1;

  if (currentQty <= 1) {
    fromCards.splice(fromIdx, 1);
  } else {
    fromCards[fromIdx] = { ...printing, quantity: currentQty - 1 };
  }

  const toIdx = toCards.findIndex(c => c.printingId === printingId);
  if (toIdx >= 0) {
    toCards[toIdx] = { ...toCards[toIdx], quantity: (toCards[toIdx].quantity ?? 1) + 1 };
  } else {
    toCards.push({ ...printing, quantity: 1, category: toCategory });
  }

  return { ...deck, [fromCategory]: fromCards, [toCategory]: toCards };
}

// ─── Game view ────────────────────────────────────────────────────────────────

interface GameViewCard {
  name: string;
  imageUrl?: string;
  redQty: number;
  yellowQty: number;
  blueQty: number;
  noPitchQty: number;
  totalQty: number;
  cost: number | null;
  defense: number | null;
  power: number | null;
}

interface GameViewSection {
  key: string;
  title: string;
  pitchColor?: string;
  cards: GameViewCard[];
}

function buildGameCards(cards: DeckPrintingDTO[]): GameViewCard[] {
  const map = new Map<string, GameViewCard>();
  // Track which pitch level provided the current image so we can prefer lower pitch (red > yellow > blue)
  const bestPitch = new Map<string, number>();

  for (const printing of cards) {
    const name = (printing.printingDetails?.name || printing.printingId) as string;
    const pitch = printing.printingDetails?.pitch as number | undefined;
    const qty = printing.quantity ?? 1;
    const imageUrl = printing.printingDetails?.image_url as string | undefined;

    const pd = printing.printingDetails as any;
    if (!map.has(name)) {
      map.set(name, {
        name, imageUrl,
        redQty: 0, yellowQty: 0, blueQty: 0, noPitchQty: 0, totalQty: 0,
        cost: pd?.cost ?? null,
        defense: pd?.defense ?? null,
        power: pd?.power ?? null,
      });
      bestPitch.set(name, pitch ?? 99);
    }
    const card = map.get(name)!;
    card.totalQty += qty;

    // Prefer the image from the lowest pitch (red > yellow > blue > unpitched)
    const thisPitch = pitch ?? 99;
    if (imageUrl && thisPitch < (bestPitch.get(name) ?? 99)) {
      card.imageUrl = imageUrl;
      bestPitch.set(name, thisPitch);
    }

    if (pitch === 1) card.redQty += qty;
    else if (pitch === 2) card.yellowQty += qty;
    else if (pitch === 3) card.blueQty += qty;
    else card.noPitchQty += qty;
  }

  return Array.from(map.values()).sort((a, b) => {
    // Primary sort: lowest pitch present (red-containing first, then yellow-only, blue-only, unpitched)
    const pA = a.redQty > 0 ? 1 : a.yellowQty > 0 ? 2 : a.blueQty > 0 ? 3 : 4;
    const pB = b.redQty > 0 ? 1 : b.yellowQty > 0 ? 2 : b.blueQty > 0 ? 3 : 4;
    if (pA !== pB) return pA - pB;
    return a.name.localeCompare(b.name);
  });
}

function buildGameViewSections(deck: DeckDTO): GameViewSection[] {
  const sections: GameViewSection[] = [];
  const eqCards = buildGameCards(deck.equipment || []);
  const libCards = buildGameCards(deck.maindeck || []);
  const invCards = buildGameCards(deck.inventory || []);
  const benchCards = buildGameCards(deck.benched || []);
  // Always include equipment section so the hero portrait is always visible
  sections.push({ key: 'equipment', title: 'Equipment & Weapons', cards: eqCards });
  // Split library by pitch — same visual grouping as tile view
  const redCards      = libCards.filter(c => c.redQty > 0);
  const yellowCards   = libCards.filter(c => c.yellowQty > 0);
  const blueCards     = libCards.filter(c => c.blueQty > 0);
  const unpitchedCards = libCards.filter(c => c.noPitchQty > 0);
  if (redCards.length > 0)      sections.push({ key: 'red',      title: 'Library — Red',    pitchColor: 'bg-red-500',    cards: redCards });
  if (yellowCards.length > 0)   sections.push({ key: 'yellow',   title: 'Library — Yellow', pitchColor: 'bg-yellow-400', cards: yellowCards });
  if (blueCards.length > 0)     sections.push({ key: 'blue',     title: 'Library — Blue',   pitchColor: 'bg-blue-500',   cards: blueCards });
  if (unpitchedCards.length > 0) sections.push({ key: 'unpitched', title: 'Library',          cards: unpitchedCards });
  if (invCards.length > 0)  sections.push({ key: 'inventory', title: 'Inventory', cards: invCards });
  if (benchCards.length > 0) sections.push({ key: 'bench', title: 'Bench', cards: benchCards });
  return sections;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DeckEditorListViewProps {
  deck: DeckDTO;
  ownershipMap: Map<string, OwnershipEntry>;
  onSwap: (target: SwapTarget) => void;
  onRemove: (printingId: string, category: DeckCategory) => Promise<void>;
  onMove?: (printingId: string, fromCategory: DeckCategory, toCategory: DeckCategory, quantity: number) => Promise<void>;
  /** Move exactly 1 copy of a printing between categories (used by tile drag-and-drop) */
  onMoveSingle?: (printingId: string, fromCategory: DeckCategory, toCategory: DeckCategory, currentQty: number) => Promise<void>;
  /** Remove 1 copy of a tile printing (tile view X button) */
  onRemoveTile?: (printingId: string, category: DeckCategory, currentQty: number) => Promise<void>;
  /** Add 1 copy of a tile printing (+1 button on hover) */
  onAddOneTile?: (printingId: string, category: DeckCategory, currentQty: number) => Promise<void>;
  /** Called when the user clicks "+ Add" on a tile zone — receives the target category and optional pitch filter */
  onAddCard?: (category: DeckCategory, pitch?: 1 | 2 | 3) => void;
  canEdit?: boolean;
  /** Binder list for the selector */
  binders?: Array<{ _id: string; name: string }>;
  /** Currently selected binder ID */
  selectedBinderId?: string;
  /** Called when the user changes the binder selection */
  onBinderChange?: (binderId: string) => void;
  /** Called when the user clicks the binder button on a tile */
  onAddToBinder?: (printingId: string, cardName: string) => void;
  /** Called when the user clicks the wants button on an unowned tile */
  onAddToWants?: (printingId: string, cardName: string) => void;
  /** Swap all unowned deck printings to best-value owned alternatives */
  onUpgradePrintings?: () => Promise<void>;
}

export default function DeckEditorListView({ deck, ownershipMap, onSwap, onRemove, onMove, onMoveSingle, onRemoveTile, onAddOneTile, onAddCard, canEdit, binders, selectedBinderId, onBinderChange, onAddToBinder, onAddToWants, onUpgradePrintings }: DeckEditorListViewProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [hoveredImage, setHoveredImage] = useState<{ url: string; name: string } | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<{ url: string; name: string } | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'tile' | 'game'>('tile');
  const TILE_SIZES = [
    { key: 'compact', label: 'Compact', width: 72 },
    { key: 'normal',  label: 'Normal',  width: 108 },
    { key: 'large',   label: 'Large',   width: 150 },
  ] as const;
  type TileSizeKey = typeof TILE_SIZES[number]['key'];
  const [tileSizeKey, setTileSizeKey] = useState<TileSizeKey>('normal');
  const tileSizeIdx = TILE_SIZES.findIndex(s => s.key === tileSizeKey);
  const tileWidth = TILE_SIZES[tileSizeIdx].width;
  const [dragTile, setDragTile] = useState<DeckTileCard | null>(null);
  const [optimisticDeck, setOptimisticDeck] = useState<DeckDTO | null>(null);
  const mouseXRef = useRef(0);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleUpgradePrintings = async () => {
    if (!onUpgradePrintings) return;
    setIsUpgrading(true);
    try {
      await onUpgradePrintings();
    } finally {
      setIsUpgrading(false);
    }
  };

  // Clear optimistic state whenever the real deck prop updates (after backend refresh)
  useEffect(() => { setOptimisticDeck(null); }, [deck]);

  // Track mouse X so the hover preview can appear on the opposite side from the cursor
  useEffect(() => {
    const handler = (e: MouseEvent) => { mouseXRef.current = e.clientX; };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  const displayDeck = optimisticDeck ?? deck;

  const handleRemove = async (printingId: string, category: DeckCategory) => {
    setRemovingId(printingId);
    try {
      await onRemove(printingId, category);
    } finally {
      setRemovingId(null);
    }
  };

  const handleTileRemoveOne = useCallback(async (tile: DeckTileCard) => {
    setOptimisticDeck(prev => applyOptimisticRemoveOne(prev ?? deck, tile.printingId, tile.category));
    await onRemoveTile?.(tile.printingId, tile.category, tile.totalQty);
  }, [onRemoveTile, deck]);

  const handleTileAddOne = useCallback(async (tile: DeckTileCard) => {
    setOptimisticDeck(prev => applyOptimisticAddOne(prev ?? deck, tile.printingId, tile.category));
    await onAddOneTile?.(tile.printingId, tile.category, tile.totalQty);
  }, [onAddOneTile, deck]);

  const handleTileMoveToInventory = useCallback(async (tile: DeckTileCard) => {
    if (!onMoveSingle) return;
    setOptimisticDeck(prev => applyOptimisticMove(prev ?? deck, tile.printingId, tile.category, 'inventory'));
    await onMoveSingle(tile.printingId, tile.category, 'inventory', tile.totalQty);
  }, [onMoveSingle, deck]);

  const handleSectionDrop = useCallback(async (tile: DeckTileCard, targetSectionKey: TileSectionKey) => {
    const targetCategory = sectionToCategory(targetSectionKey);
    if (!targetCategory || !onMoveSingle) return;
    setDragTile(null);
    // Apply optimistic update immediately so the UI doesn't wait for 3+ API round-trips
    setOptimisticDeck(prev => applyOptimisticMove(prev ?? deck, tile.printingId, tile.category, targetCategory));
    await onMoveSingle(tile.printingId, tile.category, targetCategory, tile.totalQty);
  }, [onMoveSingle, deck]);

  const [highlightFilters, setHighlightFilters] = useState<Array<{ stat: string; value: number | string }>>([]);

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const toggleSection = (key: string) => setCollapsedSections(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const renderCardRows = (cards: DeckPrintingDTO[], category: DeckCategory) => {
    const groups = groupByCardName(cards);
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {groups.map(group => (
          <GroupedCardRow
            key={group.uid}
            group={group}
            category={category}
            ownershipMap={ownershipMap}
            onSwap={onSwap}
            onRemove={handleRemove}
            removingId={removingId}
            onMove={onMove}
            onHoverImage={(url, name) => setHoveredImage({ url, name })}
            onClearImage={() => setHoveredImage(null)}
          />
        ))}
      </div>
    );
  };

  const renderSection = (label: string, cards: DeckPrintingDTO[], category: DeckCategory, sectionKey: string, limit?: string, alwaysShow?: boolean) => {
    if (cards.length === 0 && !alwaysShow) return null;
    const total = cards.reduce((s, c) => s + (c.quantity ?? 1), 0);
    const isCollapsed = collapsedSections.has(sectionKey);
    return (
      <div className="mb-6">
        <button
          type="button"
          onClick={() => toggleSection(sectionKey)}
          className="w-full flex items-center gap-2 mb-2 text-left group"
        >
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</span>
          <span className="text-xs font-normal text-gray-400">
            {total} card{total !== 1 ? "s" : ""}{limit && ` / ${limit}`}
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 text-gray-400 ml-auto transition-transform shrink-0", isCollapsed && "-rotate-90")} />
        </button>
        {!isCollapsed && (
          cards.length > 0
            ? renderCardRows(cards, category)
            : <p className="text-xs text-gray-400 dark:text-gray-600 py-1">No cards yet</p>
        )}
      </div>
    );
  };

  const renderMaindeckSection = (cards: DeckPrintingDTO[], limit?: string) => {
    const total = cards.reduce((s, c) => s + (c.quantity ?? 1), 0);
    const isCollapsed = collapsedSections.has('maindeck');

    const red      = cards.filter(c => (c.printingDetails?.pitch as number | undefined) === 1);
    const yellow   = cards.filter(c => (c.printingDetails?.pitch as number | undefined) === 2);
    const blue     = cards.filter(c => (c.printingDetails?.pitch as number | undefined) === 3);
    const unpitched = cards.filter(c => !(c.printingDetails?.pitch as number | undefined));

    // Always show red/yellow/blue so users can see which zones to add cards to
    const pitchGroups: Array<{ key: string; label: string; dot: string; cards: DeckPrintingDTO[] }> = [];
    pitchGroups.push({ key: 'maindeck-red',    label: 'Red',    dot: 'bg-red-500',    cards: red });
    pitchGroups.push({ key: 'maindeck-yellow', label: 'Yellow', dot: 'bg-yellow-400', cards: yellow });
    pitchGroups.push({ key: 'maindeck-blue',   label: 'Blue',   dot: 'bg-blue-500',   cards: blue });
    if (unpitched.length) pitchGroups.push({ key: 'maindeck-unpitched', label: 'Unpitched', dot: 'bg-gray-400', cards: unpitched });

    return (
      <div className="mb-6">
        <button
          type="button"
          onClick={() => toggleSection('maindeck')}
          className="w-full flex items-center gap-2 mb-2 text-left group"
        >
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Main Deck</span>
          <span className="text-xs font-normal text-gray-400">
            {total} card{total !== 1 ? "s" : ""}{limit && ` / ${limit}`}
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 text-gray-400 ml-auto transition-transform shrink-0", isCollapsed && "-rotate-90")} />
        </button>
        {!isCollapsed && (
          <div className="space-y-3">
            {pitchGroups.map(pg => {
              const pgCollapsed = collapsedSections.has(pg.key);
              const pgTotal = pg.cards.reduce((s, c) => s + (c.quantity ?? 1), 0);
              return (
                <div key={pg.key}>
                  <button
                    type="button"
                    onClick={() => toggleSection(pg.key)}
                    className="flex items-center gap-2 mb-1.5 text-left w-full"
                  >
                    <span className={cn("w-2 h-2 rounded-full shrink-0", pg.dot)} />
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{pg.label}</span>
                    <span className="text-xs text-gray-400">({pgTotal})</span>
                    <ChevronDown className={cn("h-3 w-3 text-gray-500 ml-auto transition-transform shrink-0", pgCollapsed && "-rotate-90")} />
                  </button>
                  {!pgCollapsed && (
                    pg.cards.length > 0
                      ? renderCardRows(pg.cards, 'maindeck')
                      : <p className="text-xs text-gray-400 dark:text-gray-600 py-1">No cards yet</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ─── Highlight filter helpers ───────────────────────────────────────────────

  const getStatCount = (stat: string, value: number | string): number => {
    const allCards = [...(displayDeck.maindeck || []), ...(displayDeck.equipment || [])];
    const threshold = typeof value === 'string' && value.endsWith('+') ? parseInt(value) : null;
    return allCards.reduce((sum, c) => {
      const v = (c.printingDetails as any)?.[stat] as number | undefined;
      if (v == null) return sum;
      if (threshold !== null) return v >= threshold ? sum + (c.quantity ?? 1) : sum;
      return v === value ? sum + (c.quantity ?? 1) : sum;
    }, 0);
  };

  const matchingPrintingIds: Set<string> | null = highlightFilters.length > 0
    ? (() => {
        const ids = new Set<string>();
        const allCards = [
          ...(displayDeck.maindeck || []),
          ...(displayDeck.equipment || []),
          ...(displayDeck.inventory || []),
          ...(displayDeck.benched || []),
        ];
        for (const c of allCards) {
          const details = c.printingDetails as any;
          const passes = highlightFilters.every(f => {
            const v = details?.[f.stat] as number | undefined;
            if (v == null) return false;
            const threshold = typeof f.value === 'string' && f.value.endsWith('+') ? parseInt(f.value) : null;
            return threshold !== null ? v >= threshold : v === f.value;
          });
          if (passes) ids.add(c.printingId);
        }
        return ids;
      })()
    : null;

  const matchesGameCard = (card: GameViewCard): boolean | null => {
    if (highlightFilters.length === 0) return null;
    // Pitch not applicable in game view (cards grouped by name across all pitch variants)
    const nonPitchFilters = highlightFilters.filter(f => f.stat !== 'pitch');
    if (nonPitchFilters.length === 0) return null;
    return nonPitchFilters.every(f => {
      const v = (card as any)[f.stat] as number | undefined;
      if (v == null) return false;
      const threshold = typeof f.value === 'string' && f.value.endsWith('+') ? parseInt(f.value) : null;
      return threshold !== null ? v >= threshold : v === f.value;
    });
  };

  const toggleHighlight = (stat: string, value: number | string) => {
    setHighlightFilters(prev => {
      const exact = prev.find(f => f.stat === stat && f.value === value);
      if (exact) {
        // Same button clicked again — remove it
        return prev.filter(f => !(f.stat === stat && f.value === value));
      }
      const sameStat = prev.find(f => f.stat === stat);
      if (sameStat) {
        // Different value for same stat — replace it
        return prev.map(f => f.stat === stat ? { stat, value } : f);
      }
      // New stat — AND it in
      return [...prev, { stat, value }];
    });
  };

  const heroCards = displayDeck.hero || [];
  const equipmentCards = displayDeck.equipment || [];
  const maindeckCards = displayDeck.maindeck || [];
  const inventoryCards = displayDeck.inventory || [];
  const benchedCards = displayDeck.benched || [];

  if (!heroCards.length && !equipmentCards.length && !maindeckCards.length && !inventoryCards.length && !benchedCards.length) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
        <p className="font-medium">This deck is empty.</p>
        <p className="text-sm mt-1">Use the Search tab to find cards to add.</p>
      </div>
    );
  }

  const tileSections = buildTileSections(displayDeck);
  // Hero is embedded in the equipment section header — not a standalone section
  const heroPortrait = tileSections.find(s => s.key === 'hero')?.tiles[0] ?? null;
  const tileTopSections = tileSections.filter(s => s.key === 'equipment');
  const tileRestSections = tileSections.filter(s => s.key !== 'hero' && s.key !== 'equipment');

  const tileSharedProps = {
    onHover: (url: string, name: string) => setHoveredImage({ url, name }),
    onLeave: () => setHoveredImage(null),
    onSwap: canEdit ? onSwap : undefined,
    ownershipMap,
    isTileDraggable: canEdit && !!onMoveSingle,
    activeDragTile: dragTile,
    onTileDragStart: (tile: DeckTileCard) => setDragTile(tile),
    onTileDragEnd: () => setDragTile(null),
    onSectionDrop: handleSectionDrop,
    onAddCard: canEdit ? onAddCard : undefined,
    onRemoveTile: canEdit ? handleTileRemoveOne : undefined,
    onMoveToInventory: canEdit && onMoveSingle ? handleTileMoveToInventory : undefined,
    onAddTile: canEdit ? handleTileAddOne : undefined,
    onEnlargeImage: (url: string, name: string) => setEnlargedImage({ url, name }),
    onAddToBinder: onAddToBinder,
    onAddToWants: onAddToWants,
    highlightMatchIds: matchingPrintingIds,
    tileWidth,
  };

  return (
    <>
      {/* View toggle + legend */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
        <div className="flex rounded border border-gray-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={cn(
              "px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors",
              viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:bg-gray-800',
            )}
          >
            <List className="h-3.5 w-3.5" />List
          </button>
          <button
            type="button"
            onClick={() => setViewMode('tile')}
            className={cn(
              "px-3 py-1.5 text-xs flex items-center gap-1.5 border-l border-gray-700 transition-colors",
              viewMode === 'tile' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:bg-gray-800',
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />Tiles
          </button>
          <button
            type="button"
            onClick={() => setViewMode('game')}
            className={cn(
              "px-3 py-1.5 text-xs flex items-center gap-1.5 border-l border-gray-700 transition-colors",
              viewMode === 'game' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:bg-gray-800',
            )}
          >
            <Layers className="h-3.5 w-3.5" />Game
          </button>
        </div>

        {/* Tile size stepper — only for tile/game views */}
        {(viewMode === 'tile' || viewMode === 'game') && (
          <div className="flex items-center gap-1 rounded border border-gray-700 overflow-hidden text-xs">
            <span className="px-2 text-gray-500 hidden sm:inline border-r border-gray-700 py-1.5">Tile Size</span>
            <button
              type="button"
              disabled={tileSizeIdx === 0}
              onClick={() => setTileSizeKey(TILE_SIZES[tileSizeIdx - 1].key)}
              className="px-2 py-1.5 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Smaller tiles"
            >−</button>
            <span className="px-2 py-1.5 text-gray-300 min-w-[52px] text-center">{TILE_SIZES[tileSizeIdx].label}</span>
            <button
              type="button"
              disabled={tileSizeIdx === TILE_SIZES.length - 1}
              onClick={() => setTileSizeKey(TILE_SIZES[tileSizeIdx + 1].key)}
              className="px-2 py-1.5 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Larger tiles"
            >+</button>
          </div>
        )}
        </div>

        {(viewMode === 'tile' || viewMode === 'game') && (
          <div className="hidden sm:flex items-center gap-3 text-[10px] text-gray-500 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 border border-black/20 shrink-0" />
              owned
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 border border-black/20 shrink-0" />
              unowned
            </span>
            {canEdit && onMoveSingle && (
              <span className="flex items-center gap-1">
                <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
                </svg>
                drag to move
              </span>
            )}
            {canEdit && (
              <span className="flex items-center gap-1">
                <ArrowLeftRight className="h-2.5 w-2.5 shrink-0" />
                click to swap
              </span>
            )}
            {canEdit && onRemoveTile && (
              <span className="flex items-center gap-1">
                <X className="h-2.5 w-2.5 shrink-0" />
                hover to remove
              </span>
            )}
            {onAddToBinder && binders && binders.length > 0 && (
              <span className="flex items-center gap-1.5 border-l border-gray-700 pl-3 ml-1">
                <BookmarkPlus className="h-2.5 w-2.5 shrink-0" />
                add to:
                <Select value={selectedBinderId} onValueChange={onBinderChange}>
                  <SelectTrigger className="h-5 text-[10px] px-1.5 py-0 border-gray-600 bg-transparent min-w-[90px] gap-1">
                    <SelectValue placeholder="Select binder" />
                  </SelectTrigger>
                  <SelectContent>
                    {binders.map(b => (
                      <SelectItem key={b._id} value={b._id} className="text-xs">
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </span>
            )}
            {canEdit && onUpgradePrintings && (
              <button
                type="button"
                onClick={handleUpgradePrintings}
                disabled={isUpgrading}
                className="flex items-center gap-1.5 border-l border-gray-700 pl-3 ml-1 text-[10px] text-emerald-400 hover:text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Swap unowned printings to the highest-value printing you own of the same card"
              >
                {isUpgrading
                  ? <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin" />
                  : <ArrowLeftRight className="h-2.5 w-2.5 shrink-0" />
                }
                Update to owned printings
              </button>
            )}
          </div>
        )}
      </div>

      {/* Highlight filter bar */}
      {(viewMode === 'tile' || viewMode === 'game') && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-3 px-2 py-1.5 bg-gray-800/40 rounded-lg border border-gray-700/50 text-[10px]">
          <span className="font-semibold text-gray-400 uppercase tracking-wide shrink-0">Highlight</span>

          {/* Pitch filter — icon conveys value (1/2/3 red dots) */}
          <div className="flex items-center gap-1">
            {([1, 2, 3] as const).map(v => {
              const count = getStatCount('pitch', v);
              const isActive = highlightFilters.some(f => f.stat === 'pitch' && f.value === v);
              return (
                <button
                  key={v}
                  onClick={() => count > 0 && toggleHighlight('pitch', v)}
                  className={cn(
                    "flex items-center gap-0.5 px-0.5 py-0.5 rounded transition-all",
                    isActive ? "bg-amber-500 ring-1 ring-amber-400/80" : count > 0 ? "bg-gray-700 hover:bg-gray-600" : "opacity-30 cursor-default",
                  )}
                >
                  <img src={`/fab/symbols/pitch${v}.png`} alt={`Pitch ${v}`} className="w-5 h-5 object-contain" />
                </button>
              );
            })}
          </div>

          {/* Cost filter — number overlaid in center of swirl icon */}
          <div className="flex items-center gap-1">
            {([0, 1, 2, 3, 4, '5+'] as const).map(v => {
              const count = getStatCount('cost', v);
              const isActive = highlightFilters.some(f => f.stat === 'cost' && f.value === v);
              return (
                <button
                  key={String(v)}
                  onClick={() => count > 0 && toggleHighlight('cost', v)}
                  className={cn(
                    "flex items-center gap-0.5 px-0.5 py-0.5 rounded transition-all",
                    isActive ? "bg-amber-500 ring-1 ring-amber-400/80" : count > 0 ? "bg-gray-700 hover:bg-gray-600" : "opacity-30 cursor-default",
                  )}
                >
                  <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
                    <img src="/fab/symbols/cost.png" alt="Cost" className="w-5 h-5 object-contain" />
                    <span className="absolute font-bold text-[8px] leading-none text-white drop-shadow-[0_0_2px_rgba(0,0,0,1)]">
                      {String(v)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Power filter — number to left of symbol */}
          <div className="flex items-center gap-1">
            {([3, 4, 5, 6, '7+'] as const).map(v => {
              const count = getStatCount('power', v);
              const isActive = highlightFilters.some(f => f.stat === 'power' && f.value === v);
              return (
                <button
                  key={String(v)}
                  onClick={() => count > 0 && toggleHighlight('power', v)}
                  className={cn(
                    "flex items-center gap-0.5 px-1 py-0.5 rounded transition-all",
                    isActive ? "bg-amber-500 ring-1 ring-amber-400/80" : count > 0 ? "bg-gray-700 hover:bg-gray-600" : "opacity-30 cursor-default",
                  )}
                >
                  <span className={cn("font-medium", isActive ? "text-white" : "text-gray-200")}>{String(v)}</span>
                  <img src="/fab/symbols/power.png" alt="Power" className="w-4 h-4 object-contain" />
                </button>
              );
            })}
          </div>

          {/* Block filter — number to left of symbol */}
          <div className="flex items-center gap-1">
            {([0, 2, 3, 4] as const).map(v => {
              const count = getStatCount('defense', v);
              const isActive = highlightFilters.some(f => f.stat === 'defense' && f.value === v);
              return (
                <button
                  key={String(v)}
                  onClick={() => count > 0 && toggleHighlight('defense', v)}
                  className={cn(
                    "flex items-center gap-0.5 px-1 py-0.5 rounded transition-all",
                    isActive ? "bg-amber-500 ring-1 ring-amber-400/80" : count > 0 ? "bg-gray-700 hover:bg-gray-600" : "opacity-30 cursor-default",
                  )}
                >
                  <span className={cn("font-medium", isActive ? "text-white" : "text-gray-200")}>{String(v)}</span>
                  <img src="/fab/symbols/block.png" alt="Block" className="w-4 h-4 object-contain" />
                </button>
              );
            })}
          </div>

          {highlightFilters.length > 0 && (
            <button
              onClick={() => setHighlightFilters([])}
              className="ml-auto flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-3 w-3" />clear
            </button>
          )}
        </div>
      )}

      {viewMode === 'list' ? (
        <div>
          {renderSection("Hero", heroCards, "hero", "hero", "1")}
          {renderSection("Equipment", equipmentCards, "equipment", "equipment", "5", true)}
          {renderMaindeckSection(maindeckCards, "60+")}
          {renderSection("Inventory", inventoryCards, "inventory", "inventory", undefined, true)}
          {renderSection("Bench", benchedCards, "benched", "bench")}
        </div>
      ) : viewMode === 'tile' ? (
        <div className="rounded border border-gray-700/50 p-2">
          {tileTopSections.map(s => (
            <DeckTileSection
              key={s.key}
              section={s}
              {...tileSharedProps}
              heroPortrait={heroPortrait}
            />
          ))}
          {tileRestSections.map(s => (
            <DeckTileSection key={s.key} section={s} {...tileSharedProps} />
          ))}
        </div>
      ) : (
        /* Game view — one tile per card name, R/Y/B pitch count bubbles */
        <div className="rounded border border-gray-700/50 p-2">
          {buildGameViewSections(displayDeck).map(section => {
            const sectionTotal = section.cards.reduce((s, c) => s + c.totalQty, 0);
            const sectionCollapseKey = `game-${section.key}`;
            const isSectionCollapsed = collapsedSections.has(sectionCollapseKey);
            const gameZoneAccent: Record<string, { bg: string; border: string; headerBorder: string; labelColor: string }> = {
              red:       { bg: "bg-red-500/10 dark:bg-red-500/[0.06]",       border: "border-l-[3px] border-l-red-500 rounded-r-lg",    headerBorder: "border-red-500/30",    labelColor: "text-red-600 dark:text-red-400" },
              yellow:    { bg: "bg-yellow-400/10 dark:bg-yellow-400/[0.05]", border: "border-l-[3px] border-l-yellow-400 rounded-r-lg", headerBorder: "border-yellow-400/30", labelColor: "text-yellow-600 dark:text-yellow-400" },
              blue:      { bg: "bg-blue-500/10 dark:bg-blue-500/[0.05]",     border: "border-l-[3px] border-l-blue-500 rounded-r-lg",   headerBorder: "border-blue-500/30",   labelColor: "text-blue-600 dark:text-blue-400" },
              unpitched: { bg: "bg-gray-500/5 dark:bg-gray-400/[0.04]",     border: "border-l-[3px] border-l-gray-400 rounded-r-lg",   headerBorder: "border-gray-500/40",   labelColor: "text-gray-600 dark:text-gray-300" },
              equipment: { bg: "",  border: "rounded-lg", headerBorder: "border-gray-700/40", labelColor: "text-gray-600 dark:text-gray-300" },
              inventory: { bg: "",  border: "rounded-lg", headerBorder: "border-gray-700/40", labelColor: "text-gray-600 dark:text-gray-300" },
              bench:     { bg: "",  border: "rounded-lg", headerBorder: "border-gray-700/40", labelColor: "text-gray-600 dark:text-gray-300" },
            };
            const gameAccent = gameZoneAccent[section.key] ?? gameZoneAccent.unpitched;
            return (
              <div key={section.key} className={cn("mb-3 p-1 transition-all", gameAccent.bg, gameAccent.border)}>
                <button
                  type="button"
                  onClick={() => toggleSection(sectionCollapseKey)}
                  className={cn("w-full flex items-center gap-1.5 px-0.5 pb-1 mb-1 border-b text-left", gameAccent.headerBorder)}
                >
                  {section.key === 'equipment' && heroPortrait && (
                    <>
                      <div
                        className="relative flex-shrink-0 rounded overflow-hidden ring-[1.5px] ring-yellow-400/70 cursor-pointer"
                        style={{ width: 28 }}
                        title={heroPortrait.name}
                        onMouseEnter={(e) => { e.stopPropagation(); heroPortrait.imageUrl && setHoveredImage({ url: heroPortrait.imageUrl, name: heroPortrait.name }); }}
                        onMouseLeave={() => setHoveredImage(null)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={heroPortrait.imageUrl || '/cardback.webp'}
                          alt={heroPortrait.name}
                          className="w-full block"
                          style={{ aspectRatio: '63/88', objectFit: 'cover', objectPosition: 'top' }}
                          draggable={false}
                        />
                        <div className="absolute bottom-0 left-0 right-0 text-[5px] text-center bg-black/50 text-yellow-300 uppercase tracking-widest leading-3 py-px">
                          hero
                        </div>
                      </div>
                      <div className="w-px self-stretch bg-gray-600/50 mx-0.5 flex-shrink-0" />
                      {isSectionCollapsed && section.cards.map(card => (
                        <div
                          key={card.name}
                          className="relative flex-shrink-0 rounded overflow-hidden ring-[1.5px] ring-gray-500"
                          style={{ width: 28 }}
                          title={card.name}
                          onMouseEnter={(e) => { e.stopPropagation(); card.imageUrl && setHoveredImage({ url: card.imageUrl, name: card.name }); }}
                          onMouseLeave={() => setHoveredImage(null)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={card.imageUrl || '/cardback.webp'}
                            alt={card.name}
                            className="w-full block"
                            style={{ aspectRatio: '63/88', objectFit: 'cover', objectPosition: 'top' }}
                            draggable={false}
                          />
                        </div>
                      ))}
                    </>
                  )}
                  {section.pitchColor && (
                    <span className={cn("inline-block w-2 h-2 rounded-full flex-shrink-0", section.pitchColor)} />
                  )}
                  <span className={cn("text-[10px] font-bold uppercase tracking-wider", gameAccent.labelColor)}>
                    {section.title}
                  </span>
                  <span className={cn(
                    "text-[10px]",
                    section.key === 'red'    ? "text-red-500/70 dark:text-red-400/60" :
                    section.key === 'yellow' ? "text-yellow-500/70 dark:text-yellow-400/60" :
                    section.key === 'blue'   ? "text-blue-500/70 dark:text-blue-400/60" :
                    "text-gray-500"
                  )}>({sectionTotal})</span>
                  <ChevronDown className={cn("h-3 w-3 text-gray-500 ml-auto transition-transform shrink-0", isSectionCollapsed && "-rotate-90")} />
                </button>
                {!isSectionCollapsed && <div className="flex flex-wrap gap-1">
                  {section.cards.map(card => {
                    const gameHighlight = matchesGameCard(card);
                    return (
                    <div
                      key={card.name}
                      className={cn(
                        "relative rounded ring-[1.5px] ring-gray-400 dark:ring-gray-500 transition-all duration-150",
                        gameHighlight === true && "ring-2 ring-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]",
                        gameHighlight === false && "opacity-25 scale-95 grayscale",
                      )}
                      style={{ width: tileWidth }}
                      onMouseEnter={() => card.imageUrl && setHoveredImage({ url: card.imageUrl, name: card.name })}
                      onMouseLeave={() => setHoveredImage(null)}
                    >
                      {card.imageUrl ? (
                        <div className="w-full overflow-hidden rounded" style={{ aspectRatio: '63/53' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={card.imageUrl}
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
                      {/* Qty badge — show only the relevant pitch for library sections */}
                      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-0.5 pb-0.5 px-0.5">
                        {section.key === 'red'      && card.redQty > 0      && <span className="bg-red-500 text-white text-xs min-w-[22px] px-1.5 py-1 rounded-full font-bold leading-none text-center border-2 border-white/90 shadow">{card.redQty}</span>}
                        {section.key === 'yellow'   && card.yellowQty > 0   && <span className="bg-yellow-400 text-gray-900 text-xs min-w-[22px] px-1.5 py-1 rounded-full font-bold leading-none text-center border-2 border-white/90 shadow">{card.yellowQty}</span>}
                        {section.key === 'blue'     && card.blueQty > 0     && <span className="bg-blue-500 text-white text-xs min-w-[22px] px-1.5 py-1 rounded-full font-bold leading-none text-center border-2 border-white/90 shadow">{card.blueQty}</span>}
                        {section.key === 'unpitched' && card.noPitchQty > 0 && <span className="bg-gray-500 text-white text-xs min-w-[22px] px-1.5 py-1 rounded-full font-bold leading-none text-center border-2 border-white/90 shadow">{card.noPitchQty}</span>}
                        {(section.key === 'equipment' || section.key === 'inventory' || section.key === 'bench') && (
                          <>
                            {card.redQty > 0    && <span className="bg-red-500 text-white text-xs min-w-[22px] px-1.5 py-1 rounded-full font-bold leading-none text-center border-2 border-white/90 shadow">{card.redQty}</span>}
                            {card.yellowQty > 0 && <span className="bg-yellow-400 text-gray-900 text-xs min-w-[22px] px-1.5 py-1 rounded-full font-bold leading-none text-center border-2 border-white/90 shadow">{card.yellowQty}</span>}
                            {card.blueQty > 0   && <span className="bg-blue-500 text-white text-xs min-w-[22px] px-1.5 py-1 rounded-full font-bold leading-none text-center border-2 border-white/90 shadow">{card.blueQty}</span>}
                            {card.noPitchQty > 0 && <span className="bg-gray-500 text-white text-xs min-w-[22px] px-1.5 py-1 rounded-full font-bold leading-none text-center border-2 border-white/90 shadow">{card.noPitchQty}</span>}
                          </>
                        )}
                      </div>
                    </div>
                  );
                  })}
                </div>}
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'list' && hoveredImage && (
        <HoverImagePreview imageUrl={hoveredImage.url} cardName={hoveredImage.name} />
      )}
      {(viewMode === 'tile' || viewMode === 'game') && hoveredImage && !dragTile && !enlargedImage && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            ...(mouseXRef.current < window.innerWidth / 2 ? { right: 16 } : { left: 16 }),
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hoveredImage.url} alt={hoveredImage.name} className="w-56 rounded-xl shadow-2xl border border-gray-600" />
        </div>
      )}

      {/* Lightbox */}
      {enlargedImage && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer"
          onClick={() => setEnlargedImage(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enlargedImage.url}
            alt={enlargedImage.name}
            className="max-h-[90vh] max-w-[min(90vw,400px)] rounded-xl shadow-2xl border border-gray-600"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
