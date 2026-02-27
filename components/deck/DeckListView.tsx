// components/deck/DeckListView.tsx - Compact list view for deck cards
"use client"

import React from "react"
import { Plus, Trash2, Copy, Move, Repeat } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface DeckPrinting {
  _id?: string;
  printingId: string;
  quantity?: number;  // Added: actual quantity from database
  condition?: string;
  notes?: string;
  addedAt: string;
  isOptimistic?: boolean;
  printingDetails?: { [key: string]: any };
}

interface CardGroup {
  cardName: string;
  cardId: string;
  category: "hero" | "equipment" | "maindeck" | "inventory";
  printings: (DeckPrinting & { category: string })[];
}

interface DeckListViewProps {
  printings: (DeckPrinting & { category: string })[];
  groupedCards: Record<string, CardGroup>;
  category: "hero" | "equipment" | "maindeck" | "inventory";
  editable: boolean;
  ownershipStatus?: Map<string, any>;
  wantsMap?: Map<string, number>;
  binderMap?: Map<string, { quantity: number; cardId: string }>;
  deckCardCounts?: Map<string, number>;
  onRemove: (printing: DeckPrinting & { category: string }) => void;
  onAddAnother: (printing: DeckPrinting & { category: string }) => void;
  onMove?: (printing: DeckPrinting & { category: string }) => void;
  onOpenPrintingSwap?: (printing: DeckPrinting & { category: string }) => void;
  onOpenOwnershipComparison?: (printing: DeckPrinting & { category: string }) => void;
  onAddCard: () => void;
  removingCards?: Set<string>;
}

const CATEGORY_LABELS = {
  hero: "Hero",
  equipment: "Equipment",
  maindeck: "Main Deck",
  inventory: "Inventory"
};

const PITCH_LABELS = {
  'pitch-3-blue': 'Pitch 3 - Blue',
  'pitch-2-yellow': 'Pitch 2 - Yellow',
  'pitch-1-red': 'Pitch 1 - Red',
  'no-pitch': 'No Pitch'
};

// Helper function to group cards by name
const groupCardsByName = (printings: (DeckPrinting & { category: string })[]) => {
  const groups: Record<string, (DeckPrinting & { category: string })[]> = {};

  printings.forEach((printing) => {
    const cardName = printing.printingDetails?.display_name || printing.printingDetails?.name || 'Unknown Card';
    if (!groups[cardName]) {
      groups[cardName] = [];
    }
    groups[cardName].push(printing);
  });

  return groups;
};

// Compact card row component
interface CompactCardRowProps {
  cardName: string;
  quantity: number;
  printing: DeckPrinting & { category: string };
  ownershipInfo?: any;
  wantsCount?: number;
  editable: boolean;
  onRemove: () => void;
  onAddAnother: () => void;
  onMove?: () => void;
  onOpenPrintingSwap?: () => void;
  onOpenOwnershipComparison?: () => void;
}

// Shared grid column template — must match between header and rows
const ROW_GRID = "grid grid-cols-[32px_1fr_24px_24px_24px_88px_64px]";
const ROW_GRID_EDITABLE = "grid grid-cols-[32px_1fr_24px_24px_24px_88px_64px_72px]";

