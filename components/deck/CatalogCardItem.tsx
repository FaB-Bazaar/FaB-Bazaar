"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { RarityIcon } from "@/components/shared/RarityIcon"
import { FoilingBadge } from "@/components/deck/FoilingBadge"
import { KeywordBadge } from "@/components/deck/KeywordBadge"
import { Plus, Maximize2, X } from "lucide-react"

interface CatalogCardItemProps {
  card: any
  onAddCard: (cardUniqueId: string, cardName: string) => Promise<void>
  isAddingCard: boolean
  isExpanded: boolean
  onExpand: () => void
  onCollapse: () => void
}

export default function CatalogCardItem({
  card,
  onAddCard,
  isAddingCard,
  isExpanded,
  onExpand,
  onCollapse
}: CatalogCardItemProps) {
  const [imageError, setImageError] = useState(false)
  const [cardPosition, setCardPosition] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  const handleAddCard = () => {
    if (!isAddingCard) {
      onAddCard(card.card_unique_id, card.name)
    }
  }

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect()
      // Add extra pixels to account for border and ring
      const extraPadding = 6 // 3px on each side
      // Add 5% extra width (2.5% on each side)
      const widthIncrease = rect.width * 0.05
      setCardPosition({
        x: rect.left - extraPadding - (widthIncrease / 2),
        y: rect.top - extraPadding,
        width: rect.width + (extraPadding * 2) + widthIncrease,
        height: rect.height + (extraPadding * 2)
      })
    }
    onExpand()
  }

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    onCollapse()
  }

  // Map foiling codes to human-readable names
  const getFoilingName = (foiling: string) => {
    const foilingMap: Record<string, string> = {
      'S': 'Standard',
      'R': 'Rainbow Foil',
      'C': 'Cold Foil',
      'G': 'Gold Cold Foil',
      'M': 'Marvel',
      'N': 'None'
    }
    return foilingMap[foiling] || foiling || 'Standard'
  }

  // Map edition codes to human-readable names
  const getEditionName = (edition: string) => {
    const editionMap: Record<string, string> = {
      'N': 'Normal',
      'F': '1st',
      'U': 'Unl',
      'A': '1st', // Alpha is treated as 1st edition
      'P': 'Promo'
    }
    return editionMap[edition] || edition || 'Normal'
  }

  return (
    <>
      <div
        ref={cardRef}
        className="group relative cursor-pointer transition-all duration-200"
        onClick={handleAddCard}
      >
        {/* Card Image Container */}
        <div className="relative aspect-[63/88] overflow-hidden rounded-lg border-2 border-gray-300 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all">
        {/* Card Image */}
        {!imageError && card.image_url ? (
          <Image
            src={card.image_url}
            alt={card.display_name || card.name}
            fill
            className="object-cover"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-100 dark:bg-gray-800">
            <p className="text-xs text-center p-2 text-muted-foreground">
              {card.name}
            </p>
          </div>
        )}

        {/* Price Badge (Top-Left) */}
        {card.tcg_low > 0 && (
          <div className="absolute top-2 left-2 bg-black/70 text-white rounded px-2 py-0.5 text-xs font-semibold">
            ${card.tcg_low.toFixed(2)}
          </div>
        )}

        {/* Expand Icon (Top-Right) */}
        <button
          className="absolute top-2 right-2 bg-black/70 hover:bg-black/90 text-white rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleExpand}
          aria-label="Expand card"
        >
          <Maximize2 className="h-3 w-3" />
        </button>

        {/* Rarity Icon (Bottom-Right) */}
        <div className="absolute bottom-2 right-2">
          <RarityIcon rarityCode={card.rarity} size="sm" />
        </div>

        {/* Foiling Badge (Bottom-Left) - Only show for RF/CF/GCF */}
        {card.printing_data?.foiling &&
         ['R', 'C', 'G'].includes(card.printing_data.foiling) && (
          <div className="absolute bottom-2 left-2 z-10">
            <FoilingBadge foiling={card.printing_data.foiling} size="sm" />
          </div>
        )}
      </div>

      {/* Card Name */}
      <div className="mt-2 px-1">
        <p className="text-xs font-medium truncate" title={card.display_name || card.name}>
          {card.display_name || card.name}
        </p>
        {/* Collector Number & Edition */}
        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
          {card.collector_number || 'N/A'} • {getEditionName(card.edition)}
        </p>
        {/* Keywords */}
        {card.keywords && card.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {card.keywords.slice(0, 3).map((kw: string) => (
              <KeywordBadge key={kw} keyword={kw} size="sm" />
            ))}
          </div>
        )}
      </div>
    </div>

    {/* Fixed Overlay Card on Click - Rendered outside grid constraints */}
    {isExpanded && (
      <div
        className="fixed z-[100] transition-all duration-200 cursor-pointer"
        style={{
          left: `${cardPosition.x}px`,
          top: `${cardPosition.y}px`,
          width: `${cardPosition.width}px`,
          height: `${cardPosition.height}px`,
          transform: 'scale(2)',
          transformOrigin: 'top left'
        }}
        onClick={handleAddCard}
      >
        <div className="relative w-full h-full overflow-hidden rounded-lg border-2 border-blue-500 shadow-2xl ring-2 ring-blue-500/50">
          {/* Close Button (Top-Right) */}
          <button
            className="absolute top-2 right-2 bg-black/80 hover:bg-black text-white rounded-full p-1.5 z-10"
            onClick={handleClose}
            aria-label="Close expanded view"
          >
            <X className="h-4 w-4" />
          </button>
          {/* Card Image */}
          {!imageError && card.image_url ? (
            <Image
              src={card.image_url}
              alt={card.display_name || card.name}
              fill
              className="object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-100 dark:bg-gray-800">
              <p className="text-xs text-center p-2 text-muted-foreground">
                {card.name}
              </p>
            </div>
          )}

          {/* Compact Info Overlay - Bottom Left */}
          <div className="absolute bottom-2 left-2 flex flex-col gap-1">
            <div className="bg-black/80 backdrop-blur-sm text-white rounded px-2 py-0.5 text-[10px] font-semibold">
              {card.collector_number || 'N/A'} • {getEditionName(card.edition)}
            </div>
            {card.printing_data?.foiling && card.printing_data.foiling !== 'S' && card.printing_data.foiling !== 'N' && (
              <FoilingBadge foiling={card.printing_data.foiling} size="sm" />
            )}
          </div>

          {/* Price Badge (Top-Left) */}
          {card.tcg_low > 0 && (
            <div className="absolute top-2 left-2 bg-black/70 text-white rounded px-2 py-0.5 text-xs font-semibold">
              ${card.tcg_low.toFixed(2)}
            </div>
          )}

          {/* Rarity Icon (Bottom-Right) */}
          <div className="absolute bottom-2 right-2">
            <RarityIcon rarityCode={card.rarity} size="sm" />
          </div>
        </div>
      </div>
    )}
  </>
  )
}
