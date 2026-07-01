//components/binder/BinderCardsGrid.tsx

"use client"

import React from "react"
import { BookOpen, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import BinderCard from "./BinderCard"

// Types
interface BinderCardsGridProps {
  cards: any[]
  binder: any
  editable: boolean
  selectedCards: any[]
  transferDialogOpen: boolean
  onCardSelect: (card: any) => void
  onEditCard: (card: any) => void
  onRemoveCard: (binderId: string, cardId: string) => void
  onToggleForTrade: (card: any, checked: boolean) => void
  onUpdateCard: (id: string, updates: any) => void
  onUpdateCardQuantity: (id: string, newQuantity: number) => void
  onOpenPrintingSwap: (card: any) => void
  onAddCard?: () => void
  toast: (opts: { title: string; description: string; variant?: "default" | "destructive" | null }) => void
}

export default function BinderCardsGrid({
  cards,
  binder,
  editable,
  selectedCards,
  transferDialogOpen,
  onCardSelect,
  onEditCard,
  onRemoveCard,
  onToggleForTrade,
  onUpdateCard,
  onUpdateCardQuantity,
  onOpenPrintingSwap,
  onAddCard,
  toast
}: BinderCardsGridProps) {

  // Empty state
  if (cards.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700">
        <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100">No cards found</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          {binder?.cards?.length === 0 
            ? "Add cards to this binder to get started" 
            : "Try adjusting your search or filters"
          }
        </p>
        {editable && onAddCard && binder?.cards?.length === 0 && (
          <Button 
            onClick={onAddCard} 
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Card
          </Button>
        )}
      </div>
    )
  }

  return (
    <div 
      className="flex flex-wrap gap-4 justify-center sm:justify-start transition-all duration-300" 
    >
      {cards.map((card: any) => {
        // Create unique key for card selection
        const key = card.id + '|' + card.printingId
        const selected = selectedCards.find((c) => c.id + '|' + c.printingId === key)
        
        return (
          <BinderCard
            key={card._id || card.id}
            card={card}
            editable={editable}
            onEdit={onEditCard}
            onRemove={() => {
              onRemoveCard(binder._id, card.id)
            }}
            onOpenPrintingSwap={onOpenPrintingSwap}
            toast={toast}
            onSelect={onCardSelect}
            isSelected={!!selected}
            selectedQty={selected?.quantity || 0}
            maxQty={card.quantity}
            onToggleForTrade={onToggleForTrade}
            handleUpdateCard={onUpdateCard}
            handleUpdateCardQuantity={onUpdateCardQuantity}
            isInTransferDialog={transferDialogOpen && selectedCards.some(sc => sc.id === card.id)}
            transferDialogOpen={transferDialogOpen}
          />
        )
      })}
    </div>
  )
}