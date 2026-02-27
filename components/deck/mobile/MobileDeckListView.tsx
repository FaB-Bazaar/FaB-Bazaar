// components/deck/mobile/MobileDeckListView.tsx
"use client";

import React, { useMemo, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Plus, Minus, ChevronDown, ChevronUp } from "lucide-react";
import type { DeckPrinting, DeckCategory } from "./types";
import { PITCH_LABELS, PITCH_COLORS } from "./types";
import { FOILING_NAME_MAP } from "@/lib/formatters/cardListFormatter";

interface MobileDeckListViewProps {
  printings: (DeckPrinting & { category: string })[];
  category: DeckCategory;
  ownershipStatus: Map<string, any>;
  wantsMap: Map<string, number>;
  onCardTap: (printing: DeckPrinting & { category: string }) => void;
  onAddCard?: (printing: DeckPrinting & { category: string }) => void;
  onRemoveCard?: (printing: DeckPrinting & { category: string }) => void;
}

export default function MobileDeckListView({
  printings,
  category,
  ownershipStatus,
  wantsMap,
  onCardTap,
  onAddCard,
  onRemoveCard,
}: MobileDeckListViewProps) {
  const categoryPrintings = printings.filter((p) => p.category === category);

  // Track which cards are expanded
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Toggle expanded state for a card
  const toggleExpanded = useCallback((cardName: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardName)) {
        next.delete(cardName);
      } else {
        next.add(cardName);
      }
      return next;
    });
  }, []);

  // Group by pitch, then by card name within each pitch
  const groupedByPitch = useMemo(() => {
    const groups: Record<
      string,
      Record<string, (DeckPrinting & { category: string })[]>
    > = {
      "pitch-1-red": {},
      "pitch-2-yellow": {},
      "pitch-3-blue": {},
      "no-pitch": {},
    };

    categoryPrintings.forEach((printing) => {
      const pitchValue =
        printing.printingDetails?.pitch?.$numberInt ||
        printing.printingDetails?.pitch;
      let pitchKey = "no-pitch";
      if (pitchValue === 3 || pitchValue === "3") pitchKey = "pitch-3-blue";
      else if (pitchValue === 2 || pitchValue === "2")
        pitchKey = "pitch-2-yellow";
      else if (pitchValue === 1 || pitchValue === "1")
        pitchKey = "pitch-1-red";

      const cardName =
        printing.printingDetails?.display_name ||
        printing.printingDetails?.name ||
        "Unknown Card";

      if (!groups[pitchKey][cardName]) {
        groups[pitchKey][cardName] = [];
      }
      groups[pitchKey][cardName].push(printing);
    });

    const pitchOrder = [
      "pitch-1-red",
      "pitch-2-yellow",
      "pitch-3-blue",
      "no-pitch",
    ];
    return pitchOrder
      .filter((pitch) => Object.keys(groups[pitch]).length > 0)
      .map((pitch) => ({
        pitch,
        cards: groups[pitch],
      }));
  }, [categoryPrintings]);

  if (categoryPrintings.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
        No cards in this category yet.
      </div>
    );
  }

  return (
    <div className="px-2 py-2 space-y-3">
      {groupedByPitch.map(({ pitch, cards }) => (
        <div key={pitch}>
          {/* Pitch header */}
          <div
            className={cn(
              "px-2.5 py-1 rounded-t-md text-xs font-semibold flex items-center justify-between",
              pitch === "pitch-3-blue" &&
                "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100",
              pitch === "pitch-2-yellow" &&
                "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-100",
              pitch === "pitch-1-red" &&
                "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-100",
              pitch === "no-pitch" &&
                "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
            )}
          >
            <span>{PITCH_LABELS[pitch]}</span>
            <span className="opacity-75">
              {Object.values(cards).reduce((s, g) => s + g.reduce((sum, p) => sum + (p.quantity || 1), 0), 0)}
            </span>
          </div>

          {/* Card rows */}
          <div className="border border-t-0 rounded-b-md border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
            {Object.entries(cards).map(([cardName, cardPrintings]) => {
              const firstPrinting = cardPrintings[0];
              const quantity = cardPrintings.reduce((sum, p) => sum + (p.quantity || 1), 0);
              const { cost, power, defense, tcg_low } =
                firstPrinting.printingDetails || {};
              const foiling = firstPrinting.printingDetails?.foiling;
              const ownershipInfo = ownershipStatus.get(
                firstPrinting.printingId
              );
              const owned = ownershipInfo?.owned || 0;
              const alternatives = ownershipInfo?.alternative || 0;
              const wantsCount = wantsMap.get(firstPrinting.printingId) || 0;

              const isExpanded = expandedCards.has(cardName);

              return (
                <div key={`${cardName}-${firstPrinting.printingId}`}>
                  {/* Main card row */}
                  <div className="flex items-center w-full text-left gap-2 px-2 py-2">
                    {/* Pitch color bar */}
                    <div
                      className={cn(
                        "w-1 self-stretch rounded-full shrink-0",
                        PITCH_COLORS[pitch]
                      )}
                    />

                    {/* Expand/Collapse button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(cardName);
                      }}
                      className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 dark:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors shrink-0"
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <ChevronDown className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                      )}
                    </button>

                    {/* Quantity controls with +/- buttons (only when collapsed) */}
                    {!isExpanded && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        {onRemoveCard && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveCard(firstPrinting);
                            }}
                            className="w-5 h-5 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600 transition-colors"
                            aria-label="Remove one"
                          >
                            <Minus className="w-3 h-3 text-gray-700 dark:text-gray-300" />
                          </button>
                        )}
                        <span className="text-xs text-gray-500 font-mono w-7 text-center" aria-live="polite">
                          {quantity}x
                        </span>
                        {onAddCard && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddCard(firstPrinting);
                            }}
                            className="w-5 h-5 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600 transition-colors"
                            aria-label="Add one"
                          >
                            <Plus className="w-3 h-3 text-gray-700 dark:text-gray-300" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Total count when expanded */}
                    {isExpanded && (
                      <span className="text-xs text-gray-500 font-mono w-12 text-center" aria-live="polite">
                        {quantity}x
                      </span>
                    )}

                    {/* Clickable card details area */}
                    <button
                      onClick={() => onCardTap(firstPrinting)}
                      className="flex items-center gap-2 flex-1 min-w-0 active:bg-gray-100 dark:active:bg-gray-800 transition-colors -mx-2 px-2 py-1 rounded"
                    >
                      {/* Card name + foiling (only show foiling when collapsed) */}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate block">
                          {cardName}
                        </span>
                        {!isExpanded && foiling && foiling.toLowerCase() !== "n" && foiling.toLowerCase() !== "s" && (
                          <span className="text-[10px] text-purple-600 dark:text-purple-400">
                            {FOILING_NAME_MAP[foiling.toLowerCase() as keyof typeof FOILING_NAME_MAP] || foiling}
                          </span>
                        )}
                      </div>

                      {/* Ownership dot */}
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          owned >= quantity
                            ? "bg-green-500"
                            : owned + alternatives >= quantity
                            ? "bg-yellow-500"
                            : owned > 0
                            ? "bg-orange-500"
                            : "bg-red-500"
                        )}
                        title={
                          owned >= quantity
                            ? "Owned"
                            : owned > 0
                            ? `${owned}/${quantity}`
                            : "Not owned"
                        }
                      />

                      {/* Price */}
                      {tcg_low > 0 && (
                        <span className="text-xs text-green-600 font-semibold shrink-0 w-12 text-right">
                          ${tcg_low.toFixed(2)}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Individual printing rows (when expanded) */}
                  {isExpanded && (
                    <div className="bg-gray-50 dark:bg-gray-900/50">
                      {cardPrintings.map((printing, idx) => {
                        const printingFoiling = printing.printingDetails?.foiling?.toLowerCase() || "s";
                        const foilingLabel = FOILING_NAME_MAP[printingFoiling as keyof typeof FOILING_NAME_MAP] || "Standard";
                        const printingOwnershipInfo = ownershipStatus.get(printing.printingId);
                        const printingOwned = printingOwnershipInfo?.owned || 0;
                        const printingAlternatives = printingOwnershipInfo?.alternative || 0;
                        const set = printing.printingDetails?.set?.toUpperCase() || "";
                        const edition = printing.printingDetails?.edition?.toLowerCase() || "";
                        const editionLabel = edition === "f" ? "1st" : edition === "u" ? "Unl" : edition === "a" ? "Alpha" : "";

                        return (
                          <button
                            key={`${printing.printingId}-${idx}`}
                            onClick={() => onCardTap(printing)}
                            className="flex items-center gap-2 px-2 py-1.5 pl-10 border-l-2 border-gray-300 dark:border-gray-600 ml-2 w-full text-left hover:bg-gray-100 dark:hover:bg-gray-800/50 active:bg-gray-200 dark:active:bg-gray-700 transition-colors"
                          >
                            {/* 1x indicator */}
                            <span className="text-xs text-gray-500 font-mono w-7 text-center">
                              1x
                            </span>

                            {/* Foiling + Set/Edition info */}
                            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {foilingLabel}
                              </span>
                              {(set || editionLabel) && (
                                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                  {set} {editionLabel && `• ${editionLabel}`}
                                </span>
                              )}
                            </div>

                            {/* Ownership status */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {printingOwned >= 1 ? (
                                <span className="text-[10px] font-semibold text-green-600 dark:text-green-400">
                                  ✓ Own{printingOwned > 1 ? ` (${printingOwned})` : ""}
                                </span>
                              ) : printingAlternatives > 0 ? (
                                <span className="text-[10px] font-medium text-yellow-600 dark:text-yellow-400">
                                  Alt
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-red-600 dark:text-red-400">
                                  ✗ Need
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
