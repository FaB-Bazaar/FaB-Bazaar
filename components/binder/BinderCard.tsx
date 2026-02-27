// components/binder/BinderCard.tsx

"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Minus, Plus, Edit3, Trash2, Layers, ExternalLink } from "lucide-react"
import { RarityIcon } from '@/components/shared/RarityIcon'
import { cn } from '@/lib/utils'
import Link from "next/link"
import { TcgAffiliateLink } from '@/components/tracking'


interface DeckUsage {
  deckId: string;
  deckName: string;
  quantity: number;
  category: 'hero' | 'equipment' | 'main' | 'sideboard';
}

interface EnhancedBinderCardProps {
  card: any & { // The card is now a rich, flat inventory_item document
    usedInDecks?: DeckUsage[];
  };
  editable: boolean;
  compactMode?: boolean;
  onEdit: (card: any) => void;
  onRemove: (id: string) => void;
  toast: (opts: { title: string; description: string; variant?: "default" | "destructive" | null }) => void;
  onToggleForTrade?: (card: any, checked: boolean) => void;
  onSelect?: (card: any) => void;
  isSelected?: boolean;
  selectedQty?: number;
  maxQty?: number;
  handleUpdateCard: (id: string, updates: any) => void;
  onQuantityIncrease: (cardId: string) => void;
  onQuantityDecrease: (cardId: string) => void;
  onOpenPrintingSwap?: (card: any) => void;
  isInTransferDialog?: boolean;
  transferDialogOpen?: boolean;
  onViewDeck?: (deckId: string) => void;
}

export default function EnhancedBinderCard({
  card,
  editable,
  onEdit,
  onRemove,
  toast,
  onSelect,
  isSelected,
  selectedQty,
  maxQty,
  onToggleForTrade,
  handleUpdateCard,
  onQuantityIncrease,
  onQuantityDecrease,
  onOpenPrintingSwap,
  isInTransferDialog,
  transferDialogOpen,
  compactMode = false,
  onViewDeck
}: EnhancedBinderCardProps) {

  // State for inline feedback message
  const [showFeedback, setShowFeedback] = useState(false)

  // --- HELPER FUNCTIONS ---
  const getEditionDisplayName = (code?: string) => {
    if (!code) return ""
    const lookupCode = code.toLowerCase()
    const editions: Record<string, string> = {
      a: "Alpha", f: "1st", u: "UNL", n: "",
    }
    return editions[lookupCode] || code.toUpperCase()
  }

  const getFoilingInfo = (foiling: string) => {
    const foilingMap = {
      'R': { name: 'Rainbow Foil', className: 'bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 text-white' },
      'C': { name: 'Cold Foil', className: 'bg-blue-600 text-white' },
      'G': { name: 'Gold Foil', className: 'bg-yellow-500 text-black' },
      'S': { name: 'Non-foil', className: 'bg-gray-500 text-white' }
    }
    const code = foiling?.toUpperCase()
    return foilingMap[code] || { name: 'Non-foil', className: 'bg-gray-500 text-white' }
  }
  
  // --- THIS IS THE CRITICAL CHANGE FOR IMAGES ---
  // This function is now self-reliant and builds your canonical Cloudflare URL.
  const getImageUrl = () => {
    // Your new inventory_item model guarantees `printingId` is a top-level field.
    const printingId = card.printingId;

    if (printingId) {
      // Always construct your preferred, high-performance Cloudflare URL.
      return `https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${printingId}/public`;
    }
    
    // Fallback to a generic card back if no ID is found.
    return "/cardback.webp";
  }

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onSelect) return

    // Non-owners can only select cards that are for trade
    if (!editable && !card.forTrade) {
      setShowFeedback(true)
      setTimeout(() => setShowFeedback(false), 3000)
      return
    }

    onSelect(card)
  }

  const getCategoryColor = (category: string) => {
    const colors = {
      'hero': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'equipment': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'main': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'sideboard': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    }
    return colors[category] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  }
  
  // --- SIMPLIFIED DATA ACCESS ---
  // Destructure all properties directly from the flat `card` object.
  const {
    display_name,
    rarity,
    foiling,
    set,
    edition,
    condition = 'NM',
    type_text_display,
    tcg_low,
    tcg_mid,
    tcg_high,
    tcg_market,
    tcgplayer_url,
    quantity = 1,
    printingId,
    collector_number
  } = card;

  const editionDisplay = getEditionDisplayName(edition)
  const foilingInfo = getFoilingInfo(foiling)

const renderPriceLine = (price: number | undefined, label: string, isLow = false) => {
  if (typeof price !== 'number') return null
  const totalValue = price * quantity
  return (
    <div className={`${isLow ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-gray-600 dark:text-gray-400'} text-xs`}>
      <div className="flex justify-between items-center">
        <span className="text-gray-500 dark:text-gray-400">{label}:</span>
        <span>
          {quantity > 1 ? `$${price.toFixed(2)} × ${quantity} = $${totalValue.toFixed(2)}` : `$${price.toFixed(2)}`}
        </span>
      </div>
    </div>
  )
}

