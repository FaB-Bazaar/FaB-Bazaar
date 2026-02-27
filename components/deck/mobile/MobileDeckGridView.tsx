// components/deck/mobile/MobileDeckGridView.tsx
"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { DeckPrinting, DeckCategory } from "./types";

interface MobileDeckGridViewProps {
  printings: (DeckPrinting & { category: string })[];
  category: DeckCategory;
  onCardTap: (printing: DeckPrinting & { category: string }) => void;
}

export default function MobileDeckGridView({
  printings,
  category,
  onCardTap,
}: MobileDeckGridViewProps) {
  const categoryPrintings = printings.filter((p) => p.category === category);

  // Group by card_unique_id to keep different pitch cards separate
  const groupedCards = useMemo(() => {
    const groups: Record<
      string,
      { printing: DeckPrinting & { category: string }; quantity: number }
    > = {};

    categoryPrintings.forEach((printing) => {
      // Use card_unique_id to differentiate cards with different pitch values
      const cardUniqueId =
        printing.printingDetails?.card_unique_id ||
        printing.printingId ||
        "unknown";
      if (!groups[cardUniqueId]) {
        groups[cardUniqueId] = { printing, quantity: 0 };
      }
      groups[cardUniqueId].quantity++;
    });

    return Object.values(groups);
  }, [categoryPrintings]);

  if (groupedCards.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
        No cards in this category yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1.5 px-2 py-2">
      {groupedCards.map(({ printing, quantity }) => {
        const cardName =
          printing.printingDetails?.display_name ||
          printing.printingDetails?.name ||
          "Unknown";
        const imageUrl = printing.printingDetails?.image_url;

        return (
          <button
            key={`${cardName}-${printing.printingId}`}
            className="relative aspect-[5/7] rounded-md overflow-hidden bg-gray-200 dark:bg-gray-800 active:opacity-80 transition-opacity"
            onClick={() => onCardTap(printing)}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={cardName}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center p-1">
                <span className="text-[10px] text-gray-500 text-center leading-tight">
                  {cardName}
                </span>
              </div>
            )}

            {/* Quantity badge */}
            {quantity > 1 && (
              <div className="absolute top-1 right-1 bg-black/75 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {quantity}x
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
