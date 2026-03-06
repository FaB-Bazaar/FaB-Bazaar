"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, ArrowLeftRight, Loader2, Archive, ArchiveRestore, Sofa, ChevronRight, ChevronDown, List, LayoutGrid } from "lucide-react";
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
    if (category === "maindeck") {
      dests.push({ to: "inventory", label: "Move to Inventory", icon: <Archive className="h-3 w-3" /> });
      dests.push({ to: "benched", label: "Move to Bench", icon: <Sofa className="h-3 w-3" /> });
    } else if (category === "equipment") {
      dests.push({ to: "inventory", label: "Move to Inventory", icon: <Archive className="h-3 w-3" /> });
    } else if (category === "inventory") {
      dests.push({ to: "maindeck", label: "Move to Library", icon: <ArchiveRestore className="h-3 w-3" /> });
      dests.push({ to: "benched", label: "Move to Bench", icon: <Sofa className="h-3 w-3" /> });
    } else if (category === "benched") {
      dests.push({ to: "maindeck", label: "Move to Library", icon: <ArchiveRestore className="h-3 w-3" /> });
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
}

interface DeckTileSectionData {
  key: TileSectionKey;
  title: string;
  pitchColor?: string;
  tiles: DeckTileCard[];
}

function classifyTileCard(printing: DeckPrintingDTO, category: DeckCategory): TileSectionKey {
  const types = ((printing.printingDetails?.types as string[] | undefined) || []).map(t => t.toLowerCase());
  if (category === 'hero') return 'hero';
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
      if (!sectionMap.has(sectionKey)) sectionMap.set(sectionKey, []);
      const tiles = sectionMap.get(sectionKey)!;
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
        });
      }
    }
  };

  addCards(deck.hero || [], 'hero');
  addCards(deck.equipment || [], 'equipment');
  addCards(deck.maindeck || [], 'maindeck');
  addCards(deck.inventory || [], 'inventory');
  addCards(deck.benched || [], 'benched');

  const sections: DeckTileSectionData[] = [];
  for (const [key, tiles] of sectionMap) {
    // Sort alphabetically by name for stable ordering across refreshes
    tiles.sort((a, b) => a.name.localeCompare(b.name));
    const label = TILE_SECTION_LABELS[key];
    sections.push({ key, title: label.title, pitchColor: label.pitchColor, tiles });
  }
  return sections.sort((a, b) => TILE_SECTION_ORDER[a.key] - TILE_SECTION_ORDER[b.key]);
}

