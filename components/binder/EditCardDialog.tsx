// components/binder/EditCardDialog.tsx
"use client"

import React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { getSetName, getRarityName, getFoilingName } from "@/lib/fab-formatters";


// The shape of the card object passed as a prop
interface BinderCard {
  id: string;
  name: string;
  set?: string;
  rarity?: string;
  foiling?: string;
  quantity: number | { $numberInt: string };
  condition?: string;
  notes?: string;
  forTrade: boolean;
}

// The props our component accepts
interface EditCardDialogProps {
  card: BinderCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: Partial<Omit<BinderCard, 'id' | 'name'>>) => void;
}

// Helper to safely get the initial quantity as a number
function getSafeQuantity(q: any): number {
  if (typeof q === "object" && q !== null && "$numberInt" in q) {
    return Number(q.$numberInt);
  }
  return Number(q) || 1;
}

export default function EditCardDialog({ card, open, onOpenChange, onSave }: EditCardDialogProps) {
  // State for the form fields
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState("NM");
  const [notes, setNotes] = useState("");
  const [forTrade, setForTrade] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // When a new card is passed in, reset the form's state to match that card's data.
  useEffect(() => {
    if (card) {
      setQuantity(getSafeQuantity(card.quantity));
      setCondition(card.condition || "NM");
      setNotes(card.notes || "");
      setForTrade(card.forTrade ?? true); // Default to true if undefined
    }
  }, [card]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const updates = {
        quantity,
        condition,
        notes,
        forTrade,
      };
      // Call the onSave prop passed from the parent page
      await onSave(updates);
      onOpenChange(false); // Close the dialog on success
    } catch (error) {
      console.error("Error saving card:", error);
      // In a real app, you might show a toast notification here
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!card) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit: {card.name}</DialogTitle>
          <DialogDescription>
            Update the quantity, condition, and other details for this card.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Display-only info for context */}
          <div className="flex justify-between items-center text-sm text-muted-foreground p-3 bg-muted rounded-md">
            <span>Set: {getSetName(card.printingDetails?.set_id)}</span>
            <span>Rarity: {getRarityName(card.printingDetails?.rarity)}</span>
            <span>Foil: {getFoilingName(card.printingDetails?.foiling)}</span>
        </div>

          {/* Quantity and Condition */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="condition">Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger id="condition"><SelectValue placeholder="Select condition" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NM">Near Mint (NM)</SelectItem>
                  <SelectItem value="SP">Slightly Played (SP)</SelectItem>
                  <SelectItem value="MP">Moderately Played (MP)</SelectItem>
                  <SelectItem value="HP">Heavily Played (HP)</SelectItem>
                  <SelectItem value="DMG">Damaged (DMG)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="e.g., Signed by artist, specific wear..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* For Trade */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <Label htmlFor="for-trade" className="cursor-pointer">
              Available for Trade
            </Label>
            <Switch id="for-trade" checked={forTrade} onCheckedChange={setForTrade} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}