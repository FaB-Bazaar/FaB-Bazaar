//components/edit-card-dialog.tsx
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { PrintingSelector } from "./printing-selector"

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
  priceInfo?: {
    tcgMarket?: string
  }
}

interface EditCardDialogProps {
  card: BinderCard
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (updates: Partial<BinderCard>) => void
}

// Helper to safely extract quantity as a number
function getSafeQuantity(q: any): number {
  if (typeof q === "object" && q !== null && "$numberInt" in q) {
    return Number(q.$numberInt)
  }
  return Number(q) || 1
}

export default function EditCardDialog({ card, open, onOpenChange, onSave }: EditCardDialogProps) {
  // Defensive: always coerce quantity to number
  const [quantity, setQuantity] = useState(getSafeQuantity(card.quantity))
  const [condition, setCondition] = useState(card.condition || "NM")
  const [notes, setNotes] = useState(card.notes || "")
  const [forTrade, setForTrade] = useState(card.forTrade)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [printingDetails, setPrintingDetails] = useState<any>(card.printingDetails || null)
  const [selectedPrintingId, setSelectedPrintingId] = useState<string | null>(card.printingId || null)
  const [parentCardId, setParentCardId] = useState<string | null>(card.cardId || null)

  // Parent card ID is now provided directly by PrintingSelector
  // No need to fetch separately - PrintingSelector uses /api/search/core

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

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)

      // Create the updates object with all necessary fields
      const updates: Partial<BinderCard> = {
        id: card.id, // Ensure the card id is always included for PATCH
        quantity,
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
      await onSave(updates)
      onOpenChange(false)
    } catch (error) {
      console.error("Error saving card:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
        <DialogHeader className="border-b border-gray-200 dark:border-gray-600 pb-4">
          <DialogTitle className="text-gray-900 dark:text-gray-100 text-lg font-semibold">
            Edit Card
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-6">
          {/* Card Info Section */}
          <div className="space-y-2 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base">
              {card.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {card.set} {card.rarity} {card.foiling}
            </p>
          </div>

          {/* Printing Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Select Printing
            </Label>
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/30">
              <PrintingSelector
                cardId={parentCardId || ""}
                cardName={card.name}
                selectedPrintingId={selectedPrintingId}
                onPrintingSelect={handlePrintingSelect}
              />
            </div>
          </div>

          {/* Quantity and Condition Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Quantity
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Number.parseInt(e.target.value) || 1)}
                className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="condition" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Condition
              </Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger 
                  id="condition" 
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400"
                >
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                  <SelectItem value="NM" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600">
                    Near Mint (NM)
                  </SelectItem>
                  <SelectItem value="SP" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600">
                    Slightly Played (SP)
                  </SelectItem>
                  <SelectItem value="MP" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600">
                    Moderately Played (MP)
                  </SelectItem>
                  <SelectItem value="HP" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600">
                    Heavily Played (HP)
                  </SelectItem>
                  <SelectItem value="DMG" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600">
                    Damaged (DMG)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes Section */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this card"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 resize-none"
            />
          </div>

          {/* For Trade Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="space-y-1">
              <Label htmlFor="for-trade" className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer">
                Available for Trade
              </Label>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Make this card available for trading with other users
              </p>
            </div>
            <Switch 
              id="for-trade" 
              checked={forTrade} 
              onCheckedChange={setForTrade}
              className="data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-500"
            />
          </div>
        </div>

        <DialogFooter className="border-t border-gray-200 dark:border-gray-600 pt-4 gap-3">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
