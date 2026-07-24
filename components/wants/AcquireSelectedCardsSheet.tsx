// components/wants/AcquireSelectedCardsSheet.tsx
// Bottom-sheet acquire interface for the owner wants page, modeled on
// components/binder/MobileSelectedCardsSheet (the transfer sheet).
"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { X, Plus, Minus, PackageCheck } from "lucide-react";
import { getCardImageUrl } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { bindersClient } from "@/lib/client";
import { acquireWantsItems } from "@/lib/client/wants-client";
import type { AcquiredCard } from "./MarkAcquiredDialog";

const AcquireSelectedCardItem = ({ card, onQuantityChange, onRemove }: any) => {
  return (
    <div className="p-2 mb-2 border rounded-lg flex items-start gap-3">
      <img
        src={getCardImageUrl(card)}
        alt={card.name}
        className="w-12 h-16 object-cover rounded"
      />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start">
          <h4 className="font-medium text-sm truncate pr-2">{card.printingDetails?.display_name || card.name}</h4>
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

interface AcquireSelectedCardsSheetProps {
  selectedCards: any[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onQuantityChange: (cardId: string, newQuantity: number) => void;
  onRemoveSelected: (index: number) => void;
  onClearSelected: () => void;
  onAcquireComplete: (acquiredCards: AcquiredCard[]) => void;
}

export const AcquireSelectedCardsSheet = ({
  selectedCards,
  isOpen,
  onOpenChange,
  onQuantityChange,
  onRemoveSelected,
  onClearSelected,
  onAcquireComplete,
}: AcquireSelectedCardsSheetProps) => {
  const { toast } = useToast();
  const [binders, setBinders] = useState<any[]>([]);
  const [targetBinderId, setTargetBinderId] = useState("");
  const [acquiring, setAcquiring] = useState(false);

  useEffect(() => {
    const fetchBinders = async () => {
      const result = await bindersClient.getUserBinders();
      if (result.success) {
        const available = (result.data.binders || []).filter((b: any) => !b.archived);
        setBinders(available);
        setTargetBinderId((current) => current || available[0]?._id || "");
      }
    };
    fetchBinders();
  }, []);

  const handleAcquire = async () => {
    if (!targetBinderId) return;
    setAcquiring(true);
    try {
      const cards = selectedCards.map(card => ({
        printingId: String(card.id),
        quantity: card.quantity || 1,
      }));
      const result = await acquireWantsItems(targetBinderId, cards);
      if (!result.success) throw new Error(result.error || "Failed to mark cards as acquired");

      const { summary, results } = result.data;
      if (summary.successful > 0) {
        const binderName = binders.find(b => b._id === targetBinderId)?.name || "binder";
        toast({
          title: "Cards Acquired",
          description: `Added ${summary.totalQuantityAcquired} cards to ${binderName}`,
        });
        const acquiredCards: AcquiredCard[] = results
          .filter((r) => r.success)
          .map((r) => ({ printingId: r.printingId, quantity: r.quantity, remainingWanted: r.remainingWanted }));
        onAcquireComplete(acquiredCards);
        onOpenChange(false);
      }
      if (summary.failed > 0) {
        const failed = results.filter((r) => !r.success);
        toast({
          title: `${summary.failed} Cards Failed`,
          description: failed[0]?.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({ title: "Failed to Mark as Acquired", description: err.message, variant: "destructive" });
    } finally {
      setAcquiring(false);
    }
  };

  const totalCards = selectedCards.reduce((sum: number, card: any) => sum + (card.quantity || 1), 0);

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5" />
              Acquired Cards
            </DrawerTitle>
            <div className="text-sm text-muted-foreground">
              {totalCards} {totalCards === 1 ? "card" : "cards"} selected
            </div>
          </DrawerHeader>

          <div className="p-4 max-h-[50vh] overflow-y-auto">
            {selectedCards.map((card: any, index: number) => (
              <AcquireSelectedCardItem
                key={card.id}
                card={card}
                onQuantityChange={onQuantityChange}
                onRemove={() => onRemoveSelected(index)}
              />
            ))}
          </div>

          <DrawerFooter className="pt-2 space-y-2">
            {/* Inline binder picker + acquire */}
            {binders.length > 0 && (
              <Select value={targetBinderId} onValueChange={setTargetBinderId}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Select destination binder…" />
                </SelectTrigger>
                <SelectContent>
                  {binders.map(b => (
                    <SelectItem key={b._id} value={b._id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              onClick={handleAcquire}
              disabled={acquiring || !targetBinderId || binders.length === 0 || selectedCards.length === 0}
              className="w-full flex items-center gap-2 bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-500 text-white"
            >
              {acquiring
                ? <><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />Adding…</>
                : <><PackageCheck className="h-4 w-4" />Mark as Acquired</>
              }
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => { onClearSelected(); onOpenChange(false); }}>
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
