"use client"

import { useState } from "react"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RarityIcon } from "@/components/shared/RarityIcon"
import { getSetName, getFoilingName, getEditionName } from "@/lib/fab-formatters"
import { Plus, Minus, X, ChevronDown, ChevronUp } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import ViewPrintingsDialog from "@/components/dialogs/cards/view-printings-dialog"
import { decksClient } from "@/lib/client"

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
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  const toggleCard = (key: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null)

  const [printingDialogTarget, setPrintingDialogTarget] = useState<{
    cardName: string;
    cardUniqueId: string;
    printingId: string;
    category: string;
  } | null>(null)

  const handleSwapPrinting = async (newPrinting: any) => {
    if (!printingDialogTarget) return
    const result = await decksClient.swapPrinting(
      deckId,
      printingDialogTarget.printingId,
      newPrinting.printing_id,
      printingDialogTarget.category as any
    )
    if (result.success) {
      toast({ title: "Printing swapped" })
      await onDeckUpdate()
    } else {
      toast({ title: "Swap failed", description: (result as any).error, variant: "destructive" })
    }
    setPrintingDialogTarget(null)
  }

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

  const PITCH_META: Record<string, { label: string; border: string; header: string; bg: string }> = {
    'pitch-1-red':   { label: 'Red (1)',    border: 'border-l-[3px] border-red-500',   header: 'text-red-700 dark:text-red-400',    bg: 'bg-red-500/10 dark:bg-red-500/15' },
    'pitch-2-yellow':{ label: 'Yellow (2)', border: 'border-l-[3px] border-yellow-400', header: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-500/10 dark:bg-yellow-500/15' },
    'pitch-3-blue':  { label: 'Blue (3)',   border: 'border-l-[3px] border-blue-500',  header: 'text-blue-700 dark:text-blue-400',  bg: 'bg-blue-500/10 dark:bg-blue-500/15' },
    'no-pitch':      { label: 'Non-pitch',  border: 'border-l-[3px] border-gray-400 dark:border-gray-600', header: 'text-gray-500 dark:text-gray-400', bg: 'hover:bg-accent' },
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
      const color = card.printingDetails?.color
      const pitch = card.printingDetails?.pitch
      if (color === 'red' || pitch === 1 || pitch === '1') {
        groups['pitch-1-red'].push(card)
      } else if (color === 'yellow' || pitch === 2 || pitch === '2') {
        groups['pitch-2-yellow'].push(card)
      } else if (color === 'blue' || pitch === 3 || pitch === '3') {
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
            {expandedSections.equipment && <div className="space-y-0.5">
              {deck.equipment.map((card: any, index: number) => {
                const price = card.printingDetails?.tcg_low
                return (
                  <div
                    key={index}
                    className="text-sm flex items-center gap-2 px-2 py-1 rounded border-l-[3px] border-gray-400 dark:border-gray-600 hover:bg-accent group"
                    onMouseEnter={(e) => handleCardHover(card, e)}
                    onMouseLeave={handleCardLeave}
                  >
                    <span className="text-muted-foreground font-mono text-xs w-5 shrink-0 text-right">{card.quantity || 1}×</span>
                    <span className="flex-1 truncate">{card.printingDetails?.display_name || card.printingDetails?.name}</span>
                    {price > 0 && (
                      <span className="text-xs text-green-600 dark:text-green-500 font-medium shrink-0 group-hover:hidden">
                        ${price.toFixed(2)}
                      </span>
                    )}
                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleRemoveCard(card.printingId, 'equipment', 1) }}
                        disabled={removingCard === card.printingId}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )
              })}
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

              const meta = PITCH_META[pitchKey]

              // Group by card name, collecting all printing instances
              const cardCounts: Record<string, number> = {}
              const cardAllInstances: Record<string, any[]> = {}
              cards.forEach((card: any) => {
                const name = card.printingDetails?.display_name || card.printingDetails?.name
                cardCounts[name] = (cardCounts[name] || 0) + (card.quantity || 1)
                if (!cardAllInstances[name]) cardAllInstances[name] = []
                cardAllInstances[name].push(card)
              })

              const pitchTotal = Object.values(cardCounts).reduce((a, b) => a + b, 0)

              return (
                <div key={pitchKey} className="mb-3">
                  {/* Pitch section label */}
                  <div className={`flex items-center justify-between px-2 py-0.5 mb-0.5 text-xs font-semibold ${meta.header}`}>
                    <span>{meta.label}</span>
                    <span className="font-normal opacity-70">{pitchTotal}</span>
                  </div>
                  <div className="space-y-0.5">
                    {Object.entries(cardCounts).map(([name, count]) => {
                      const instances = cardAllInstances[name]
                      const firstCard = instances[0]
                      const cardKey = `${pitchKey}:${name}`
                      const isExpanded = expandedCards.has(cardKey)

                      return (
                        <div key={name}>
                          {/* Card name row */}
                          <div
                            className={`text-sm flex items-center gap-2 px-2 py-1 rounded group ${meta.border} ${meta.bg}`}
                            onMouseEnter={(e) => !isExpanded && handleCardHover(firstCard, e)}
                            onMouseLeave={handleCardLeave}
                          >
                            <span className="text-muted-foreground font-mono text-xs w-5 shrink-0 text-right">{count}×</span>
                            <span
                              className="flex-1 truncate cursor-pointer hover:underline hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                              onClick={() => {
                                handleCardLeave()
                                const imageUrl = firstCard?.printingDetails?.image_url
                                if (imageUrl) setZoomedImageUrl(imageUrl)
                              }}
                            >{name}</span>
                            {!isExpanded && firstCard?.printingDetails?.tcg_low > 0 && (
                              <span className="text-xs text-green-600 dark:text-green-500 font-medium shrink-0 group-hover:hidden">
                                ${firstCard.printingDetails.tcg_low.toFixed(2)}
                              </span>
                            )}
                            <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                              <Button variant="ghost" size="icon" className="h-5 w-5"
                                onClick={(e) => { e.stopPropagation(); onAddCard?.(firstCard?.printingDetails?.card_unique_id, firstCard?.printingDetails?.name) }}
                                disabled={!onAddCard}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <button
                              className="shrink-0 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                              onClick={() => { handleCardLeave(); toggleCard(cardKey) }}
                            >
                              <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          </div>

                          {/* Expanded: individual printing rows */}
                          {isExpanded && (
                            <div className="ml-5 mt-0.5 space-y-0.5">
                              {instances.map((card: any, i: number) => {
                                const qty = card.quantity || 1
                                const foiling = getFoilingName(card.printingDetails?.foiling)
                                const edition = getEditionName(card.printingDetails?.edition)
                                const collector = card.printingDetails?.collector_number
                                const price = card.printingDetails?.tcg_low

                                const infoChunks = [
                                  foiling && foiling !== 'Non-foil' ? foiling : null,
                                  edition && edition !== 'Normal' ? edition : null,
                                  collector ? `#${collector}` : null,
                                ].filter(Boolean).join(' · ')

                                return (
                                  <div
                                    key={i}
                                    className={`text-xs flex items-center gap-2 px-2 py-1 rounded group ${meta.border} bg-black/5 dark:bg-white/5`}
                                    onMouseEnter={(e) => handleCardHover(card, e)}
                                    onMouseLeave={handleCardLeave}
                                  >
                                    <span className="text-muted-foreground font-mono w-4 shrink-0 text-right">{qty}×</span>
                                    <span className="flex-1 truncate text-muted-foreground">{infoChunks || 'Standard'}</span>
                                    {price > 0 && (
                                      <span className="text-green-600 dark:text-green-500 font-medium shrink-0 group-hover:hidden">
                                        ${price.toFixed(2)}
                                      </span>
                                    )}
                                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                                      <Button variant="ghost" size="icon" className="h-5 w-5"
                                        onClick={(e) => { e.stopPropagation(); handleRemoveCard(card.printingId, 'maindeck', 1) }}
                                        disabled={removingCard === card.printingId}
                                      >
                                        <Minus className="h-3 w-3" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive"
                                        onClick={(e) => { e.stopPropagation(); handleRemoveCard(card.printingId, 'maindeck', qty) }}
                                        disabled={removingCard === card.printingId}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
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
            {expandedSections.inventory && <div className="space-y-0.5">
              {deck.inventory.map((card: any, index: number) => {
                const price = card.printingDetails?.tcg_low
                return (
                  <div
                    key={index}
                    className="text-sm flex items-center gap-2 px-2 py-1 rounded border-l-[3px] border-gray-400 dark:border-gray-600 hover:bg-accent group"
                    onMouseEnter={(e) => handleCardHover(card, e)}
                    onMouseLeave={handleCardLeave}
                  >
                    <span className="text-muted-foreground font-mono text-xs w-5 shrink-0 text-right">{card.quantity || 1}×</span>
                    <span className="flex-1 truncate">{card.printingDetails?.display_name || card.printingDetails?.name}</span>
                    {price > 0 && (
                      <span className="text-xs text-green-600 dark:text-green-500 font-medium shrink-0 group-hover:hidden">
                        ${price.toFixed(2)}
                      </span>
                    )}
                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleRemoveCard(card.printingId, 'inventory', 1) }}
                        disabled={removingCard === card.printingId}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>}
          </div>
        )}
      </div>

      {/* Card zoom lightbox */}
      {zoomedImageUrl && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer"
          onClick={() => setZoomedImageUrl(null)}
        >
          <Image
            src={zoomedImageUrl}
            alt="Card zoom"
            width={400}
            height={560}
            className="max-h-[85vh] max-w-[85vw] w-auto h-auto rounded-xl shadow-2xl border border-gray-600"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* Printings dialog — swap printing for a deck card */}
      <ViewPrintingsDialog
        open={!!printingDialogTarget}
        onOpenChange={isOpen => !isOpen && setPrintingDialogTarget(null)}
        cardName={printingDialogTarget?.cardName || ''}
        cardUniqueId={printingDialogTarget?.cardUniqueId || ''}
        onSelectPrinting={handleSwapPrinting}
      />

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
