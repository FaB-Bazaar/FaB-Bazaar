"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check } from "lucide-react"
import { getSetName, getFoilingName, getEditionName } from "@/lib/fab-formatters"
import { RarityIcon } from "@/components/shared/RarityIcon"

// Helper functions for compact display
function getFoilingShortName(foiling: string): string {
  const map: Record<string, string> = {
    'r': 'RF', 'c': 'CF', 'g': 'GF', 's': 'NF'
  }
  return map[foiling?.toLowerCase()] || 'NF'
}

function getFoilingBadgeColor(foiling: string): string {
  const map: Record<string, string> = {
    'r': 'bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 text-white',
    'c': 'bg-blue-600 text-white',
    'g': 'bg-yellow-500 text-black',
    's': 'bg-gray-500 text-white'
  }
  return map[foiling?.toLowerCase()] || 'bg-gray-500 text-white'
}

function getEditionShortName(edition: string): string {
  const map: Record<string, string> = {
    'a': 'A', 'f': '1st', 'u': 'U', 'n': 'N'
  }
  return map[edition?.toLowerCase()] || edition?.toUpperCase() || 'N'
}

interface DeckCopy {
  _id: string
  printingId: string
  printingDetails: any
}

interface PrintingComparisonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deckCopies: DeckCopy[] // All copies of this card in the deck
  cardName: string
  cardUniqueId: string // To fetch alternatives
  onSwapPrinting: (deckCopyId: string, newPrintingId: string) => void
}

