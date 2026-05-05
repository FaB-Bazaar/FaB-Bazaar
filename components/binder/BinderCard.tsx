// components/binder/BinderCard.tsx

"use client"

import React, { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Minus, Plus, Edit3, Trash2, ExternalLink } from "lucide-react"
import { RarityIcon } from '@/components/shared/RarityIcon'
import FoilCardImage from '@/components/shared/FoilCardImage'
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
  card: any & {
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

  const [showFeedback, setShowFeedback] = useState(false)

  const getEditionDisplayName = (code?: string) => {
    if (!code) return ""
    const editions: Record<string, string> = { a: "Alpha", f: "1st", u: "UNL", n: "" }
    return editions[code.toLowerCase()] || code.toUpperCase()
  }

  const getFoilingInfo = (foiling: string) => {
    const foilingMap = {
      'R': { name: 'Rainbow Foil', className: 'bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 text-white' },
      'C': { name: 'Cold Foil',    className: 'bg-blue-600 text-white' },
      'G': { name: 'Gold Foil',    className: 'bg-yellow-500 text-black' },
      'S': { name: 'Non-foil',     className: 'bg-gray-500 text-white' }
    }
    const code = foiling?.toUpperCase()
    return foilingMap[code] || { name: 'Non-foil', className: 'bg-gray-500 text-white' }
  }

  const getImageUrl = () => {
    const printingId = card.printingId
    if (printingId) return `https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${printingId}/public`
    return "/cardback.webp"
  }

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onSelect) return
    if (!editable && !card.forTrade) {
      setShowFeedback(true)
      setTimeout(() => setShowFeedback(false), 3000)
      return
    }
    onSelect(card)
  }

  const {
    display_name,
    rarity,
    foiling,
    edition,
    type_text_display,
    tcg_low,
    tcg_mid,
    tcg_high,
    tcg_market,
    tcgplayer_url,
    quantity = 1,
    printingId,
    collector_number
  } = card

  const editionDisplay = getEditionDisplayName(edition)
  const foilingInfo    = getFoilingInfo(foiling)

  const renderPriceLine = (price: number | undefined, label: string, isLow = false) => {
    const hasPrice = typeof price === 'number'
    const totalValue = hasPrice ? price * quantity : 0
    return (
      <div className={`${isLow && hasPrice ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-gray-600 dark:text-gray-400'} text-xs`}>
        <div className="flex justify-between items-center">
          <span className="text-gray-500 dark:text-gray-300">{label}:</span>
          <span className={!hasPrice ? 'text-gray-400 dark:text-gray-500' : undefined}>
            {!hasPrice
              ? 'N/A'
              : quantity > 1
                ? `$${price.toFixed(2)} × ${quantity} = $${totalValue.toFixed(2)}`
                : `$${price.toFixed(2)}`}
          </span>
        </div>
      </div>
    )
  }

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

  return (
    <div
      className={cn(
        "w-full sm:w-[200px] h-full min-w-0 rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all hover:shadow-xl hover:-translate-y-1 flex-shrink-0 flex flex-col",
        isSelected ? "shadow-lg bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500" : "shadow-md",
        isSelected && selectedQty >= maxQty && "opacity-70"
      )}
    >
      {/* Image Section */}
      <div className="relative w-full aspect-[5/7] bg-gray-50 dark:bg-gray-800 overflow-hidden flex items-center justify-center p-2">
        <FoilCardImage
          foiling={foiling}
          artStyle={[
            card.is_extended_art && 'extended-art',
            (card.art_variations?.includes('AA') || card.art_variations?.includes('AB')) && 'alternate-art',
            card.art_variations?.includes('AB') && 'alternate-border',
            card.art_variations?.includes('FA') && 'full-art',
          ].filter((s): s is string => Boolean(s))}
          foilInset={card.foil_inset_bottom != null ? {
            top: card.foil_inset_top,
            right: card.foil_inset_right,
            bottom: card.foil_inset_bottom,
            left: card.foil_inset_left,
            round: card.foil_inset_round,
          } : null}
          src={getImageUrl()}
          alt={display_name}
          className={cn(
            "w-full h-full",
            onSelect && (editable || card.forTrade) && "cursor-pointer",
            onSelect && !editable && !card.forTrade && "cursor-not-allowed"
          )}
          imgClassName={cn(
            "max-w-full max-h-full object-contain transition-opacity",
            !editable && !card.forTrade && "opacity-50"
          )}
          onClick={handleImageClick}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/cardback.webp" }}
        />

        {/* Overlays — sit above the foil layers */}
        {!editable && !card.forTrade && (
          <div className="absolute top-2 right-2 bg-red-600/90 text-white text-sm px-2 py-1 rounded font-semibold shadow-lg" style={{ zIndex: 10 }}>
            Not For Trade
          </div>
        )}

        {(quantity > 1 || !editable) && (
          <div className="absolute top-2 left-2 bg-black/80 text-white text-sm px-3 py-1.5 rounded-full font-bold pointer-events-none" style={{ zIndex: 10 }}>
            {quantity}x
          </div>
        )}

        {showFeedback && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-red-600/95 text-white text-xs px-3 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-none" style={{ zIndex: 10 }}>
            This card is not available for trade
          </div>
        )}

        {isSelected && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 10 }}>
            <div className="bg-black/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg border-2 border-white shadow-lg">
              <div className="text-center">
                <div className="text-2xl font-bold">{selectedQty || 1}</div>
                <div className="text-sm font-medium opacity-90">Selected</div>
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

        <div className="flex-1"></div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {collector_number && <span className="font-mono uppercase tracking-wide text-blue-600 dark:text-blue-400">{collector_number}</span>}
              {editionDisplay && <span className="text-gray-500 dark:text-gray-300 uppercase">• {editionDisplay}</span>}
            </div>
            {card.forTrade && (
              <div className="font-semibold text-green-600 dark:text-green-400">For Trade</div>
            )}
          </div>

          {type_text_display && <div className="text-xs text-gray-500 dark:text-gray-300 truncate">{type_text_display}</div>}

          {!compactMode && (
            <div className="space-y-1">
              {renderPriceLine(tcg_market, "Market")}
              {renderPriceLine(tcg_high, "High")}
              {renderPriceLine(tcg_mid, "Mid")}
              {renderPriceLine(tcg_low, "Low", true)}
              {renderPurchaseLink()}
            </div>
          )}

          {card.notes && <div className="text-xs text-gray-600 dark:text-gray-300 italic truncate">{card.notes}</div>}

          <div className="flex items-center gap-2">
            {rarity && <RarityIcon rarityCode={rarity} size="sm" />}
            {foiling && (
              <button
                onClick={(e) => { e.stopPropagation(); if (editable && onOpenPrintingSwap) onOpenPrintingSwap(card) }}
                className={`text-sm px-2 py-0.5 rounded-full text-center flex-1 transition-all no-select focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${foilingInfo.className} ${editable && onOpenPrintingSwap ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
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
              <span className={`text-xs font-medium ${card.forTrade ? 'text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-300'}`}>For Trade</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-2">
            {editable && (
              <div className="flex items-center gap-1">
                <button onClick={(e) => { e.stopPropagation(); onQuantityDecrease(card.id || card._id) }} disabled={quantity <= 1} className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 flex items-center justify-center no-select focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                  <Minus className="w-3 h-3" />
                </button>
                <div className="text-center text-sm font-medium">{quantity}</div>
                <button onClick={(e) => { e.stopPropagation(); onQuantityIncrease(card.id || card._id) }} className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 flex items-center justify-center no-select focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {editable && (
            <div className="flex gap-1">
              {printingId && (
                <Link href={`/printing/${printingId}`} onClick={(e) => e.stopPropagation()} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 no-select focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" title="View Printing Details">
                  <ExternalLink className="w-4 h-4 text-blue-500 hover:text-blue-600" />
                </Link>
              )}
              <button onClick={(e) => { e.stopPropagation(); onEdit(card) }} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 no-select focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                <Edit3 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onRemove(card.id || card._id) }} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900 text-red-500 dark:text-red-400 no-select focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
