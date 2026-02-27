"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Loader2 } from "lucide-react"

interface PrintingSelectorProps {
  cardId: string
  cardName: string
  selectedPrintingId: string | null
  onPrintingSelect: (printingId: string, printingDetails: any) => void
}

export function PrintingSelector({ cardId, cardName, selectedPrintingId, onPrintingSelect }: PrintingSelectorProps) {
  const [printings, setPrintings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [parentCardId, setParentCardId] = useState<string | null>(null)

  useEffect(() => {
    const fetchPrintings = async () => {
      try {
        setLoading(true)

        // Build search filters - prefer cardId, fallback to printingId or name
        const filters: any = {}

        if (cardId) {
          // If we have the parent card ID, use it directly
          filters.cardUniqueId = cardId
          setParentCardId(cardId)
        } else if (selectedPrintingId) {
          // If we only have a printing ID, search by that to find parent
          filters.printingId = selectedPrintingId
        } else if (cardName) {
          // Last resort: search by name
          filters.name = cardName
          filters.exact = true
        } else {
          // No identifiers provided
          setLoading(false)
          return
        }

        // Use /api/search/core to get all printings
        const response = await fetch('/api/search/core', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filters,
            limit: 100, // Get all printings for this card
            sortBy: 'set',
            sortOrder: 'desc'
          })
        })

        if (response.ok) {
          const data = await response.json()

          if (data.success && data.data?.printings && data.data.printings.length > 0) {
            const printingsData = data.data.printings

            // Convert search/core format to the format expected by the UI
            const formattedPrintings = printingsData.map((p: any) => ({
              unique_id: p.printing_id,
              set_id: p.set,
              rarity: p.rarity,
              foiling: p.foiling,
              edition: p.edition,
              art_variations: p.is_extended_art ? ['EA'] : [],
              tcgMarket: p.tcg_market,
              image_url: p.image_url
            }))

            setPrintings(formattedPrintings)

            // Set parent card ID from the first result
            if (!parentCardId && printingsData[0]?.card_unique_id) {
              setParentCardId(printingsData[0].card_unique_id)
            }
          }
        }
      } catch (error) {
        console.error("Error fetching printings:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchPrintings()
  }, [cardId, cardName, selectedPrintingId])

  // Helper functions for formatting printing details
  const getRarityName = (rarity: string) => {
    const rarityMap: Record<string, string> = {
      C: "Common",
      R: "Rare",
      S: "Super Rare",
      M: "Majestic",
      L: "Legendary",
      F: "Fabled",
      P: "Promo",
      T: "Token",
    }
    return rarityMap[rarity] || rarity
  }

  const getFoilingName = (foiling: string) => {
    const foilingMap: Record<string, string> = {
      S: "Non-Foil",
      R: "Rainbow Foil",
      C: "Cold Foil",
      G: "Gold Foil",
      N: "Non-Foil",
    }
    return foilingMap[foiling] || foiling
  }

  const getEditionName = (edition: string) => {
    const editionMap: Record<string, string> = {
      N: "Normal",
      F: "First Edition",
      U: "Unlimited",
      A: "Alpha",
    }
    return editionMap[edition] || edition
  }

  const getRarityColor = (rarity: string) => {
    const colorMap: Record<string, string> = {
      C: "bg-gray-200 text-gray-800",
      R: "bg-blue-200 text-blue-800",
      S: "bg-purple-200 text-purple-800",
      M: "bg-yellow-200 text-yellow-800",
      L: "bg-orange-200 text-orange-800",
      F: "bg-red-200 text-red-800",
      P: "bg-green-200 text-green-800",
      T: "bg-gray-200 text-gray-800",
    }
    return colorMap[rarity] || "bg-gray-200 text-gray-800"
  }

  const getFoilingStyle = (foiling: string) => {
    const styleMap: Record<string, string> = {
      S: "",
      R: "bg-gradient-to-r from-red-200 via-green-200 to-blue-200 text-gray-800",
      C: "bg-gradient-to-r from-blue-200 to-cyan-200 text-gray-800",
      G: "bg-gradient-to-r from-yellow-200 to-amber-200 text-gray-800",
    }
    return styleMap[foiling] || ""
  }

  const handlePrintingSelect = (printingId: string) => {
    const selectedPrinting = printings.find((p) => p.unique_id === printingId)
    if (selectedPrinting) {
      onPrintingSelect(printingId, {
        printingId: selectedPrinting.unique_id,
        set: selectedPrinting.set_id,
        rarity: selectedPrinting.rarity,
        foiling: selectedPrinting.foiling,
        edition: selectedPrinting.edition,
        artVariation:
          selectedPrinting.art_variations && selectedPrinting.art_variations.length > 0
            ? selectedPrinting.art_variations[0]
            : undefined,
        // Add this line to include the image URL
        image_url: selectedPrinting.image_url,
        // Add the parent card ID
        cardId: parentCardId,
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
        <span className="ml-2 text-sm text-gray-500">Loading printings...</span>
      </div>
    )
  }

  if (printings.length === 0) {
    return <div className="rounded-md bg-gray-100 p-3 text-sm text-gray-500">No printings found for this card</div>
  }

  return (
    <div className="space-y-2">
      <Label>Select Printing</Label>
      <div className="max-h-[200px] overflow-y-auto border rounded-md p-2">
        <RadioGroup value={selectedPrintingId || ""} onValueChange={handlePrintingSelect}>
          {printings.map((printing) => (
            <div
              key={printing.unique_id}
              className={`mb-2 rounded-md border p-3 transition-colors ${
                selectedPrintingId === printing.unique_id ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <div className="flex items-start space-x-2">
                <RadioGroupItem value={printing.unique_id} id={printing.unique_id} className="mt-1" />
                <div className="grid gap-1 w-full">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{printing.set_id}</Badge>
                    <Badge className={getRarityColor(printing.rarity)}>{getRarityName(printing.rarity)}</Badge>
                    <Badge className={getFoilingStyle(printing.foiling) || "bg-gray-200"}>
                      {getFoilingName(printing.foiling)}
                    </Badge>
                    {printing.edition && <Badge variant="secondary">{getEditionName(printing.edition)}</Badge>}
                    {printing.art_variations && printing.art_variations.length > 0 && (
                      <Badge variant="secondary">
                        {printing.art_variations.includes("EA") ? "Extended Art" : printing.art_variations[0]}
                      </Badge>
                    )}
                    {printing.tcgMarket && printing.tcgMarket !== "Not available" && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300">
                        ${Number(printing.tcgMarket).toFixed(2)}
                      </Badge>
                    )}
                  </div>
                  {printing.unique_id && (
                    <div className="mt-2 flex justify-center bg-white rounded-lg p-1">
                      <img
                        src={`https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${printing.unique_id}/public`}
                        alt={`${cardName} (${printing.set_id})`}
                        className="h-24 rounded-lg object-contain"
                        style={{ backgroundColor: "white" }}
                        onError={(e) => {
                          // First fallback: Try the image_url if available
                          if (printing.image_url) {
                            e.currentTarget.src = printing.image_url.startsWith("/")
                              ? `https://storage.googleapis.com/fabmaster/cardfaces${printing.image_url}`
                              : printing.image_url
                          } else {
                            // Final fallback: Use cardback
                            e.currentTarget.src = "/cardback.webp"
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>
    </div>
  )
}