export default function PrintingComparisonDialog({
  open,
  onOpenChange,
  deckCopies,
  cardName,
  cardUniqueId,
  onSwapPrinting
}: PrintingComparisonDialogProps) {
  const [alternatives, setAlternatives] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !cardUniqueId) {
      console.log('[PrintingComparisonDialog] Not fetching - open:', open, 'cardUniqueId:', cardUniqueId)
      return
    }

    const fetchAlternatives = async () => {
      setLoading(true)
      try {
        console.log('[PrintingComparisonDialog] Fetching alternatives for cardUniqueId:', cardUniqueId)

        // Fetch ALL printings for this card using the core search API
        const response = await fetch(`/api/search/core?cardUniqueId=${encodeURIComponent(cardUniqueId)}&limit=100`)
        console.log('[PrintingComparisonDialog] Response status:', response.status)

        if (!response.ok) {
          const errorText = await response.text()
          console.error('[PrintingComparisonDialog] Response not OK:', response.status, errorText)
          setAlternatives([])
          return
        }

        const data = await response.json()
        console.log('[PrintingComparisonDialog] Response data:', data)

        if (!data.success || !data.data?.printings) {
          console.log('[PrintingComparisonDialog] No printings found in response data:', data)
          setAlternatives([])
          return
        }

        console.log('[PrintingComparisonDialog] Found', data.data.printings.length, 'printings')

        // Sort printings by set, edition, foiling for better UX
        const sortedPrintings = data.data.printings.sort((a: any, b: any) => {
          if (a.set !== b.set) return a.set.localeCompare(b.set)
          if (a.edition !== b.edition) return a.edition.localeCompare(b.edition)
          return a.foiling.localeCompare(b.foiling)
        })

        // Convert to the format we need (with ownership as optional)
        const formattedPrintings = sortedPrintings.map((p: any) => ({
          printingId: p.printing_id,
          name: p.name,
          display_name: p.display_name,
          image_url: p.image_url,
          set: p.set,
          edition: p.edition,
          rarity: p.rarity,
          foiling: p.foiling,
          is_extended_art: p.is_extended_art,
          tcg_low: p.tcg_low,
          quantity: 0,
          isOwned: false
        }))

        console.log('[PrintingComparisonDialog] Setting alternatives:', formattedPrintings.length)
        setAlternatives(formattedPrintings)

      } catch (error) {
        console.error('[PrintingComparisonDialog] Error fetching alternatives:', error)
        setAlternatives([])
      } finally {
        setLoading(false)
      }
    }

    fetchAlternatives()
  }, [open, cardUniqueId])

  const handleSwapCopy = (deckCopyId: string, newPrintingId: string) => {
    onSwapPrinting(deckCopyId, newPrintingId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {cardName}
            <Badge variant="secondary">{deckCopies.length} {deckCopies.length === 1 ? 'copy' : 'copies'} in deck</Badge>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading alternatives...</div>
        ) : (
          <div className="space-y-3">
            {/* Each deck copy as a row */}
            {deckCopies.map((copy, index) => {
              const printing = copy.printingDetails

              return (
                <div key={copy._id} className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center gap-4">
                    {/* Copy number */}
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
                        {index + 1}
                      </div>
                    </div>

                    {/* Card image */}
                    <div className="w-20 aspect-[63/88] bg-gray-100 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0">
                      <img
                        src={printing?.image_url || "/cardback.webp"}
                        alt={printing?.display_name || printing?.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Printing details */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {printing?.display_name || printing?.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs mt-1">
                        <span className="font-mono">{getEditionName(printing?.edition)}</span>
                        <RarityIcon rarityCode={printing?.rarity} size="sm" />
                        <span className="truncate">{getFoilingName(printing?.foiling, printing?.is_extended_art)}</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {getSetName(printing?.set)}
                      </p>
                      {printing?.tcg_low > 0 && (
                        <span className="text-xs font-semibold text-green-600">
                          ${printing.tcg_low.toFixed(2)}
                        </span>
                      )}
                    </div>

                  </div>

                  {/* Alternative printings grid */}
                  <div className="mt-4 border-t pt-4">
                    <h4 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">
                      Available Printings ({alternatives.length})
                    </h4>
                    {alternatives.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500">
                        No alternative printings found
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {alternatives.map((alt) => {
                          const isCurrentPrinting = alt.printingId === copy.printingId;
                          const isOwned = alt.isOwned;

                          return (
                            <button
                              key={alt.printingId}
                              onClick={() => handleSwapCopy(copy._id, alt.printingId)}
                              disabled={isCurrentPrinting}
                              className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                                isCurrentPrinting
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 cursor-default'
                                  : 'border-gray-300 dark:border-gray-700 hover:border-blue-400 hover:shadow-lg cursor-pointer'
                              }`}
                            >
                              <div className="aspect-[63/88] bg-gray-100 dark:bg-gray-700 relative">
                                <img
                                  src={alt.image_url || "/cardback.webp"}
                                  alt={alt.display_name || alt.name}
                                  className="w-full h-full object-cover"
                                />

                                {/* Current indicator */}
                                {isCurrentPrinting && (
                                  <div className="absolute top-1 right-1 bg-blue-600 text-white rounded-full p-1">
                                    <Check className="h-3 w-3" />
                                  </div>
                                )}

                                {/* Ownership indicator */}
                                {isOwned && !isCurrentPrinting && (
                                  <div className="absolute top-1 right-1 bg-green-600 text-white rounded px-1.5 py-0.5 text-xs font-bold">
                                    ✓{alt.quantity > 1 ? ` ${alt.quantity}` : ''}
                                  </div>
                                )}

                                {/* Foiling badge */}
                                <div className="absolute bottom-1 left-1">
                                  <Badge className={`text-xs px-1.5 py-0 ${getFoilingBadgeColor(alt.foiling)}`}>
                                    {getFoilingShortName(alt.foiling)}
                                  </Badge>
                                </div>

                                {/* Edition badge */}
                                <div className="absolute bottom-1 right-1">
                                  <Badge variant="secondary" className="text-xs px-1 py-0">
                                    {getEditionShortName(alt.edition)}
                                  </Badge>
                                </div>

                                {/* Price */}
                                {alt.tcg_low > 0 && (
                                  <div className="absolute top-1 left-1 bg-black/70 text-white rounded px-1.5 py-0.5 text-xs font-semibold">
                                    ${alt.tcg_low.toFixed(2)}
                                  </div>
                                )}
                              </div>

                              {/* Set name */}
                              <div className="p-1 bg-gray-50 dark:bg-gray-800 text-center">
                                <p className="text-xs font-mono truncate">{getSetName(alt.set)}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-end items-center pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
