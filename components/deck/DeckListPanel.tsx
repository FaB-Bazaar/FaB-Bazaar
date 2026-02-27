"use client"

import { useState } from "react"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RarityIcon } from "@/components/shared/RarityIcon"
import { getSetName, getFoilingName, getEditionName } from "@/lib/fab-formatters"
import { Plus, Minus, X, ChevronDown, ChevronUp } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface DeckListPanelProps {
  deckId: string
  deck: any
  onDeckUpdate: () => Promise<void>
  setDeck?: (deck: any) => void
  onAddCard?: (cardUniqueId: string, cardName: string) => Promise<void>
}

export default function DeckListPanel({
  deckId,
  deck,
  onDeckUpdate,
  setDeck,
  onAddCard
}: DeckListPanelProps) {
  const { toast } = useToast()
  const [hoveredCard, setHoveredCard] = useState<any>(null)
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 })
  const [removingCard, setRemovingCard] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    hero: true,
    equipment: true,
    maindeck: true,
    inventory: true
  })

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // ✅ Helper function to calculate total cards using quantities
  const getTotalCards = (cards: any[]) => {
    return cards.reduce((sum, card) => sum + (card.quantity || 1), 0);
  }

  const handleCardHover = (card: any, event: React.MouseEvent) => {
    setHoveredCard(card)
    const rect = event.currentTarget.getBoundingClientRect()

    // Calculate position to avoid cutting off at edges
    // Card preview width is 240px (w-60)
    const previewWidth = 240
    const viewportWidth = window.innerWidth

    // Default: show to the left
    let x = rect.left - previewWidth - 10

    // If too close to left edge, show to the right instead
    if (x < 10) {
      x = rect.right + 10
    }

    // If showing to the right would cut off, show to the left anyway but constrain
    if (x + previewWidth > viewportWidth - 10) {
      x = rect.left - previewWidth - 10
    }

    // Final safety check - ensure it's always visible
    x = Math.max(10, Math.min(x, viewportWidth - previewWidth - 10))

    setHoverPosition({
      x,
      y: rect.top
    })
  }

  const handleCardLeave = () => {
    setHoveredCard(null)
  }

  const handleRemoveCard = async (printingId: string, category: string, quantity: number = 1) => {
    if (removingCard) return

    setRemovingCard(printingId)

    // Optimistic update
    if (setDeck) {
      setDeck((prevDeck: any) => {
        if (!prevDeck) return prevDeck

        const categoryArray = [...(prevDeck[category] || [])]
        let removedCount = 0

        // Remove specified quantity, respecting the quantity field on each entry
        for (let i = categoryArray.length - 1; i >= 0 && removedCount < quantity; i--) {
          if (categoryArray[i].printingId === printingId) {
            const entryQty = categoryArray[i].quantity || 1;
            const toRemove = Math.min(quantity - removedCount, entryQty);
            if (entryQty - toRemove <= 0) {
              categoryArray.splice(i, 1);
            } else {
              categoryArray[i] = { ...categoryArray[i], quantity: entryQty - toRemove };
            }
            removedCount += toRemove;
          }
        }

        return {
          ...prevDeck,
          [category]: categoryArray,
          totalCards: (prevDeck.totalCards || 0) - removedCount,
          [`${category}Count`]: (prevDeck[`${category}Count`] || 0) - removedCount,
          _optimisticUpdateKey: Date.now()
        }
      })
    }

    try {
      const response = await fetch(`/api/decks/${deckId}/printings/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printingId,
          category,
          quantity
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        // Revert optimistic update on error
        if (setDeck) {
          await onDeckUpdate()
        }
        toast({
          title: "Failed to remove card",
          description: data.error || "An error occurred",
          variant: "destructive"
        })
      } else {
        // Sync stats from server response (don't refetch!)
        if (setDeck && data.deck) {
          setDeck((prevDeck: any) => ({
            ...prevDeck,
            estimatedValue: data.deck.estimatedValue,
            updatedAt: data.deck.updatedAt
          }))
        }
      }
    } catch (error) {
      console.error('[DeckListPanel] Error removing card:', error)
      // Revert optimistic update on error
      if (setDeck) {
        await onDeckUpdate()
      }
      toast({
        title: "Failed to remove card",
        description: "An error occurred",
        variant: "destructive"
      })
    } finally {
      setRemovingCard(null)
    }
  }

  // Group main deck cards by pitch
  const groupByPitch = (cards: any[]) => {
    const groups: Record<string, any[]> = {
      'pitch-1-red': [],
      'pitch-2-yellow': [],
      'pitch-3-blue': [],
      'no-pitch': []
    }

    cards.forEach(card => {
      const pitch = card.printingDetails?.color
      if (pitch === 'red') {
        groups['pitch-1-red'].push(card)
      } else if (pitch === 'yellow') {
        groups['pitch-2-yellow'].push(card)
      } else if (pitch === 'blue') {
        groups['pitch-3-blue'].push(card)
      } else {
        groups['no-pitch'].push(card)
      }
    })

    return groups
  }

  const maindeckByPitch = groupByPitch(deck.maindeck || [])
  const pitchOrder = ['pitch-1-red', 'pitch-2-yellow', 'pitch-3-blue', 'no-pitch']

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold truncate">{deck.name}</h2>
        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
          <span>{deck.totalCards || 0} cards</span>
          {deck.estimatedValue > 0 && (
            <span className="text-green-600 font-semibold">
              ${deck.estimatedValue.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Deck List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Hero */}
        {deck.hero?.length > 0 && (
          <div>
            <div
              className="flex items-center justify-between cursor-pointer p-1.5 rounded hover:bg-accent mb-2"
              onClick={() => toggleSection('hero')}
            >
              <h3 className="text-xs font-semibold text-muted-foreground">HERO</h3>
              {expandedSections.hero ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            {expandedSections.hero && deck.hero.map((card: any, index: number) => (
              <div
                key={index}
                className="text-sm p-2 rounded hover:bg-accent hover:scale-[1.02] transition-all cursor-pointer"
                onMouseEnter={(e) => handleCardHover(card, e)}
                onMouseLeave={handleCardLeave}
              >
                {card.printingDetails?.display_name || card.printingDetails?.name}
              </div>
            ))}
          </div>
        )}

        {/* Equipment */}
        {deck.equipment?.length > 0 && (
          <div>
            <div
              className="flex items-center justify-between cursor-pointer p-1.5 rounded hover:bg-accent mb-2"
              onClick={() => toggleSection('equipment')}
            >
              <h3 className="text-xs font-semibold text-muted-foreground">
                EQUIPMENT ({getTotalCards(deck.equipment)})
              </h3>
              {expandedSections.equipment ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            {expandedSections.equipment && <div className="space-y-1">
              {deck.equipment.map((card: any, index: number) => (
                <div
                  key={index}
                  className="text-sm flex items-center justify-between gap-2 p-2 rounded hover:bg-accent group"
                  onMouseEnter={(e) => handleCardHover(card, e)}
                  onMouseLeave={handleCardLeave}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{card.quantity || 1}x</span>
                    <span>{card.printingDetails?.display_name || card.printingDetails?.name}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveCard(card.printingId, 'equipment', 1)
                      }}
                      disabled={removingCard === card.printingId}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>}
          </div>
        )}

        {/* Main Deck by Pitch */}
        {deck.maindeck?.length > 0 && (
          <div>
            <div
              className="flex items-center justify-between cursor-pointer p-1.5 rounded hover:bg-accent mb-2"
              onClick={() => toggleSection('maindeck')}
            >
              <h3 className="text-xs font-semibold text-muted-foreground">
                MAIN DECK ({getTotalCards(deck.maindeck)})
              </h3>
              {expandedSections.maindeck ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            {expandedSections.maindeck && pitchOrder.map(pitchKey => {
              const cards = maindeckByPitch[pitchKey]
              if (cards.length === 0) return null

              // Count cards by unique name and store first card instance for hover
              const cardCounts: Record<string, number> = {}
              const cardInstances: Record<string, any> = {}
              cards.forEach((card: any) => {
                const name = card.printingDetails?.display_name || card.printingDetails?.name
                // ✅ Sum quantities instead of counting instances
                cardCounts[name] = (cardCounts[name] || 0) + (card.quantity || 1)
                if (!cardInstances[name]) {
                  cardInstances[name] = card
                }
              })

              const cardBgColor =
                pitchKey === 'pitch-1-red' ? 'bg-red-500/20 hover:bg-red-500/30' :
                pitchKey === 'pitch-2-yellow' ? 'bg-yellow-500/25 hover:bg-yellow-500/35' :
                pitchKey === 'pitch-3-blue' ? 'bg-blue-500/20 hover:bg-blue-500/30' :
                'bg-gray-500/15 hover:bg-gray-500/25'

              return (
                <div key={pitchKey} className="mb-2">
                  <div className="space-y-0.5">
                    {Object.entries(cardCounts).map(([name, count]) => {
                      const card = cardInstances[name]
                      const printingId = card?.printingId

                      return (
                        <div
                          key={name}
                          className={`text-sm flex items-center justify-between gap-2 p-2 rounded group ${cardBgColor}`}
                          onMouseEnter={(e) => handleCardHover(card, e)}
                          onMouseLeave={handleCardLeave}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{count}x</span>
                            <span>{name}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemoveCard(printingId, 'maindeck', 1)
                              }}
                              disabled={removingCard === printingId}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (onAddCard) {
                                  onAddCard(card.printingDetails?.card_unique_id, card.printingDetails?.name)
                                }
                              }}
                              disabled={!onAddCard}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemoveCard(printingId, 'maindeck', count as number)
                              }}
                              disabled={removingCard === printingId}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Inventory */}
        {deck.inventory?.length > 0 && (
          <div>
            <div
              className="flex items-center justify-between cursor-pointer p-1.5 rounded hover:bg-accent mb-2"
              onClick={() => toggleSection('inventory')}
            >
              <h3 className="text-xs font-semibold text-muted-foreground">
                INVENTORY ({getTotalCards(deck.inventory)})
              </h3>
              {expandedSections.inventory ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            {expandedSections.inventory && <div className="space-y-1">
              {deck.inventory.map((card: any, index: number) => (
                <div
                  key={index}
                  className="text-sm flex items-center justify-between gap-2 p-2 rounded hover:bg-accent group"
                  onMouseEnter={(e) => handleCardHover(card, e)}
                  onMouseLeave={handleCardLeave}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{card.quantity || 1}x</span>
                    <span>{card.printingDetails?.display_name || card.printingDetails?.name}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveCard(card.printingId, 'inventory', 1)
                      }}
                      disabled={removingCard === card.printingId}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>}
          </div>
        )}
      </div>

      {/* Card Image Preview on Hover */}
      {hoveredCard && (
        <div
          className="fixed pointer-events-none z-[200]"
          style={{
            left: `${hoverPosition.x}px`,
            top: `${hoverPosition.y}px`
          }}
        >
          <div className="w-60 rounded-lg overflow-hidden shadow-2xl border-4 border-blue-500 ring-4 ring-blue-500/30 bg-black">
            {hoveredCard.printingDetails?.image_url ? (
              <Image
                src={hoveredCard.printingDetails.image_url}
                alt={hoveredCard.printingDetails?.display_name || hoveredCard.printingDetails?.name}
                width={240}
                height={336}
                className="object-cover"
              />
            ) : (
              <div className="w-60 h-84 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <p className="text-sm text-muted-foreground text-center px-4">
                  {hoveredCard.printingDetails?.display_name || hoveredCard.printingDetails?.name}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
