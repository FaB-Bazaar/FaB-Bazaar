"use client"

import { useState } from "react"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import CardCatalogPanel from "./CardCatalogPanel"
import DeckListPanel from "./DeckListPanel"
import { useToast } from "@/hooks/use-toast"

interface DeckBuilderSplitViewProps {
  deckId: string
  deck: any // Full deck data with hero, format, etc.
  deckFormat?: string // Deck format (e.g., "Silver Age", "Blitz", "Classic Constructed")
  onDeckUpdate: () => Promise<void> // Callback to refetch deck data
  setDeck?: (deck: any) => void // Optional: Set deck state directly without refetch
}

export default function DeckBuilderSplitView({
  deckId,
  deck,
  deckFormat,
  onDeckUpdate,
  setDeck
}: DeckBuilderSplitViewProps) {
  const { toast } = useToast()
  const [isAddingCard, setIsAddingCard] = useState(false)

  // Extract hero information for filtering
  const heroPrinting = deck.hero?.[0]
  const heroDetails = heroPrinting?.printingDetails
  // Use the full hero name for heroLegal filter (API will handle lookup via getHeroInfo)
  const heroName = heroDetails?.name || heroDetails?.display_name

  // Handle adding a card from the catalog
  const handleAddCard = async (cardUniqueId: string, cardName: string) => {
    if (isAddingCard) return

    setIsAddingCard(true)
    try {
      // Find the default printing (Normal edition, non-foil)
      const printingDetails = await findDefaultPrinting(cardUniqueId)

      // Optimistically update the deck state immediately for instant UI feedback
      if (setDeck) {
        setDeck((prevDeck: any) => {
          if (!prevDeck) return prevDeck

          const newMaindeck = [...(prevDeck.maindeck || [])]

          // Add the new card with printing details
          newMaindeck.push({
            printingId: printingDetails.printing_id,
            category: 'maindeck',
            condition: 'NM',
            printingDetails: printingDetails
          })

          // Create a completely new object to trigger re-render
          const updatedDeck = {
            ...prevDeck,
            maindeck: newMaindeck,
            totalCards: (prevDeck.totalCards || 0) + 1,
            maindeckCount: (prevDeck.maindeckCount || 0) + 1,
            // Force update timestamp to ensure re-render
            _optimisticUpdateKey: Date.now()
          }

          return updatedDeck
        })
      }

      // Add to deck via API in the background (no await - fire and forget)
      fetch(`/api/decks/${deckId}/printings/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printingId: printingDetails.printing_id,
          category: 'maindeck',
          condition: 'NM'
        })
      }).then(async (response) => {
        const data = await response.json()

        if (!response.ok || !data.success) {
          // On error, revert the optimistic update and show error
          console.error('[DeckBuilderSplitView] Error adding card:', data.error)
          await onDeckUpdate() // Refetch to revert state
          toast({
            title: "Failed to add card",
            description: data.error || "An error occurred",
            variant: "destructive"
          })
        } else {
          // Silently sync the stats from the server response
          if (setDeck && data.deck) {
            setDeck((prevDeck: any) => ({
              ...prevDeck,
              estimatedValue: data.deck.estimatedValue,
              updatedAt: data.deck.updatedAt
            }))
          }
        }
      }).catch((error) => {
        console.error('[DeckBuilderSplitView] Network error:', error)
        onDeckUpdate() // Refetch to ensure consistency
      })

      // Show success toast immediately
      toast({
        title: "Card added",
        description: `${cardName} added to main deck`
      })
    } catch (error) {
      console.error('[DeckBuilderSplitView] Error finding printing:', error)
      toast({
        title: "Failed to add card",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      })
    } finally {
      setIsAddingCard(false)
    }
  }

  return (
    <div className="h-[calc(100vh-200px)] w-full">
      <ResizablePanelGroup direction="horizontal" className="h-full w-full rounded-lg border">
        {/* Left Panel - Card Catalog */}
        <ResizablePanel defaultSize={75} minSize={50}>
          <CardCatalogPanel
            deck={deck}
            deckFormat={deckFormat}
            heroClasses={heroDetails?.classes || []}
            heroTalents={heroDetails?.talents || []}
            heroName={heroName}
            onAddCard={handleAddCard}
            isAddingCard={isAddingCard}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel - Deck List */}
        <ResizablePanel defaultSize={25} minSize={15}>
          <DeckListPanel
            deckId={deckId}
            deck={deck}
            onDeckUpdate={onDeckUpdate}
            setDeck={setDeck}
            onAddCard={handleAddCard}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

// Helper function to find the default printing (Normal > U > first non-foil)
// Returns the full printing object with all details
async function findDefaultPrinting(cardUniqueId: string): Promise<any> {
  const response = await fetch(`/api/search/core?cardUniqueId=${encodeURIComponent(cardUniqueId)}&limit=100`)
  const data = await response.json()

  if (!data.success || !data.data?.printings?.length) {
    throw new Error('No printings found for this card')
  }

  const printings = data.data.printings

  // Filter to non-foil only (foiling = 's' or 'n')
  const nonFoil = printings.filter((p: any) =>
    p.foiling?.toLowerCase() === 's' ||
    p.foiling?.toLowerCase() === 'n'
  )

  // Priority 1: Normal edition (edition = 'n')
  const normal = nonFoil.find((p: any) => p.edition?.toLowerCase() === 'n')
  if (normal) return normal

  // Priority 2: Unlimited edition (edition = 'u')
  const unlimited = nonFoil.find((p: any) => p.edition?.toLowerCase() === 'u')
  if (unlimited) return unlimited

  // Fallback: First available non-foil
  if (nonFoil[0]) return nonFoil[0]

  // Last resort: First printing (any foiling)
  return printings[0]
}
