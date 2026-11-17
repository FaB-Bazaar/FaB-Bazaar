// components/binder/MobileTradeRequestSheet.tsx (NEW FILE)
"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { X, Plus, Minus, ArrowLeftRight, Loader2, Copy, ShieldAlert, Package, Users, Send, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { cn, getCardImageUrl } from "@/lib/utils";
import { formatTradeRequestForDiscord } from "@/lib/formatters/tradeRequestFormatter";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { sendTradeInterestNotification } from "@/lib/client/binders-client";
import { TRADE_REQUESTS_CHANNEL_NAME, TRADE_REQUESTS_CHANNEL_URL } from "@/lib/discord/links";
import { tradeInterestFeedback } from "@/lib/discord/trade-interest-feedback";
import { displayUsername } from "@/lib/utils/display-username";
import { formatPrice } from "@/lib/pricing/price-source";
import { tradeCardDetails, tradeCardPriceLine, tradeCartTotals } from "@/lib/binder/trade-cart";

// A simplified card item specifically for the mobile sheet
const MobileTradeCardItem = ({ card, onQuantityChange, onRemove }: any) => {
    const isForTrade = card.forTrade === true;
    return (
        <div data-testid="mobile-trade-card" className={cn("p-2 mb-2 border rounded-lg flex items-start gap-3", !isForTrade && "border-amber-500/50 bg-amber-50/20")}>
            <img
              src={getCardImageUrl(card)}
              alt={card.display_name || card.name}
              className="w-12 h-16 object-cover rounded"
            />
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                    <h4 className="font-medium text-sm truncate pr-2">{card.display_name || card.name}</h4>
                    <Button variant="ghost" size="sm" aria-label={`Remove ${card.display_name || card.name}`} onClick={onRemove} className="h-6 w-6 p-0 text-muted-foreground"><X className="h-3 w-3" /></Button>
                </div>
                <div className="text-sm text-muted-foreground">{tradeCardDetails(card)}</div>
                {!isForTrade && <Badge variant="destructive" className="text-xs mt-1">Not for Trade</Badge>}
                {/* Price and quantity share a row so ~4 tiles fit on a phone */}
                <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-sm text-muted-foreground tabular-nums truncate">{tradeCardPriceLine(card)}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="outline" size="sm" aria-label={`Decrease quantity of ${card.display_name || card.name}`} onClick={() => onQuantityChange(card.id, card.quantity - 1)} disabled={card.quantity <= 1} className="h-7 w-7 p-0"><Minus className="h-4 w-4" /></Button>
                        <span className="font-semibold w-10 text-center text-sm tabular-nums">{card.quantity}<span className="font-normal text-muted-foreground">/{card.maxQuantity}</span></span>
                        <Button variant="outline" size="sm" aria-label={`Increase quantity of ${card.display_name || card.name}`} onClick={() => onQuantityChange(card.id, card.quantity + 1)} disabled={card.quantity >= card.maxQuantity} className="h-7 w-7 p-0"><Plus className="h-4 w-4" /></Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const MobileTradeRequestSheet = ({
  selectedCards,
  isOpen,
  onOpenChange,
  binderId,
  recipientId,
  recipientUsername,
  recipientDiscordId,
  onQuantityChange,
  onRemoveSelected,
  onClearSelected,
  onTradeRequestSent
}: any) => {
  const { toast } = useToast();
  const router = useRouter();
  const [isSending, setIsSending] = useState(false);
  const [isNotifying, setIsNotifying] = useState(false);
  const [tradeMessage, setTradeMessage] = useState("");
  const [messageOpen, setMessageOpen] = useState(false);
  const [tradeType, setTradeType] = useState<'shipped' | 'in-person'>('in-person');
  const [error, setError] = useState<string | null>(null);
  const [existingTradeId, setExistingTradeId] = useState<string | null>(null);

  const hasInvalidCards = selectedCards.some((card: any) => card.forTrade !== true);
  const validCardsToSend = selectedCards.filter((card: any) => card.forTrade === true);

  // Clear error when sheet closes or selection changes
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setExistingTradeId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setError(null);
    setExistingTradeId(null);
  }, [selectedCards]);

  // Explicit Discord ping — no clipboard involved. Awaited so we can say
  // whether it fired or was suppressed by the server's dedupe window.
  const handleNotifyDiscord = async () => {
    if (validCardsToSend.length === 0) {
      toast({
        title: "No Tradable Cards Selected",
        description: "You can only notify about items marked 'For Trade'.",
        variant: "destructive",
      });
      return;
    }

    setIsNotifying(true);
    try {
      const notifyCards = validCardsToSend.map((card: any) => ({
        name: card.display_name || card.name,
        quantity: card.quantity,
        value: card.tcg_low ?? card.printingDetails?.tcg_low ?? 0,
      }));
      const { notified } = await sendTradeInterestNotification(binderId, {
        cards: notifyCards,
        totalValue: notifyCards.reduce((sum: number, c: any) => sum + c.value * c.quantity, 0),
      });
      toast({
        ...tradeInterestFeedback({ notified, recipientUsername, cardCount: notifyCards.length }),
        duration: 5000,
      });
    } catch (error: any) {
      toast({
        title: "Couldn't ping on Discord",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsNotifying(false);
    }
  };

  const handleCopyToClipboard = async () => {
    setIsSending(true);
    setError(null);
    setExistingTradeId(null);

    if (validCardsToSend.length === 0) {
        const errorMsg = "You can only copy items marked 'For Trade'.";
        setError(errorMsg);
        toast({ title: "No Tradable Cards Selected", description: errorMsg, variant: "destructive" });
        setIsSending(false);
        return;
    }

    try {
      // Format data for Discord
      const formattedText = formatTradeRequestForDiscord({
        recipientUsername: recipientUsername,
        message: tradeMessage,
        tradeType: tradeType,
        cards: validCardsToSend.map(card => ({
          ...card,
          printingDetails: {
            set_id: card.set,
            collector_number: card.collector_number,
            foiling: card.foiling,
            edition: card.edition,
            rarity: card.rarity,
            tcg_low: card.tcg_low,
            tcg_market: card.tcg_market,
            tcg_mid: card.tcg_mid,
            tcg_high: card.tcg_high
          }
        }))
      });

      // Copy to clipboard
      const result = await copyToClipboard(formattedText);

      if (result.success) {
        toast({
          title: "Copied to Clipboard!",
          description: "Your trade request is ready to paste.",
          duration: 5000,
        });

        setError(null);
        setExistingTradeId(null);

        // Optional: Clear form after successful copy
        // onClearSelected();
        // setTradeMessage("");
      } else {
        throw new Error(result.error || 'Failed to copy');
      }
    } catch (error: any) {
      console.error('Error copying to clipboard:', error);
      const errorMsg = error.message || "Failed to copy. Please try again.";
      setError(errorMsg);
      toast({ title: "Copy Failed", description: errorMsg, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const totals = tradeCartTotals(selectedCards);
  const totalCards = totals.copies;

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[calc(100dvh-1.5rem)] mt-6">
        <div className="mx-auto w-full max-w-sm flex flex-col min-h-0 flex-1">
          {/* Pinned summary — stays put while the card list scrolls */}
          <DrawerHeader className="shrink-0 flex items-start justify-between gap-2 px-4 pt-2 pb-2 text-left border-b border-border">
            <div className="min-w-0">
              <DrawerTitle className="text-base">Your Trade Request</DrawerTitle>
              <div className="text-sm text-muted-foreground truncate">For {displayUsername(recipientUsername)}</div>
              <div className="text-sm font-medium" data-testid="mobile-trade-total">
                {totals.copies} {totals.copies === 1 ? "card" : "cards"} · {formatPrice(totals.value, "tcgplayer")} TCG Low
                {totals.unpriced > 0 && ` (${totals.unpriced} unpriced)`}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Close trade request"
              onClick={() => onOpenChange(false)}
              className="h-9 w-9 p-0 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <X className="h-5 w-5" />
            </Button>
          </DrawerHeader>
          <div data-testid="mobile-trade-list" className="flex-1 min-h-0 overflow-y-auto px-4 pt-3">
            {selectedCards.map((card: any, index: number) => (
              <MobileTradeCardItem
                key={card.id}
                card={card}
                onQuantityChange={onQuantityChange}
                onRemove={() => onRemoveSelected(index)}
              />
            ))}
          </div>
          <DrawerFooter className="shrink-0 pt-2 gap-2 border-t border-border">
            {hasInvalidCards && (
                <div className="flex items-center gap-2 p-2 text-xs text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/20 rounded-md">
                    <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                    <span>Only 'For Trade' items will be included.</span>
                </div>
            )}

            {/* Trade method + message on one row; the message box opens on tap */}
            <div className="flex gap-2">
              <Select value={tradeType} onValueChange={(value: 'shipped' | 'in-person') => setTradeType(value)}>
                <SelectTrigger className="flex-1 min-w-0 whitespace-nowrap [&>span]:truncate" aria-label="Trade method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shipped">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 flex-shrink-0" />
                      <span>By mail</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="in-person">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 flex-shrink-0" />
                      <span>In person</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {!messageOpen && (
                <Button
                  variant="outline"
                  onClick={() => setMessageOpen(true)}
                  className="flex-1 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <MessageSquare className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate">{tradeMessage ? "Edit message" : "Add message"}</span>
                </Button>
              )}
            </div>
            {messageOpen && (
              <Textarea
                autoFocus
                value={tradeMessage}
                onChange={(e) => setTradeMessage(e.target.value)}
                onBlur={() => { if (!tradeMessage.trim()) setMessageOpen(false); }}
                placeholder="Add an optional message..."
                aria-label="Message"
                className="text-sm min-h-[60px]"
              />
            )}
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/50 rounded-md">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive mb-1">Unable to Send Request</p>
                    <p className="text-xs text-destructive/90">{error}</p>
                    {existingTradeId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          router.push(`/trade-requests/${existingTradeId}`);
                          onOpenChange(false);
                        }}
                        className="mt-2 h-7 text-xs"
                      >
                        View Existing Trade
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
            <Button
              variant="secondary"
              onClick={handleNotifyDiscord}
              disabled={isNotifying || validCardsToSend.length === 0}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              data-testid="notify-discord-button"
            >
              {isNotifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {isNotifying ? "Pinging…" : "Notify on Discord"}
            </Button>
            <Button onClick={handleCopyToClipboard} disabled={isSending || validCardsToSend.length === 0}>
              {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
              {isSending ? "Copying..." : `Copy Request (${totalCards} ${totalCards === 1 ? 'card' : 'cards'})`}
            </Button>
            <div className="text-sm text-gray-300 text-center">
              Notify pings {displayUsername(recipientUsername)} in{" "}
              <a
                href={TRADE_REQUESTS_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline underline-offset-2 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-sm"
              >
                #{TRADE_REQUESTS_CHANNEL_NAME}
              </a>
            </div>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
};