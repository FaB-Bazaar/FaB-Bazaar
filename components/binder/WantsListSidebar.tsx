// components/binder/WantsListSidebar.tsx
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
  Heart, 
  Loader2, 
  Check,
  Trash2,
  ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WantsListSidebarProps {
  selectedCards: any[];
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  onQuantityChange: (cardId: string, newQuantity: number) => void;
  onRemoveSelected: (index: number) => void;
  onClearSelected: () => void;
  onAddToWants: () => Promise<void>;
}

interface WantsCardItemProps {
  card: any;
  index: number;
  onQuantityChange: (cardId: string, newQuantity: number) => void;
  onRemove: (index: number) => void;
  onPriorityChange: (cardId: string, priority: string) => void;
  onNotesChange: (cardId: string, notes: string) => void;
}

const WantsCardItem: React.FC<WantsCardItemProps> = ({
  card,
  index,
  onQuantityChange,
  onRemove,
  onPriorityChange,
  onNotesChange
}) => {
  const [localNotes, setLocalNotes] = useState(card.notes || "");
  const [notesExpanded, setNotesExpanded] = useState(false);

  const handleNotesBlur = () => {
    onNotesChange(card.id, localNotes);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  return (
    <Card className="mb-3">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* Card Image */}
          <div className="flex-shrink-0">
            <img
              src={getCardImageUrl(card)
              }
              alt={card.name}
              className="w-12 h-16 object-cover rounded border"
            />
          </div>
          
          {/* Card Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">{card.name}</h4>
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

            {/* Quantity Controls */}
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
                    const newQty = Math.max(1, parseInt(e.target.value) || 1);
                    onQuantityChange(card.id, newQty);
                  }}
                  className="w-14 h-6 text-center text-sm"
                  min="1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onQuantityChange(card.id, card.quantity + 1)}
                  className="h-6 w-6 p-0"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Priority Selection */}
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

            {/* Notes Section */}
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
                  placeholder="Add notes about why you want this card..."
                  className="text-xs min-h-[60px] resize-none"
                />
              )}
              
              {!notesExpanded && localNotes && (
                <p className="text-xs text-muted-foreground truncate">
                  {localNotes}
                </p>
              )}
            </div>
            
            {/* Price Display */}
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

export const WantsListSidebar: React.FC<WantsListSidebarProps> = ({
  selectedCards,
  sidebarOpen,
  onCloseSidebar,
  onQuantityChange,
  onRemoveSelected,
  onClearSelected,
  onAddToWants
}) => {
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [cardsWithPriority, setCardsWithPriority] = useState(
    selectedCards.map(card => ({
      ...card,
      priority: card.priority || 'medium',
      notes: card.notes || ''
    }))
  );

  // Update cards when selectedCards changes
  React.useEffect(() => {
    setCardsWithPriority(
      selectedCards.map(card => ({
        ...card,
        priority: card.priority || 'medium',
        notes: card.notes || ''
      }))
    );
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

  const handleAddToWantsList = async () => {
    setIsAdding(true);
    
    try {
      const response = await fetch('/api/wants/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          printings: cardsWithPriority.map(card => ({
            printingId: card.printingId,
            quantity: card.quantity,
            priority: card.priority,
            notes: card.notes
          }))
        })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Added to Wants List",
          description: `Successfully added ${cardsWithPriority.length} card${cardsWithPriority.length > 1 ? 's' : ''} to your wants list.`
        });
        
        // Call the parent's onAddToWants callback to handle any additional logic
        await onAddToWants();
        
        // Clear selections after successful add
        onClearSelected();
      } else {
        throw new Error(data.error || 'Failed to add cards to wants list');
      }
    } catch (error: any) {
      console.error('Error adding to wants list:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add cards to wants list. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAdding(false);
    }
  };

  const totalEstimatedValue = cardsWithPriority.reduce((total, card) => {
    const price = card.printingDetails?.tcg_low || 0;
    return total + (price * card.quantity);
  }, 0);

  if (!sidebarOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-72 bg-background border-l border-border shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Add to Wants</h2>
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

      {/* Summary */}
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

      {/* Cards List */}
      <div className="flex-1 overflow-y-auto p-3">
        {cardsWithPriority.map((card, index) => (
          <WantsCardItem
            key={card.id}
            card={card}
            index={index}
            onQuantityChange={onQuantityChange}
            onRemove={onRemoveSelected}
            onPriorityChange={handlePriorityChange}
            onNotesChange={handleNotesChange}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-border space-y-2">
        <Button
          onClick={handleAddToWantsList}
          disabled={isAdding || cardsWithPriority.length === 0}
          className="w-full"
        >
          {isAdding ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding to Wants...
            </>
          ) : (
            <>
              <Heart className="mr-2 h-4 w-4" />
              Add {cardsWithPriority.length} to Wants List
            </>
          )}
        </Button>
        
        <div className="text-xs text-muted-foreground text-center">
          Cards will be added to your personal wants list
        </div>
      </div>
    </div>
  );
};