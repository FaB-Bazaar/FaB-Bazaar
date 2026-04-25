"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import HighlightFiltersPopover, { type HighlightFilter as HF } from "./HighlightFiltersPopover";
import { RarityIcon } from "@/components/shared/RarityIcon";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Trash2, ArrowLeftRight, Loader2, Archive, ArchiveRestore, ChevronRight, ChevronDown, List, LayoutGrid, Plus, ZoomIn, BookmarkPlus, BookOpen, Layers, Heart, Eye } from "lucide-react";
import { TcgAffiliateLink } from "@/components/tracking";
import FoilCardImage from "@/components/shared/FoilCardImage";
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

// Optional extras passed through onHover handlers up to the rail-level preview.
// Older / simpler callers may omit them.
type HoverExtras = {
  tcgplayerUrl?: string;
  tcgLow?: number;
  otherFaceUrl?: string;
};

// Extract data-dense list view fields from a printing (cost, P/D, type, class).
// Card-level fields are identical across reprints, so we read from the first printing.
const NON_CLASS_TYPE_KEYWORDS = new Set([
  'hero', 'young', 'adult', 'token', 'demi-hero', 'evo',
  'equipment', 'weapon', 'arms', 'head', 'chest', 'legs', 'off-hand',
  'one handed', 'two handed', 'one-handed', 'two-handed',
  'action', 'attack', 'instant', 'attack reaction', 'defense reaction',
]);

