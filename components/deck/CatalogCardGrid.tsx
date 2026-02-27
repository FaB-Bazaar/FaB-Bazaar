"use client"

import { useState } from "react"
import CatalogCardItem from "./CatalogCardItem"
import { Loader2 } from "lucide-react"

interface CatalogCardGridProps {
  cards: any[]
  loading: boolean
  onAddCard: (cardUniqueId: string, cardName: string) => Promise<void>
  isAddingCard: boolean
}

export default function CatalogCardGrid({
  cards,
  loading,
  onAddCard,
  isAddingCard
}: CatalogCardGridProps) {
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading cards...</p>
        </div>
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">No cards found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try adjusting your filters
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 p-32 -m-32">
      {cards.map((card) => (
        <CatalogCardItem
          key={card.printing_id}
          card={card}
          onAddCard={onAddCard}
          isAddingCard={isAddingCard}
          isExpanded={expandedCardId === card.printing_id}
          onExpand={() => setExpandedCardId(card.printing_id)}
          onCollapse={() => setExpandedCardId(null)}
        />
      ))}
    </div>
  )
}
