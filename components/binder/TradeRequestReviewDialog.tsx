"use client";

/**
 * Full-size review of a binder trade request — opened from the sidebar's
 * "N cards selected" button, whose card list only fits ~1 card between the
 * header and the send controls. Edits here change the real cart.
 */
import React from "react";
import { Minus, Plus, Trash2, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getCardImageUrl } from "@/lib/utils";
import { displayUsername } from "@/lib/utils/display-username";
import { formatPrice } from "@/lib/pricing/price-source";
import { tradeCardDetails, tradeCardPriceLine, tradeCartTotals } from "@/lib/binder/trade-cart";

interface TradeRequestReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: any[];
  recipientUsername: string;
  onQuantityChange: (cardId: string, newQuantity: number) => void;
  onRemove: (index: number) => void;
}

export function TradeRequestReviewDialog({
  open,
  onOpenChange,
  cards,
  recipientUsername,
  onQuantityChange,
  onRemove,
}: TradeRequestReviewDialogProps) {
  const totals = tradeCartTotals(cards);
  const name = displayUsername(recipientUsername);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[calc(100vw-2rem)] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Trade request with {name}</DialogTitle>
          <DialogDescription data-testid="review-total">
            {cards.length} {cards.length === 1 ? "card" : "different cards"} · {totals.copies}{" "}
            {totals.copies === 1 ? "card" : "cards"} total · {formatPrice(totals.value, "tcgplayer")} TCG Low
            {totals.unpriced > 0 && ` (${totals.unpriced} unpriced)`}
          </DialogDescription>
        </DialogHeader>

        {cards.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Your trade request is empty. Click cards in the binder to add them.
          </p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 overflow-y-auto pr-1">
            {cards.map((card, index) => {
              const cardName = card.display_name || card.name;
              return (
                <li
                  key={card.id}
                  data-testid="review-card"
                  className="flex flex-col rounded-lg border border-border bg-card p-2"
                >
                  <img
                    src={getCardImageUrl(card)}
                    alt={cardName}
                    loading="lazy"
                    className="w-full aspect-[5/7] object-cover rounded"
                  />
                  <div className="mt-2 flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" title={cardName}>{cardName}</div>
                    <div className="text-xs text-muted-foreground">{tradeCardDetails(card)}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {tradeCardPriceLine(card)}
                    </div>
                    {card.forTrade !== true && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                        Not for trade — won&apos;t be sent
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        aria-label={`Decrease quantity of ${cardName}`}
                        disabled={card.quantity <= 1}
                        onClick={() => onQuantityChange(card.id, card.quantity - 1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-12 text-center text-sm tabular-nums" aria-live="polite">
                        {card.quantity}
                        <span className="text-muted-foreground">/{card.maxQuantity}</span>
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        aria-label={`Increase quantity of ${cardName}`}
                        disabled={card.quantity >= card.maxQuantity}
                        onClick={() => onQuantityChange(card.id, card.quantity + 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${cardName}`}
                      onClick={() => onRemove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
