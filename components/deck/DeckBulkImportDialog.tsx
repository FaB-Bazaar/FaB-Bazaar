"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Upload, AlertCircle, Check, Edit, FileText } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { parseBulkInput } from '@/lib/browse/parsers/bulk-input-parser'
import { selectDefaultPrinting } from '@/lib/browse/utils'
import { getMaxQuantityForCard } from '@/lib/bulk-import-limits'
import { searchClient } from "@/lib/client"
import DeckImportCard from './DeckImportCard'

interface DeckBulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (importResults: DeckImportResult[]) => void
  deckFormat?: string
  currentDeck?: any
}

interface ParsedCard {
  name: string
  quantity: number
  color?: string
  isPartialMatch: boolean
  category?: 'hero' | 'equipment' | 'maindeck' | 'inventory'
}

interface DeckImportResult {
  printingId: string
  quantity: number
  category: 'hero' | 'equipment' | 'maindeck' | 'inventory'
  cardName: string
  printingDetails?: any
  availablePrintings?: any[]
}

export default function DeckBulkImportDialog({
  open,
  onOpenChange,
  onImport,
  deckFormat,
  currentDeck
}: DeckBulkImportDialogProps) {
  const [activeTab, setActiveTab] = useState<"paste" | "review">("paste")
  const [bulkInput, setBulkInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsedCards, setParsedCards] = useState<ParsedCard[]>([])
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [reviewItems, setReviewItems] = useState<DeckImportResult[]>([])

  // Auto-categorize cards based on type
  const categorizeCard = (printing: any): 'hero' | 'equipment' | 'maindeck' | 'inventory' => {
    const types = (printing.types || []).map((t: string) => t.toLowerCase())

    if (types.includes('hero')) return 'hero'

    // Check if equipment/weapon - Evo equipment goes to maindeck
    if (types.includes('equipment') || types.includes('weapon')) {
      // Check if this is Evo equipment (can be played as actions in the deck)
      const isEvo = types.includes('evo')

      if (isEvo) {
        return 'maindeck'  // Evo equipment goes to library/maindeck
      } else {
        return 'equipment' // Normal equipment goes to equipment slots
      }
    }

    // Default to maindeck for action/attack/defense cards
    return 'maindeck'
  }

  const handleBulkParse = async () => {
    if (!bulkInput.trim()) {
      setError("Please enter a deck list")
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Parse the input using existing browse logic
      const parsed = parseBulkInput(bulkInput, 'cardlist')
      if (parsed.length === 0) {
        throw new Error("No valid cards found in the input")
      }

      setParsedCards(parsed)

      // Search for each card
      const searchPromises = parsed.map(async (card) => {
        const filters: any = { name: card.name }

        if (!card.isPartialMatch) {
          filters.exact = true
        }

        if (card.color) {
          filters.color = card.color
        }

        const options = { limit: 20 }

        const result = await searchClient.searchPrintingsPost(filters, options)

        if (result.success && result.data?.printings) {
          return result.data.printings.map((p: any) => ({
            ...p,
            originalCard: card,
            importQuantity: card.quantity
          }))
        }
        return []
      })

      const allResults = await Promise.all(searchPromises)
      const flatResults = allResults.flat()
      setSearchResults(flatResults)

      console.log('[DeckBulkImport] Search completed:', {
        parsedCards: parsed.length,
        totalResults: flatResults.length,
        sampleResult: flatResults[0],
        allResults: allResults.map((arr, i) => ({ cardIndex: i, resultCount: arr.length }))
      })

      // Create initial review items with auto-categorization
      // Group by card_unique_id (like browse page) to separate multi-color variants
      const initialReviewItems: DeckImportResult[] = []

      parsed.forEach((card, cardIndex) => {
        console.log(`[DeckBulkImport] Processing ${card.name}:`, {
          cardObject: card,
          hasColor: !!card.color
        })

        const cardResults = flatResults.filter(r => r.originalCard === card)
        console.log(`[DeckBulkImport] Found ${cardResults.length} results for ${card.name}`)

        if (cardResults.length > 0) {
          // Filter by requested color/pitch if specified
          let filteredResults = cardResults
          if (card.color) {
            // Try to match by color field or pitch value
            filteredResults = cardResults.filter((p: any) => {
              const printingColor = p.color?.toLowerCase()
              const printingPitch = p.pitch?.$numberInt || p.pitch

              // Map pitch numbers to colors: 1=red, 2=yellow, 3=blue
              let pitchColor = ''
              if (printingPitch === 1 || printingPitch === '1') pitchColor = 'red'
              else if (printingPitch === 2 || printingPitch === '2') pitchColor = 'yellow'
              else if (printingPitch === 3 || printingPitch === '3') pitchColor = 'blue'

              return printingColor === card.color.toLowerCase() || pitchColor === card.color.toLowerCase()
            })

            console.log(`[DeckBulkImport] Filtered ${card.name} by color '${card.color}':`, {
              totalResults: cardResults.length,
              filteredResults: filteredResults.length,
              requestedColor: card.color
            })

            // If color filtering eliminated all results, fall back to all results
            if (filteredResults.length === 0) {
              console.warn(`[DeckBulkImport] No results matching color '${card.color}' for ${card.name}, using all results`)
              filteredResults = cardResults
            }
          }

          // ✅ GROUP BY card_unique_id (same as browse page)
          // This separates multi-color cards into individual entries
          const groupedByCardUniqueId = new Map<string, any[]>()
          filteredResults.forEach(printing => {
            const cardUniqueId = printing.card_unique_id
            if (!groupedByCardUniqueId.has(cardUniqueId)) {
              groupedByCardUniqueId.set(cardUniqueId, [])
            }
            groupedByCardUniqueId.get(cardUniqueId)!.push(printing)
          })

          console.log(`[DeckBulkImport] Grouped ${card.name} into ${groupedByCardUniqueId.size} card variants`)

          // Create one review item per card_unique_id
          groupedByCardUniqueId.forEach((printings, cardUniqueId) => {
            const cardWithPrintings = { printings }
            const selectedPrinting = selectDefaultPrinting(cardWithPrintings)

            if (selectedPrinting) {
              const category = categorizeCard(selectedPrinting)

              console.log(`[DeckBulkImport] Adding variant:`, {
                cardUniqueId,
                name: selectedPrinting.display_name || selectedPrinting.name,
                quantity: card.quantity,
                category,
                printingsAvailable: printings.length
              })

              initialReviewItems.push({
                printingId: selectedPrinting.printing_id,
                quantity: card.quantity,
                category,
                cardName: selectedPrinting.display_name || selectedPrinting.name,
                printingDetails: selectedPrinting,
                availablePrintings: printings
              })
            }
          })
        } else {
          console.warn(`[DeckBulkImport] No results found for card: ${card.name}`)
        }
      })

      console.log('[DeckBulkImport] Final review items:', initialReviewItems.length, 'items')

      setReviewItems(initialReviewItems)
      setActiveTab("review")

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse deck list")
    } finally {
      setLoading(false)
    }
  }

  const updateItemCategory = (index: number, newCategory: 'hero' | 'equipment' | 'maindeck' | 'inventory') => {
    setReviewItems(prev => prev.map((item, i) =>
      i === index ? { ...item, category: newCategory } : item
    ))
  }

  const updateItemQuantity = (index: number, newQuantity: number) => {
    const cardName = reviewItems[index]?.cardName || ''
    const maxAllowed = getMaxQuantityForCard(cardName)
    const clampedQuantity = Math.max(1, Math.min(maxAllowed, newQuantity))

    console.log(`[DeckBulkImport] Updating quantity for item ${index}:`, {
      oldQuantity: reviewItems[index]?.quantity,
      requestedQuantity: newQuantity,
      clampedQuantity,
      cardName,
      maxAllowed
    })
    setReviewItems(prev => prev.map((item, i) =>
      i === index ? { ...item, quantity: clampedQuantity } : item
    ))
  }

  const updateItemPrinting = (index: number, newPrintingId: string) => {
    setReviewItems(prev => prev.map((item, i) => {
      if (i === index && item.availablePrintings) {
        const newPrinting = item.availablePrintings.find(p => p.printing_id === newPrintingId)
        if (newPrinting) {
          return {
            ...item,
            printingId: newPrintingId,
            printingDetails: newPrinting,
            cardName: newPrinting.display_name || newPrinting.name
          }
        }
      }
      return item
    }))
  }

  const removeItem = (index: number) => {
    setReviewItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleImport = async () => {
    if (reviewItems.length === 0) {
      setError("No cards to import")
      return
    }

    console.log('[DeckBulkImport] Starting import with review items:', reviewItems.map(item => ({
      cardName: item.cardName,
      quantity: item.quantity,
      category: item.category,
      printingId: item.printingId
    })))

    setImporting(true)
    setError(null)

    try {
      await onImport(reviewItems)
      onOpenChange(false)

      // Reset state
      setBulkInput("")
      setParsedCards([])
      setSearchResults([])
      setReviewItems([])
      setActiveTab("paste")
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import cards")
    } finally {
      setImporting(false)
    }
  }

  const getCategoryStats = () => {
    const stats = {
      hero: 0,
      equipment: 0,
      maindeck: 0,
      inventory: 0
    }

    reviewItems.forEach(item => {
      stats[item.category] += item.quantity
    })

    return stats
  }

  const stats = getCategoryStats()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[95vw] lg:max-w-[1400px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Decklist
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab as any}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="paste" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Paste Decklist
            </TabsTrigger>
            <TabsTrigger value="review" disabled={reviewItems.length === 0} className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Review & Categorize ({reviewItems.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
              <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Import Deck List</h3>
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                Paste your decklist below. Cards will be automatically categorized into Hero, Equipment, and Main Deck sections.
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Multi-color cards:</strong> If you don't specify a color (e.g., "3x Zipper Hit"), all color variants will appear in the review step. Specify colors like <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-800 rounded">3x red Zipper Hit</code> or <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-800 rounded">3x Zipper Hit (blue)</code> to get only that color.
              </p>
            </div>

            <div className="space-y-4">
              <textarea
                className="w-full h-64 p-3 border rounded-md font-mono text-sm bg-white text-gray-900 placeholder-gray-500 border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400 dark:border-gray-600"
                placeholder={`Paste your deck list here...\n\nExample:\n1x Prism, Sculptor of Arc Light\n2x Phantasmal Footsteps\n3x Spectral Shield (red)\n3x Arc Light Sentinel\n2x red Command and Conquer\n3x Photon Splicing (blue, rf)\n\nTip: Specify colors as (red), (yellow), or (blue) to filter multi-color cards.`}
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                disabled={loading}
              />

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Parse Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleBulkParse}
                disabled={loading || !bulkInput.trim()}
                className="w-full"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {loading ? "Parsing Decklist..." : "Parse & Categorize Cards"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="review" className="space-y-4">
            {reviewItems.length > 0 && (
              <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{stats.hero}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Hero</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{stats.equipment}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Equipment</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.maindeck}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Main Deck</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.inventory}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Inventory</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 max-h-[60vh] overflow-y-auto p-1">
              {reviewItems.map((item, index) => (
                <DeckImportCard
                  key={index}
                  item={item}
                  index={index}
                  availablePrintings={item.availablePrintings || []}
                  onQuantityChange={updateItemQuantity}
                  onCategoryChange={updateItemCategory}
                  onPrintingChange={updateItemPrinting}
                  onRemove={removeItem}
                />
              ))}
            </div>

            {reviewItems.length > 0 && (
              <div className="flex justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("paste")}
                  disabled={importing}
                >
                  Back to Edit
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex items-center gap-2"
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Adding Cards...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Add {reviewItems.reduce((sum, item) => sum + item.quantity, 0)} Cards to Deck
                    </>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}