function getCardSummary(printingDetails: any): {
  cost: number | null;
  power: number | null;
  defense: number | null;
  type: string;
  classLabel: string;
  rarityCode: string | null;
  keywords: string[];
} {
  if (!printingDetails) {
    return { cost: null, power: null, defense: null, type: '', classLabel: '', rarityCode: null, keywords: [] };
  }
  const types: string[] = printingDetails.types || [];
  const lower = types.map(t => t.toLowerCase());

  let type = '';
  if (lower.includes('hero')) type = 'Hero';
  else if (lower.includes('weapon')) type = 'Weapon';
  else if (lower.includes('equipment')) type = 'Equipment';
  else if (lower.includes('attack reaction')) type = 'Atk Reaction';
  else if (lower.includes('defense reaction')) type = 'Def Reaction';
  else if (lower.includes('attack')) type = 'Attack';
  else if (lower.includes('instant')) type = 'Instant';
  else if (lower.includes('action')) type = 'Action';
  else if (lower.includes('token')) type = 'Token';

  // Class/talent: any type entry that isn't a structural keyword (e.g. "Lightning", "Wizard").
  const classWords = types.filter(t => !NON_CLASS_TYPE_KEYWORDS.has(t.toLowerCase()));
  const classLabel = classWords.join(' ');

  const rarityCode = printingDetails.rarity ? String(printingDetails.rarity).toLowerCase() : null;
  // Prefer original-case `keywords_display`; fall back to lowercase `keywords` for rows
  // that haven't been backfilled yet (transition window after migration 0043).
  const displayKeywords: string[] = Array.isArray(printingDetails.keywords_display) ? printingDetails.keywords_display : [];
  const lowercaseKeywords: string[] = Array.isArray(printingDetails.keywords) ? printingDetails.keywords : [];
  const keywords = displayKeywords.length > 0 ? displayKeywords : lowercaseKeywords;

  return {
    cost: typeof printingDetails.cost === 'number' ? printingDetails.cost : null,
    power: typeof printingDetails.power === 'number' ? printingDetails.power : null,
    defense: typeof printingDetails.defense === 'number' ? printingDetails.defense : null,
    type,
    classLabel,
    rarityCode,
    keywords,
  };
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

function HoverImagePreview({ imageUrl, cardName, onDismiss }: { imageUrl: string; cardName: string; onDismiss?: () => void }) {
  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100]" onClick={onDismiss}>
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
  /** Extras carry pricing/tcg info to the rail-level preview. Optional; older callers may omit. */
  onHoverImage: (url: string, name: string, extras?: HoverExtras) => void;
  onClearImage: () => void;
  isTouchDevice: boolean;
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
  isTouchDevice,
}: GroupedCardRowProps) {
  const [expanded, setExpanded] = useState(false);

  const totalOwned = group.printings.reduce((s, pr) => s + (ownershipMap.get(pr.printingId)?.owned ?? 0), 0);
  const hasOwnership = group.printings.some(pr => ownershipMap.has(pr.printingId));
  const isFullyOwned = hasOwnership && totalOwned >= group.totalQty;

  const pitchClass = group.pitch ? PITCH_DOT_CLASS[group.pitch] : "bg-gray-300 dark:bg-gray-600";

  // Card-level data (identical across all printings of the same card)
  const summary = getCardSummary(group.printings[0]?.printingDetails);
  const fmt = (v: number | null) => (v == null ? '—' : String(v));
  const pdLabel = summary.power == null && summary.defense == null ? '—' : `${fmt(summary.power)} / ${fmt(summary.defense)}`;

  const buildMoveButtons = (pr: DeckPrintingDTO) => {
    if (!onMove) return null;
    const qty = pr.quantity ?? 1;
    const dests: Array<{ to: DeckCategory; label: string; icon: React.ReactNode }> = [];
    const types = ((pr.printingDetails?.types as string[] | undefined) || []).map(t => t.toLowerCase());
    if (category === "maindeck") {
      dests.push({ to: "inventory", label: "Move to Inventory", icon: <Archive className="h-3 w-3" /> });
      dests.push({ to: "benched", label: "Move to Bench", icon: <img src="/bench-icon.svg" className="h-3 w-3 dark:invert" alt="Bench" /> });
    } else if (category === "equipment") {
      dests.push({ to: "inventory", label: "Move to Inventory", icon: <Archive className="h-3 w-3" /> });
      dests.push({ to: "benched", label: "Move to Bench", icon: <img src="/bench-icon.svg" className="h-3 w-3 dark:invert" alt="Bench" /> });
    } else if (category === "inventory") {
      dests.push({ to: "maindeck", label: "Move to Library", icon: <ArchiveRestore className="h-3 w-3" /> });
      dests.push({ to: "benched", label: "Move to Bench", icon: <img src="/bench-icon.svg" className="h-3 w-3 dark:invert" alt="Bench" /> });
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
      {/* Group header — data-dense row.
          Stats hug the name on the left; Keywords absorb the remaining row width as flex-1. */}
      <div
        className="flex items-center gap-3 py-1.5 px-3 max-w-[1300px] hover:bg-gray-50 dark:hover:bg-gray-800/50 group"
        onMouseEnter={isTouchDevice ? undefined : () => {
          if (!group.imageUrl) return;
          const pd = group.printings[0]?.printingDetails as any;
          onHoverImage(group.imageUrl, group.displayName, {
            tcgplayerUrl: pd?.tcgplayer_url,
            tcgLow: typeof pd?.tcg_low === 'number' ? pd.tcg_low : undefined,
          });
        }}
        onMouseLeave={isTouchDevice ? undefined : onClearImage}
      >
        {/* Thumbnail */}
        <div className="w-7 h-10 flex-shrink-0 rounded overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer">
          <img
            src={group.imageUrl || "/cardback.webp"}
            alt={group.displayName}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Pitch dot */}
        <span className={cn("w-2 h-2 rounded-full flex-shrink-0", pitchClass)} aria-hidden="true" />

        {/* Name + class as a stacked block; class is the secondary line */}
        <div className="w-64 flex-shrink-0 min-w-0">
          <div className="text-sm text-gray-900 dark:text-gray-100 truncate" title={group.displayName}>{group.displayName}</div>
          {summary.classLabel && (
            <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate" title={summary.classLabel}>
              {summary.classLabel}
            </div>
          )}
        </div>

        {/* Type */}
        <span className="hidden md:block text-xs text-gray-500 dark:text-gray-400 w-24 truncate flex-shrink-0" title={summary.type || 'Type'}>
          {summary.type || '—'}
        </span>

        {/* Rarity — uses the shared RarityIcon component for consistent treatment across the app */}
        <span className="hidden sm:flex w-6 items-center justify-center flex-shrink-0">
          {summary.rarityCode
            ? <RarityIcon rarityCode={summary.rarityCode} size="sm" />
            : <span className="text-xs text-gray-400 dark:text-gray-500">—</span>}
        </span>

        {/* Cost */}
        <span className="hidden sm:block text-xs text-gray-500 dark:text-gray-400 w-8 text-right tabular-nums flex-shrink-0" title="Cost">
          {fmt(summary.cost)}
        </span>

        {/* Power / Defense */}
        <span className="hidden sm:block text-xs text-gray-500 dark:text-gray-400 w-14 text-right tabular-nums flex-shrink-0" title="Power / Defense">
          {pdLabel}
        </span>

        {/* Keywords — fills the remaining horizontal space; truncates if too many */}
        <span className="hidden lg:block text-xs text-gray-500 dark:text-gray-400 flex-1 min-w-0 truncate" title={summary.keywords.join(', ')}>
          {summary.keywords.join(', ')}
        </span>

        {/* Quantity */}
        <span className="text-sm text-gray-700 dark:text-gray-200 tabular-nums w-10 text-right flex-shrink-0">{group.totalQty}×</span>

        {/* Ownership */}
        <span className="w-4 text-center flex-shrink-0">
          {hasOwnership ? (
            isFullyOwned
              ? <span className="text-xs text-emerald-600/90 dark:text-emerald-400/90">✓</span>
              : <span className="text-xs text-amber-700/70 dark:text-amber-300/70">○</span>
          ) : null}
        </span>

        {/* Expand caret */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
          title={expanded ? "Collapse printings" : "Expand printings"}
          aria-label={expanded ? "Collapse printings" : "Expand printings"}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded printing rows — left keyline makes the parent → child hierarchy explicit */}
      {expanded && (
        <div className="ml-6 pl-6 border-l-2 border-amber-400/30 bg-gray-50/50 dark:bg-gray-800/20 max-w-[1100px]">
          {group.printings.map(pr => {
            const prImageUrl = pr.printingDetails?.image_url as string | undefined;
            const own = ownershipMap.get(pr.printingId);
            const isRemoving = removingId === pr.printingId;
            return (
              <div
                key={pr.printingId}
                className="flex items-center gap-2 py-1 px-3 hover:bg-gray-100 dark:hover:bg-gray-800/50 group/pr border-t border-gray-100 dark:border-gray-800"
                onMouseEnter={isTouchDevice ? undefined : () => {
                  if (!prImageUrl) return;
                  const pd = pr.printingDetails as any;
                  onHoverImage(prImageUrl, group.displayName, {
                    tcgplayerUrl: pd?.tcgplayer_url,
                    tcgLow: typeof pd?.tcg_low === 'number' ? pd.tcg_low : undefined,
                  });
                }}
                onMouseLeave={isTouchDevice ? undefined : onClearImage}
              >
                {/* Printing thumbnail */}
                <div
                  className="w-5 h-7 flex-shrink-0 rounded overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer"
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

                {/* Ownership — informational, not alarmist; muted amber for "missing" */}
                {own ? (
                  own.owned >= own.needed ? (
                    <span className="text-xs text-emerald-600/90 dark:text-emerald-400/90 flex-shrink-0">✓</span>
                  ) : (
                    <span className="text-xs text-amber-700/70 dark:text-amber-300/70 tabular-nums flex-shrink-0">{own.owned}/{own.needed}</span>
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
  tcgplayerUrl?: string;
  tcgLow?: number;
  otherFaceImageUrl?: string;
  /** Raw foiling code ('R', 'C', 'S', 'G', etc.) — used for foil shimmer effect */
  foiling?: string;
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
          tcgplayerUrl: pd?.tcgplayer_url ?? undefined,
          tcgLow: pd?.tcg_low ?? undefined,
          otherFaceImageUrl: pd?.other_face_image_url ?? undefined,
          foiling: pd?.foiling ?? undefined,
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
  for (const key of ['equipment', 'red', 'yellow', 'blue', 'inventory', 'bench'] as TileSectionKey[]) {
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
  onMoveTo,
  onAddTile,
  onEnlargeImage,
  onAddToBinder,
  onAddToWants,
  highlightMatchIds,
  tileWidth = 72,
  ownershipFilter = 'all',
  isTouchDevice = false,
}: {
  section: DeckTileSectionData;
  onHover: (url: string, name: string, extras?: HoverExtras) => void;
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
  /** Move 1 copy of a tile to any target category (context menu) */
  onMoveTo?: (tile: DeckTileCard, to: DeckCategory) => void;
  /** Add 1 more copy of a tile (+1 button on hover) */
  onAddTile?: (tile: DeckTileCard) => void;
  /** Open enlarged image lightbox */
  onEnlargeImage?: (url: string, name: string, otherFaceUrl?: string) => void;
  /** Add a card to the selected binder */
  onAddToBinder?: (printingId: string, cardName: string) => void;
  /** Add an unowned card to the wants list */
  onAddToWants?: (printingId: string, cardName: string) => void;
  /** Set of printingIds that match the active highlight filter (null = no filter) */
  highlightMatchIds?: Set<string> | null;
  /** Width of each card tile in px — default 72 */
  tileWidth?: number;
  /** When set, shows a binder link below owned tiles */
  ownershipFilter?: 'all' | 'owned' | 'unowned';
  isTouchDevice?: boolean;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ tile: DeckTileCard; x: number; y: number } | null>(null);
  const [bottomSheet, setBottomSheet] = useState<{ tile: DeckTileCard } | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      id={`deck-section-${section.key}`}
      className={cn(
        "mb-3 p-1 transition-all scroll-mt-16",
        accent ? [accent.bg, accent.border] : "rounded-lg",
        isDragActive && isValidDropTarget && !isDragOver && "ring-1 ring-inset ring-indigo-400/50 bg-indigo-500/5",
        isDragActive && isValidDropTarget && isDragOver && "ring-2 ring-inset ring-indigo-400 bg-indigo-500/20",
        isDragActive && !isValidDropTarget && activeDragTile?.sectionKey !== section.key && "opacity-40",
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={cn("group flex items-center gap-1.5 px-0.5 pb-1 mb-1 border-b", accent ? accent.headerBorder : "border-gray-700/40")}>
        {/* Hero portrait inline — no extra row, zero additional height cost */}
        {heroPortrait && (
          <>
            <div
              className="relative flex-shrink-0 rounded overflow-hidden ring-[1.5px] ring-yellow-400/70 cursor-pointer"
              style={{ width: 28 }}
              title={`${heroPortrait.name} — click to enlarge`}
              onMouseEnter={() => heroPortrait.imageUrl && onHover(heroPortrait.imageUrl, heroPortrait.name, {
                tcgplayerUrl: heroPortrait.tcgplayerUrl,
                tcgLow: heroPortrait.tcgLow,
                otherFaceUrl: heroPortrait.otherFaceImageUrl,
              })}
              onMouseLeave={onLeave}
              onClick={() => {
                if (isDragActive) return;
                if (onEnlargeImage && heroPortrait.imageUrl) {
                  onEnlargeImage(heroPortrait.imageUrl, heroPortrait.name, heroPortrait.otherFaceImageUrl);
                } else {
                  onSwap?.({ printingId: heroPortrait.printingId, cardUniqueId: heroPortrait.cardUniqueId, cardName: heroPortrait.name, category: heroPortrait.category });
                }
              }}
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
                  onMouseEnter={() => tile.imageUrl && onHover(tile.imageUrl, tile.name, {
                    tcgplayerUrl: tile.tcgplayerUrl,
                    tcgLow: tile.tcgLow,
                    otherFaceUrl: tile.otherFaceImageUrl,
                  })}
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
          "text-sm uppercase tracking-wider font-bold",
          section.key === 'red'    ? "text-red-600 dark:text-red-400" :
          section.key === 'yellow' ? "text-yellow-700 dark:text-yellow-400" :
          section.key === 'blue'   ? "text-blue-600 dark:text-blue-400" :
          "text-gray-700 dark:text-gray-200"
        )}>
          {section.title}
        </span>
        <span className={cn(
          "text-sm font-semibold",
          section.key === 'red'    ? "text-red-600 dark:text-red-400" :
          section.key === 'yellow' ? "text-yellow-700 dark:text-yellow-400" :
          section.key === 'blue'   ? "text-blue-600 dark:text-blue-400" :
          "text-gray-600 dark:text-gray-300"
        )}>({section.tiles.length})</span>
        {isDragActive && isValidDropTarget && (
          <span className="text-[9px] text-indigo-400 font-medium ml-auto">drop here</span>
        )}
        {!isDragActive && (
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            {onAddCard && sectionToCategory(section.key) && (
              <button
                type="button"
                onClick={() => onAddCard(sectionToCategory(section.key)!, sectionToPitch(section.key))}
                title={`Add card to ${section.title}`}
                aria-label={`Add card to ${section.title}`}
                className="flex items-center justify-center w-7 h-7 text-gray-500 hover:text-gray-200 transition-colors rounded hover:bg-gray-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {isCollapsible && (
              <button
                type="button"
                className="flex items-center justify-center w-7 h-7 text-gray-500 hover:text-gray-200 transition-colors rounded hover:bg-gray-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                onClick={() => setIsCollapsed(v => !v)}
                title={isCollapsed ? "Show equipment & weapons" : "Collapse equipment & weapons"}
                aria-label={isCollapsed ? "Show equipment & weapons" : "Collapse equipment & weapons"}
                aria-expanded={!isCollapsed}
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform", isCollapsed && "-rotate-90")} aria-hidden="true" />
              </button>
            )}
          </div>
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
          const showBinderLabel = ownershipState === 'full' && (own?.binderNames?.length ?? 0) > 0;
          return (
            <div key={tile.key} className="flex flex-col items-center" data-focus-id={tile.printingId} style={{ width: tileWidth }}>
            <div
              title={thisTileDraggable ? `${tile.name} — drag to move, click to enlarge` : `${tile.name} — click to enlarge`}
              draggable={thisTileDraggable}
              onMouseEnter={() => !isDragActive && tile.imageUrl && onHover(tile.imageUrl, tile.name, {
                tcgplayerUrl: tile.tcgplayerUrl,
                tcgLow: tile.tcgLow,
                otherFaceUrl: tile.otherFaceImageUrl,
              })}
              onMouseLeave={onLeave}
              onDragStart={thisTileDraggable ? (e) => {
                e.dataTransfer.effectAllowed = 'move';
                if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
                onTileDragStart?.(tile);
              } : undefined}
              onDragEnd={thisTileDraggable ? () => onTileDragEnd?.() : undefined}
              onClick={(e) => {
                if (isDragActive) return;
                if (isTouchDevice) {
                  setBottomSheet({ tile });
                } else if ((e.metaKey || e.ctrlKey) && onMoveTo && tile.category !== 'hero') {
                  e.preventDefault();
                  setContextMenu({ tile, x: e.clientX, y: e.clientY });
                } else if (onEnlargeImage && tile.imageUrl) {
                  onEnlargeImage(tile.imageUrl, tile.name, tile.otherFaceImageUrl);
                } else {
                  onSwap?.({ printingId: tile.printingId, cardUniqueId: tile.cardUniqueId, cardName: tile.name, category: tile.category });
                }
              }}
              onTouchStart={!isTouchDevice && onMoveTo && tile.category !== 'hero' && !tile.types.includes('demi-hero') ? (e) => {
                const touch = e.touches[0];
                longPressRef.current = setTimeout(() => {
                  const el = e.currentTarget.getBoundingClientRect();
                  setContextMenu({ tile, x: el.left + el.width / 2, y: el.top });
                }, 500);
              } : undefined}
              onTouchEnd={() => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; } }}
              onTouchMove={() => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; } }}
              className={cn(
                "relative rounded select-none group transition-all duration-150",
                isHeroSection ? "ring-2 ring-white/60" : "ring-[1.5px] ring-gray-400 dark:ring-gray-500",
                thisTileDraggable && "cursor-grab active:cursor-grabbing",
                !thisTileDraggable && onSwap && "cursor-pointer",
                isBeingDragged && "opacity-30 scale-95",
                isHighlighted === true && "ring-2 ring-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]",
                isHighlighted === false && "opacity-25 scale-95 grayscale",
              )}
              style={{ width: '100%' }}
            >
              {tile.imageUrl ? (
                <div className="w-full overflow-hidden rounded" style={{ aspectRatio: '63/53', display: 'flex', flexDirection: 'column', gap: '1px', background: '#111827' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tile.imageUrl}
                    alt={tile.name}
                    className="w-full block"
                    style={{ objectFit: 'cover', objectPosition: 'top', flex: '0 0 81%', minHeight: 0 }}
                    draggable={false}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tile.imageUrl}
                    alt=""
                    className="w-full block"
                    style={{ objectFit: 'cover', objectPosition: 'bottom', flex: '1 0 0', minHeight: 0 }}
                    draggable={false}
                    aria-hidden="true"
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
                  onAddTile ? "group-hover:opacity-0" : "",
                )} />
              )}

              {/* Remove button (X) — shown on hover, hidden for hero/demi-hero */}
              {!isTouchDevice && !isDragActive && onRemoveTile && tile.category !== 'hero' && !tile.types.includes('demi-hero') && (
                <button
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-black/85 ring-1 ring-white/20 text-gray-300 hover:text-white hover:bg-red-600 flex items-center justify-center opacity-20 group-hover:opacity-100 transition-all z-10"
                  title="Remove 1 copy"
                  onClick={e => { e.stopPropagation(); onRemoveTile(tile); }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}

              {/* Move to inventory button — shown on hover, only for maindeck/equipment cards */}
              {!isTouchDevice && !isDragActive && onMoveToInventory && tile.category !== 'hero' && tile.category !== 'inventory' && !tile.types.includes('demi-hero') && (
                <button
                  className="absolute top-6 left-0.5 w-5 h-5 rounded-full bg-black/85 ring-1 ring-white/20 text-gray-300 hover:text-white hover:bg-blue-600 flex items-center justify-center opacity-20 group-hover:opacity-100 transition-all z-10 text-[8px] font-bold leading-none"
                  title="Move to inventory"
                  onClick={e => { e.stopPropagation(); onMoveToInventory(tile); }}
                >
                  Inv.
                </button>
              )}

              {/* Move to bench button — shown on hover, only for non-hero/non-bench cards */}
              {!isTouchDevice && !isDragActive && onMoveTo && tile.category !== 'hero' && tile.category !== 'benched' && !tile.types.includes('demi-hero') && (
                <button
                  className="absolute top-12 left-0.5 w-5 h-5 rounded-full bg-black/85 ring-1 ring-white/20 text-gray-300 hover:text-white hover:bg-blue-600 flex items-center justify-center opacity-20 group-hover:opacity-100 transition-all z-10"
                  title="Move to bench"
                  onClick={e => { e.stopPropagation(); onMoveTo(tile, 'benched'); }}
                >
                  <img src="/bench-icon.svg" className="h-3 w-3 invert" alt="Bench" />
                </button>
              )}

              {/* Add +1 button — shown on hover, hidden for hero/demi-hero */}
              {!isTouchDevice && !isDragActive && onAddTile && tile.category !== 'hero' && !tile.types.includes('demi-hero') && (
                <button
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/85 ring-1 ring-white/20 text-gray-300 hover:text-white hover:bg-green-600 flex items-center justify-center opacity-20 group-hover:opacity-100 transition-all z-10 text-[10px] font-bold leading-none"
                  title="Add 1 copy"
                  onClick={e => { e.stopPropagation(); onAddTile(tile); }}
                >
                  +1
                </button>
              )}

              {/* Swap printing button — bottom-right corner, shown on hover */}
              {!isTouchDevice && !isDragActive && onSwap && tile.category !== 'hero' && !tile.types.includes('demi-hero') && (
                <button
                  className="absolute bottom-0.5 right-0.5 w-8 h-8 rounded-full bg-black/85 ring-1 ring-white/20 text-gray-300 hover:text-white hover:bg-purple-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10"
                  title="Swap printing"
                  onClick={e => { e.stopPropagation(); onSwap({ printingId: tile.printingId, cardUniqueId: tile.cardUniqueId, cardName: tile.name, category: tile.category }); }}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Hover overlay: drag hint when draggable, zoom hint otherwise */}
              {!isTouchDevice && !isDragActive && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 rounded transition-opacity pointer-events-none">
                  {thisTileDraggable ? (
                    <svg className="h-4 w-4 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
                    </svg>
                  ) : tile.imageUrl ? (
                    <ZoomIn className="h-4 w-4 text-white drop-shadow" />
                  ) : null}
                </div>
              )}
            </div>
            <span className="sr-only">{tile.name}</span>
            {ownershipFilter === 'owned' && showBinderLabel && (
              <div className="flex flex-col items-center gap-0.5 w-full px-0.5 mt-0.5">
                <a
                  href={`/binder/${own!.binderIds![0]}`}
                  onClick={e => e.stopPropagation()}
                  className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate w-full text-center leading-tight font-medium"
                  title={`Go to binder: ${own!.binderNames!.join(', ')}`}
                >
                  {own!.binderNames!.length > 1 ? `${own!.binderNames![0]} +${own!.binderNames!.length - 1}` : own!.binderNames![0]}
                </a>
              </div>
            )}
            {!isTouchDevice && ownershipFilter === 'unowned' && ownershipState !== 'full' && (
              <div className="flex flex-col items-center gap-0.5 w-full px-0.5 py-0.5">
                {/* Row 1: binder + heart icons */}
                <div className="flex items-center justify-center gap-2 w-full">
                  {onAddToBinder && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onAddToBinder(tile.printingId, tile.name); }}
                      className="flex items-center justify-center text-gray-400 hover:text-green-400 transition-colors"
                      title="Add to your binder"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {onAddToWants && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onAddToWants(tile.printingId, tile.name); }}
                      className="flex items-center justify-center text-gray-400 hover:text-pink-400 transition-colors"
                      title="Add to your wants list"
                    >
                      <Heart className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {/* Row 2: TCGPlayer logo + price */}
                {tile.tcgplayerUrl && (
                  <TcgAffiliateLink
                    tcgplayerUrl={tile.tcgplayerUrl}
                    feature="DeckTileUnowned"
                    onClick={e => e.stopPropagation()}
                    className="flex flex-col items-center gap-0.5 hover:opacity-80 transition-opacity"
                    title="Buy on TCGPlayer"
                  >
                    <img
                      src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
                      alt="TCGPlayer"
                      className="h-4 w-auto"
                    />
                    {tile.tcgLow != null && (
                      <span className="text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">${tile.tcgLow.toFixed(2)}</span>
                    )}
                  </TcgAffiliateLink>
                )}
              </div>
            )}
            </div>
          );
        })}
        {onAddCard && sectionToCategory(section.key) && (
          <button
            type="button"
            onClick={() => !isDragActive && onAddCard(sectionToCategory(section.key)!, sectionToPitch(section.key))}
            title="Add a card here"
            className="rounded border-2 border-dashed border-gray-600 hover:border-blue-500 text-gray-600 hover:text-blue-400 flex items-center justify-center transition-colors flex-shrink-0"
            style={{ width: tileWidth, aspectRatio: '63/53' }}
          >
            <Plus className="h-5 w-5" />
          </button>
        )}
      </div>}

      {/* Context menu — Cmd/Ctrl+click or long-press */}
      {contextMenu && onMoveTo && (() => {
        const { tile, x, y } = contextMenu;
        const dests: Array<{ to: DeckCategory; label: string }> = [];
        if (tile.category !== 'inventory') dests.push({ to: 'inventory', label: 'Move to Inventory' });
        if (tile.category !== 'maindeck' && isLibraryCompatible(tile.types)) dests.push({ to: 'maindeck', label: 'Move to Library' });
        if (tile.category !== 'equipment' && isEquipmentCompatible(tile.types)) dests.push({ to: 'equipment', label: 'Move to Equipment' });
        if (tile.category !== 'benched') dests.push({ to: 'benched', label: 'Move to Bench' });
        if (dests.length === 0) { setContextMenu(null); return null; }
        return (
          <>
            <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)} />
            <div
              className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl py-1 min-w-[160px]"
              style={{ left: Math.min(x, window.innerWidth - 170), top: Math.min(y, window.innerHeight - (dests.length * 36 + 8)) }}
            >
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-700 mb-1">
                {tile.name}
              </div>
              {dests.map(({ to, label }) => (
                <button
                  key={to}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
                  onClick={() => { onMoveTo(tile, to); setContextMenu(null); }}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        );
      })()}

      {/* Mobile bottom sheet — shown on tile tap when isTouchDevice */}
      {bottomSheet && (() => {
        const { tile } = bottomSheet;
        const isSpecial = tile.category === 'hero' || tile.types.includes('demi-hero');
        const moveDests: Array<{ to: DeckCategory; label: string }> = [];
        if (!isSpecial && onMoveTo) {
          if (tile.category !== 'inventory') moveDests.push({ to: 'inventory', label: 'Move to Inventory' });
          if (tile.category !== 'maindeck' && isLibraryCompatible(tile.types)) moveDests.push({ to: 'maindeck', label: 'Move to Library' });
          if (tile.category !== 'equipment' && isEquipmentCompatible(tile.types)) moveDests.push({ to: 'equipment', label: 'Move to Equipment' });
          if (tile.category !== 'benched') moveDests.push({ to: 'benched', label: 'Move to Bench' });
        }
        const dismiss = () => setBottomSheet(null);
        return (
          <>
            <div className="fixed inset-0 z-50 bg-black/50" onClick={dismiss} />
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl">
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
              </div>
              {/* Card header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-gray-800">
                {tile.imageUrl && (
                  <img
                    src={tile.imageUrl}
                    alt={tile.name}
                    className="w-10 rounded-lg border border-gray-200 dark:border-gray-700 flex-shrink-0"
                    style={{ aspectRatio: '63/88', objectFit: 'cover', objectPosition: 'top' }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{tile.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{tile.category}</p>
                </div>
              </div>
              {/* Qty controls */}
              {!isSpecial && (onRemoveTile || onAddTile) && (
                <div className="flex items-center justify-center gap-6 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    disabled={!onRemoveTile}
                    onClick={() => { onRemoveTile?.(tile); dismiss(); }}
                    className="w-10 h-10 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-200 disabled:opacity-30 active:bg-gray-100 dark:active:bg-gray-700 text-xl font-light"
                  >−</button>
                  <span className="text-base font-bold text-gray-900 dark:text-white w-8 text-center tabular-nums">
                    {section.tiles.filter(t => t.cardUniqueId === tile.cardUniqueId).length}
                  </span>
                  <button
                    type="button"
                    disabled={!onAddTile}
                    onClick={() => { onAddTile?.(tile); dismiss(); }}
                    className="w-10 h-10 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-200 disabled:opacity-30 active:bg-gray-100 dark:active:bg-gray-700 text-xl font-light"
                  >+</button>
                </div>
              )}
              {/* Action rows */}
              <div className="py-1">
                {!isSpecial && onSwap && (
                  <button type="button" className="w-full text-left px-5 py-3.5 text-sm text-gray-800 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-800 transition-colors" onClick={() => { onSwap({ printingId: tile.printingId, cardUniqueId: tile.cardUniqueId, cardName: tile.name, category: tile.category }); dismiss(); }}>
                    Swap printing
                  </button>
                )}
                {moveDests.map(({ to, label }) => (
                  <button key={to} type="button" className="w-full text-left px-5 py-3.5 text-sm text-gray-800 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-800 transition-colors" onClick={() => { onMoveTo!(tile, to); dismiss(); }}>
                    {label}
                  </button>
                ))}
                {onEnlargeImage && tile.imageUrl && (
                  <button type="button" className="w-full text-left px-5 py-3.5 text-sm text-gray-800 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-800 transition-colors" onClick={() => { onEnlargeImage(tile.imageUrl!, tile.name, tile.otherFaceImageUrl); dismiss(); }}>
                    Enlarge image
                  </button>
                )}
                {onAddToBinder && (
                  <button type="button" className="w-full text-left px-5 py-3.5 text-sm text-gray-800 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-800 transition-colors" onClick={() => { onAddToBinder(tile.printingId, tile.name); dismiss(); }}>
                    Add to binder
                  </button>
                )}
                {onAddToWants && (
                  <button type="button" className="w-full text-left px-5 py-3.5 text-sm text-gray-800 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-800 transition-colors" onClick={() => { onAddToWants(tile.printingId, tile.name); dismiss(); }}>
                    Add to wants
                  </button>
                )}
                {tile.tcgplayerUrl && (
                  <TcgAffiliateLink
                    tcgplayerUrl={tile.tcgplayerUrl}
                    feature="DeckTileBottomSheet"
                    onClick={dismiss}
                    className="block w-full text-left px-5 py-3.5 text-sm text-gray-800 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-800 transition-colors"
                  >
                    View on TCGPlayer{tile.tcgLow != null ? ` · $${tile.tcgLow.toFixed(2)}` : ''}
                  </TcgAffiliateLink>
                )}
              </div>
              <div className="border-t border-gray-100 dark:border-gray-800">
                <button type="button" className="w-full py-4 text-sm font-semibold text-gray-500 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-800 transition-colors" onClick={dismiss}>
                  Cancel
                </button>
              </div>
              {/* Safe area */}
              <div className="h-safe-bottom" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
            </div>
          </>
        );
      })()}
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
  tcgplayerUrl?: string;
  tcgLow?: number;
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
    // Group by card_unique_id so different pitch variants of the same card name remain separate
    const uid = (printing.printingDetails?.card_unique_id as string | undefined) || printing.printingId;
    const name = (printing.printingDetails?.display_name || printing.printingDetails?.name || printing.printingId) as string;
    const pitch = printing.printingDetails?.pitch as number | undefined;
    const qty = printing.quantity ?? 1;
    const imageUrl = printing.printingDetails?.image_url as string | undefined;

    const pd = printing.printingDetails as any;
    if (!map.has(uid)) {
      map.set(uid, {
        name, imageUrl,
        redQty: 0, yellowQty: 0, blueQty: 0, noPitchQty: 0, totalQty: 0,
        cost: pd?.cost ?? null,
        defense: pd?.defense ?? null,
        power: pd?.power ?? null,
        tcgplayerUrl: pd?.tcgplayer_url || undefined,
        tcgLow: typeof pd?.tcg_low === 'number' ? pd.tcg_low : undefined,
      });
      bestPitch.set(uid, pitch ?? 99);
    }
    const card = map.get(uid)!;
    card.totalQty += qty;

    // Prefer the image from the lowest pitch (red > yellow > blue > unpitched)
    const thisPitch = pitch ?? 99;
    if (imageUrl && thisPitch < (bestPitch.get(uid) ?? 99)) {
      card.imageUrl = imageUrl;
      bestPitch.set(uid, thisPitch);
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

  // Apply classifyTileCard to equipment-category cards so evo cards (which are
  // pitched library cards, not zone-starting equipment) land in the correct pitch
  // section rather than Equipment & Weapons.
  const eqPrintings: DeckPrintingDTO[] = [];
  const evoPrintings: DeckPrintingDTO[] = [];
  for (const p of (deck.equipment || [])) {
    if (classifyTileCard(p, 'equipment') === 'equipment') {
      eqPrintings.push(p);
    } else {
      evoPrintings.push(p);
    }
  }

  const eqCards = buildGameCards(eqPrintings);
  const libCards = buildGameCards([...(deck.maindeck || []), ...evoPrintings]);
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
  /** Called whenever the user hovers/leaves a card tile — used by the page to show a preview in the right rail. */
  onCardHover?: (preview: { url: string; name: string } | null) => void;
}

export default function DeckEditorListView({ deck, ownershipMap, onSwap, onRemove, onMove, onMoveSingle, onRemoveTile, onAddOneTile, onAddCard, canEdit, binders, selectedBinderId, onBinderChange, onAddToBinder, onAddToWants, onUpgradePrintings, onCardHover }: DeckEditorListViewProps) {
  // Collection summary across all deck cards (excluding hero, which is purely cosmetic for this purpose).
  const { ownedCount, totalCount } = useMemo(() => {
    let owned = 0, total = 0;
    const sources = [
      ...(deck.maindeck ?? []),
      ...(deck.equipment ?? []),
      ...(deck.inventory ?? []),
    ];
    for (const card of sources) {
      const qty = card.quantity ?? 1;
      total += qty;
      const ownedQty = ownershipMap.get(card.printingId)?.owned ?? 0;
      owned += Math.min(qty, ownedQty);
    }
    return { ownedCount: owned, totalCount: total };
  }, [deck, ownershipMap]);

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [hoveredImage, setHoveredImage] = useState<{ url: string; name: string } | null>(null);
  const [hoverMode, setHoverMode] = useState(false);
  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  const [enlargedImage, setEnlargedImage] = useState<{ url: string; name: string; otherFaceUrl?: string } | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'tile' | 'game'>('tile');
  const TILE_SIZES = [
    { key: 'compact', label: 'Compact', width: 108 },
    { key: 'normal',  label: 'Normal',  width: 150 },
    { key: 'large',   label: 'Large',   width: 200 },
  ] as const;
  type TileSizeKey = typeof TILE_SIZES[number]['key'];
  const [tileSizeKey, setTileSizeKey] = useState<TileSizeKey>(
    () => (typeof window !== 'undefined' && window.innerWidth >= 768) ? 'normal' : 'compact'
  );
  const tileSizeIdx = TILE_SIZES.findIndex(s => s.key === tileSizeKey);
  const tileWidth = TILE_SIZES[tileSizeIdx].width;

  useEffect(() => {
    if (viewMode !== 'tile' && viewMode !== 'game') return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '9') setTileSizeKey(k => {
        const i = TILE_SIZES.findIndex(s => s.key === k);
        return i > 0 ? TILE_SIZES[i - 1].key : k;
      });
      if (e.key === '0') setTileSizeKey(k => {
        const i = TILE_SIZES.findIndex(s => s.key === k);
        return i < TILE_SIZES.length - 1 ? TILE_SIZES[i + 1].key : k;
      });
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [viewMode]);

  // Respond to HUD deck-tile-size events (from page.tsx HUD buttons)
  useEffect(() => {
    const handler = (e: Event) => {
      const { direction } = (e as CustomEvent<{ direction: string }>).detail;
      setTileSizeKey(k => {
        const i = TILE_SIZES.findIndex(s => s.key === k);
        if (direction === 'smaller' && i > 0) return TILE_SIZES[i - 1].key;
        if (direction === 'larger' && i < TILE_SIZES.length - 1) return TILE_SIZES[i + 1].key;
        return k;
      });
    };
    window.addEventListener('deck-tile-size', handler);
    return () => window.removeEventListener('deck-tile-size', handler);
  }, []);

  // Broadcast current tile size so the HUD can display it
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('deck-tile-size-update', {
      detail: { idx: tileSizeIdx, label: TILE_SIZES[tileSizeIdx].label, total: TILE_SIZES.length },
    }));
  }, [tileSizeIdx]);

  const [dragTile, setDragTile] = useState<DeckTileCard | null>(null);
  const [optimisticDeck, setOptimisticDeck] = useState<DeckDTO | null>(null);
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'owned' | 'unowned'>('all');
  const mouseXRef = useRef(0);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const overlayCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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

  const handleTileMoveTo = useCallback(async (tile: DeckTileCard, targetCategory: DeckCategory) => {
    if (!onMoveSingle) return;
    setOptimisticDeck(prev => applyOptimisticMove(prev ?? deck, tile.printingId, tile.category, targetCategory));
    await onMoveSingle(tile.printingId, tile.category, targetCategory, tile.totalQty);
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
        {/* Column headers — must match the data row's flex layout exactly (widths, gaps, breakpoints) */}
        <div className="flex items-center gap-3 py-1.5 px-3 max-w-[1300px] text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-900/40" aria-hidden="true">
          <span className="w-7 flex-shrink-0" />
          <span className="w-2 flex-shrink-0" />
          <span className="w-64 flex-shrink-0">Name</span>
          <span className="hidden md:block w-24 flex-shrink-0">Type</span>
          <span className="hidden sm:block w-6 text-center flex-shrink-0">R</span>
          <span className="hidden sm:block w-8 text-right flex-shrink-0">Cost</span>
          <span className="hidden sm:block w-14 text-right flex-shrink-0">P / D</span>
          <span className="hidden lg:block flex-1 min-w-0">Keywords</span>
          <span className="w-10 text-right flex-shrink-0">Qty</span>
          <span className="w-4 text-center flex-shrink-0">Own</span>
          <span className="w-5 flex-shrink-0" />
        </div>
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
            onHoverImage={(url, name, extras) => {
              if (hoverMode) setHoveredImage({ url, name });
              onCardHover?.({ url, name, ...(extras ?? {}) });
            }}
            onClearImage={() => {
              // Same sticky-preview rationale as tile/game views above.
              setHoveredImage(null);
            }}
            isTouchDevice={isTouchDevice}
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
      let v = (c.printingDetails as any)?.[stat] as number | undefined;
      if (v == null && stat === 'defense') v = 0;
      if (v == null) return sum;
      if (threshold !== null) return v >= threshold ? sum + (c.quantity ?? 1) : sum;
      return v === value ? sum + (c.quantity ?? 1) : sum;
    }, 0);
  };

  // Helper: check if a card's details object matches a single filter entry
  const checkFilterOnDetails = (details: any, f: { stat: string; value: number | string }): boolean => {
    if (f.stat === 'name') {
      const name = (details?.display_name || details?.name || '') as string;
      return name.toLowerCase().includes(String(f.value).toLowerCase());
    }
    if (f.stat === 'keyword') {
      const kws: string[] = ((details?.keywords as string[] | undefined) || []).map((k: string) => k.toLowerCase());
      const needle = String(f.value).toLowerCase();
      return kws.some(k => k === needle || k.startsWith(needle + ' '));
    }
    if (f.stat === 'type') {
      const types: string[] = ((details?.types as string[] | undefined) || []).map((t: string) => t.toLowerCase());
      const tv = String(f.value);
      if (tv === 'attack') return types.includes('attack') && types.includes('action');
      if (tv === 'non-attack') return types.includes('action') && !types.includes('attack');
      if (tv === 'defense-reaction') return types.includes('defense reaction');
      if (tv === 'attack-reaction') return types.includes('attack reaction');
      return types.includes(tv);
    }
    if (f.stat === 'arcane') {
      const cardText = (details?.text ?? '') as string;
      const arcaneMatches = [...cardText.matchAll(/(\d+)\s+arcane damage/gi)];
      return arcaneMatches.some(m => parseInt(m[1]) === f.value);
    }
    let v = details?.[f.stat] as number | undefined;
    if (v == null && f.stat === 'defense') v = 0;
    if (v == null) return false;
    const threshold = typeof f.value === 'string' && f.value.endsWith('+') ? parseInt(f.value) : null;
    return threshold !== null ? v >= threshold : v === f.value;
  };

  // Group filters by stat then apply: OR within same stat, AND across stats
  const groupFiltersByStat = (filters: Array<{ stat: string; value: number | string }>) => {
    const map = new Map<string, Array<{ stat: string; value: number | string }>>();
    for (const f of filters) {
      if (!map.has(f.stat)) map.set(f.stat, []);
      map.get(f.stat)!.push(f);
    }
    return map;
  };

  // Helper: count cards in a specific deck zone
  const getZoneCount = (zone: string): number => {
    const arr = zone === 'equipment' ? (displayDeck.equipment || [])
              : zone === 'inventory' ? (displayDeck.inventory || [])
              : zone === 'bench'     ? (displayDeck.benched || [])
              : [];
    return arr.reduce((s, c) => s + (c.quantity ?? 1), 0);
  };

  const matchingPrintingIds: Set<string> | null = highlightFilters.length > 0
    ? (() => {
        const ids = new Set<string>();
        // Tag each card with its zone so 'zone' filters can match
        const zoneCards = [
          ...(displayDeck.maindeck   || []).map(c => ({ c, zone: 'maindeck'   })),
          ...(displayDeck.equipment  || []).map(c => ({ c, zone: 'equipment'  })),
          ...(displayDeck.inventory  || []).map(c => ({ c, zone: 'inventory'  })),
          ...(displayDeck.benched    || []).map(c => ({ c, zone: 'bench'      })),
        ];
        const filtersByStat = groupFiltersByStat(highlightFilters);
        for (const { c, zone } of zoneCards) {
          const details = c.printingDetails as any;
          // AND across stats, OR within same stat
          const passes = [...filtersByStat.values()].every(statFilters =>
            statFilters.some(f => {
              if (f.stat === 'zone') return zone === f.value;
              return checkFilterOnDetails(details, f);
            })
          );
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
    const filtersByStat = groupFiltersByStat(nonPitchFilters);
    return [...filtersByStat.values()].every(statFilters =>
      statFilters.some(f => {
        if (f.stat === 'name') return card.name.toLowerCase().includes(String(f.value).toLowerCase());
        if (f.stat === 'keyword') {
          const kws: string[] = ((card as any).keywords || []).map((k: string) => k.toLowerCase());
          const needle = String(f.value).toLowerCase();
          return kws.some(k => k === needle || k.startsWith(needle + ' '));
        }
        if (f.stat === 'type') {
          const types: string[] = ((card as any).types || []).map((t: string) => t.toLowerCase());
          const tv = String(f.value);
          if (tv === 'attack') return types.includes('attack') && types.includes('action');
          if (tv === 'non-attack') return types.includes('action') && !types.includes('attack');
          if (tv === 'defense-reaction') return types.includes('defense reaction');
          if (tv === 'attack-reaction') return types.includes('attack reaction');
          return types.includes(tv);
        }
        if (f.stat === 'arcane') {
          const cardText = ((card as any).text ?? '') as string;
          const arcaneMatches = [...cardText.matchAll(/(\d+)\s+arcane damage/gi)];
          return arcaneMatches.some(m => parseInt(m[1]) === f.value);
        }
        let v = (card as any)[f.stat] as number | undefined;
        if (v == null && f.stat === 'defense') v = 0;
        if (v == null) return false;
        const threshold = typeof f.value === 'string' && f.value.endsWith('+') ? parseInt(f.value) : null;
        return threshold !== null ? v >= threshold : v === f.value;
      })
    );
  };

  const toggleHighlight = (stat: string, value: number | string) => {
    setHighlightFilters(prev => {
      const exact = prev.find(f => f.stat === stat && f.value === value);
      if (exact) {
        // Same button clicked again — remove it
        return prev.filter(f => !(f.stat === stat && f.value === value));
      }
      if (hoverMode) {
        // In hover mode: allow multiple values per stat (OR within same stat)
        return [...prev, { stat, value }];
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

  // Listen for chord-triggered highlight filter events from the deck page
  useEffect(() => {
    const handleFilter = (e: Event) => {
      const { stat, value, additive } = (e as CustomEvent).detail;
      if (additive) {
        // Additive mode (e.g. chord range dispatch): add without replacing same-stat filters
        setHighlightFilters(prev => {
          if (prev.some(f => f.stat === stat && f.value === value)) return prev;
          return [...prev, { stat, value }];
        });
      } else {
        toggleHighlight(stat, value);
      }
    };
    const handleClear = () => setHighlightFilters([]);
    const handleOwnershipFilter = (e: Event) => {
      const { filter } = (e as CustomEvent).detail as { filter: 'all' | 'owned' | 'unowned' };
      setOwnershipFilter(prev => prev === filter ? 'all' : filter);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setHighlightFilters([]);
        setEnlargedImage(null);
      }
      if (e.key === 'h' || e.key === 'H') {
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
        setHoverMode(prev => { setHighlightFilters([]); return !prev; });
        setHoveredImage(null);
      }
    };
    window.addEventListener('deck-highlight-filter', handleFilter);
    window.addEventListener('deck-highlight-clear', handleClear);
    window.addEventListener('deck-ownership-filter', handleOwnershipFilter);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('deck-highlight-filter', handleFilter);
      window.removeEventListener('deck-highlight-clear', handleClear);
      window.removeEventListener('deck-ownership-filter', handleOwnershipFilter);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const heroCards = displayDeck.hero || [];
  const equipmentCards = displayDeck.equipment || [];
  const maindeckCards = displayDeck.maindeck || [];
  const inventoryCards = displayDeck.inventory || [];
  const benchedCards = displayDeck.benched || [];

  const tileSections = buildTileSections(displayDeck);

  // Apply ownership filter to tile sections
  const applyOwnershipFilter = (sections: DeckTileSectionData[]): DeckTileSectionData[] => {
    if (ownershipFilter === 'all') return sections;
    return sections.map(section => ({
      ...section,
      tiles: section.tiles.filter(tile => {
        const own = ownershipMap.get(tile.printingId);
        const isOwned = own ? tile.copyIndex < own.owned : false;
        return ownershipFilter === 'owned' ? isOwned : !isOwned;
      }),
    })).filter(section => section.key === 'hero' || section.tiles.length > 0);
  };

  const filteredTileSections = applyOwnershipFilter(tileSections);

  // Collect matching cards for the focus panel (deduped by printingId, with count)
  const focusCards: Array<{ tile: DeckTileCard; count: number }> = (() => {
    if (!matchingPrintingIds || matchingPrintingIds.size === 0) return [];
    const map = new Map<string, { tile: DeckTileCard; count: number }>();
    for (const section of filteredTileSections) {
      for (const tile of section.tiles) {
        if (!matchingPrintingIds.has(tile.printingId)) continue;
        const existing = map.get(tile.printingId);
        if (existing) existing.count++;
        else map.set(tile.printingId, { tile, count: 1 });
      }
    }
    return [...map.values()];
  })();
  const focusTotal = focusCards.reduce((sum, { count }) => sum + count, 0);

  // Dynamically size focus overlay cards — shrink if 3+ rows would result
  const focusCardWidth = (() => {
    const available = typeof window !== 'undefined' ? window.innerWidth - 96 : 1200;
    const gap = 16;
    const perRow = (w: number) => Math.max(1, Math.floor((available + gap) / (w + gap)));
    if (Math.ceil(focusCards.length / perRow(220)) < 3) return 220;
    const targetPerRow = Math.ceil(focusCards.length / 2);
    return Math.max(150, Math.floor((available - (targetPerRow - 1) * gap) / targetPerRow));
  })();
  const focusFilterLabel = highlightFilters.map(f => {
    if (f.stat === 'type') return String(f.value);
    if (f.stat === 'pitch') return `pitch ${f.value}`;
    if (f.stat === 'keyword') return String(f.value);
    return `${f.stat} ${f.value}`;
  }).join(' + ');

  // FLIP animation: fly matching cards from their deck positions to the focus overlay
  useEffect(() => {
    if (focusCards.length === 0) {
      overlayCardRefs.current.clear();
      return;
    }
    const refs = overlayCardRefs.current;
    requestAnimationFrame(() => {
      refs.forEach((overlayEl, printingId) => {
        if (!overlayEl) return;
        const sourceTile = document.querySelector(`[data-focus-id="${printingId}"]`);
        if (!sourceTile) {
          // No source tile in DOM (e.g. game view) — simple fade-in
          overlayEl.style.transition = 'none';
          overlayEl.style.opacity = '0';
          requestAnimationFrame(() => {
            overlayEl.style.transition = 'opacity 0.4s ease';
            overlayEl.style.opacity = '1';
          });
          return;
        }
        const sourceRect = sourceTile.getBoundingClientRect();
        const finalRect = overlayEl.getBoundingClientRect();
        if (!finalRect.width) return;
        const dx = sourceRect.left + sourceRect.width / 2 - (finalRect.left + finalRect.width / 2);
        const dy = sourceRect.top + sourceRect.height / 2 - (finalRect.top + finalRect.height / 2);
        const scale = sourceRect.width / finalRect.width;
        overlayEl.style.transition = 'none';
        overlayEl.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
        overlayEl.style.opacity = '0.4';
        requestAnimationFrame(() => {
          overlayEl.style.transition = 'transform 0.75s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s ease';
          overlayEl.style.transform = 'translate(0, 0) scale(1)';
          overlayEl.style.opacity = '1';
        });
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightFilters]);

  // Hero is embedded in the equipment section header — not a standalone section
  const heroPortrait = tileSections.find(s => s.key === 'hero')?.tiles[0] ?? null;
  const tileTopSections = filteredTileSections.filter(s => s.key === 'equipment');
  const tileRestSections = filteredTileSections.filter(s => s.key !== 'hero' && s.key !== 'equipment');

  const tileSharedProps = {
    onHover: isTouchDevice
      ? (_url: string, _name: string) => {}
      : (url: string, name: string, extras?: HoverExtras) => {
          if (hoverMode) setHoveredImage({ url, name });
          onCardHover?.({ url, name, ...(extras ?? {}) });
        },
    onLeave: isTouchDevice
      ? () => {}
      : () => {
          // Clear the in-tile hover overlay only. Leave the rail-level preview
          // sticky on the last-hovered card so users can click the affiliate
          // link and other actions without the preview vanishing under them.
          setHoveredImage(null);
        },
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
    onMoveTo: canEdit && onMoveSingle ? handleTileMoveTo : undefined,
    onAddTile: canEdit ? handleTileAddOne : undefined,
    onEnlargeImage: (url: string, name: string, otherFaceUrl?: string) => setEnlargedImage({ url, name, otherFaceUrl }),
    onAddToBinder: onAddToBinder,
    onAddToWants: onAddToWants,
    highlightMatchIds: matchingPrintingIds,
    tileWidth,
    ownershipFilter,
    isTouchDevice,
  };

  // Highlight popover (with full pitch/cost/power/defense grid as children).
  // Defined as a node so it can render inside the toolbar cluster instead of as a separate row.
  const highlightFiltersBlock = (
    <HighlightFiltersPopover
      activeFilters={highlightFilters as HF[]}
      onRemoveFilter={(f) => setHighlightFilters(curr => curr.filter(x => !(x.stat === f.stat && x.value === f.value)))}
      onClearAll={() => setHighlightFilters([])}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {/* Pitch */}
        <div className="flex items-center gap-1">
          {([1, 2, 3] as const).map(v => {
            const count = getStatCount('pitch', v);
            const isActive = highlightFilters.some(f => f.stat === 'pitch' && f.value === v);
            return (
              <button key={v} onClick={() => count > 0 && toggleHighlight('pitch', v)}
                className={cn("flex items-center gap-0.5 px-1 py-1 rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                  isActive ? "bg-amber-500 ring-1 ring-amber-400/80" : count > 0 ? "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600" : "opacity-30 cursor-default")}
              >
                <img src={`/fab/symbols/pitch${v}.png`} alt={`Pitch ${v}`} className="w-6 h-6 object-contain" />
              </button>
            );
          })}
        </div>
        {/* Cost */}
        <div className="flex items-center gap-1">
          {([0, 1, 2, 3, 4, '5+'] as const).map(v => {
            const count = getStatCount('cost', v);
            const isActive = highlightFilters.some(f => f.stat === 'cost' && f.value === v);
            return (
              <button key={String(v)} onClick={() => count > 0 && toggleHighlight('cost', v)}
                className={cn("flex items-center gap-0.5 px-1 py-1 rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                  isActive ? "bg-amber-500 ring-1 ring-amber-400/80" : count > 0 ? "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600" : "opacity-30 cursor-default")}
              >
                <div className="relative w-6 h-6 flex items-center justify-center shrink-0">
                  <img src="/fab/symbols/cost.png" alt="Cost" className="w-6 h-6 object-contain" />
                  <span className="absolute font-bold text-xs leading-none text-white drop-shadow-[0_0_2px_rgba(0,0,0,1)]">{String(v)}</span>
                </div>
              </button>
            );
          })}
        </div>
        {/* Power */}
        <div className="flex items-center gap-1">
          {([1, 2, 3, 4, 5, 6, '7+'] as const).map(v => {
            const count = getStatCount('power', v);
            const isActive = highlightFilters.some(f => f.stat === 'power' && f.value === v);
            return (
              <button key={String(v)} onClick={() => count > 0 && toggleHighlight('power', v)}
                className={cn("flex items-center gap-1 px-1.5 py-1 rounded transition-all text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                  isActive ? "bg-amber-500 ring-1 ring-amber-400/80" : count > 0 ? "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600" : "opacity-30 cursor-default")}
              >
                <span className={cn("font-semibold", isActive ? "text-white" : "text-gray-800 dark:text-gray-100")}>{String(v)}</span>
                <img src="/fab/symbols/power.png" alt="Power" className="w-5 h-5 object-contain" />
              </button>
            );
          })}
        </div>
        {/* Defense */}
        <div className="flex items-center gap-1">
          {([0, 1, 2, 3, 4, '5+'] as const).map(v => {
            const count = getStatCount('defense', v);
            const isActive = highlightFilters.some(f => f.stat === 'defense' && f.value === v);
            return (
              <button key={String(v)} onClick={() => count > 0 && toggleHighlight('defense', v)}
                className={cn("flex items-center gap-1 px-1.5 py-1 rounded transition-all text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                  isActive ? "bg-amber-500 ring-1 ring-amber-400/80" : count > 0 ? "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600" : "opacity-30 cursor-default")}
              >
                <span className={cn("font-semibold", isActive ? "text-white" : "text-gray-800 dark:text-gray-100")}>{String(v)}</span>
                <img src="/fab/symbols/block.png" alt="Block" className="w-5 h-5 object-contain" />
              </button>
            );
          })}
        </div>
      </div>
    </HighlightFiltersPopover>
  );

  return (
    <>
      {/* Display controls — view mode, hover preview, tile density, and highlight popover */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="inline-flex items-center rounded border border-gray-200 dark:border-gray-700 overflow-hidden text-sm bg-white dark:bg-gray-900/40">
          {/* View mode */}
          {([
            { key: 'list', icon: List,       label: 'List'  },
            { key: 'tile', icon: LayoutGrid, label: 'Tiles' },
            { key: 'game', icon: Layers,     label: 'Game'  },
          ] as const).map((m, idx) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setViewMode(m.key)}
              aria-pressed={viewMode === m.key}
              className={cn(
                "px-3 py-1.5 flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400",
                idx > 0 && "border-l border-gray-200 dark:border-gray-700",
                viewMode === m.key
                  ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
              )}
            >
              <m.icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{m.label}</span>
            </button>
          ))}

          {/* Hover preview toggle (only meaningful in tile / game views) */}
          {(viewMode === 'tile' || viewMode === 'game') && (
            <button
              type="button"
              onClick={() => { setHoverMode(m => { setHighlightFilters([]); return !m; }); setHoveredImage(null); }}
              className={cn(
                "px-3 py-1.5 border-l border-gray-200 dark:border-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400",
                hoverMode
                  ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
              )}
              title="Toggle hover preview (H)"
              aria-label="Toggle hover preview"
              aria-pressed={hoverMode}
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}

          {/* Tile density */}
          {(viewMode === 'tile' || viewMode === 'game') && (
            <div className="flex items-center border-l border-gray-200 dark:border-gray-700">
              <button
                type="button"
                disabled={tileSizeIdx === 0}
                onClick={() => setTileSizeKey(TILE_SIZES[tileSizeIdx - 1].key)}
                className="px-2.5 py-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400"
                aria-label="Smaller tiles"
              >−</button>
              <span className="px-1 text-gray-700 dark:text-gray-300 min-w-[60px] text-center text-xs uppercase tracking-wide" aria-live="polite">{TILE_SIZES[tileSizeIdx].label}</span>
              <button
                type="button"
                disabled={tileSizeIdx === TILE_SIZES.length - 1}
                onClick={() => setTileSizeKey(TILE_SIZES[tileSizeIdx + 1].key)}
                className="px-2.5 py-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400"
                aria-label="Larger tiles"
              >+</button>
            </div>
          )}
        </div>

        {(viewMode === 'tile' || viewMode === 'game') && (
          <div className="hidden md:block text-sm">
            {highlightFiltersBlock}
          </div>
        )}

        {(viewMode === 'tile' || viewMode === 'game') && onAddToBinder && binders && binders.length > 0 && (
          <div className="hidden sm:flex items-center gap-2 flex-wrap ml-auto">
            <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
              <BookmarkPlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden md:inline">Add to</span>
              <Select value={selectedBinderId} onValueChange={onBinderChange}>
                <SelectTrigger className="h-8 text-sm px-2 py-1 border-gray-300 dark:border-gray-600 bg-transparent min-w-[120px] gap-1">
                  <SelectValue placeholder="Select binder" />
                </SelectTrigger>
                <SelectContent>
                  {binders.map(b => (
                    <SelectItem key={b._id} value={b._id} className="text-sm">
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </span>
          </div>
        )}
      </div>

      {/* Highlight filter bar */}
      {(viewMode === 'tile' || viewMode === 'game') && (
        <>
          {/* ── Mobile highlight strips: two swipeable rows ── */}
          <div className="md:hidden mb-3 -mx-4 flex flex-col gap-0">

            {/* Row 1 — Zone chips: Equipment / Inventory / Bench with card counts */}
            <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto scrollbar-none bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700/60">
              {([
                { zone: 'equipment', label: 'Equipment' },
                { zone: 'inventory', label: 'Inventory' },
                { zone: 'bench',     label: 'Bench'     },
              ] as const).map(({ zone, label }) => {
                const count = getZoneCount(zone);
                const isActive = highlightFilters.some(f => f.stat === 'zone' && f.value === zone);
                return (
                  <button
                    key={zone}
                    onClick={() => count > 0 && toggleHighlight('zone', zone)}
                    aria-label={`Highlight ${label} cards (${count})`}
                    aria-pressed={isActive}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 shrink-0 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                      isActive
                        ? "border-amber-400 bg-amber-500 text-white shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                        : count > 0
                        ? "border-gray-400 dark:border-gray-500 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 active:bg-gray-200 dark:active:bg-gray-600"
                        : "border-dashed border-gray-300 dark:border-gray-600 opacity-40 cursor-default text-gray-500",
                    )}
                  >
                    {label}
                    {count > 0 && (
                      <span className={cn(
                        "text-xs font-bold px-1.5 py-0.5 rounded-full leading-none",
                        isActive ? "bg-white/25 text-white" : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300",
                      )}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
              {highlightFilters.some(f => f.stat === 'zone') && (
                <button
                  onClick={() => setHighlightFilters(f => f.filter(x => x.stat !== 'zone'))}
                  aria-label="Clear zone filter"
                  className="ml-auto flex items-center px-2.5 py-1.5 rounded-full border-2 border-gray-400 dark:border-gray-500 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 shrink-0 active:bg-gray-200 dark:active:bg-gray-600 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Row 2 — Attack 3–7+ | Defense 2–4 */}
            <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto scrollbar-none bg-gray-50 dark:bg-gray-800/50 border-t border-b border-gray-200 dark:border-gray-700/60">
              {([3, 4, 5, 6, '7+'] as const).map(v => {
                const count = getStatCount('power', v);
                const isActive = highlightFilters.some(f => f.stat === 'power' && f.value === v);
                return (
                  <button
                    key={String(v)}
                    onClick={() => count > 0 && toggleHighlight('power', v)}
                    aria-label={`Highlight attack ${v}`}
                    aria-pressed={isActive}
                    className={cn(
                      "flex items-center gap-0.5 px-2.5 py-1.5 rounded-full border-2 shrink-0 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                      isActive
                        ? "border-amber-400 bg-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                        : count > 0
                        ? "border-gray-400 dark:border-gray-500 bg-gray-100 dark:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600"
                        : "border-dashed border-gray-300 dark:border-gray-600 opacity-40 cursor-default",
                    )}
                  >
                    <span className={cn("text-sm font-bold leading-none", isActive ? "text-white" : "text-gray-800 dark:text-gray-100")}>{String(v)}</span>
                    <img src="/fab/symbols/power.png" alt="" className="w-4 h-4 object-contain" />
                  </button>
                );
              })}

              <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 shrink-0 mx-1" />

              {([2, 3, 4] as const).map(v => {
                const count = getStatCount('defense', v);
                const isActive = highlightFilters.some(f => f.stat === 'defense' && f.value === v);
                return (
                  <button
                    key={String(v)}
                    onClick={() => count > 0 && toggleHighlight('defense', v)}
                    aria-label={`Highlight defense ${v}`}
                    aria-pressed={isActive}
                    className={cn(
                      "flex items-center gap-0.5 px-2.5 py-1.5 rounded-full border-2 shrink-0 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                      isActive
                        ? "border-amber-400 bg-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                        : count > 0
                        ? "border-gray-400 dark:border-gray-500 bg-gray-100 dark:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600"
                        : "border-dashed border-gray-300 dark:border-gray-600 opacity-40 cursor-default",
                    )}
                  >
                    <span className={cn("text-sm font-bold leading-none", isActive ? "text-white" : "text-gray-800 dark:text-gray-100")}>{String(v)}</span>
                    <img src="/fab/symbols/block.png" alt="" className="w-4 h-4 object-contain" />
                  </button>
                );
              })}

              {highlightFilters.some(f => f.stat === 'power' || f.stat === 'defense') && (
                <button
                  onClick={() => setHighlightFilters(f => f.filter(x => x.stat !== 'power' && x.stat !== 'defense'))}
                  aria-label="Clear attack/defense filter"
                  className="ml-auto flex items-center px-2.5 py-1.5 rounded-full border-2 border-gray-400 dark:border-gray-500 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 shrink-0 active:bg-gray-200 dark:active:bg-gray-600 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

        </>
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
        <div className={cn("rounded border border-gray-200 dark:border-gray-700/50 p-2", hoverMode && "md:pr-[420px]")}>
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
        <div className={cn("rounded border border-gray-200 dark:border-gray-700/50 p-2", hoverMode && "md:pr-[420px]")}>
          {buildGameViewSections(displayDeck).map(section => {
            const sectionTotal = section.cards.reduce((s, c) =>
              s + (section.key === 'red' ? c.redQty : section.key === 'yellow' ? c.yellowQty : section.key === 'blue' ? c.blueQty : section.key === 'unpitched' ? c.noPitchQty : c.totalQty), 0);
            const sectionCollapseKey = `game-${section.key}`;
            const isSectionCollapsed = collapsedSections.has(sectionCollapseKey);
            const gameZoneAccent: Record<string, { bg: string; border: string; headerBorder: string; labelColor: string }> = {
              red:       { bg: "bg-red-500/10 dark:bg-red-500/[0.06]",       border: "border-l-[3px] border-l-red-500 rounded-r-lg",    headerBorder: "border-red-500/30",    labelColor: "text-red-600 dark:text-red-400" },
              yellow:    { bg: "bg-yellow-400/10 dark:bg-yellow-400/[0.05]", border: "border-l-[3px] border-l-yellow-400 rounded-r-lg", headerBorder: "border-yellow-400/30", labelColor: "text-yellow-700 dark:text-yellow-400" },
              blue:      { bg: "bg-blue-500/10 dark:bg-blue-500/[0.05]",     border: "border-l-[3px] border-l-blue-500 rounded-r-lg",   headerBorder: "border-blue-500/30",   labelColor: "text-blue-600 dark:text-blue-400" },
              unpitched: { bg: "bg-gray-500/5 dark:bg-gray-400/[0.04]",     border: "border-l-[3px] border-l-gray-400 rounded-r-lg",   headerBorder: "border-gray-500/40",   labelColor: "text-gray-700 dark:text-gray-200" },
              equipment: { bg: "",  border: "rounded-lg", headerBorder: "border-gray-700/40", labelColor: "text-gray-700 dark:text-gray-200" },
              inventory: { bg: "",  border: "rounded-lg", headerBorder: "border-gray-700/40", labelColor: "text-gray-700 dark:text-gray-200" },
              bench:     { bg: "",  border: "rounded-lg", headerBorder: "border-gray-700/40", labelColor: "text-gray-700 dark:text-gray-200" },
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
                        title={`${heroPortrait.name} — click to enlarge`}
                        onMouseEnter={isTouchDevice ? undefined : (e) => { e.stopPropagation(); hoverMode && heroPortrait.imageUrl && setHoveredImage({ url: heroPortrait.imageUrl, name: heroPortrait.name }); }}
                        onMouseLeave={isTouchDevice ? undefined : () => setHoveredImage(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (heroPortrait.imageUrl) {
                            setEnlargedImage({ url: heroPortrait.imageUrl, name: heroPortrait.name, otherFaceUrl: heroPortrait.otherFaceImageUrl });
                          }
                        }}
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
                          onMouseEnter={isTouchDevice ? undefined : (e) => { e.stopPropagation(); hoverMode && card.imageUrl && setHoveredImage({ url: card.imageUrl, name: card.name }); }}
                          onMouseLeave={isTouchDevice ? undefined : () => setHoveredImage(null)}
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
                  <span className={cn("text-sm font-bold uppercase tracking-wider", gameAccent.labelColor)}>
                    {section.title}
                  </span>
                  <span className={cn(
                    "text-sm font-semibold",
                    section.key === 'red'    ? "text-red-600 dark:text-red-400" :
                    section.key === 'yellow' ? "text-yellow-700 dark:text-yellow-400" :
                    section.key === 'blue'   ? "text-blue-600 dark:text-blue-400" :
                    "text-gray-600 dark:text-gray-300"
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
                      onMouseEnter={isTouchDevice ? undefined : () => {
                        if (!card.imageUrl) return;
                        if (hoverMode) setHoveredImage({ url: card.imageUrl, name: card.name });
                        onCardHover?.({
                          url: card.imageUrl,
                          name: card.name,
                          tcgplayerUrl: card.tcgplayerUrl,
                          tcgLow: card.tcgLow,
                        });
                      }}
                      onMouseLeave={isTouchDevice ? undefined : () => {
                        setHoveredImage(null);
                      }}
                    >
                      {card.imageUrl ? (
                        <div className="w-full overflow-hidden rounded" style={{ aspectRatio: '63/53', display: 'flex', flexDirection: 'column', gap: '1px', background: '#111827' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={card.imageUrl}
                            alt={card.name}
                            className="w-full block"
                            style={{ objectFit: 'cover', objectPosition: 'top', flex: '0 0 81%', minHeight: 0 }}
                            draggable={false}
                          />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={card.imageUrl}
                            alt=""
                            className="w-full block"
                            style={{ objectFit: 'cover', objectPosition: 'bottom', flex: '1 0 0', minHeight: 0 }}
                            draggable={false}
                            aria-hidden="true"
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
                      <span className="sr-only">{card.name}</span>
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

      {/* Filter focus overlay — dims the deck and shows matching cards floating in from their positions */}
      {/* In hover mode, skip the overlay — tiles show highlight/dim in-place instead */}
      {focusCards.length > 0 && !hoverMode && (viewMode === 'tile' || viewMode === 'game') && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-sm flex flex-col"
          onClick={() => setHighlightFilters([])}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-3 shrink-0"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-amber-400">{focusTotal} {focusTotal === 1 ? 'card' : 'cards'}</span>
              {focusFilterLabel && <span className="text-xs text-gray-500">{focusFilterLabel}</span>}
            </div>
            <button
              type="button"
              onClick={() => setHighlightFilters([])}
              className="text-gray-400 hover:text-white text-xl leading-none px-2 transition-colors"
              title="Clear filter"
            >×</button>
          </div>

          {/* Centered scrollable card grid — clicking empty space closes the overlay */}
          <div className="overflow-y-auto flex-1 flex px-6 py-4">
            <div className="flex flex-wrap justify-center gap-4 my-auto w-full">
              {focusCards.map(({ tile, count }) => {
                const isMeld = tile.name.includes(' // ');
                return (
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                <div
                  key={tile.printingId}
                  ref={el => {
                    if (el) overlayCardRefs.current.set(tile.printingId, el);
                    else overlayCardRefs.current.delete(tile.printingId);
                  }}
                  className="relative cursor-pointer group"
                  style={{ width: isMeld ? Math.round(focusCardWidth * 1.64) : focusCardWidth, opacity: 0 }}
                >
                  <FoilCardImage
                    foiling={tile.foiling}
                    src={tile.imageUrl || '/cardback.webp'}
                    alt={tile.name}
                    className="w-full rounded-lg shadow-xl ring-1 ring-white/10 group-hover:ring-amber-400/70 group-hover:scale-[1.04] transition-transform duration-150"
                    imgClassName="w-full"
                    style={{ aspectRatio: isMeld ? '4/3' : '3/4', display: 'block' }}
                    expandable
                  />
                  <div className="mt-1.5 text-center">
                    <span className="text-xs font-bold text-white font-mono">{count}×</span>
                    {' '}
                    <span className="text-[10px] text-gray-400">{tile.name}</span>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'list' && hoveredImage && (
        <HoverImagePreview imageUrl={hoveredImage.url} cardName={hoveredImage.name} onDismiss={() => setHoveredImage(null)} />
      )}
      {(viewMode === 'tile' || viewMode === 'game') && hoveredImage && !dragTile && !enlargedImage && (
        <div
          className="fixed z-[9999]"
          onClick={() => setHoveredImage(null)}
          style={{ right: 24, top: '50%', transform: 'translateY(-50%)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hoveredImage.url} alt={hoveredImage.name} className="w-72 md:w-[400px] rounded-xl shadow-2xl border border-gray-600" />
        </div>
      )}

      {/* Lightbox */}
      {enlargedImage && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer"
          onClick={() => setEnlargedImage(null)}
        >
          {enlargedImage.otherFaceUrl ? (
            <div className="flex gap-3 items-center" onClick={e => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={enlargedImage.url}
                alt={enlargedImage.name}
                className="w-[min(44vw,320px)] h-auto rounded-xl shadow-2xl border border-gray-600"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={enlargedImage.otherFaceUrl}
                alt={`${enlargedImage.name} (back face)`}
                className="w-[min(44vw,320px)] h-auto rounded-xl shadow-2xl border border-gray-600"
              />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={enlargedImage.url}
              alt={enlargedImage.name}
              className="w-[min(90vw,460px)] h-auto rounded-xl shadow-2xl border border-gray-600"
              onClick={e => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </>
  );
}
