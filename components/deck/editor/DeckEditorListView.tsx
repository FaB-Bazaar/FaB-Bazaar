"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, ArrowLeftRight, Loader2, Archive, ArchiveRestore, Sofa } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeckDTO, DeckPrintingDTO, DeckCategory } from "@/lib/services/contracts/IDeckService";
import type { OwnershipEntry, SwapTarget } from "@/hooks/deck/useDeckEditor";

const PITCH_DOT_CLASS: Record<number, string> = {
  1: "bg-red-500",
  2: "bg-yellow-400",
  3: "bg-blue-500",
};

function PitchDot({ pitch }: { pitch?: number | null }) {
  const cls = pitch ? PITCH_DOT_CLASS[pitch] : "bg-gray-300 dark:bg-gray-600";
  return <span className={cn("w-2.5 h-2.5 rounded-full inline-block flex-shrink-0", cls)} />;
}

function OwnershipBadge({ owned, needed }: OwnershipEntry) {
  if (owned >= needed) {
    return <span className="text-xs text-green-600 dark:text-green-400 font-medium w-8 text-right">✓</span>;
  }
  return (
    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium w-8 text-right tabular-nums">
      {owned}/{needed}
    </span>
  );
}

interface MoveAction {
  title: string;
  icon: "archive" | "archive-restore" | "sofa";
  onClick: () => void;
}

interface DeckCardRowProps {
  printing: DeckPrintingDTO;
  category: DeckCategory;
  showPitchDot: boolean;
  ownershipInfo?: OwnershipEntry;
  onSwap: () => void;
  onRemove: () => void;
  isRemoving: boolean;
  moves?: MoveAction[];
}