// Add this new function for the TCGPlayer purchase link:
const renderPurchaseLink = () => {
  if (!tcgplayer_url) return null
  
  return (
    <div className="text-xs mt-2 pt-2 border-t border-gray-100 dark:border-gray-600">
      <TcgAffiliateLink
        tcgplayerUrl={tcgplayer_url}
        feature="PurchaseLink"
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors no-select"
        title="Purchase on TCGPlayer"
      >
        <span>Available for purchase here</span>
        <div className="flex items-center gap-1">
          <img 
            src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
            alt="TCGPlayer"
            className="h-4 w-auto"
          />
        </div>
      </TcgAffiliateLink>
    </div>
  )
}


  const totalUsedInDecks = card.usedInDecks?.reduce((sum, usage) => sum + usage.quantity, 0) || 0
  const availableForTrade = quantity - totalUsedInDecks

  return (
    <div
      className={cn(
        "w-full sm:w-[200px] rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all hover:shadow-xl hover:-translate-y-1 flex-shrink-0 flex flex-col",
        isSelected ? "shadow-lg bg-blue-50 dark:bg-blue-900/20" : "shadow-md",
        isSelected && selectedQty >= maxQty && "opacity-70"
      )}
    >
      {/* Image Section */}
      <div className="relative w-full h-[200px] sm:h-[280px] bg-gray-50 dark:bg-gray-800 overflow-hidden flex items-center justify-center p-2">
        <div
          onClick={handleImageClick}
          className={cn(
            "relative w-full h-full flex items-center justify-center",
            onSelect && (editable || card.forTrade) && "cursor-pointer",
            onSelect && !editable && !card.forTrade && "cursor-not-allowed"
          )}
        >
          <img
            src={getImageUrl()}
            alt={display_name}
            className={cn(
              "max-w-full max-h-full object-contain transition-opacity",
              !editable && !card.forTrade && "opacity-50"
            )}
            loading="lazy"
            onError={(e) => { e.currentTarget.src = "/cardback.webp" }}
          />

          {/* Not For Trade Badge - only show for non-owners */}
          {!editable && !card.forTrade && (
            <div className="absolute top-2 right-2 bg-red-600/90 text-white text-xs px-2 py-1 rounded font-semibold shadow-lg">
              Not For Trade
            </div>
          )}
        </div>

        {(quantity > 1 || !editable) && (
          <div className="absolute top-2 left-2 bg-black/80 text-white text-sm px-3 py-1.5 rounded-full font-bold pointer-events-none">
            {quantity}x
          </div>
        )}

        {/* Inline feedback message for non-tradeable card clicks */}
        {showFeedback && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-red-600/95 text-white text-xs px-3 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-none">
            This card is not available for trade
          </div>
        )}

        {/* Other indicators */}
        {isSelected && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg border-2 border-white shadow-lg">
              <div className="text-center">
                <div className="text-2xl font-bold">{selectedQty || 1}</div>
                <div className="text-xs font-medium opacity-90">Selected</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="p-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 flex-1 flex flex-col">
        <div className="font-semibold text-sm leading-tight mb-2">
          {display_name}
        </div>

        {/* ... Deck usage tags ... */}

        <div className="flex-1"></div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {collector_number && <span className="font-mono uppercase tracking-wide text-blue-600 dark:text-blue-400">{collector_number}</span>}
              {editionDisplay && <span className="text-gray-500 dark:text-gray-400 uppercase">• {editionDisplay}</span>}
            </div>
            {card.forTrade && (
              <div className="font-semibold text-green-600 dark:text-green-400">
                For Trade
              </div>
            )}
          </div>

          {type_text_display && <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{type_text_display}</div>}

          {!compactMode && (
            <div className="space-y-1">
              {renderPriceLine(tcg_market, "Market")}
              {renderPriceLine(tcg_high, "High")}
              {renderPriceLine(tcg_mid, "Mid")}
              {renderPriceLine(tcg_low, "Low", true)}
              {renderPurchaseLink()}
            </div>
          )}

          {card.notes && <div className="text-xs text-gray-600 dark:text-gray-400 italic truncate">{card.notes}</div>}

          <div className="flex items-center gap-2">
            {rarity && <RarityIcon rarityCode={rarity} size="sm" />}
            {foiling && (
              <button
                onClick={(e) => { e.stopPropagation(); if (editable && onOpenPrintingSwap) onOpenPrintingSwap(card); }}
                className={`text-xs px-2 py-0.5 rounded-full text-center flex-1 transition-all no-select ${foilingInfo.className} ${editable && onOpenPrintingSwap ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
                disabled={!editable || !onOpenPrintingSwap}
                title={editable && onOpenPrintingSwap ? "Click to change printing" : undefined}
              >
                {foilingInfo.name}
              </button>
            )}
          </div>
        </div>

        {editable && (
          <div className="flex justify-center mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
            <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${card.forTrade ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-700'}`}>
              <Switch checked={!!card.forTrade} onCheckedChange={onToggleForTrade ? (checked => onToggleForTrade(card, checked)) : undefined} size="sm" className="no-select" />
              <span className={`text-xs font-medium ${card.forTrade ? 'text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-400'}`}>For Trade</span>
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-2">
            {editable && (
              <div className="flex items-center gap-1">
                <button onClick={(e) => { e.stopPropagation(); onQuantityDecrease(card.id || card._id); }} disabled={quantity <= 1} className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 flex items-center justify-center no-select">
                  <Minus className="w-3 h-3" />
                </button>
                <div className="text-center text-sm font-medium">{quantity}</div>
                <button onClick={(e) => { e.stopPropagation(); onQuantityIncrease(card.id || card._id); }} className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 flex items-center justify-center no-select">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
          
          {editable && (
            <div className="flex gap-1">
              {printingId && (
                <Link href={`/printing/${printingId}`} onClick={(e) => e.stopPropagation()} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 no-select" title="View Printing Details">
                  <ExternalLink className="w-4 h-4 text-blue-500 hover:text-blue-600" />
                </Link>
              )}
              <button onClick={(e) => { e.stopPropagation(); onEdit(card); }} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 no-select">
                <Edit3 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onRemove(card.id || card._id); }} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900 text-red-500 dark:text-red-400 no-select">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}