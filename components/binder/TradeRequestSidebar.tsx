// components/binder/TradeRequestSidebar.tsx (FINAL & COMPLETE)

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  X,
  Plus,
  Minus,
  ArrowLeftRight,
  Loader2,
  ShieldAlert,
  ChevronRight,
  Copy,
  Package,
  Users
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn, getCardImageUrl } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { formatTradeRequestForDiscord } from "@/lib/formatters/tradeRequestFormatter";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { notifyTradeInterest } from "@/lib/client/binders-client";
import { TRADE_REQUESTS_CHANNEL_NAME, TRADE_REQUESTS_CHANNEL_URL } from "@/lib/discord/links";
import { displayUsername } from "@/lib/utils/display-username";

interface TradeRequestSidebarProps {
  selectedCards: any[];
  sidebarOpen: boolean;
  binderId: string;
  recipientId: string;
  recipientUsername: string;
  recipientDiscordId?: string;
  onCloseSidebar: () => void;
  onQuantityChange: (cardId: string, newQuantity: number) => void;
  onRemoveSelected: (index: number) => void;
  onClearSelected: () => void;
  onTradeRequestSent: () => Promise<void>;
}

interface TradeCardItemProps {
  card: any;
  index: number;
  onQuantityChange: (cardId: string, newQuantity: number) => void;
  onRemove: (index: number) => void;
  onPriorityChange: (cardId: string, priority: string) => void;
  onNotesChange: (cardId: string, notes: string) => void;
}

