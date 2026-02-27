// components/deck/mobile/MobileDeckCardActionSheet.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KeywordBadge } from "@/components/deck/KeywordBadge";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  ArrowRightLeft,
  Copy,
  Repeat,
  Trash2,
  Star,
  BookOpen,
  Layers,
  Coins,
  Sword,
  Shield,
  Minus,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeckPrinting, DeckCategory } from "./types";

interface MobileDeckCardActionSheetProps {
  printing: (DeckPrinting & { category: string }) | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  ownershipStatus: Map<string, any>;
  wantsMap: Map<string, number>;
  binderMap: Map<string, { quantity: number; cardId: string }>;
  allPrintings: (DeckPrinting & { category: string })[]; // Added: to count copies
  onMove: (printing: DeckPrinting & { category: string }) => void;
  onMoveMultiple?: (printing: DeckPrinting & { category: string }, quantity: number) => void;
  onAddAnother: (printing: DeckPrinting & { category: string }) => void;
  onOpenPrintingSwap: (printing: DeckPrinting & { category: string }) => void;
  onRemove: (printing: DeckPrinting & { category: string }) => void;
  onAddToWants: (printing: DeckPrinting & { category: string }) => void;
  onAddToBinder: (printing: DeckPrinting & { category: string }) => void;
  onOpenOwnershipComparison: (
    printing: DeckPrinting & { category: string }
  ) => void;
}

