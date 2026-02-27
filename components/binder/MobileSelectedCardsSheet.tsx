// components/binder/MobileSelectedCardsSheet.tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { X, Plus, Minus, Package, Copy, Check, ArrowRight, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// A simplified card item for the mobile sheet
const MobileSelectedCardItem = ({ card, onQuantityChange, onRemove }: any) => {
  return (
    <div className="p-2 mb-2 border rounded-lg flex items-start gap-3">
      <img
        src={card.printingId ? `https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${card.printingId}/public` : '/placeholder-card.png'}
        alt={card.name}
        className="w-12 h-16 object-cover rounded"
      />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start">
          <h4 className="font-medium text-sm truncate pr-2">{card.name}</h4>
          <Button variant="ghost" size="sm" onClick={onRemove} className="h-6 w-6 p-0 text-muted-foreground">
            <X className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onQuantityChange(card.id, card.quantity - 1)}
            disabled={card.quantity <= 1}
            className="h-7 w-7 p-0"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="font-semibold w-8 text-center">{card.quantity}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onQuantityChange(card.id, card.quantity + 1)}
            disabled={card.quantity >= card.maxQuantity}
            className="h-7 w-7 p-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">(of {card.maxQuantity})</span>
        </div>
      </div>
    </div>
  );
};

interface MobileSelectedCardsSheetProps {
  selectedCards: any[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onQuantityChange: (cardId: string, newQuantity: number) => void;
  onRemoveSelected: (index: number) => void;
  onClearSelected: () => void;
  onTransfer?: () => void;
  onDeleteSelected?: () => void;
  onCopySelected: () => void;
  copied: boolean;
}

export const MobileSelectedCardsSheet = ({
  selectedCards,
  isOpen,
  onOpenChange,
  onQuantityChange,
  onRemoveSelected,
  onClearSelected,
  onTransfer,
  onDeleteSelected,
  onCopySelected,
  copied
}: MobileSelectedCardsSheetProps) => {
  const totalCards = selectedCards.reduce((sum: number, card: any) => sum + card.quantity, 0);

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Selected Cards
            </DrawerTitle>
            <div className="text-sm text-muted-foreground">
              {totalCards} {totalCards === 1 ? 'card' : 'cards'} selected
            </div>
          </DrawerHeader>

          <div className="p-4 max-h-[50vh] overflow-y-auto">
            {selectedCards.map((card: any, index: number) => (
              <MobileSelectedCardItem
                key={card.id}
                card={card}
                onQuantityChange={onQuantityChange}
                onRemove={() => onRemoveSelected(index)}
              />
            ))}
          </div>

          <DrawerFooter className="pt-2 space-y-2">
            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              {onTransfer && (
                <Button
                  onClick={() => {
                    onTransfer();
                    onOpenChange(false);
                  }}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <ArrowRight className="h-4 w-4" />
                  Transfer
                </Button>
              )}

              <Button
                onClick={() => {
                  onCopySelected();
                  // Don't close the sheet so user can see the copied state
                }}
                variant="outline"
                className="flex items-center gap-2"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>

              {onDeleteSelected && (
                <Button
                  onClick={() => {
                    onDeleteSelected();
                    onOpenChange(false);
                  }}
                  variant="destructive"
                  className="flex items-center gap-2 col-span-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Selected
                </Button>
              )}
            </div>

            {/* Bottom actions */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  onClearSelected();
                  onOpenChange(false);
                }}
              >
                Clear All
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
};