const TradeCardItem: React.FC<TradeCardItemProps> = ({
  card,
  index,
  onQuantityChange,
  onRemove,
  onPriorityChange,
  onNotesChange
}) => {
  const [localNotes, setLocalNotes] = useState(card.notes || "");
  const [notesExpanded, setNotesExpanded] = useState(false);
  const isForTrade = card.forTrade === true;

  const handleNotesBlur = () => {
    onNotesChange(card.id, localNotes);
  };

  return (
    <Card className={cn("mb-3", !isForTrade && "border-amber-500/50 bg-amber-50/20 dark:bg-amber-900/10")}>
      <CardContent className="p-3">
        {!isForTrade && (
            <div className="flex items-center gap-2 p-2 mb-2 text-xs text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/20 rounded-md">
                <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                <span>This item is not marked for trade.</span>
            </div>
        )}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <img
              src={getCardImageUrl(card)
              }
              alt={card.name}
              className="w-12 h-16 object-cover rounded border"
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">{card.display_name || card.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  {card.printingDetails?.set_id && (
                    <Badge variant="outline" className="text-xs">
                      {card.printingDetails.set_id}
                    </Badge>
                  )}
                  {card.printingDetails?.foiling && card.printingDetails.foiling !== 'S' && (
                    <Badge variant="outline" className="text-xs">
                      {card.printingDetails.foiling === 'RF' ? 'Rainbow Foil' : 
                       card.printingDetails.foiling === 'CF' ? 'Cold Foil' : 
                       card.printingDetails.foiling}
                    </Badge>
                  )}
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(index)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-muted-foreground">Qty:</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onQuantityChange(card.id, Math.max(1, card.quantity - 1))}
                  className="h-6 w-6 p-0"
                  disabled={card.quantity <= 1}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  type="number"
                  value={card.quantity}
                  onChange={(e) => {
                    const newQty = Math.max(1, Math.min(parseInt(e.target.value) || 1, card.maxQuantity));
                    onQuantityChange(card.id, newQty);
                  }}
                  className="w-14 h-6 text-center text-sm"
                  min="1"
                  max={card.maxQuantity}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onQuantityChange(card.id, Math.min(card.quantity + 1, card.maxQuantity))}
                  className="h-6 w-6 p-0"
                  disabled={card.quantity >= card.maxQuantity}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">
                (of {card.maxQuantity})
              </span>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-muted-foreground">Priority:</span>
              <Select
                value={card.priority || 'medium'}
                onValueChange={(value) => onPriorityChange(card.id, value)}
              >
                <SelectTrigger className="w-24 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Notes:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setNotesExpanded(!notesExpanded)}
                  className="h-5 w-5 p-0"
                >
                  <ChevronRight className={`h-3 w-3 transition-transform ${notesExpanded ? 'rotate-90' : ''}`} />
                </Button>
              </div>
              
              {notesExpanded && (
                <Textarea
                  value={localNotes}
                  onChange={(e) => setLocalNotes(e.target.value)}
                  onBlur={handleNotesBlur}
                  placeholder="Why do you want this card?"
                  className="text-xs min-h-[60px] resize-none"
                />
              )}
              
              {!notesExpanded && localNotes && (
                <p className="text-xs text-muted-foreground truncate">
                  {localNotes}
                </p>
              )}
            </div>
            
            {card.printingDetails?.tcg_low && (
              <div className="mt-2 text-xs text-muted-foreground">
                Est. ${(card.printingDetails.tcg_low * card.quantity).toFixed(2)}
                {card.quantity > 1 && (
                  <span className="ml-1">
                    (${card.printingDetails.tcg_low.toFixed(2)} each)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const TradeRequestSidebar: React.FC<TradeRequestSidebarProps> = ({
  selectedCards,
  sidebarOpen,
  binderId,
  recipientId,
  recipientUsername,
  recipientDiscordId,
  onCloseSidebar,
  onQuantityChange,
  onRemoveSelected,
  onClearSelected,
  onTradeRequestSent
}) => {
  const { toast } = useToast();
  const router = useRouter();
  const [isSending, setIsSending] = useState(false);
  const [tradeMessage, setTradeMessage] = useState("");
  const [tradeType, setTradeType] = useState<'shipped' | 'in-person'>('in-person');
  const [error, setError] = useState<string | null>(null);
  const [existingTradeId, setExistingTradeId] = useState<string | null>(null);
  const [cardsWithPriority, setCardsWithPriority] = useState(
    selectedCards.map(card => ({
      ...card,
      priority: card.priority || 'medium',
      notes: card.notes || ''
    }))
  );

  React.useEffect(() => {
    setCardsWithPriority(
      selectedCards.map(card => ({
        ...card,
        priority: card.priority || 'medium',
        notes: card.notes || ''
      }))
    );
    // Clear error when selection changes
    setError(null);
    setExistingTradeId(null);
  }, [selectedCards]);

  const handlePriorityChange = (cardId: string, priority: string) => {
    setCardsWithPriority(prev => 
      prev.map(card => 
        card.id === cardId ? { ...card, priority } : card
      )
    );
  };

  const handleNotesChange = (cardId: string, notes: string) => {
    setCardsWithPriority(prev => 
      prev.map(card => 
        card.id === cardId ? { ...card, notes } : card
      )
    );
  };

  const hasInvalidCards = cardsWithPriority.some(card => card.forTrade !== true);

//   const handleSendTradeRequest = async () => {
//     setIsSending(true);
    
//     const validCardsToSend = cardsWithPriority.filter(card => card.forTrade === true);

//     if (validCardsToSend.length === 0) {
//         toast({
//             title: "No Tradable Cards Selected",
//             description: "You can only send trade requests for items marked 'For Trade' by the owner.",
//             variant: "destructive"
//         });
//         setIsSending(false);
//         return;
//     }

//     try {
//       const response = await fetch('/api/trade-requests/create', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           targetUserId: recipientId,
//           message: tradeMessage,
//           selectedCards: validCardsToSend.map(card => ({
//             inventoryId: card.id,
//             requestedQuantity: card.quantity,
//             priority: card.priority,
//             notes: card.notes
//           }))
//         })
//       });

//       const data = await response.json();

//       if (data.success) {
//         toast({
//           title: "Trade Request Sent!",
//           description: `Your request has been sent to ${recipientUsername}. You will be redirected.`,
//           variant: "success"
//         });
        
//         await onTradeRequestSent();
//         onClearSelected();
//         setTradeMessage("");

//         router.push(`/trade-requests/${data.tradeRequestId}`);

//       } else {
//         throw new Error(data.error || 'Failed to send trade request');
//       }
//     } catch (error: any) {
//       console.error('Error sending trade request:', error);
//       toast({
//         title: "Submission Failed",
//         description: error.message || "Please try again. The owner may have changed their binder.",
//         variant: "destructive"
//       });
//     } finally {
//       setIsSending(false);
//     }
//   };

// In TradeRequestSidebar.tsx, update the handleSendTradeRequest function:

const handleCopyToClipboard = async () => {
    setIsSending(true);
    setError(null);
    setExistingTradeId(null);

    const validCardsToSend = cardsWithPriority.filter(card => card.forTrade === true);

    if (validCardsToSend.length === 0) {
        const errorMsg = "You can only copy items marked 'For Trade' by the owner.";
        setError(errorMsg);
        toast({
            title: "No Tradable Cards Selected",
            description: errorMsg,
            variant: "destructive"
        });
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
          description: `We pinged ${displayUsername(recipientUsername)} in #${TRADE_REQUESTS_CHANNEL_NAME} on the FaB Bazaar Discord — paste your request there.`,
          duration: 5000,
        });

        // Ping the binder owner in the Discord server (fire-and-forget)
        const notifyCards = validCardsToSend.map(card => ({
          name: card.display_name || card.name,
          quantity: card.quantity,
          value: card.tcg_low ?? card.printingDetails?.tcg_low ?? 0,
        }));
        notifyTradeInterest(binderId, {
          cards: notifyCards,
          totalValue: notifyCards.reduce((sum, c) => sum + c.value * c.quantity, 0),
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

      toast({
        title: "Copy Failed",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
};

  const totalEstimatedValue = cardsWithPriority.reduce((total, card) => {
    const price = card.printingDetails?.tcg_low || 0;
    return total + (price * card.quantity);
  }, 0);

  if (!sidebarOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-72 bg-background border-l border-border shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Trade Request</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCloseSidebar}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 border-b border-border bg-muted/50">
        <div className="text-sm">
          <span className="text-muted-foreground">Trading with:</span>
          <span className="ml-2 font-medium">{displayUsername(recipientUsername)}</span>
        </div>
      </div>

      <div className="p-4 border-b border-border bg-muted/50">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">
            {cardsWithPriority.length} card{cardsWithPriority.length !== 1 ? 's' : ''} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelected}
            className="text-xs h-6 px-2"
          >
            Clear All
          </Button>
        </div>
        
        {totalEstimatedValue > 0 && (
          <div className="text-sm text-muted-foreground">
            Est. Total: ${totalEstimatedValue.toFixed(2)}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {cardsWithPriority.map((card, index) => (
          <TradeCardItem
            key={card.id}
            card={card}
            index={index}
            onQuantityChange={onQuantityChange}
            onRemove={() => onRemoveSelected(index)}
            onPriorityChange={handlePriorityChange}
            onNotesChange={handleNotesChange}
          />
        ))}
      </div>

      <div className="p-4 border-t border-border space-y-3">
        {hasInvalidCards && (
            <div className="flex items-center gap-2 p-2 text-xs text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/20 rounded-md">
                <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                <span>Only 'For Trade' items will be sent.</span>
            </div>
        )}

        <div>
          <label className="text-sm font-medium mb-2 block">
            Trade Method:
          </label>
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
          <div className="text-xs text-muted-foreground mt-1">
            {tradeType === 'shipped'
              ? 'Cards will be sent through mail with tracking'
              : 'You will arrange to meet locally to exchange cards'}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">
            Message to {displayUsername(recipientUsername)}:
          </label>
          <Textarea
            value={tradeMessage}
            onChange={(e) => setTradeMessage(e.target.value)}
            placeholder="Hi! I'm interested in trading for these cards..."
            className="text-sm min-h-[80px] resize-none"
            maxLength={500}
          />
          <div className="text-xs text-muted-foreground mt-1">
            {tradeMessage.length}/500 characters
          </div>
        </div>

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
                    onClick={() => router.push(`/trade-requests/${existingTradeId}`)}
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
          onClick={handleCopyToClipboard}
          disabled={isSending || cardsWithPriority.length === 0}
          className="w-full"
        >
          {isSending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          {isSending ? "Copying..." : "Copy to Clipboard"}
        </Button>

        <div className="text-sm text-gray-300 text-center">
          Copies the request and pings {displayUsername(recipientUsername)} in{" "}
          <a
            href={TRADE_REQUESTS_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline underline-offset-2 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-sm"
          >
            #{TRADE_REQUESTS_CHANNEL_NAME}
          </a>{" "}
          on the FaB Bazaar Discord
        </div>
      </div>
    </div>
  );
};