function DeckCardRow({ printing, category, showPitchDot, ownershipInfo, onSwap, onRemove, isRemoving, moves }: DeckCardRowProps) {
  const p = printing.printingDetails;
  const name = p?.display_name || p?.name || printing.printingId;
  const qty = printing.quantity ?? 1;
  const pitch = p?.pitch as number | undefined;
  const price = p?.tcg_low;

  return (
    <div className="flex items-center gap-2 py-1.5 px-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 group border-b border-gray-100 dark:border-gray-800 last:border-0">
      {showPitchDot && <PitchDot pitch={pitch} />}
      <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums w-6 text-right flex-shrink-0">{qty}×</span>
      <span className="text-sm text-gray-900 dark:text-gray-100 flex-1 min-w-0 truncate">{name}</span>
      {ownershipInfo ? (
        <OwnershipBadge owned={ownershipInfo.owned} needed={ownershipInfo.needed} />
      ) : (
        <span className="w-8" />
      )}
      {price != null && (
        <span className="text-xs text-gray-400 tabular-nums w-14 text-right hidden sm:block">
          ${price.toFixed(2)}
        </span>
      )}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-gray-400 hover:text-blue-500"
          onClick={onSwap}
          title="Swap printing"
        >
          <ArrowLeftRight className="h-3 w-3" />
        </Button>
        {moves?.map((m, i) => (
          <Button
            key={i}
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-gray-400 hover:text-indigo-500"
            onClick={m.onClick}
            title={m.title}
          >
            {m.icon === "archive-restore" ? <ArchiveRestore className="h-3 w-3" /> :
             m.icon === "sofa" ? <Sofa className="h-3 w-3" /> :
             <Archive className="h-3 w-3" />}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-gray-400 hover:text-red-500"
          onClick={onRemove}
          disabled={isRemoving}
          title="Remove from deck"
        >
          {isRemoving ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  );
}

function groupByPitch(cards: DeckPrintingDTO[]): Array<{ pitchKey: string; label: string; cards: DeckPrintingDTO[] }> {
  const groups = new Map<string, DeckPrintingDTO[]>();
  for (const card of cards) {
    const pitch = (card.printingDetails?.pitch as number | undefined | null);
    const key = pitch != null && pitch > 0 ? String(pitch) : "0";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(card);
  }
  const order = ["1", "2", "3", "0"];
  const labels: Record<string, string> = {
    "1": "Pitch 1 – Red",
    "2": "Pitch 2 – Yellow",
    "3": "Pitch 3 – Blue",
    "0": "No Pitch",
  };
  const sortAlpha = (arr: DeckPrintingDTO[]) =>
    [...arr].sort((a, b) => {
      const nameA = a.printingDetails?.display_name || a.printingDetails?.name || "";
      const nameB = b.printingDetails?.display_name || b.printingDetails?.name || "";
      return nameA.localeCompare(nameB);
    });

  return order
    .filter(k => groups.has(k))
    .map(k => ({ pitchKey: k, label: labels[k], cards: sortAlpha(groups.get(k)!) }));
}

interface DeckEditorListViewProps {
  deck: DeckDTO;
  ownershipMap: Map<string, OwnershipEntry>;
  onSwap: (target: SwapTarget) => void;
  onRemove: (printingId: string, category: DeckCategory) => Promise<void>;
  onMove?: (printingId: string, fromCategory: DeckCategory, toCategory: DeckCategory, quantity: number) => Promise<void>;
}

function buildMoves(
  card: DeckPrintingDTO,
  fromCategory: DeckCategory,
  onMove?: DeckEditorListViewProps["onMove"]
): MoveAction[] {
  if (!onMove) return [];
  const qty = card.quantity ?? 1;
  if (fromCategory === "maindeck") return [
    { title: "Move to Inventory", icon: "archive", onClick: () => onMove(card.printingId, "maindeck", "inventory", qty) },
    { title: "Move to Bench", icon: "sofa", onClick: () => onMove(card.printingId, "maindeck", "benched", qty) },
  ];
  if (fromCategory === "equipment") return [
    { title: "Move to Inventory", icon: "archive", onClick: () => onMove(card.printingId, "equipment", "inventory", qty) },
  ];
  if (fromCategory === "inventory") return [
    { title: "Move to Library", icon: "archive-restore", onClick: () => onMove(card.printingId, "inventory", "maindeck", qty) },
    { title: "Move to Bench", icon: "sofa", onClick: () => onMove(card.printingId, "inventory", "benched", qty) },
  ];
  if (fromCategory === "benched") return [
    { title: "Move to Library", icon: "archive-restore", onClick: () => onMove(card.printingId, "benched", "maindeck", qty) },
    { title: "Move to Inventory", icon: "archive", onClick: () => onMove(card.printingId, "benched", "inventory", qty) },
  ];
  return [];
}

export default function DeckEditorListView({ deck, ownershipMap, onSwap, onRemove, onMove }: DeckEditorListViewProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = async (printingId: string, category: DeckCategory) => {
    setRemovingId(printingId);
    try {
      await onRemove(printingId, category);
    } finally {
      setRemovingId(null);
    }
  };

  const makeSwapTarget = (card: DeckPrintingDTO, category: DeckCategory): SwapTarget => ({
    printingId: card.printingId,
    cardUniqueId: card.printingDetails?.card_unique_id || "",
    cardName: card.printingDetails?.display_name || card.printingDetails?.name || "",
    category,
  });

  const renderSection = (
    label: string,
    cards: DeckPrintingDTO[],
    category: DeckCategory,
    limit?: string,
  ) => {
    if (cards.length === 0) return null;
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
          {cards.map(card => (
            <DeckCardRow
              key={card.printingId}
              printing={card}
              category={category}
              showPitchDot={false}
              ownershipInfo={ownershipMap.get(card.printingId)}
              onSwap={() => onSwap(makeSwapTarget(card, category))}
              onRemove={() => handleRemove(card.printingId, category)}
              isRemoving={removingId === card.printingId}
              moves={buildMoves(card, category, onMove)}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderMaindeck = () => {
    const cards = deck.maindeck || [];
    if (cards.length === 0) return null;
    const total = cards.reduce((s, c) => s + (c.quantity ?? 1), 0);
    const pitchGroups = groupByPitch(cards);

    return (
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
          Main Deck
          <span className="text-xs font-normal text-gray-400">
            {total} card{total !== 1 ? "s" : ""} / 60+
          </span>
        </h3>
        <div className="space-y-3">
          {pitchGroups.map(group => (
            <div key={group.pitchKey}>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1 flex items-center gap-1.5">
                {group.pitchKey !== "0" && (
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full inline-block",
                      PITCH_DOT_CLASS[parseInt(group.pitchKey)] ?? "bg-gray-400"
                    )}
                  />
                )}
                {group.label}
                <span className="text-gray-400 font-normal">
                  ({group.cards.reduce((s, c) => s + (c.quantity ?? 1), 0)})
                </span>
              </div>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                {group.cards.map(card => (
                  <DeckCardRow
                    key={card.printingId}
                    printing={card}
                    category="maindeck"
                    showPitchDot={true}
                    ownershipInfo={ownershipMap.get(card.printingId)}
                    onSwap={() => onSwap(makeSwapTarget(card, "maindeck"))}
                    onRemove={() => handleRemove(card.printingId, "maindeck")}
                    isRemoving={removingId === card.printingId}
                    moves={buildMoves(card, "maindeck", onMove)}
                  />
                ))}
              </div>
            </div>
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

  if (heroCards.length === 0 && equipmentCards.length === 0 && maindeckCards.length === 0 && inventoryCards.length === 0 && benchedCards.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
        <p className="font-medium">This deck is empty.</p>
        <p className="text-sm mt-1">Use the Search tab to find cards to add.</p>
      </div>
    );
  }

  return (
    <div>
      {renderSection("Hero", heroCards, "hero", "1")}
      {renderSection("Equipment", equipmentCards, "equipment", "5")}
      {renderMaindeck()}
      {renderSection("Inventory", inventoryCards, "inventory")}
      {renderSection("Bench", benchedCards, "benched")}
    </div>
  );
}
