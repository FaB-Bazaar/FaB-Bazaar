// components/binder/TransferCardsDialog.tsx
import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { ArrowRight, Package, AlertCircle } from "lucide-react"
import { bindersClient } from "@/lib/client"

type TransferCardsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCards: any[]
  sourceBinderId: string // Updated to use binderId instead of slug
  onTransferComplete?: (transferredCards: { id: string; quantity: number }[]) => void
}

export default function TransferCardsDialog({ 
  open, 
  onOpenChange, 
  selectedCards, 
  sourceBinderId, 
  onTransferComplete 
}: TransferCardsDialogProps) {
  const [binders, setBinders] = useState<any[]>([])
  const [targetBinderId, setTargetBinderId] = useState("")
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Fetch all user binders except the source
  useEffect(() => {
    if (!open) return

    const fetchBinders = async () => {
      const result = await bindersClient.getUserBinders()
      if (result.success) {
        const filtered = (result.data.binders || []).filter(
          (b: any) => b._id !== sourceBinderId && !b.archived
        )
        setBinders(filtered)
        if (filtered.length > 0) {
          setTargetBinderId(filtered[0]._id)
        }
      } else {
        setBinders([])
      }
    }

    fetchBinders()
  }, [open, sourceBinderId])

  // Initialize quantities for each card - preserve selected quantities
  useEffect(() => {
    if (!open) return
    const q: Record<string, number> = {}
    for (const card of selectedCards) {
      q[String(card.id)] = card.quantity || 1
    }
    setQuantities(q)
  }, [open, selectedCards])

  const handleQuantityChange = (cardId: string, newQuantity: number, max: number) => {
    let v = Math.max(1, Math.min(newQuantity, max))
    setQuantities(q => ({ ...q, [cardId]: v }))
  }

  const handleTransfer = async () => {
    if (!targetBinderId) {
      toast({
        title: "No Target Binder",
        description: "Please select a destination binder.",
        variant: "destructive"
      })
      return
    }

    setLoading(true)

    try {
      // Prepare cards array for bulk transfer
      const cardsToTransfer = selectedCards.map(card => ({
        cardId: String(card.id || card._id),
        quantity: quantities[String(card.id)] || 1
      }))

      console.log('Initiating bulk transfer:', {
        sourceBinderId,
        targetBinderId,
        cardsCount: cardsToTransfer.length
      })

      // Single API call for all cards using client service
      const result = await bindersClient.transferSelectedCards(
        sourceBinderId,
        targetBinderId,
        cardsToTransfer
      )

      if (!result.success) {
        throw new Error(result.error || 'Transfer failed')
      }

      console.log('Transfer completed:', result.data)

      // Show success message
      const data = result.data
      if (data.summary.successful > 0) {
        const { summary } = data

        let message = `Successfully transferred ${summary.totalQuantityTransferred} cards`
        if (summary.fullyTransferred > 0 && summary.partiallyTransferred > 0) {
          message += ` (${summary.fullyTransferred} fully, ${summary.partiallyTransferred} partially)`
        } else if (summary.partiallyTransferred > 0) {
          message += ` (partial quantities from ${summary.partiallyTransferred} cards)`
        }

        if (summary.mergedInTarget > 0) {
          message += `. ${summary.mergedInTarget} merged with existing cards`
        }

        toast({
          title: "Transfer Complete",
          description: message,
          variant: "default"
        })

        // Map successful transfers back to the expected format
        const successfulResults = data.results.filter((r: any) => r.success)
        const successfulTransfers = successfulResults.map((r: any) => ({
          id: r.cardId,
          quantity: r.quantity
        }))

        onTransferComplete?.(successfulTransfers)
      }

      // Show errors if any
      if (data.summary.failed > 0) {
        const failedResults = data.results.filter((r: any) => !r.success)
        console.error('Failed transfers:', failedResults)
        toast({
          title: `${data.summary.failed} Transfers Failed`,
          description: failedResults[0]?.error || 'Unknown error',
          variant: "destructive"
        })
      }

      // Close dialog if any transfers were successful
      if (data.summary.successful > 0) {
        onOpenChange(false)
      }

    } catch (err: any) {
      console.error('Transfer error:', err)
      toast({
        title: "Transfer Failed",
        description: err.message || "An unexpected error occurred.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const totalCards = Object.values(quantities).reduce((sum, qty) => sum + qty, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
        <DialogHeader className="border-b border-gray-300 dark:border-gray-600 pb-4">
          <DialogTitle className="text-gray-900 dark:text-gray-100 text-lg font-semibold flex items-center gap-2">
            <Package className="h-5 w-5" />
            Transfer Cards to Another Binder
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-6 overflow-y-auto max-h-[60vh]">
          {/* Destination Binder Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
              Destination Binder
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
              <p className="text-gray-500 dark:text-gray-400">
                No other binders available for transfer
              </p>
            </div>
          )}
          
          {/* Cards List */}
          {selectedCards.length > 0 && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                Cards to Transfer ({selectedCards.length})
              </label>
              
              <div className="max-h-64 overflow-y-auto space-y-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 border border-gray-300 dark:border-gray-600">
                {selectedCards.map((card: any) => {
                  const transferQty = quantities[String(card.id)] || 1
                  const maxQty = card.maxQuantity || 1
                  const willTransferAll = transferQty >= maxQty
                  
                  return (
                    <div key={card.id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {card.display_name || card.name}
                        </div>
                        <div className="flex gap-1 text-xs mt-1">
                          <Badge variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                            {willTransferAll ? `Transfer all ${maxQty}` : `Transfer ${transferQty} of ${maxQty}`}
                          </Badge>
                          {card.set && (
                            <Badge variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                              {card.set}
                            </Badge>
                          )}
                          {card.rarity && (
                            <Badge variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                              {card.rarity}
                            </Badge>
                          )}
                          {card.foiling && (
                            <Badge variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                              {card.foiling}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(String(card.id), transferQty - 1, maxQty)}
                          disabled={transferQty <= 1}
                          className="h-8 w-8 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium"
                        >
                          -
                        </button>
                        <div className="flex flex-col items-center min-w-[3rem]">
                          <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                            {transferQty}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            of {maxQty}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(String(card.id), transferQty + 1, maxQty)}
                          disabled={transferQty >= maxQty}
                          className="h-8 w-8 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium"
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
          
          {/* Transfer Summary */}
          {selectedCards.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <div className="text-sm font-medium text-blue-900 dark:text-blue-100">Transfer Summary</div>
              </div>
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <div>{selectedCards.length} different cards • {totalCards} total cards</div>
                <div className="text-xs text-blue-600 dark:text-blue-300">
                  Cards will be moved from source binder to destination binder
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
                Transfer {totalCards > 1 ? `${totalCards} Cards` : 'Card'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}