// components/binder/SelectedCardsSidebar.tsx
"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ShoppingCart, X, ArrowRight, Copy, Check, Package, ChevronRight, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { bindersClient } from "@/lib/client"

interface SelectedCardsSidebarProps {
  selectedCards: any[]
  sidebarOpen: boolean
  sourceBinderId: string
  onCloseSidebar: () => void
  onQuantityChange: (cardId: string, newQuantity: number) => void
  onRemoveSelected: (index: number) => void
  onClearSelected: () => void
  onDeleteSelected?: () => void
  onTransferComplete?: () => void
  onCopySelected: () => void
  copied: boolean
  editable: boolean
}

export default function SelectedCardsSidebar({
  selectedCards,
  sidebarOpen,
  sourceBinderId,
  onCloseSidebar,
  onQuantityChange,
  onRemoveSelected,
  onClearSelected,
  onTransferComplete,
  onDeleteSelected,
  onCopySelected,
  copied,
  editable,
}: SelectedCardsSidebarProps) {
  const { toast } = useToast()

  const [binders, setBinders] = useState<any[]>([])
  const [targetBinderId, setTargetBinderId] = useState("")
  const [transferring, setTransferring] = useState(false)

  useEffect(() => {
    const fetchBinders = async () => {
      const result = await bindersClient.getUserBinders()
      if (result.success) {
        const filtered = (result.data.binders || []).filter(
          (b: any) => b._id !== sourceBinderId && !b.archived
        )
        setBinders(filtered)
        setTargetBinderId(filtered[0]?._id ?? "")
      }
    }
    fetchBinders()
  }, [sourceBinderId])

  const handleTransfer = async () => {
    if (!targetBinderId) {
      toast({ title: "Select a destination binder", variant: "destructive" })
      return
    }
    setTransferring(true)
    try {
      const cards = selectedCards.map(card => ({
        cardId: String(card.id || card._id),
        quantity: card.quantity || 1,
      }))
      const result = await bindersClient.transferSelectedCards(sourceBinderId, targetBinderId, cards)
      if (!result.success) throw new Error(result.error || "Transfer failed")

      const { summary } = result.data as any
      let msg = `Transferred ${summary.totalQuantityTransferred} cards`
      if (summary.mergedInTarget > 0) msg += ` · ${summary.mergedInTarget} merged`
      toast({ title: "Transfer Complete", description: msg })
      onClearSelected()
      onTransferComplete?.()
    } catch (err: any) {
      toast({ title: "Transfer Failed", description: err.message, variant: "destructive" })
    } finally {
      setTransferring(false)
    }
  }

  if (selectedCards.length === 0 && !sidebarOpen) return null

  const totalCards = selectedCards.reduce((total, card) => total + card.quantity, 0)

  return (
    <>
      {/* Backdrop (mobile only) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 lg:hidden"
          onClick={onCloseSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-72 bg-white dark:bg-gray-800 shadow-xl z-50 transition-transform duration-300 transform border-l border-gray-200 dark:border-gray-600 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ maxWidth: '100vw' }}
      >
        <div className="flex flex-col h-full">

          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
            <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              {selectedCards.length > 0 ? (
                <>
                  <Badge className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700">
                    {selectedCards.length}
                  </Badge>
                  Selected Cards
                </>
              ) : "Selected Cards"}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCloseSidebar}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 p-2 rounded-md border border-gray-300 dark:border-gray-500 flex items-center gap-1"
            >
              <ChevronRight className="h-4 w-4" />
              <span className="text-xs font-medium">Hide</span>
            </Button>
          </div>

          {/* Card list */}
          <div className="flex-1 overflow-auto">
            {selectedCards.length === 0 ? (
              <div className="text-center py-12 px-4 text-gray-500 dark:text-gray-400">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="font-medium mb-2 text-gray-700 dark:text-gray-300">No cards selected</h3>
                <p className="text-sm">Click on cards to add them to your selection</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {selectedCards.map((card, idx) => (
                  <div
                    key={card.id || card._id}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/50"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1 pr-2">
                        <p className="font-medium text-sm leading-tight text-gray-900 dark:text-gray-100 mb-1">
                          {card.display_name || card.name}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {card.set && <Badge variant="outline" className="text-xs">{card.set.toUpperCase()}</Badge>}
                          {card.rarity && <Badge variant="outline" className="text-xs">{card.rarity.toUpperCase()}</Badge>}
                          {card.foiling && <Badge variant="outline" className="text-xs">{card.foiling.toUpperCase()}</Badge>}
                          {card.condition && card.condition !== 'NM' && <Badge variant="outline" className="text-xs">{card.condition}</Badge>}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600"
                        onClick={() => onRemoveSelected(idx)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center justify-center gap-3 bg-white dark:bg-gray-700 rounded-md p-2 border border-gray-200 dark:border-gray-600">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => onQuantityChange(card.id, card.quantity - 1)}
                        disabled={card.quantity <= 1}
                      >
                        -
                      </Button>
                      <div className="flex flex-col items-center min-w-[3rem]">
                        <span className="font-mono text-sm font-medium">{card.quantity}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">of {card.maxQuantity}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => onQuantityChange(card.id, card.quantity + 1)}
                        disabled={card.quantity >= card.maxQuantity}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {selectedCards.length > 0 && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 space-y-3">
              {/* Summary */}
              <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600 space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Selected:</span>
                  <span className="font-bold">{selectedCards.length} cards</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Total quantity:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{totalCards}</span>
                </div>
              </div>

              {editable ? (
                <>
                  {/* Inline binder picker */}
                  {binders.length > 0 ? (
                    <Select value={targetBinderId} onValueChange={setTargetBinderId}>
                      <SelectTrigger className="w-full text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                        <SelectValue placeholder="Select destination binder…" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                        {binders.map(b => (
                          <SelectItem key={b._id} value={b._id} className="text-gray-900 dark:text-gray-100">
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">No other binders available</p>
                  )}

                  <Button
                    className="w-full"
                    onClick={handleTransfer}
                    disabled={transferring || !targetBinderId || binders.length === 0}
                  >
                    {transferring ? (
                      <><div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />Transferring…</>
                    ) : (
                      <><ArrowRight className="h-4 w-4 mr-1" />Transfer to Binder</>
                    )}
                  </Button>

                  <div className="flex gap-2">
                    {onDeleteSelected && (
                      <Button variant="outline" className="flex-1" onClick={onDeleteSelected}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    )}
                    <Button variant="outline" onClick={onClearSelected} className="flex-1">
                      Clear All
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Button className="w-full" onClick={onCopySelected}>
                    {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                    {copied ? 'Copied!' : 'Copy List'}
                  </Button>
                  <Button variant="outline" onClick={onClearSelected} className="w-full">
                    Clear All
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
