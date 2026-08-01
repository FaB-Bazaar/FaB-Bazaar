// components/binder/DeckUsageButton.tsx

"use client"

import { useState } from "react"
import Link from "next/link"
import { Layers, Loader2 } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { decksClient } from "@/lib/client"
import { cn } from "@/lib/utils"
import type { CardDeckUsageEntryDTO } from "@/lib/services/contracts/IDeckService"

/**
 * Per-card deck-usage aggregate shipped inline with binder cards (owner only).
 * Coverage is max-per-deck, not sum: you play one deck at a time, so owning
 * maxDeckQuantity copies is enough to play any single deck.
 */
export interface DeckUsageSummary {
  deckCount: number
  maxDeckQuantity: number
  ownedQuantity: number
}

interface DeckUsageButtonProps {
  cardUniqueId: string
  deckUsage: DeckUsageSummary
  className?: string
}

/**
 * Compact "Decks (N)" button for binder card tiles. The deck list itself is
 * lazy-fetched on first open — a card can sit in dozens of decks, so nothing
 * heavy ships with the binder page.
 */
export default function DeckUsageButton({ cardUniqueId, deckUsage, className }: DeckUsageButtonProps) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<CardDeckUsageEntryDTO[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const shortage = Math.max(0, deckUsage.maxDeckQuantity - deckUsage.ownedQuantity)

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen && entries === null) {
      setError(null)
      decksClient.getCardDeckUsage(cardUniqueId).then((result) => {
        if (result.success) {
          setEntries(result.data)
        } else {
          setError(result.error || 'Failed to load decks')
        }
      })
    }
  }

  if (deckUsage.deckCount === 0) return null

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          data-testid="deck-usage-button"
          className={cn(
            "flex items-center justify-center gap-1.5 w-full text-sm px-2 py-0.5 rounded-full no-select transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
            shortage > 0
              ? "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60"
              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600",
            className
          )}
        >
          <Layers className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            Decks ({deckUsage.deckCount}){shortage > 0 && ` • ${shortage} short`}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-72 p-0" onClick={(e) => e.stopPropagation()}>
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="text-sm font-semibold">In {deckUsage.deckCount} of your decks</div>
          <div className={cn(
            "text-sm",
            shortage > 0 ? "text-amber-700 dark:text-amber-400 font-medium" : "text-gray-600 dark:text-gray-300"
          )}>
            {shortage > 0
              ? `You own ${deckUsage.ownedQuantity}, a deck runs ${deckUsage.maxDeckQuantity} — ${shortage} short to play it`
              : `You own ${deckUsage.ownedQuantity} — enough for any one deck (max needed: ${deckUsage.maxDeckQuantity})`}
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto py-1" data-testid="deck-usage-list">
          {error && (
            <div className="px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</div>
          )}
          {!error && entries === null && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading decks…
            </div>
          )}
          {entries?.map((entry) => (
            <Link
              key={entry.publicId}
              href={`/decks/${entry.publicId}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-baseline justify-between gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium truncate">{entry.name}</span>
                {(entry.heroName || entry.format) && (
                  <span className="block text-sm text-gray-600 dark:text-gray-300 truncate">
                    {[entry.heroName, entry.format].filter(Boolean).join(' • ')}
                  </span>
                )}
              </span>
              <span className="text-sm font-semibold shrink-0">&times;{entry.quantity}</span>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
