"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, ArrowLeftRight, Loader2, Archive, ArchiveRestore, Sofa, ChevronRight, ChevronDown } from "lucide-react";
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

// ─── Section ──────────────────────────────────────────────────────────────────

interface DeckEditorListViewProps {
  deck: DeckDTO;
  ownershipMap: Map<string, OwnershipEntry>;
  onSwap: (target: SwapTarget) => void;
  onRemove: (printingId: string, category: DeckCategory) => Promise<void>;
  onMove?: (printingId: string, fromCategory: DeckCategory, toCategory: DeckCategory, quantity: number) => Promise<void>;
}

export default function DeckEditorListView({ deck, ownershipMap, onSwap, onRemove, onMove }: DeckEditorListViewProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [hoveredImage, setHoveredImage] = useState<{ url: string; name: string } | null>(null);

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

  return (
    <>
      <div>
        {renderSection("Hero", heroCards, "hero", "1")}
        {renderSection("Equipment", equipmentCards, "equipment", "5")}
        {renderSection("Main Deck", maindeckCards, "maindeck", "60+")}
        {renderSection("Inventory", inventoryCards, "inventory")}
        {renderSection("Bench", benchedCards, "benched")}
      </div>
      {hoveredImage && (
        <HoverImagePreview imageUrl={hoveredImage.url} cardName={hoveredImage.name} />
      )}
    </>
  );
}
