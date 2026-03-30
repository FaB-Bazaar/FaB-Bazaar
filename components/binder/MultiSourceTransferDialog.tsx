// components/binder/MultiSourceTransferDialog.tsx
"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { ArrowRight, Package, AlertCircle } from "lucide-react"
import { bindersClient } from "@/lib/client"

type TransferCard = {
  id?: string
  _id?: string
  binderId: string
  binderName?: string
  display_name?: string
  name?: string
  quantity?: number
  set?: string
  rarity?: string
  foiling?: string
}

type MultiSourceTransferDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCards: TransferCard[]
  onTransferComplete?: () => void
}

export default function MultiSourceTransferDialog({
  open,
  onOpenChange,
  selectedCards,
  onTransferComplete,
}: MultiSourceTransferDialogProps) {
  const [binders, setBinders] = useState<any[]>([])
  const [targetBinderId, setTargetBinderId] = useState("")
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // IDs of all source binders represented in the selection
  const sourceBinderIds = new Set(selectedCards.map(c => c.binderId))

  // Fetch all user binders, exclude all source binders
  useEffect(() => {
    if (!open) return
    const fetchBinders = async () => {
      const result = await bindersClient.getUserBinders()
      if (result.success) {
        const filtered = (result.data.binders || []).filter(
          (b: any) => !sourceBinderIds.has(b._id) && !b.archived
        )
        setBinders(filtered)
        setTargetBinderId(filtered[0]?._id ?? "")
      } else {
        setBinders([])
      }
    }
    fetchBinders()
  }, [open, selectedCards])

  // Initialize quantities from card data
  useEffect(() => {
    if (!open) return
    const q: Record<string, number> = {}
    for (const card of selectedCards) {
      const id = String(card.id ?? card._id)
      q[id] = card.quantity || 1
    }
    setQuantities(q)
  }, [open, selectedCards])

  const handleQuantityChange = (cardId: string, next: number, max: number) => {
    setQuantities(q => ({ ...q, [cardId]: Math.max(1, Math.min(next, max)) }))
  }

  const handleTransfer = async () => {
    if (!targetBinderId) {
      toast({ title: "No Target Binder", description: "Please select a destination binder.", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const cards = selectedCards.map(card => ({
        cardId: String(card.id ?? card._id),
        sourceBinderId: card.binderId,
        quantity: quantities[String(card.id ?? card._id)] || 1,
      }))

      const result = await bindersClient.transferCardsCrossSource(targetBinderId, cards)

      if (!result.success) throw new Error(result.error || "Transfer failed")

      const { summary } = result.data
      if (summary.successful > 0) {
        let message = `Transferred ${summary.totalQuantityTransferred} cards`
        if (summary.mergedInTarget > 0) message += ` · ${summary.mergedInTarget} merged with existing`
        toast({ title: "Transfer Complete", description: message })
        onOpenChange(false)
        onTransferComplete?.()
      }

      if (summary.failed > 0) {
        toast({ title: `${summary.failed} transfers failed`, variant: "destructive" })
      }
    } catch (err: any) {
      toast({ title: "Transfer Failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // Group cards by source binder for display
  const byBinder = new Map<string, { binderName: string; cards: TransferCard[] }>()
  for (const card of selectedCards) {
    if (!byBinder.has(card.binderId)) {
      byBinder.set(card.binderId, { binderName: card.binderName || card.binderId, cards: [] })
    }
    byBinder.get(card.binderId)!.cards.push(card)
  }

  const totalQty = Object.values(quantities).reduce((s, q) => s + q, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
        <DialogHeader className="border-b border-gray-200 dark:border-gray-600 pb-4">
          <DialogTitle className="text-gray-900 dark:text-gray-100 text-lg font-semibold flex items-center gap-2">
            <Package className="h-5 w-5" />
            Transfer {selectedCards.length} Cards to Another Binder
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4 overflow-y-auto max-h-[60vh]">
          {/* Destination */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">Destination Binder</label>
            {binders.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 p-4">
                <AlertCircle className="h-4 w-4 shrink-0" />
                No other binders available for transfer
              </div>
            ) : (
              <Select value={targetBinderId} onValueChange={setTargetBinderId}>
                <SelectTrigger className="w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                  <SelectValue placeholder="Select a binder" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                  {binders.map(b => (
                    <SelectItem key={b._id} value={b._id} className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600">
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Cards grouped by source binder */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
              Cards to Transfer ({selectedCards.length})
            </label>
            <div className="space-y-4 max-h-64 overflow-y-auto bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
              {[...byBinder.entries()].map(([binderId, { binderName, cards }]) => (
                <div key={binderId}>
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    From: {binderName}
                  </div>
                  <div className="space-y-2">
                    {cards.map(card => {
                      const cardId = String(card.id ?? card._id)
                      const transferQty = quantities[cardId] || 1
                      const maxQty = card.quantity || 1
                      return (
                        <div key={cardId} className="flex items-center gap-3 p-2 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                              {card.display_name || card.name}
                            </div>
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              {card.set && <Badge variant="outline" className="text-xs border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300">{card.set}</Badge>}
                              {card.rarity && <Badge variant="outline" className="text-xs border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300">{card.rarity}</Badge>}
                              {card.foiling && <Badge variant="outline" className="text-xs border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300">{card.foiling}</Badge>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(cardId, transferQty - 1, maxQty)}
                              disabled={transferQty <= 1}
                              className="h-7 w-7 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                            >
                              -
                            </button>
                            <div className="text-center min-w-[2.5rem]">
                              <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">{transferQty}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">/{maxQty}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(cardId, transferQty + 1, maxQty)}
                              disabled={transferQty >= maxQty}
                              className="h-7 w-7 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Transfer Summary</span>
            </div>
            <div className="text-sm text-blue-800 dark:text-blue-200">
              {selectedCards.length} cards · {totalQty} total copies · from {byBinder.size} {byBinder.size === 1 ? 'binder' : 'binders'}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-gray-200 dark:border-gray-600 pt-4 gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={loading || !targetBinderId || binders.length === 0 || selectedCards.length === 0}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white min-w-[120px]"
          >
            {loading ? (
              <>
                <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                Transferring...
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4 mr-2" />
                Transfer {totalQty > 1 ? `${totalQty} Cards` : 'Card'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
