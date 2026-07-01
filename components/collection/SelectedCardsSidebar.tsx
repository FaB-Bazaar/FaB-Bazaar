// components/collection/SelectedCardsSidebar.tsx
"use client"

import { useEffect, useState } from "react"
import { X, ArrowRight, Trash2, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { bindersClient } from "@/lib/client"

interface SelectedCardsSidebarProps {
  cards: any[]                             // full card objects for selected IDs
  onRemove: (cardId: string) => void       // remove one card from selection
  onClearAll: () => void                   // clear entire selection
  onHide: () => void                       // exit select mode
  onTransferComplete: () => void           // refetch after transfer
  onDeleteComplete: () => void             // refetch after bulk delete
}

export function SelectedCardsSidebar({
  cards,
  onRemove,
  onClearAll,
  onHide,
  onTransferComplete,
  onDeleteComplete,
}: SelectedCardsSidebarProps) {
  const { toast } = useToast()

  // Per-card transfer quantities (independent of binder quantity)
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  // Binder picker
  const [binders, setBinders] = useState<any[]>([])
  const [targetBinderId, setTargetBinderId] = useState("")
  const [bindersLoaded, setBindersLoaded] = useState(false)

  const [transferring, setTransferring] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Sync quantities when card selection changes
  useEffect(() => {
    setQuantities(prev => {
      const next: Record<string, number> = {}
      for (const card of cards) {
        const id = String(card.id ?? card._id)
        next[id] = prev[id] ?? card.quantity ?? 1
      }
      return next
    })
  }, [cards])

  // Fetch available target binders once
  useEffect(() => {
    if (bindersLoaded) return
    const fetchBinders = async () => {
      const result = await bindersClient.getUserBinders()
      if (result.success) {
        setBinders(result.data.binders?.filter((b: any) => !b.archived) ?? [])
        setBindersLoaded(true)
      }
    }
    fetchBinders()
  }, [])

  // Keep target binder filtered: exclude all current source binders
  const sourceBinderIds = new Set(cards.map(c => c.binderId))
  const availableTargets = binders.filter(b => !sourceBinderIds.has(b._id))

  // Auto-select first available target when it changes
  useEffect(() => {
    if (availableTargets.length > 0 && !availableTargets.find(b => b._id === targetBinderId)) {
      setTargetBinderId(availableTargets[0]._id)
    }
  }, [availableTargets.length])

  const setQty = (cardId: string, next: number, max: number) =>
    setQuantities(q => ({ ...q, [cardId]: Math.max(1, Math.min(next, max)) }))

  const totalQty = cards.reduce((s, c) => s + (quantities[String(c.id ?? c._id)] ?? 1), 0)

  const handleTransfer = async () => {
    if (!targetBinderId) {
      toast({ title: "Select a destination binder", variant: "destructive" })
      return
    }
    setTransferring(true)
    try {
      const payload = cards.map(card => ({
        cardId: String(card.id ?? card._id),
        sourceBinderId: card.binderId,
        quantity: quantities[String(card.id ?? card._id)] ?? 1,
      }))

      const result = await bindersClient.transferCardsCrossSource(targetBinderId, payload)
      if (!result.success) throw new Error(result.error || "Transfer failed")

      const { summary } = result.data
      let msg = `Transferred ${summary.totalQuantityTransferred} cards`
      if (summary.mergedInTarget > 0) msg += ` · ${summary.mergedInTarget} merged`
      toast({ title: "Transfer Complete", description: msg })
      onClearAll()
      onTransferComplete()
    } catch (err: any) {
      toast({ title: "Transfer Failed", description: err.message, variant: "destructive" })
    } finally {
      setTransferring(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await Promise.all(
        cards.map(card =>
          bindersClient.deleteBinderCard(card.binderId, String(card.id ?? card._id))
        )
      )
      toast({ title: `Deleted ${cards.length} card${cards.length !== 1 ? "s" : ""}` })
      onClearAll()
      onDeleteComplete()
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-l border-gray-300 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-300 dark:border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Selected Cards</span>
          <Badge className="bg-blue-600 text-white text-xs px-1.5 py-0">{cards.length}</Badge>
        </div>
        <button
          onClick={onHide}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
        >
          Hide <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* Card List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {cards.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center mt-8">
            Click cards to select them
          </p>
        )}
        {cards.map(card => {
          const cardId = String(card.id ?? card._id)
          const qty = quantities[cardId] ?? 1
          const max = card.quantity ?? 1
          return (
            <div key={cardId} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-300 dark:border-gray-600 p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="font-medium text-sm text-gray-900 dark:text-gray-100 leading-tight">
                  {card.display_name || card.name}
                </div>
                <button
                  onClick={() => onRemove(cardId)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {card.set && <Badge variant="outline" className="text-xs px-1.5 py-0 border-gray-300 dark:border-gray-500 text-gray-600 dark:text-gray-300">{card.set}</Badge>}
                {card.foiling && <Badge variant="outline" className="text-xs px-1.5 py-0 border-gray-300 dark:border-gray-500 text-gray-600 dark:text-gray-300">{card.foiling}</Badge>}
                {card.rarity && <Badge variant="outline" className="text-xs px-1.5 py-0 border-gray-300 dark:border-gray-500 text-gray-600 dark:text-gray-300">{card.rarity}</Badge>}
              </div>
              {card.binderName && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  From: <span className="font-medium">{card.binderName}</span>
                </div>
              )}
              {/* Quantity control */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQty(cardId, qty - 1, max)}
                  disabled={qty <= 1}
                  className="h-7 w-7 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  -
                </button>
                <span className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100 min-w-[3rem] text-center">
                  {qty} <span className="text-gray-400 dark:text-gray-500">of {max}</span>
                </span>
                <button
                  onClick={() => setQty(cardId, qty + 1, max)}
                  disabled={qty >= max}
                  className="h-7 w-7 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-gray-300 dark:border-gray-700 px-4 py-4 space-y-3">
        {/* Summary */}
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Selected:</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{cards.length} cards</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Total quantity:</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{totalQty}</span>
        </div>

        {/* Binder picker */}
        {cards.length > 0 && (
          <Select value={targetBinderId} onValueChange={setTargetBinderId}>
            <SelectTrigger className="w-full text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
              <SelectValue placeholder="Select destination binder…" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
              {availableTargets.length === 0 ? (
                <SelectItem value="__none__" disabled className="text-gray-400">No available binders</SelectItem>
              ) : (
                availableTargets.map(b => (
                  <SelectItem key={b._id} value={b._id} className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600">
                    {b.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}

        {/* Actions */}
        <Button
          className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
          disabled={transferring || cards.length === 0 || !targetBinderId || availableTargets.length === 0}
          onClick={handleTransfer}
        >
          {transferring ? (
            <><div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />Transferring…</>
          ) : (
            <><ArrowRight className="h-4 w-4 mr-2" />Transfer to Binder</>
          )}
        </Button>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
            disabled={deleting || cards.length === 0}
            onClick={handleDelete}
          >
            {deleting ? (
              <div className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
            ) : (
              <><Trash2 className="h-3 w-3 mr-1" />Delete</>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-gray-600 dark:text-gray-400"
            onClick={onClearAll}
          >
            Clear All
          </Button>
        </div>
      </div>
    </div>
  )
}
