// components/collection/BulkTransferDialog.tsx
"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowRight, AlertCircle, Package } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { bindersClient } from '@/lib/client'

interface BulkTransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceBinder: any
  binders: any[]
  onTransferComplete: () => void
}

export default function BulkTransferDialog({
  open,
  onOpenChange,
  sourceBinder,
  binders,
  onTransferComplete
}: BulkTransferDialogProps) {
  const [targetBinderId, setTargetBinderId] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Filter out the source binder from available targets
  const availableBinders = binders.filter(b => b._id !== sourceBinder?._id)

  const handleTransfer = async () => {
    if (!targetBinderId) {
      toast({
        title: "No Target Selected",
        description: "Please select a destination binder",
        variant: "destructive"
      })
      return
    }

    setLoading(true)

    const result = await bindersClient.transferAllCards(sourceBinder._id, targetBinderId)

    setLoading(false)

    if (result.success) {
      // Show success with details
      const targetBinder = binders.find(b => b._id === targetBinderId)
      let message = `Successfully transferred all cards to ${targetBinder?.name}`

      if (result.data.summary?.mergedCards > 0) {
        message += ` (${result.data.summary.mergedCards} cards merged with existing copies)`
      }

      toast({
        title: "Transfer Complete",
        description: message,
        variant: "default"
      })

      onTransferComplete()
      onOpenChange(false)
      setTargetBinderId("")
    } else {
      console.error('Bulk transfer error:', result.error)
      toast({
        title: "Transfer Failed",
        description: result.error || "An error occurred during transfer",
        variant: "destructive"
      })
    }
  }

  const targetBinder = binders.find(b => b._id === targetBinderId)
  const sourceCardCount = sourceBinder?.totalQuantity || sourceBinder?.stats?.totalQuantity || 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Transfer All Cards
          </DialogTitle>
          <DialogDescription>
            Move all cards from one binder to another. Duplicate cards will be merged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Source Binder Info */}
          <div className="space-y-2">
            <label className="text-sm font-medium">From Binder</label>
            <div className="p-3 bg-muted rounded-lg border">
              <div className="font-medium">{sourceBinder?.name}</div>
              <div className="text-sm text-muted-foreground">
                {sourceCardCount} {sourceCardCount === 1 ? 'card' : 'cards'}
              </div>
            </div>
          </div>

          {/* Arrow Icon */}
          <div className="flex justify-center">
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
          </div>

          {/* Target Binder Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">To Binder</label>
            {availableBinders.length === 0 ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You need at least one other binder to transfer to. Please create another binder first.
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={targetBinderId} onValueChange={setTargetBinderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination binder" />
                </SelectTrigger>
                <SelectContent>
                  {availableBinders.map(binder => (
                    <SelectItem key={binder._id} value={binder._id}>
                      {binder.name} ({binder.totalQuantity || binder.stats?.totalQuantity || 0} cards)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Warning Alert */}
          {targetBinderId && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>All {sourceCardCount} cards</strong> will be moved from <strong>{sourceBinder?.name}</strong> to <strong>{targetBinder?.name}</strong>.
                <br />
                <span className="text-xs text-muted-foreground mt-1 block">
                  • Duplicate cards will have quantities merged<br />
                  • Notes from both copies will be combined<br />
                  • Source binder will become empty
                </span>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={loading || !targetBinderId || availableBinders.length === 0}
          >
            {loading ? (
              <>
                <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                Transferring...
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4 mr-2" />
                Transfer All Cards
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