const CompactCardRow = ({
  cardName,
  quantity,
  printing,
  ownershipInfo,
  wantsCount,
  editable,
  onRemove,
  onAddAnother,
  onMove,
  onOpenPrintingSwap,
  onOpenOwnershipComparison
}: CompactCardRowProps) => {
  const { cost, power, defense, tcg_low } = printing.printingDetails || {};
  const owned = ownershipInfo?.owned ?? 0;
  const alternatives = ownershipInfo?.alternative ?? 0;

  return (
    <div className={cn("group py-1 px-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm relative items-center gap-3", editable ? ROW_GRID_EDITABLE : ROW_GRID)}>
      {/* Quantity */}
      <span className="text-gray-500 dark:text-gray-400 text-right font-mono text-xs">{quantity}×</span>

      {/* Card Name */}
      <span className="font-medium text-gray-900 dark:text-gray-100 truncate min-w-0">{cardName}</span>

      {/* Hover Card Preview */}
      {printing.printingDetails?.image_url && (
        <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover:block pointer-events-none">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl border-2 border-gray-300 dark:border-gray-600 overflow-hidden">
            <img
              src={printing.printingDetails.image_url}
              alt={cardName}
              className="w-64 h-auto"
            />
          </div>
        </div>
      )}

      {/* Cost */}
      <span className="text-gray-600 dark:text-gray-400 font-mono text-xs text-center">
        {cost !== null && cost !== undefined ? cost : ''}
      </span>

      {/* Power */}
      <span className="text-gray-600 dark:text-gray-400 font-mono text-xs text-center">
        {power !== null && power !== undefined ? power : ''}
      </span>

      {/* Defense */}
      <span className="text-gray-600 dark:text-gray-400 font-mono text-xs text-center">
        {defense !== null && defense !== undefined ? defense : ''}
      </span>

      {/* Ownership badge — fixed-width column, right-aligned */}
      <div className="flex items-center justify-end gap-1.5">
        <Badge
          variant={owned >= quantity ? "default" : "destructive"}
          className={cn(
            "text-xs cursor-pointer transition-all shrink-0",
            owned >= quantity ? "bg-green-600 hover:bg-green-700" :
            (owned + alternatives) >= quantity ? "bg-yellow-600 hover:bg-yellow-700" :
            owned > 0 ? "bg-orange-600 hover:bg-orange-700" :
            "bg-red-600 hover:bg-red-700"
          )}
          title={
            owned >= quantity ? `✓ Click to view & swap printings (${quantity} in deck)` :
            (owned + alternatives) >= quantity ? `Click to swap to owned alternative (${owned} exact, ${alternatives} other)` :
            owned > 0 ? `Click to view & swap printings (${owned} of ${quantity} exact)` :
            alternatives > 0 ? `Click to swap to alternative (${alternatives} owned)` :
            `Click to view & swap printings (${quantity} in deck, need ${quantity - owned} more)`
          }
          onClick={(e) => {
            e.stopPropagation()
            onOpenOwnershipComparison?.()
          }}
        >
          {owned >= quantity ? '✓' :
           (owned + alternatives) >= quantity ? `~${owned + alternatives}` :
           owned > 0 ? `${owned}/${quantity}` :
           alternatives > 0 ? `~${alternatives}` :
           `0/${quantity}`}
        </Badge>
        {(wantsCount ?? 0) > 0 && (
          <Badge variant="outline" className="text-yellow-600 dark:text-yellow-500 border-yellow-500 text-xs shrink-0">
            ★{wantsCount}
          </Badge>
        )}
      </div>

      {/* Price — fixed-width column, right-aligned */}
      <span className="text-green-600 dark:text-green-500 font-semibold text-xs text-right">
        {tcg_low > 0 ? `$${tcg_low.toFixed(2)}` : ''}
      </span>

      {/* Actions (editable only, always occupies column slot to keep alignment) */}
      {editable && (
        <div className={cn(
          "flex items-center gap-1 transition-opacity justify-end",
          quantity === 1 ? "opacity-0 group-hover:opacity-100" : "opacity-0 pointer-events-none"
        )}>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onAddAnother} title="Add another copy">
            <Copy className="h-3 w-3" />
          </Button>
          {onOpenPrintingSwap && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onOpenPrintingSwap} title="Swap printing">
              <Repeat className="h-3 w-3" />
            </Button>
          )}
          {onMove && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onMove} title="Move to different category">
              <Move className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost" size="sm"
            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={onRemove} title="Remove from deck"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default function DeckListView({
  printings,
  groupedCards,
  category,
  editable,
  ownershipStatus,
  wantsMap,
  binderMap,
  deckCardCounts,
  onRemove,
  onAddAnother,
  onMove,
  onOpenPrintingSwap,
  onOpenOwnershipComparison,
  onAddCard,
  removingCards
}: DeckListViewProps) {
  // Filter printings for this category
  const categoryPrintings = printings.filter(p => p.category === category);
  const categoryGroups = Object.values(groupedCards).filter(g => g.category === category);

  // Group printings by pitch FIRST, then by card name within each pitch
  const groupedByPitch = React.useMemo(() => {
    const groups: Record<string, Record<string, (DeckPrinting & { category: string })[]>> = {
      'pitch-3-blue': {},
      'pitch-2-yellow': {},
      'pitch-1-red': {},
      'no-pitch': {}
    };

    categoryPrintings.forEach((printing) => {
      // Extract pitch value - handle MongoDB $numberInt wrapper
      const pitchValue = printing.printingDetails?.pitch?.$numberInt || printing.printingDetails?.pitch;

      let pitchKey = 'no-pitch';

      // Map pitch number to pitch group: 1=red, 2=yellow, 3=blue
      if (pitchValue === 3 || pitchValue === '3') pitchKey = 'pitch-3-blue';
      else if (pitchValue === 2 || pitchValue === '2') pitchKey = 'pitch-2-yellow';
      else if (pitchValue === 1 || pitchValue === '1') pitchKey = 'pitch-1-red';

      // Group by card name within this pitch group
      const cardName = printing.printingDetails?.display_name || printing.printingDetails?.name || 'Unknown Card';

      if (!groups[pitchKey][cardName]) {
        groups[pitchKey][cardName] = [];
      }
      groups[pitchKey][cardName].push(printing);
    });

    // Filter out empty pitch groups and maintain order: red -> yellow -> blue -> no-pitch
    const pitchOrder = ['pitch-1-red', 'pitch-2-yellow', 'pitch-3-blue', 'no-pitch'];
    return pitchOrder
      .filter(pitch => Object.keys(groups[pitch]).length > 0)
      .map(pitch => ({
        pitch,
        cards: groups[pitch]
      }));
  }, [categoryPrintings]);

  // Calculate total cards using actual quantities
  const totalCards = categoryPrintings.reduce((sum, p) => sum + (p.quantity || 1), 0);

  if (totalCards === 0 && !editable) {
    return null;
  }

  return (
    <div className="mb-6">
      {/* Category Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {CATEGORY_LABELS[category]}
          </h2>
          <Badge variant="secondary">
            {totalCards} {totalCards === 1 ? 'card' : 'cards'}
          </Badge>
        </div>
        {editable && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddCard}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        )}
      </div>

      {/* List of Cards */}
      {totalCards === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
          No {CATEGORY_LABELS[category].toLowerCase()} cards yet. Click "Add" to add cards.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pitch Groups */}
          {groupedByPitch.map(({ pitch, cards }) => {
            // Count cards using actual quantities instead of array length
            const pitchCardCount = Object.values(cards).reduce((sum, group) =>
              sum + group.reduce((groupSum, p) => groupSum + (p.quantity || 1), 0), 0
            );

            return (
              <div key={pitch} className="mb-4">
                {/* Pitch Header */}
                <div className={cn(
                  "px-3 py-1.5 rounded-t-md text-sm font-semibold flex items-center justify-between",
                  pitch === 'pitch-3-blue' && "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100",
                  pitch === 'pitch-2-yellow' && "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-100",
                  pitch === 'pitch-1-red' && "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-100",
                  pitch === 'no-pitch' && "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                )}>
                  <span>
                    {PITCH_LABELS[pitch as keyof typeof PITCH_LABELS]}
                  </span>
                  <span className="text-xs opacity-75">
                    {pitchCardCount} {pitchCardCount === 1 ? 'card' : 'cards'}
                  </span>
                </div>

                {/* Card Rows */}
                <div className="border-l border-r border-b rounded-b-md border-gray-200 dark:border-gray-700">
                  {/* Column Headers */}
                  <div className={cn("py-1.5 px-2 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 items-center gap-3", editable ? ROW_GRID_EDITABLE : ROW_GRID)}>
                    <span className="text-right">Qty</span>
                    <span>Card Name</span>
                    <div className="flex justify-center">
                      <img
                        src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/d47166a9-0070-480b-ba55-499e288f3800/public"
                        alt="Cost"
                        title="Cost"
                        className="w-4 h-4"
                      />
                    </div>
                    <div className="flex justify-center">
                      <img
                        src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/a5967cfe-324c-41db-f6c4-ee029344dc00/public"
                        alt="Power"
                        title="Power"
                        className="w-4 h-4"
                      />
                    </div>
                    <div className="flex justify-center">
                      <img
                        src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/92ae8ccb-bfc8-4f3c-21a9-74d81b9b4700/public"
                        alt="Defense"
                        title="Defense"
                        className="w-4 h-4"
                      />
                    </div>
                    <span className="text-right">Own</span>
                    <span className="text-right">Price</span>
                    {editable && <span></span>}
                  </div>

                  {Object.entries(cards).map(([cardName, cardPrintings]) => {
                    const firstPrinting = cardPrintings[0];
                    const printingId = firstPrinting.printingId;

                    // Sum actual quantities from database instead of counting rows
                    const totalQuantity = cardPrintings.reduce((sum, p) => sum + (p.quantity || 1), 0);

                    return (
                      <CompactCardRow
                        key={`${cardName}-${printingId}`}
                        cardName={cardName}
                        quantity={totalQuantity}
                        printing={firstPrinting}
                        ownershipInfo={ownershipStatus?.get(printingId)}
                        wantsCount={wantsMap?.get(printingId) || 0}
                        editable={editable}
                        onRemove={() => onRemove(firstPrinting)}
                        onAddAnother={() => onAddAnother(firstPrinting)}
                        onMove={onMove ? () => onMove(firstPrinting) : undefined}
                        onOpenPrintingSwap={onOpenPrintingSwap ? () => onOpenPrintingSwap(firstPrinting) : undefined}
                        onOpenOwnershipComparison={onOpenOwnershipComparison ? () => onOpenOwnershipComparison(firstPrinting) : undefined}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