function DeckTileSection({
  section, onHover, onLeave, onSwap, ownershipMap,
}: {
  section: DeckTileSectionData;
  onHover: (url: string, name: string) => void;
  onLeave: () => void;
  onSwap?: (target: SwapTarget) => void;
  ownershipMap: Map<string, OwnershipEntry>;
}) {
  const isHeroSection = section.key === 'hero';
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 px-0.5 pb-1 mb-1 border-b border-gray-700/40">
        {section.pitchColor && (
          <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${section.pitchColor}`} />
        )}
        <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {section.title}
        </span>
        <span className="text-[10px] text-gray-500">({section.tiles.length})</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {section.tiles.map(tile => {
          const own = ownershipMap.get(tile.printingId);
          // Per-copy: this specific tile is owned if copyIndex < owned count
          const ownershipState = !own ? null
            : tile.copyIndex < own.owned ? 'full'
            : 'missing';
          return (
            <div
              key={tile.key}
              title={onSwap ? `${tile.name} — click to swap printing` : tile.name}
              onMouseEnter={() => tile.imageUrl && onHover(tile.imageUrl, tile.name)}
              onMouseLeave={onLeave}
              onClick={() => onSwap?.({ printingId: tile.printingId, cardUniqueId: tile.cardUniqueId, cardName: tile.name, category: tile.category })}
              className={`relative rounded select-none group ${isHeroSection ? 'ring-2 ring-white/60' : 'ring-[1.5px] ring-gray-400 dark:ring-gray-500'} ${onSwap ? 'cursor-pointer' : 'cursor-default'}`}
              style={{ width: '72px' }}
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

              {/* Ownership dot */}
              {ownershipState !== null && (
                <div className={`absolute top-0.5 right-0.5 w-2 h-2 rounded-full border border-black/20 ${
                  ownershipState === 'full'    ? 'bg-green-400' :
                  ownershipState === 'partial' ? 'bg-amber-400' :
                  'bg-red-500'
                }`} />
              )}

              {/* Swap hint on hover */}
              {onSwap && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 rounded transition-opacity pointer-events-none">
                  <ArrowLeftRight className="h-3.5 w-3.5 text-white" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

interface DeckEditorListViewProps {
  deck: DeckDTO;
  ownershipMap: Map<string, OwnershipEntry>;
  onSwap: (target: SwapTarget) => void;
  onRemove: (printingId: string, category: DeckCategory) => Promise<void>;
  onMove?: (printingId: string, fromCategory: DeckCategory, toCategory: DeckCategory, quantity: number) => Promise<void>;
  canEdit?: boolean;
}

export default function DeckEditorListView({ deck, ownershipMap, onSwap, onRemove, onMove, canEdit }: DeckEditorListViewProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [hoveredImage, setHoveredImage] = useState<{ url: string; name: string } | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'tile'>('list');

  const handleRemove = async (printingId: string, category: DeckCategory) => {
    setRemovingId(printingId);
    try {
      await onRemove(printingId, category);
    } finally {
      setRemovingId(null);
    }
  };

  const renderSection = (label: string, cards: DeckPrintingDTO[], category: DeckCategory, limit?: string) => {
    if (cards.length === 0) return null;
    const groups = groupByCardName(cards);
    const total = cards.reduce((s, c) => s + (c.quantity ?? 1), 0);
    return (
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
          {label}
          <span className="text-xs font-normal text-gray-400">
            {total} card{total !== 1 ? "s" : ""}
            {limit && ` / ${limit}`}
          </span>
        </h3>
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
      </div>
    );
  };

  const heroCards = deck.hero || [];
  const equipmentCards = deck.equipment || [];
  const maindeckCards = deck.maindeck || [];
  const inventoryCards = deck.inventory || [];
  const benchedCards = deck.benched || [];

  if (!heroCards.length && !equipmentCards.length && !maindeckCards.length && !inventoryCards.length && !benchedCards.length) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
        <p className="font-medium">This deck is empty.</p>
        <p className="text-sm mt-1">Use the Search tab to find cards to add.</p>
      </div>
    );
  }

  const tileSections = buildTileSections(deck);
  const tileTopSections = tileSections.filter(s => s.key === 'hero' || s.key === 'equipment');
  const tileRestSections = tileSections.filter(s => s.key !== 'hero' && s.key !== 'equipment');

  return (
    <>
      {/* View toggle + legend */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex rounded border border-gray-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-2 py-1 text-[10px] flex items-center gap-1 transition-colors ${viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:bg-gray-800'}`}
          >
            <List className="h-3 w-3" />List
          </button>
          <button
            type="button"
            onClick={() => setViewMode('tile')}
            className={`px-2 py-1 text-[10px] flex items-center gap-1 border-l border-gray-700 transition-colors ${viewMode === 'tile' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:bg-gray-800'}`}
          >
            <LayoutGrid className="h-3 w-3" />Tiles
          </button>
        </div>

        {viewMode === 'tile' && (
          <div className="flex items-center gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 border border-black/20 shrink-0" />
              owned
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 border border-black/20 shrink-0" />
              unowned
            </span>
            {canEdit && (
              <span className="flex items-center gap-1">
                <ArrowLeftRight className="h-2.5 w-2.5" />
                click to swap printing
              </span>
            )}
          </div>
        )}
      </div>

      {viewMode === 'list' ? (
        <div>
          {renderSection("Hero", heroCards, "hero", "1")}
          {renderSection("Equipment", equipmentCards, "equipment", "5")}
          {renderSection("Main Deck", maindeckCards, "maindeck", "60+")}
          {renderSection("Inventory", inventoryCards, "inventory")}
          {renderSection("Bench", benchedCards, "benched")}
        </div>
      ) : (
        <div className="rounded border border-gray-700/50 p-2">
          {tileTopSections.length > 0 && (
            <div className="flex gap-4 mb-1">
              {tileTopSections.map(s => (
                <div key={s.key} className="shrink-0">
                  <DeckTileSection
                    section={s}
                    onHover={(url, name) => setHoveredImage({ url, name })}
                    onLeave={() => setHoveredImage(null)}
                    onSwap={canEdit ? onSwap : undefined}
                    ownershipMap={ownershipMap}
                  />
                </div>
              ))}
            </div>
          )}
          {tileRestSections.map(s => (
            <DeckTileSection
              key={s.key}
              section={s}
              onHover={(url, name) => setHoveredImage({ url, name })}
              onLeave={() => setHoveredImage(null)}
              onSwap={canEdit ? onSwap : undefined}
              ownershipMap={ownershipMap}
            />
          ))}
        </div>
      )}

      {viewMode === 'list' && hoveredImage && (
        <HoverImagePreview imageUrl={hoveredImage.url} cardName={hoveredImage.name} />
      )}
      {viewMode === 'tile' && hoveredImage && (
        <div className="fixed z-[9999] pointer-events-none" style={{ left: 16, top: '50%', transform: 'translateY(-50%)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hoveredImage.url} alt={hoveredImage.name} className="w-56 rounded-xl shadow-2xl border border-gray-600" />
        </div>
      )}
    </>
  );
}
