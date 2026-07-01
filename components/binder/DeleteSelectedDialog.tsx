import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Trash2, AlertTriangle, Package } from "lucide-react"
import { bindersClient } from "@/lib/client"

type DeleteSelectedDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCards: any[]
  binderId: string
  onDeleteComplete?: (deletedResults: any[]) => void
}

export default function DeleteSelectedDialog({ 
  open, 
  onOpenChange, 
  selectedCards, 
  binderId,
  onDeleteComplete 
}: DeleteSelectedDialogProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const totalCards = selectedCards.reduce((sum, card) => sum + card.quantity, 0)

  const handleDelete = async () => {
    if (!binderId || selectedCards.length === 0) {
      toast({ 
        title: "Error", 
        description: "No cards selected for deletion.", 
        variant: "destructive" 
      })
      return
    }

    setLoading(true)
    
    try {
      const results = []
      
      // Process each selected card individually using your new API
      for (const card of selectedCards) {
        const cardId = card.id || card._id
        const selectedQty = card.quantity || 1
        const maxQty = card.maxQuantity || 1
        
        try {
          if (selectedQty >= maxQty) {
            // Delete the entire inventory item
            console.log(`Deleting entire card: ${cardId}`)
            const result = await bindersClient.deleteBinderCard(binderId, cardId)

            if (result.success) {
              results.push({
                success: true,
                printingId: card.printingId || cardId,
                action: 'deleted',
                card: card
              })
            } else {
              results.push({
                success: false,
                printingId: card.printingId || cardId,
                error: result.error || 'Failed to delete card',
                card: card
              })
            }
          } else {
            // Reduce quantity (update the inventory item)
            console.log(`Reducing quantity for card: ${cardId} by ${selectedQty}`)
            const newQuantity = maxQty - selectedQty

            const result = await bindersClient.updateBinderCard(binderId, cardId, {
              quantity: newQuantity
            })

            if (result.success) {
              results.push({
                success: true,
                printingId: card.printingId || cardId,
                action: 'reduced',
                oldQuantity: maxQty,
                newQuantity: newQuantity,
                card: card
              })
            } else {
              results.push({
                success: false,
                printingId: card.printingId || cardId,
                error: result.error || 'Failed to update card quantity',
                card: card
              })
            }
          }
        } catch (error) {
          console.error(`Error processing card ${cardId}:`, error)
          results.push({
            success: false,
            printingId: card.printingId || cardId,
            error: error instanceof Error ? error.message : 'Unknown error',
            card: card
          })
        }
      }
      
      // Process results
      const successful = results.filter(r => r.success)
      const failed = results.filter(r => !r.success)
      
      console.log('Delete results:', { successful, failed })
      
      // Show results
      if (successful.length > 0) {
        const deletedCount = successful.filter(r => r.action === 'deleted').length
        const reducedCount = successful.filter(r => r.action === 'reduced').length
        
        let message = ''
        if (deletedCount > 0 && reducedCount > 0) {
          message = `Deleted ${deletedCount} cards and reduced quantity of ${reducedCount} cards.`
        } else if (deletedCount > 0) {
          message = `Successfully deleted ${deletedCount} cards from your binder.`
        } else {
          message = `Successfully reduced quantity of ${reducedCount} cards.`
        }
        
        toast({ 
          title: "Cards Updated", 
          description: message,
          variant: "default"
        })
        
        // Notify parent component of results
        onDeleteComplete?.(results)
      }
      
      if (failed.length > 0) {
        console.error('Failed operations:', failed)
        toast({
          title: `${failed.length} Operations Failed`,
          description: failed[0].error, // Show first error
          variant: "destructive"
        })
      }
      
      // Close dialog if any operations were successful
      if (successful.length > 0) {
        onOpenChange(false)
      }
        
    } catch (err: any) {
      console.error('Delete error:', err)
      toast({ 
        title: "Delete Failed", 
        description: err.message || "An unexpected error occurred.", 
        variant: "destructive" 
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
        <DialogHeader className="border-b border-gray-300 dark:border-gray-600 pb-4">
          <DialogTitle className="text-gray-900 dark:text-gray-100 text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Delete Selected Cards
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-6 overflow-y-auto max-h-[60vh]">
          {/* Warning Message */}
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <div className="text-sm font-medium text-red-900 dark:text-red-100">Warning: This action cannot be undone</div>
            </div>
            <div className="text-sm text-red-800 dark:text-red-200">
              You are about to delete {selectedCards.length} different cards ({totalCards} total cards) from your binder.
            </div>
          </div>
          
          {/* Cards List */}
          {selectedCards.length > 0 && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                Cards to Delete ({selectedCards.length})
              </label>
              
              <div className="max-h-64 overflow-y-auto space-y-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 border border-gray-300 dark:border-gray-600">
                {selectedCards.map((card: any, index: number) => {
                  const selectedQty = card.quantity || 1
                  const maxQty = card.maxQuantity || 1
                  const willDelete = selectedQty >= maxQty
                  
                  return (
                    <div key={card.id || index} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {card.display_name || card.name}
                        </div>
                        <div className="flex gap-1 text-xs mt-1">
                          <Badge variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                            {willDelete ? `Delete all ${maxQty}` : `Remove ${selectedQty} of ${maxQty}`}
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
                      <div className="flex items-center">
                        <Trash2 className={`h-4 w-4 ${willDelete ? 'text-red-500 dark:text-red-400' : 'text-orange-500 dark:text-orange-400'}`} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          
          {/* Delete Summary */}
          <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Delete Summary</div>
            </div>
            <div className="text-sm text-gray-800 dark:text-gray-200 space-y-1">
              <div>{selectedCards.length} different cards • {totalCards} total cards</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Cards will be removed from your binder based on selected quantities
              </div>
            </div>
          </div>
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
            onClick={handleDelete} 
            disabled={loading || selectedCards.length === 0}
            variant="destructive"
            className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white min-w-[120px]"
          >
            {loading ? (
              <>
                <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete {totalCards > 1 ? `${totalCards} Cards` : 'Card'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
// import { useState } from "react"
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
// import { Button } from "@/components/ui/button"
// import { Badge } from "@/components/ui/badge"
// import { useToast } from "@/hooks/use-toast"
// import { Trash2, AlertTriangle, Package } from "lucide-react"

// type DeleteSelectedDialogProps = {
//   open: boolean
//   onOpenChange: (open: boolean) => void
//   selectedCards: any[]
//   binderId: string
//   onDeleteComplete?: (deletedCardIds: string[]) => void
// }

// export default function DeleteSelectedDialog({ 
//   open, 
//   onOpenChange, 
//   selectedCards, 
//   binderId,
//   onDeleteComplete 
// }: DeleteSelectedDialogProps) {
//   const [loading, setLoading] = useState(false)
//   const { toast } = useToast()

//   const totalCards = selectedCards.reduce((sum, card) => sum + card.quantity, 0)

//   const handleDelete = async () => {
//     if (!binderId || selectedCards.length === 0) {
//       toast({ 
//         title: "Error", 
//         description: "No cards selected for deletion.", 
//         variant: "destructive" 
//       })
//       return
//     }

//     setLoading(true)
    
//     try {
//       // Prepare batch delete payload for your remove API
//       const printings = selectedCards.map(card => ({
//         printingId: card.printingId || card.printingDetails?.printing_id || card.id,
//         quantity: card.quantity,
//         removeAll: true // Remove all copies of this card
//       })).filter(p => p.printingId) // Filter out cards without valid printing ID
      
//       if (printings.length === 0) {
//         throw new Error('No valid cards found for deletion')
//       }
      
//       console.log('Batch delete payload:', {
//         printings,
//         slug: binderId // Using binderId as slug since this is the binder page
//       })
      
//       // Use your existing bulk remove API
//       const response = await fetch('/api/binder/remove', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({
//           printings,
//           slug: binderId // Pass the binderId as slug
//         })
//       })
      
//       if (!response.ok) {
//         const errorData = await response.json()
//         throw new Error(errorData.error || 'Batch delete failed')
//       }
      
//       const result = await response.json()
      
//       // Process results from your remove API
//       const successful = result.results?.filter(r => r.success) || []
//       const failed = result.results?.filter(r => !r.success) || []
      
//       // Show results
//       if (successful.length > 0) {
//         toast({ 
//           title: "Cards Deleted", 
//           description: `Successfully deleted ${successful.length} cards from your binder.`,
//           variant: "default"
//         })
        
//         // Notify parent component of results
//         onDeleteComplete?.(result.results || [])
//       }
      
//       if (failed.length > 0) {
//         console.error('Failed deletes:', failed)
//         toast({
//           title: `${failed.length} Cards Failed to Delete`,
//           description: failed[0].error, // Show first error
//           variant: "destructive"
//         })
//       }
      
//       // Close dialog if any deletions were successful
//       if (successful.length > 0) {
//         onOpenChange(false)
//       }
        
//     } catch (err: any) {
//       console.error('Delete error:', err)
//       toast({ 
//         title: "Delete Failed", 
//         description: err.message || "An unexpected error occurred.", 
//         variant: "destructive" 
//       })
//     } finally {
//       setLoading(false)
//     }
//   }

//   return (
//     <Dialog open={open} onOpenChange={onOpenChange}>
//       <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
//         <DialogHeader className="border-b border-gray-300 dark:border-gray-600 pb-4">
//           <DialogTitle className="text-gray-900 dark:text-gray-100 text-lg font-semibold flex items-center gap-2">
//             <AlertTriangle className="h-5 w-5 text-red-500" />
//             Delete Selected Cards
//           </DialogTitle>
//         </DialogHeader>
        
//         <div className="space-y-6 py-6 overflow-y-auto max-h-[60vh]">
//           {/* Warning Message */}
//           <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4">
//             <div className="flex items-center gap-2 mb-2">
//               <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
//               <div className="text-sm font-medium text-red-900 dark:text-red-100">Warning: This action cannot be undone</div>
//             </div>
//             <div className="text-sm text-red-800 dark:text-red-200">
//               You are about to permanently delete {selectedCards.length} different cards ({totalCards} total cards) from your binder.
//             </div>
//           </div>
          
//           {/* Cards List */}
//           {selectedCards.length > 0 && (
//             <div className="space-y-3">
//               <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
//                 Cards to Delete ({selectedCards.length})
//               </label>
              
//               <div className="max-h-64 overflow-y-auto space-y-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 border border-gray-300 dark:border-gray-600">
//                 {selectedCards.map((card: any, index: number) => (
//                   <div key={card.id || index} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600">
//                     <div className="flex-1">
//                       <div className="font-medium text-gray-900 dark:text-gray-100">{card.name}</div>
//                       <div className="flex gap-1 text-xs mt-1">
//                         <Badge variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
//                           Qty: {card.quantity}
//                         </Badge>
//                         {card.printingDetails?.set_id && (
//                           <Badge variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
//                             {card.printingDetails.set_id}
//                           </Badge>
//                         )}
//                         {card.printingDetails?.rarity && (
//                           <Badge variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
//                             {card.printingDetails.rarity}
//                           </Badge>
//                         )}
//                         {card.printingDetails?.foiling && (
//                           <Badge variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
//                             {card.printingDetails.foiling}
//                           </Badge>
//                         )}
//                         {card.condition && card.condition !== 'NM' && (
//                           <Badge variant="outline" className="border-yellow-300 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30">
//                             {card.condition}
//                           </Badge>
//                         )}
//                       </div>
//                     </div>
//                     <div className="flex items-center">
//                       <Trash2 className="h-4 w-4 text-red-500 dark:text-red-400" />
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           )}
          
//           {/* Delete Summary */}
//           <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg p-4">
//             <div className="flex items-center gap-2 mb-2">
//               <Package className="h-4 w-4 text-gray-600 dark:text-gray-400" />
//               <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Delete Summary</div>
//             </div>
//             <div className="text-sm text-gray-800 dark:text-gray-200 space-y-1">
//               <div>{selectedCards.length} different cards • {totalCards} total cards</div>
//               <div className="text-xs text-gray-600 dark:text-gray-400">
//                 These cards will be permanently removed from your binder
//               </div>
//             </div>
//           </div>
//         </div>
        
//         <DialogFooter className="border-t border-gray-300 dark:border-gray-600 pt-4 gap-3">
//           <Button 
//             variant="outline"
//             onClick={() => onOpenChange(false)}
//             disabled={loading}
//             className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
//           >
//             Cancel
//           </Button>
//           <Button 
//             onClick={handleDelete} 
//             disabled={loading || selectedCards.length === 0}
//             variant="destructive"
//             className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white min-w-[120px]"
//           >
//             {loading ? (
//               <>
//                 <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
//                 Deleting...
//               </>
//             ) : (
//               <>
//                 <Trash2 className="h-4 w-4 mr-2" />
//                 Delete {totalCards > 1 ? `${totalCards} Cards` : 'Card'}
//               </>
//             )}
//           </Button>
//         </DialogFooter>
//       </DialogContent>
//     </Dialog>
//   )
// }