export default function MobileDeckCardActionSheet({
  printing,
  isOpen,
  onOpenChange,
  canEdit,
  ownershipStatus,
  wantsMap,
  binderMap,
  allPrintings,
  onMove,
  onMoveMultiple,
  onAddAnother,
  onOpenPrintingSwap,
  onRemove,
  onAddToWants,
  onAddToBinder,
  onOpenOwnershipComparison,
}: MobileDeckCardActionSheetProps) {
  // Count copies of this card in the same category
  const copyCount = printing ? allPrintings.filter(
    (p) => p.printingId === printing.printingId && p.category === printing.category
  ).length : 1;

  // State for move quantity
  const [moveQuantity, setMoveQuantity] = useState(1);

  // Reset move quantity when printing changes or sheet opens
  useEffect(() => {
    if (isOpen && printing) {
      setMoveQuantity(Math.min(copyCount, 1)); // Start with 1, or copyCount if only 1
    }
  }, [isOpen, printing, copyCount]);

  if (!printing) return null;

  const cardName =
    printing.printingDetails?.display_name ||
    printing.printingDetails?.name ||
    "Unknown Card";
  const imageUrl = printing.printingDetails?.image_url;
  const setName = printing.printingDetails?.set_name || "";
  const foiling = printing.printingDetails?.foiling || "";
  const edition = printing.printingDetails?.edition || "";
  const tcgLow = printing.printingDetails?.tcg_low;
  const cost = printing.printingDetails?.cost;
  const power = printing.printingDetails?.power;
  const defense = printing.printingDetails?.defense;
  const ownershipInfo = ownershipStatus.get(printing.printingId);
  const owned = ownershipInfo?.owned || 0;
  const wantsCount = wantsMap.get(printing.printingId) || 0;
  const binderInfo = binderMap.get(printing.printingId);
  const binderCount = binderInfo?.quantity || 0;

  // Determine move destination label
  const types = printing.printingDetails?.types || [];
  const isEquipment = types.includes('equipment') || types.includes('weapon');
  const isEvo = types.includes('evo');

  let moveDestinationLabel = "";
  if (printing.category === 'maindeck') {
    moveDestinationLabel = 'Inventory';
  } else if (printing.category === 'inventory') {
    // Equipment goes to equipment zone, everything else to maindeck
    if (isEquipment && !isEvo) {
      moveDestinationLabel = 'Equipment';
    } else {
      moveDestinationLabel = 'Main Deck';
    }
  } else if (printing.category === 'equipment') {
    moveDestinationLabel = 'Inventory';
  }

  const editionLabel =
    edition === "f"
      ? "1st Edition"
      : edition === "u"
      ? "Unlimited"
      : edition === "a"
      ? "Alpha"
      : "";
  const foilingLabel =
    foiling === "r" || foiling === "R"
      ? "Rainbow Foil"
      : foiling === "c" || foiling === "C"
      ? "Cold Foil"
      : foiling === "g" || foiling === "G"
      ? "Gold Cold Foil"
      : foiling === "n" || foiling === "S"
      ? ""
      : foiling;

  const handleAction = (action: () => void) => {
    onOpenChange(false);
    // Delay the action to let the drawer close animation finish,
    // otherwise Radix/Vaul pointer-event blocking prevents dialogs from opening
    setTimeout(action, 300);
  };

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader className="pb-2">
            {/* Card info row */}
            <div className="flex items-start gap-3">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={cardName}
                  className="w-16 h-[90px] object-cover rounded shadow-sm shrink-0"
                />
              )}
              <div className="flex-1 min-w-0 text-left">
                <DrawerTitle className="text-base truncate">
                  {cardName}
                </DrawerTitle>
                {/* Keywords */}
                {printing.printingDetails?.keywords && printing.printingDetails.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {printing.printingDetails.keywords.slice(0, 3).map((kw: string, i: number) => (
                      <KeywordBadge key={`kw-${i}`} keyword={kw} size="sm" />
                    ))}
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                  {setName && <div>{setName}</div>}

                  {/* Card Stats with Icons */}
                  {(cost !== null && cost !== undefined || power !== null && power !== undefined || defense !== null && defense !== undefined) && (
                    <div className="flex items-center gap-3 py-1">
                      {cost !== null && cost !== undefined && (
                        <div className="flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            {cost}
                          </span>
                        </div>
                      )}
                      {power !== null && power !== undefined && (
                        <div className="flex items-center gap-1">
                          <Sword className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            {power}
                          </span>
                        </div>
                      )}
                      {defense !== null && defense !== undefined && (
                        <div className="flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            {defense}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1">
                    {editionLabel && (
                      <Badge variant="outline" className="text-[10px] py-0">
                        {editionLabel}
                      </Badge>
                    )}
                    {foilingLabel && (
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0 text-purple-600 border-purple-300"
                      >
                        {foilingLabel}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {tcgLow > 0 && (
                      <span className="text-green-600 font-semibold">
                        ${tcgLow.toFixed(2)}
                      </span>
                    )}
                    <span
                      className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded",
                        owned > 0
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      )}
                    >
                      {owned > 0 ? `Own ${owned}x` : "Not owned"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </DrawerHeader>

          {/* Actions */}
          <div className="px-4 pb-4 space-y-3">
            {canEdit && copyCount > 1 && (
              // Inline quantity controls for multiple copies
              <div className="space-y-2">
                <div className="text-xs text-gray-500 font-medium px-1">
                  Move to {moveDestinationLabel}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => setMoveQuantity(Math.max(1, moveQuantity - 1))}
                    disabled={moveQuantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 text-center">
                    <div className="text-lg font-semibold">{moveQuantity}</div>
                    <div className="text-xs text-gray-500">
                      of {copyCount} {copyCount === 1 ? 'copy' : 'copies'}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => setMoveQuantity(Math.min(copyCount, moveQuantity + 1))}
                    disabled={moveQuantity >= copyCount}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    className="h-10 px-4"
                    onClick={() =>
                      handleAction(() => {
                        if (onMoveMultiple) {
                          onMoveMultiple(printing, moveQuantity);
                        }
                      })
                    }
                  >
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Move
                  </Button>
                </div>
              </div>
            )}

            {/* Regular button grid - reorganized for better UX */}
            <div className="grid grid-cols-2 gap-2">
              {canEdit && copyCount === 1 && (
                // Show Move button only for single copies (multiple copies use stepper above)
                <>
                  <Button
                    variant="outline"
                    className="h-11 justify-start gap-2 text-sm"
                    onClick={() => handleAction(() => onAddToWants(printing))}
                  >
                    <Star className="h-4 w-4" />
                    <span className="truncate">
                      Wants{wantsCount > 0 ? ` (${wantsCount})` : ""}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 justify-start gap-2 text-sm"
                    onClick={() => handleAction(() => onMove(printing))}
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Move
                  </Button>
                </>
              )}

              {canEdit && (
                <>
                  {/* Row 1: Wants | Add Copy */}
                  {copyCount > 1 && (
                    <Button
                      variant="outline"
                      className="h-11 justify-start gap-2 text-sm"
                      onClick={() => handleAction(() => onAddToWants(printing))}
                    >
                      <Star className="h-4 w-4" />
                      <span className="truncate">
                        Wants{wantsCount > 0 ? ` (${wantsCount})` : ""}
                      </span>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="h-11 justify-start gap-2 text-sm"
                    onClick={() => handleAction(() => onAddAnother(printing))}
                  >
                    <Copy className="h-4 w-4" />
                    Add Copy
                  </Button>

                  {/* Row 2: Binder | Swap Printing */}
                  <Button
                    variant="outline"
                    className="h-11 justify-start gap-2 text-sm"
                    onClick={() => handleAction(() => onAddToBinder(printing))}
                  >
                    <BookOpen className="h-4 w-4" />
                    <span className="truncate">
                      Binder{binderCount > 0 ? ` (${binderCount})` : ""}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 justify-start gap-2 text-sm"
                    onClick={() =>
                      handleAction(() => onOpenPrintingSwap(printing))
                    }
                  >
                    <Repeat className="h-4 w-4" />
                    Swap Printing
                  </Button>

                  {/* Row 3: Compare Printings | Remove */}
                  <Button
                    variant="outline"
                    className="h-11 justify-start gap-2 text-sm"
                    onClick={() =>
                      handleAction(() => onOpenOwnershipComparison(printing))
                    }
                  >
                    <Layers className="h-4 w-4" />
                    Compare Printings
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 justify-start gap-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => handleAction(() => onRemove(printing))}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </>
              )}

              {/* Non-editable view */}
              {!canEdit && (
                <>
                  <Button
                    variant="outline"
                    className="h-11 justify-start gap-2 text-sm"
                    onClick={() => handleAction(() => onAddToWants(printing))}
                  >
                    <Star className="h-4 w-4" />
                    <span className="truncate">
                      Wants{wantsCount > 0 ? ` (${wantsCount})` : ""}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 justify-start gap-2 text-sm"
                    onClick={() => handleAction(() => onAddToBinder(printing))}
                  >
                    <BookOpen className="h-4 w-4" />
                    <span className="truncate">
                      Binder{binderCount > 0 ? ` (${binderCount})` : ""}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 justify-start gap-2 text-sm col-span-2"
                    onClick={() =>
                      handleAction(() => onOpenOwnershipComparison(printing))
                    }
                  >
                    <Layers className="h-4 w-4" />
                    Compare Printings
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
