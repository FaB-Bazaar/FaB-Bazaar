"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { PrintingSelector } from "./printing-selector"
import { getFoilingDisplayName } from "@/lib/card-metadata"
import { useIsMobile } from "@/hooks/use-mobile";

interface BinderCard {
  id: string
  cardId: string
  name: string
  set?: string
  rarity?: string
  foiling?: string
  edition?: string
  artVariation?: string
  printingId?: string
  quantity: number
  condition?: string
  notes?: string
  forTrade: boolean
  value?: string
  printingDetails?: {
    image_url?: string
    set_id?: string
    rarity?: string
    foiling?: string
  }
}

interface EditWantedCardDialogProps {
  card: any
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (updates: any) => void
}

export default function EditWantedCardDialog({ card, open, onOpenChange, onSave }: EditWantedCardDialogProps) {
  const isMobile = useIsMobile();
  // Initialize with safe defaults
  const [quantity, setQuantity] = useState<number | string>(1);
  const [condition, setCondition] = useState("NM");
  const [notes, setNotes] = useState("");
  const [forTrade, setForTrade] = useState(false);
  const [printingDetails, setPrintingDetails] = useState<any>(null);
  const [selectedPrintingId, setSelectedPrintingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [priority, setPriority] = useState<string>("medium");
  const [parentCardId, setParentCardId] = useState<string | null>(null);

  // Update state when card changes
  useEffect(() => {
    if (card) {
      setQuantity(isMobile ? String(card.quantity || 1) : card.quantity || 1);
      setCondition(card.condition || "NM");
      setNotes(card.notes || "");
      setForTrade(card.forTrade || false);
      setSelectedPrintingId(card.printingId || null);
      setPriority(card.priority || "medium");
      setParentCardId(card.cardId || null);
      setPrintingDetails(card.printingDetails || null);
    }
  }, [card, isMobile]);

  // Fetch the parent card ID if we only have the printing ID
  useEffect(() => {
    const fetchParentCardId = async () => {
      if (selectedPrintingId && !parentCardId) {
        try {
          const response = await fetch(`/api/cards/printing/${selectedPrintingId}`)
          if (response.ok) {
            const data = await response.json()
            if (data.card && data.card.unique_id) {
              setParentCardId(data.card.unique_id)
            }
          }
        } catch (error) {
          console.error("Error fetching parent card ID:", error)
        }
      }
    }

    fetchParentCardId()
  }, [selectedPrintingId, parentCardId])

  const handlePrintingSelect = (printingId: string, details: any) => {
    setSelectedPrintingId(printingId)
    // Update the parent card ID if it's provided in the details
    if (details.cardId) {
      setParentCardId(details.cardId)
    }

    // Ensure we have a properly structured printingDetails object
    setPrintingDetails({
      image_url: details.image_url,
      set_id: details.set_id || details.set,
      rarity: details.rarity,
      foiling: details.foiling,
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    // Parse quantity as number, clamp to min 1
    const finalQuantity = isMobile ? Math.max(1, parseInt(quantity as string) || 1) : (quantity as number);
    const updates: Partial<BinderCard> = {
      quantity: finalQuantity,
      condition,
      notes,
      forTrade,
    }

    // Add printing-related fields
    if (selectedPrintingId) {
      updates.printingId = selectedPrintingId
    }

    // Add the parent card ID if we have it
    if (parentCardId) {
      updates.cardId = parentCardId
    }

    if (printingDetails) {
      // Add individual printing fields at the top level
      if (printingDetails.set_id) updates.set = printingDetails.set_id
      if (printingDetails.rarity) updates.rarity = printingDetails.rarity
      if (printingDetails.foiling) updates.foiling = printingDetails.foiling

      // Also include the full printingDetails object
      updates.printingDetails = printingDetails
    }

    console.log("Saving updates:", updates)
    onSave(updates)
    onOpenChange(false)
  }

  // Don't render if no card is provided
  if (!card) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Wanted Card</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
              <h3 className="font-medium">{card.name}</h3>
              <p className="text-sm text-gray-500">
                {card.set} {card.rarity}{" "}
                <span className={getFoilingDisplayName(card.foiling).includes("Foil") ? "font-semibold" : ""}>
                  {getFoilingDisplayName(card.foiling)}
                </span>
              </p>
            </div>

            {/* Printing Selection */}
            <PrintingSelector
              cardId={parentCardId || ""}
              cardName={card.name}
              selectedPrintingId={selectedPrintingId}
              onPrintingSelect={handlePrintingSelect}
            />

            <div className="grid gap-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => {
                  if (isMobile) {
                    // Allow any string, but only digits
                    const val = e.target.value.replace(/[^0-9]/g, "");
                    setQuantity(val);
                  } else {
                    setQuantity(Number.parseInt(e.target.value) || 1);
                  }
                }}
                onFocus={(e) => {
                  e.target.select();
                }}
                onBlur={(e) => {
                  if (isMobile) {
                    // On blur, clamp to min 1
                    if (e.target.value === "" || parseInt(e.target.value) < 1) {
                      setQuantity("1");
                    }
                  } else {
                    if (e.target.value === "" || Number.parseInt(e.target.value) < 1) {
                      setQuantity(1);
                    }
                  }
                }}
              />
            </div>

            <div className="grid gap-2">
              <Label>Priority</Label>
              <RadioGroup value={priority} onValueChange={setPriority} className="flex space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="low" id="priority-low" />
                  <Label htmlFor="priority-low">Low</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="medium" id="priority-medium" />
                  <Label htmlFor="priority-medium">Medium</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="high" id="priority-high" />
                  <Label htmlFor="priority-high">High</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any specific details about this card"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
