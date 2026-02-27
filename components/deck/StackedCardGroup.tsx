// components/deck/StackedCardGroup.tsx
"use client";

import React, { useState } from "react";
import CompactStackedCard from "./CompactStackedCard";
import { Badge } from "@/components/ui/badge";

interface DeckPrinting {
  _id?: string;
  printingId: string;
  quantity?: number;  // ✅ ADDED: Quantity of this printing
  condition?: string;
  notes?: string;
  addedAt: string;
  isOptimistic?: boolean;
  printingDetails?: { [key: string]: any };
  tags?: string[];
}

interface CardGroup {
  cardName: string;
  cardId: string;
  category: string;
  printings: (DeckPrinting & { category: string })[];
}

interface StackedCardGroupProps {
  group: CardGroup;
  maxVisible?: number;
  ownershipStatus?: Map<string, any>;
  onSwapPrinting?: (printing: DeckPrinting & { category: string }) => void;
  onAddToWants?: (printing: DeckPrinting & { category: string }) => void;
  onAddToBinder?: (printing: DeckPrinting & { category: string }) => void;
  onMove?: (printing: DeckPrinting & { category: string }) => void;
  onRemove?: (printing: DeckPrinting & { category: string }) => void;
  onAddAnother?: (printing: DeckPrinting & { category: string }) => void;
  wantsMap?: Map<string, number>;
  binderMap?: Map<string, { quantity: number; cardId: string }>;
  deckCardCounts?: Map<string, number>;
  editable?: boolean;
}

