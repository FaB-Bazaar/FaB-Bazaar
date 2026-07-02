// components/binder/MobileTradeRequestSheet.tsx (NEW FILE)
"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { X, Plus, Minus, ArrowLeftRight, Loader2, Copy, ShieldAlert, Package, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatTradeRequestForDiscord } from "@/lib/formatters/tradeRequestFormatter";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { notifyTradeInterest } from "@/lib/client/binders-client";

// A simplified card item specifically for the mobile sheet
const MobileTradeCardItem = ({ card, onQuantityChange, onRemove }: any) => {
    const isForTrade = card.forTrade === true;
    return (
        <div className={cn("p-2 mb-2 border rounded-lg flex items-start gap-3", !isForTrade && "border-amber-500/50 bg-amber-50/20")}>
            <img
              src={card.printingId ? `https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${card.printingId}/public` : '/placeholder-card.png'}
              alt={card.display_name || card.name}
              className="w-12 h-16 object-cover rounded"
            />
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                    <h4 className="font-medium text-sm truncate pr-2">{card.display_name || card.name}</h4>
                    <Button variant="ghost" size="sm" onClick={onRemove} className="h-6 w-6 p-0 text-muted-foreground"><X className="h-3 w-3" /></Button>
                </div>
                {!isForTrade && <Badge variant="destructive" className="text-xs mt-1">Not for Trade</Badge>}
                <div className="flex items-center gap-2 mt-2">
                    <Button variant="outline" size="sm" onClick={() => onQuantityChange(card.id, card.quantity - 1)} disabled={card.quantity <= 1} className="h-7 w-7 p-0"><Minus className="h-4 w-4" /></Button>
                    <span className="font-semibold w-8 text-center">{card.quantity}</span>
                    <Button variant="outline" size="sm" onClick={() => onQuantityChange(card.id, card.quantity + 1)} disabled={card.quantity >= card.maxQuantity} className="h-7 w-7 p-0"><Plus className="h-4 w-4" /></Button>
                    <span className="text-xs text-muted-foreground">(of {card.maxQuantity})</span>
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
  const [tradeMessage, setTradeMessage] = useState("");
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
          description: "Trade request has been copied. You can now paste it in Discord.",
          duration: 3000,
        });

        // Ping the binder owner in the Discord server (fire-and-forget)
        const notifyCards = validCardsToSend.map((card: any) => ({
          name: card.display_name || card.name,
          quantity: card.quantity,
          value: card.tcg_market ?? card.printingDetails?.tcg_market ?? 0,
        }));
        notifyTradeInterest(binderId, {
          cards: notifyCards,
          totalValue: notifyCards.reduce((sum: number, c: any) => sum + c.value * c.quantity, 0),
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

  const totalCards = selectedCards.reduce((sum: number, card: any) => sum + card.quantity, 0);

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>Your Trade Request</DrawerTitle>
            <div className="text-sm text-muted-foreground">For {recipientUsername}</div>
          </DrawerHeader>
          <div className="p-4 max-h-[50vh] overflow-y-auto">
            {selectedCards.map((card: any, index: number) => (
              <MobileTradeCardItem 
                key={card.id} 
                card={card} 
                onQuantityChange={onQuantityChange}
                onRemove={() => onRemoveSelected(index)}
              />
            ))}
          </div>
          <DrawerFooter className="pt-2">
            {hasInvalidCards && (
                <div className="flex items-center gap-2 p-2 mb-2 text-xs text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/20 rounded-md">
                    <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                    <span>Only 'For Trade' items will be included.</span>
                </div>
            )}

            {/* Trade Method Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Trade Method:</label>
              <Select value={tradeType} onValueChange={(value: 'shipped' | 'in-person') => setTradeType(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shipped">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <span>Ship via Mail</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="in-person">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>Meet in Person</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">
                {tradeType === 'shipped'
                  ? 'Cards will be sent through mail with tracking'
                  : 'You will arrange to meet locally to exchange cards'}
              </div>
            </div>

            <Textarea
              value={tradeMessage}
              onChange={(e) => setTradeMessage(e.target.value)}
              placeholder="Add an optional message..."
              className="text-sm min-h-[60px]"
            />
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
            <Button onClick={handleCopyToClipboard} disabled={isSending || validCardsToSend.length === 0}>
              {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
              {isSending ? "Copying..." : `Copy Request (${totalCards} ${totalCards === 1 ? 'card' : 'cards'})`}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
};