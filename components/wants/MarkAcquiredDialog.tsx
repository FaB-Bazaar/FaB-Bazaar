// components/wants/MarkAcquiredDialog.tsx
"use client";

import { useEffect, useState } from "react"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { PackageCheck, AlertCircle } from "lucide-react"
import { bindersClient } from "@/lib/client"
import { acquireWantsItems } from "@/lib/client/wants-client"
import { SET_MAP, FOILING_MAP, RARITY_MAP } from "@/lib/fab-constants"

export type AcquiredCard = {
  printingId: string
  quantity: number
  remainingWanted: number
}

type MarkAcquiredDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Cart entries from the wants page: id is the printingId, quantity is the selected qty, maxQuantity the wanted qty */
  selectedCards: any[]
  onAcquireComplete?: (acquiredCards: AcquiredCard[]) => void
}

const getSetName = (code: string) =>
  SET_MAP[code?.toLowerCase() as keyof typeof SET_MAP] || code?.toUpperCase() || code

const getFoilingName = (code: string) => {
  if (!code || code === "S" || code === "N") return "Non-Foil"
  return FOILING_MAP[code?.toLowerCase() as keyof typeof FOILING_MAP] || code
}

const getRarityName = (code: string) =>
  RARITY_MAP[code?.toLowerCase() as keyof typeof RARITY_MAP] || code