export default function StackedCardGroup({
  group,
  maxVisible = 15,
  ownershipStatus,
  onSwapPrinting,
  onAddToWants,
  onAddToBinder,
  onMove,
  onRemove,
  onAddAnother,
  wantsMap,
  binderMap,
  deckCardCounts,
  editable
}: StackedCardGroupProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isGroupHovered, setIsGroupHovered] = useState(false);

  // Sort printings by color priority: red > yellow > blue > others
  // Include group.printings length and first printing ID to detect changes
  const sortedPrintings = React.useMemo(() => {
    const colorPriority: { [key: string]: number } = {
      'red': 1,
      'yellow': 2,
      'blue': 3,
    };

    return [...group.printings].sort((a, b) => {
      const colorA = (a.printingDetails?.color || '').toLowerCase();
      const colorB = (b.printingDetails?.color || '').toLowerCase();
      const priorityA = colorPriority[colorA] || 999;
      const priorityB = colorPriority[colorB] || 999;
      return priorityA - priorityB;
    });
  }, [group.printings]);

  // When hovering, show all cards (or up to maxVisible). When stacked, show only first card
  const visiblePrintings = isGroupHovered
    ? sortedPrintings.slice(0, Math.min(maxVisible, sortedPrintings.length))  // Show more when expanded
    : sortedPrintings.slice(0, 1);  // Show only 1 card when stacked (the red/yellow/blue one)

  const remainingCount = isGroupHovered
    ? Math.max(0, sortedPrintings.length - maxVisible)
    : 0;  // Don't show "+X more" when stacked, we'll show it in the badge

  // Group cards by color for row-based fanning
  const cardsByColor = React.useMemo(() => {
    const grouped: { [key: string]: typeof visiblePrintings } = {
      red: [],
      yellow: [],
      blue: [],
      other: []
    };

    visiblePrintings.forEach(printing => {
      const color = (printing.printingDetails?.color || '').toLowerCase().trim();

      // Debug logging
      console.log('Card color:', {
        name: printing.printingDetails?.display_name || printing.printingDetails?.name,
        color: color,
        rawColor: printing.printingDetails?.color,
        allDetails: printing.printingDetails
      });

      if (color === 'red') grouped.red.push(printing);
      else if (color === 'yellow') grouped.yellow.push(printing);
      else if (color === 'blue') grouped.blue.push(printing);
      else grouped.other.push(printing);
    });

    console.log('Grouped by color:', {
      red: grouped.red.length,
      yellow: grouped.yellow.length,
      blue: grouped.blue.length,
      other: grouped.other.length
    });

    return grouped;
  }, [visiblePrintings]);

  // Calculate offset based on hover state and color grouping
  const getCardOffset = (printing: typeof visiblePrintings[0], globalIndex: number) => {
    if (isGroupHovered) {
      // Expanded state: fan by color rows
      const color = (printing.printingDetails?.color || '').toLowerCase();
      let rowIndex = 0;
      let columnIndex = 0;

      // Dynamically assign row index based on which colors exist
      // Only increment row for colors that have cards
      if (color === 'red') {
        rowIndex = 0;
        columnIndex = cardsByColor.red.findIndex(p => p === printing);
      } else if (color === 'yellow') {
        rowIndex = (cardsByColor.red.length > 0 ? 1 : 0);
        columnIndex = cardsByColor.yellow.findIndex(p => p === printing);
      } else if (color === 'blue') {
        rowIndex = (cardsByColor.red.length > 0 ? 1 : 0) + (cardsByColor.yellow.length > 0 ? 1 : 0);
        columnIndex = cardsByColor.blue.findIndex(p => p === printing);
      } else {
        rowIndex = (cardsByColor.red.length > 0 ? 1 : 0) + (cardsByColor.yellow.length > 0 ? 1 : 0) + (cardsByColor.blue.length > 0 ? 1 : 0);
        columnIndex = cardsByColor.other.findIndex(p => p === printing);
      }

      // Calculate z-index for proper left-to-right stacking
      // Within a row: left cards should be BEHIND (lower z) right cards
      // Between rows: doesn't matter as much since they don't overlap vertically
      // Use globalIndex as the base to maintain overall card order
      const zIndex = globalIndex;

      return {
        x: columnIndex * 100, // Horizontal spacing within row
        y: rowIndex * 210,    // Vertical spacing between rows (card height + gap)
        scale: hoveredIndex === globalIndex ? 1.05 : 1,
        zIndex: zIndex, // Use global index to maintain natural order
      };
    } else {
      // Stacked state: show only the first card, but add shadow layers to indicate stack depth
      return {
        x: 0,
        y: 0,
        scale: 1,
        zIndex: 0,
      };
    }
  };

  return (
    <div
      className={`relative flex flex-col transition-opacity duration-300 ${
        isGroupHovered ? 'z-50 opacity-100' : 'opacity-100 hover:opacity-100'
      }`}
      onMouseEnter={() => setIsGroupHovered(true)}
      onMouseLeave={() => {
        setIsGroupHovered(false);
        setHoveredIndex(null);
      }}
    >
      {/* Stacked cards container */}
      <div
        className="relative mb-2"
        style={{
          height: isGroupHovered
            ? `${Math.max(
                (cardsByColor.red.length > 0 ? 1 : 0) +
                (cardsByColor.yellow.length > 0 ? 1 : 0) +
                (cardsByColor.blue.length > 0 ? 1 : 0) +
                (cardsByColor.other.length > 0 ? 1 : 0)
              ) * 210}px` // Height based on number of color rows
            : '196px', // Single card height when stacked
          minWidth: isGroupHovered
            ? `${Math.max(
                cardsByColor.red.length,
                cardsByColor.yellow.length,
                cardsByColor.blue.length,
                cardsByColor.other.length
              ) * 100 + 140}px` // Width based on widest color row
            : '140px', // Fixed width when stacked (just the card width)
          transition: 'all 300ms ease-out',
        }}
      >
        {/* Shadow layers to show stack depth when not hovered */}
        {!isGroupHovered && sortedPrintings.length > 1 && (
          <>
            {/* Second card shadow */}
            <div
              className="absolute bg-gray-700 rounded-lg border-2 border-gray-600"
              style={{
                width: '140px',
                height: '196px',
                transform: 'translate(3px, 3px)',
                zIndex: -2,
              }}
            />
            {/* Third card shadow (only if 3+ cards) */}
            {sortedPrintings.length > 2 && (
              <div
                className="absolute bg-gray-600 rounded-lg border-2 border-gray-500"
                style={{
                  width: '140px',
                  height: '196px',
                  transform: 'translate(6px, 6px)',
                  zIndex: -3,
                }}
              />
            )}
          </>
        )}

        {visiblePrintings.map((printing, index) => {
          const offset = getCardOffset(printing, index);

          // Create a unique key that includes foiling/edition to detect printing changes
          const uniqueKey = printing._id
            ? `${printing._id}-${printing.printingDetails?.foiling}-${printing.printingDetails?.edition}`
            : `${printing.printingId}-${index}-${printing.printingDetails?.foiling}-${printing.printingDetails?.edition}`;

          // Calculate wants info
          const wanted = wantsMap?.get(printing.printingId) || 0;
          const inDeck = deckCardCounts?.get(printing.printingId) || 0;
          const wantsInfo = { wanted, inDeck };

          // Calculate binder info
          const binderData = binderMap?.get(printing.printingId);
          const owned = binderData?.quantity || 0;
          const binderInfo = { owned, inDeck };

          return (
            <div
              key={uniqueKey}
              className="absolute transition-all duration-300 ease-out cursor-pointer"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${offset.scale})`,
                zIndex: hoveredIndex === index ? 100 : offset.zIndex,
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <CompactStackedCard
                printing={printing}
                showFullDetails={hoveredIndex === index}
                isHovered={hoveredIndex === index}
                ownership={ownershipStatus?.get(printing.printingId)}
                onSwapPrinting={onSwapPrinting}
                onAddToWants={onAddToWants}
                onAddToBinder={onAddToBinder}
                onMove={onMove}
                onRemove={onRemove}
                onAddAnother={onAddAnother}
                wantsInfo={wantsInfo}
                binderInfo={binderInfo}
                editable={editable}
              />
            </div>
          );
        })}

        {/* "+X more" indicator if there are hidden cards */}
        {remainingCount > 0 && (
          <div
            className="absolute flex items-center justify-center bg-gray-800 border-2 border-gray-600 rounded-lg shadow-lg"
            style={{
              width: '140px',
              height: '196px',
              transform: isGroupHovered
                ? `translate(${visiblePrintings.length * 100}px, 0px)`
                : `translate(${visiblePrintings.length * 4}px, 0px)`,
              zIndex: visiblePrintings.length,
              transition: 'all 300ms ease-out',
            }}
          >
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-400">+{remainingCount}</div>
              <div className="text-xs text-gray-500">more</div>
            </div>
          </div>
        )}
      </div>

      {/* Card name and count below stack */}
      <div className="flex flex-col gap-1 px-1">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-sm truncate max-w-[140px]">{group.cardName}</h4>
          <Badge variant="secondary" className="text-xs px-1.5 py-0">
            {/* ✅ Sum quantities instead of counting array length */}
            {sortedPrintings.reduce((sum, p) => sum + (p.quantity || 1), 0)}x
          </Badge>
        </div>

        {/* Printing breakdown summary - only show when not hovered */}
        {!isGroupHovered && sortedPrintings.length > 1 && (
          <div className="flex flex-wrap gap-1 text-[10px] text-gray-400">
            {getFoilingBreakdown(sortedPrintings).map((item, i) => (
              <span key={i} className="whitespace-nowrap">
                {item.count > 1 ? `${item.count} ` : ''}{item.foiling}
              </span>
            )).reduce((prev, curr, i) => i === 0 ? [curr] : [...prev, <span key={`sep-${i}`}> • </span>, curr], [] as React.ReactNode[])}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to get foiling breakdown (simplified display)
function getFoilingBreakdown(printings: (DeckPrinting & { category: string })[]) {
  const breakdown: { [key: string]: number } = {};

  printings.forEach(p => {
    const allDetails = (p.printingDetails as any)?.allDetails || p.printingDetails || {};
    const foiling = allDetails.foiling || 's';
    const foilingLabel = getFoilingShort(foiling);
    breakdown[foilingLabel] = (breakdown[foilingLabel] || 0) + 1;
  });

  return Object.entries(breakdown)
    .map(([foiling, count]) => ({ foiling, count }))
    .sort((a, b) => b.count - a.count); // Sort by count descending
}

// Helper function to get printing breakdown (for reference, if needed)
function getPrintingBreakdown(printings: (DeckPrinting & { category: string })[]) {
  const breakdown: { [key: string]: number } = {};

  printings.forEach(p => {
    const allDetails = (p.printingDetails as any)?.allDetails || p.printingDetails || {};
    const edition = allDetails.edition || 'n';
    const foiling = allDetails.foiling || 's';
    const key = `${getEditionShort(edition)}-${getFoilingShort(foiling)}`;
    breakdown[key] = (breakdown[key] || 0) + 1;
  });

  return Object.entries(breakdown)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count); // Sort by count descending
}

function getEditionShort(edition: string): string {
  const map: { [key: string]: string } = {
    'f': '1st',
    'F': '1st',
    'u': 'UNL',
    'U': 'UNL',
    'n': 'Normal',
    'N': 'Normal',
  };
  return map[edition] || edition;
}

function getFoilingShort(foiling: string): string {
  const map: { [key: string]: string } = {
    'r': 'RF',
    'R': 'RF',
    'c': 'CF',
    'C': 'CF',
    'g': 'GF',
    'G': 'GF',
    's': 'NF',
    'S': 'NF',
  };
  return map[foiling] || foiling;
}