export default function MarkAcquiredDialog({
  open,
  onOpenChange,
  selectedCards,
  onAcquireComplete,
}: MarkAcquiredDialogProps) {
  const [binders, setBinders] = useState<any[]>([])
  const [targetBinderId, setTargetBinderId] = useState("")
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Fetch the user's binders when the dialog opens
  useEffect(() => {
    if (!open) return

    const fetchBinders = async () => {
      const result = await bindersClient.getUserBinders()
      if (result.success) {
        const available = (result.data.binders || []).filter((b: any) => !b.archived)
        setBinders(available)
        if (available.length > 0) {
          setTargetBinderId((current) => current || available[0]._id)
        }
      } else {
        setBinders([])
      }
    }

    fetchBinders()
  }, [open])

  // Initialize quantities from the cart's selected quantities
  useEffect(() => {
    if (!open) return
    const q: Record<string, number> = {}
    for (const card of selectedCards) {
      q[String(card.id)] = card.quantity || 1
    }
    setQuantities(q)
  }, [open, selectedCards])

  const handleQuantityChange = (printingId: string, newQuantity: number, max: number) => {
    const v = Math.max(1, Math.min(newQuantity, max))
    setQuantities(q => ({ ...q, [printingId]: v }))
  }

  const handleAcquire = async () => {
    if (!targetBinderId) {
      toast({
        title: "No Binder Selected",
        description: "Please select a destination binder.",
        variant: "destructive"
      })
      return
    }

    setLoading(true)

    try {
      const cardsToAcquire = selectedCards.map(card => ({
        printingId: String(card.id),
        quantity: quantities[String(card.id)] || 1
      }))

      const result = await acquireWantsItems(targetBinderId, cardsToAcquire)

      if (!result.success) {
        throw new Error(result.error || 'Failed to mark cards as acquired')
      }

      const data = result.data

      if (data.summary.successful > 0) {
        const binderName = binders.find(b => b._id === targetBinderId)?.name || 'binder'

        let message = `Added ${data.summary.totalQuantityAcquired} cards to ${binderName}`
        if (data.summary.partiallyAcquired > 0) {
          message += ` (${data.summary.partiallyAcquired} still partially wanted)`
        }

        toast({
          title: "Cards Acquired",
          description: message,
          variant: "default"
        })

        const acquiredCards: AcquiredCard[] = data.results
          .filter((r) => r.success)
          .map((r) => ({
            printingId: r.printingId,
            quantity: r.quantity,
            remainingWanted: r.remainingWanted,
          }))

        onAcquireComplete?.(acquiredCards)
      }

      if (data.summary.failed > 0) {
        const failedResults = data.results.filter((r) => !r.success)
        toast({
          title: `${data.summary.failed} Cards Failed`,
          description: failedResults[0]?.error || 'Unknown error',
          variant: "destructive"
        })
      }

      if (data.summary.successful > 0) {
        onOpenChange(false)
      }
    } catch (err: any) {
      console.error('Acquire error:', err)
      toast({
        title: "Failed to Mark as Acquired",
        description: err.message || "An unexpected error occurred.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const totalCards = selectedCards.reduce(
    (sum, card) => sum + (quantities[String(card.id)] || 1),
    0
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
        <DialogHeader className="border-b border-gray-300 dark:border-gray-600 pb-4">
          <DialogTitle className="text-gray-900 dark:text-gray-100 text-lg font-semibold flex items-center gap-2">
            <PackageCheck className="h-5 w-5" />
            Mark Cards as Acquired
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-6 overflow-y-auto max-h-[60vh]">
          {/* Destination binder */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
              Add to Binder
            </label>
            <Select value={targetBinderId} onValueChange={setTargetBinderId}>
              <SelectTrigger className="w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400">
                <SelectValue placeholder="Select a binder" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                {binders.map(binder => (
                  <SelectItem
                    key={binder._id}
                    value={binder._id}
                    className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    {binder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {binders.length === 0 && (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-300 dark:border-gray-600">
              <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 mb-3">
                You don&apos;t have any binders yet
              </p>
              <Link
                href="/binder/create"
                className="text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:text-blue-700 dark:hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-sm"
              >
                Create a binder
              </Link>
            </div>
          )}

          {/* Cards list */}
          {selectedCards.length > 0 && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                Acquired Cards ({selectedCards.length})
              </label>

              <div className="max-h-64 overflow-y-auto space-y-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 border border-gray-300 dark:border-gray-600">
                {selectedCards.map((card: any) => {
                  const acquireQty = quantities[String(card.id)] || 1
                  const maxQty = card.maxQuantity || 1
                  const set = card.printingDetails?.set || card.set
                  const rarity = card.printingDetails?.rarity || card.rarity
                  const foiling = card.printingDetails?.foiling || card.foiling

                  return (
                    <div key={card.id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {card.printingDetails?.display_name || card.name}
                        </div>
                        <div className="flex gap-1 text-xs mt-1 flex-wrap">
                          <Badge variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                            {acquireQty >= maxQty ? `All ${maxQty} wanted` : `${acquireQty} of ${maxQty} wanted`}
                          </Badge>
                          {set && (
                            <Badge variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                              {getSetName(set)}
                            </Badge>
                          )}
                          {rarity && (
                            <Badge variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                              {getRarityName(rarity)}
                            </Badge>
                          )}
                          {foiling && (
                            <Badge variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                              {getFoilingName(foiling)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(String(card.id), acquireQty - 1, maxQty)}
                          disabled={acquireQty <= 1}
                          className="h-8 w-8 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        >
                          -
                        </button>
                        <div className="flex flex-col items-center min-w-[3rem]">
                          <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                            {acquireQty}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            of {maxQty}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(String(card.id), acquireQty + 1, maxQty)}
                          disabled={acquireQty >= maxQty}
                          className="h-8 w-8 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Summary */}
          {selectedCards.length > 0 && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <PackageCheck className="h-4 w-4 text-green-700 dark:text-green-400" />
                <div className="text-sm font-medium text-green-900 dark:text-green-100">Acquisition Summary</div>
              </div>
              <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                <div>{selectedCards.length} different cards • {totalCards} total cards</div>
                <div className="text-xs text-green-700 dark:text-green-300">
                  Cards will be added to the binder and removed from your wants list
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-gray-300 dark:border-gray-600 pt-4 gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAcquire}
            disabled={loading || !targetBinderId || binders.length === 0 || selectedCards.length === 0}
            className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-500 text-white min-w-[120px]"
          >
            {loading ? (
              <>
                <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                Adding...
              </>
            ) : (
              <>
                <PackageCheck className="h-4 w-4 mr-2" />
                Add {totalCards > 1 ? `${totalCards} Cards` : 'Card'} to Binder
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
