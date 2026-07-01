// components/deck/DeckPrintingCard.tsx - Updated for new deck structure
"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { KeywordBadge } from "@/components/deck/KeywordBadge"
import {
  Trash2,
  Plus,
  ArrowUpDown,
  GripVertical,
  ExternalLink
} from "lucide-react"
import { RarityIcon } from '@/components/shared/RarityIcon'
import { cn } from '@/lib/utils'

interface DeckPrinting {
  _id?: string;
  printingId: string;
  quantity?: number;  // ✅ ADDED: Quantity of this printing
  // Removed: category field - now inferred from context
  condition?: string;
  notes?: string;
  addedAt: string;
  isOptimistic?: boolean;
  printingDetails?: { [key: string]: any };
}

interface DeckPrintingCardProps {
  printing: DeckPrinting;
  category: "hero" | "equipment" | "maindeck" | "inventory" | "maybeboard" | "tokens";
  editable: boolean;
  isGrouped?: boolean;
  onRemove: (printing: DeckPrinting) => void;
  onAddAnother?: (printing: DeckPrinting) => void;
  onMove?: (printing: DeckPrinting) => void;
  onOpenPrintingSwap?: (printing: DeckPrinting) => void;
  // Drag and drop props from sortable
  dragAttributes?: any;
  dragListeners?: any;
  isDragging?: boolean;
  // Animation props
  isRemoving?: boolean; // Add this new prop
  isMoving?: boolean; // Add this new prop
}

export default function DeckPrintingCard({
  printing,
  category, // Now received as prop
  editable,
  isGrouped = false,
  onRemove,
  onAddAnother,
  onMove,
  onOpenPrintingSwap,
  dragAttributes,
  dragListeners,
  isDragging,
  isRemoving, // Add this line - you're missing it!
  isMoving
}: DeckPrintingCardProps) {

  // Helper functions from BinderCard
  const getEditionDisplayName = (code?: string) => {
    if (!code) return ""
    const lookupCode = code.toLowerCase()
    const editions: Record<string, string> = {
      a: "Alpha", f: "1st", u: "UNL", n: "",
    }
    if (editions.hasOwnProperty(lookupCode)) {
      return editions[lookupCode]
    }
    return code.toUpperCase()
  }

  const capitalizeTypeText = (text?: string) => {
    if (!text) return ""
    return text.split(' ').map(word => {
      if (word === '//') return word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    }).join(' ')
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

  const getColorDot = (color: string) => {
    const colors = {
      'red': 'bg-red-500',
      'blue': 'bg-blue-500',
      'yellow': 'bg-yellow-500'
    }
    return colors[color] || 'bg-gray-400'
  }

  const getImageUrl = () => {
    return printing.printingDetails?.image_url || "/cardback.webp"
  }

  // Get category color for deck-specific styling - updated category mapping
  const getCategoryColor = (category: string) => {
    const colors = {
      'hero': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'equipment': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'maindeck': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'inventory': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'maybeboard': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      'tokens': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    }
    return colors[category] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  }

  // Get display label for category
  const getCategoryLabel = (category: string) => {
    const labels = {
      'hero': 'Hero',
      'equipment': 'Equipment',
      'maindeck': 'Main Deck',
      'inventory': 'Inventory',
      'maybeboard': 'Maybeboard',
      'tokens': 'Tokens'
    }
    return labels[category] || category
  }

  // Price rendering helper
  const renderPriceLine = (price: number | undefined, label: string, isLow = false) => {
    if (!price || price === "N/A") return null
    const unitPrice = Number(price)
    const tcgPlayerUrl = printing.printingDetails?.tcgplayer_url
    return (
      <div className={`${isLow ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-gray-600 dark:text-gray-400'} text-xs`}>
        <div className="flex justify-between items-center">
          <span className="text-gray-500 dark:text-gray-400">{label}:</span>
          <div className="flex items-center gap-1">
            <span>${unitPrice.toFixed(2)}</span>
            {/* TCGPlayer link - only show on low price line and if URL exists */}
            {isLow && tcgPlayerUrl && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(tcgPlayerUrl, '_blank', 'noopener,noreferrer')
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="View on TCGPlayer"
              >
                <ExternalLink className="w-3 h-3 text-blue-500 hover:text-blue-600" />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Get card data with comprehensive fallbacks
  const rarity = printing.printingDetails?.rarity
  const foiling = printing.printingDetails?.foiling
  const set = printing.printingDetails?.set_id || printing.printingDetails?.set
  const edition = printing.printingDetails?.edition
  const condition = printing.condition || 'NM'
  const color = printing.printingDetails?.color
  const editionDisplay = getEditionDisplayName(edition)
  const typeText = capitalizeTypeText(printing.printingDetails?.type_text)
  const foilingInfo = getFoilingInfo(foiling)

  const prices = {
    low: printing.printingDetails?.tcg_low,
    mid: printing.printingDetails?.tcg_mid,
    high: printing.printingDetails?.tcg_high,
    market: printing.printingDetails?.tcg_market
  }

  const cardName = printing.printingDetails?.display_name || 
                   printing.printingDetails?.name || 
                   `Card ${printing.printingId}`

  return (
    <div
    className={cn(
      "w-full sm:w-[160px] rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 transition-all hover:shadow-lg hover:-translate-y-0.5 flex-shrink-0 flex flex-col",
      // Animation classes for removal
      "transform transition-all duration-300 ease-in-out",
      isDragging ? "opacity-50 shadow-2xl" : "shadow-md",
      // Remove animation - fades out and shrinks
      isRemoving ? "opacity-0 scale-95 translate-y-2" : "opacity-100 scale-100 translate-y-0"
    )}
  >
      {/* Compact Image Section */}
      <div className="relative w-full h-[160px] sm:h-[220px] bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center p-1.5">
        <img
          src={getImageUrl()}
          alt={cardName}
          className="max-w-full max-h-full object-contain rounded"
          loading="lazy"
          onError={(e) => { e.currentTarget.src = "/cardback.webp" }}
        />
        
        {/* Category indicator */}
        <div className="absolute top-2 left-2">
          <div className={cn(
            "text-xs px-2 py-1 rounded-full font-medium",
            getCategoryColor(category)
          )}>
            {getCategoryLabel(category)}
          </div>
        </div>

        {/* Drag handle - only show when draggable */}
        {editable && dragListeners && (
          <div 
            className="absolute top-2 right-2 bg-black/80 text-white p-1 rounded cursor-grab active:cursor-grabbing"
            {...dragAttributes}
            {...dragListeners}
          >
            <GripVertical className="w-3 h-3" />
          </div>
        )}

        {/* Condition indicator */}
        {condition && condition !== 'NM' && (
          <div className="absolute bottom-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded-full font-medium">
            {condition}
          </div>
        )}

        {/* Optimistic indicator */}
        {printing.isOptimistic && (
          <div className="absolute bottom-2 right-2 bg-blue-600/95 text-white text-xs px-2 py-1 rounded-full font-medium animate-pulse shadow-lg">
            Saving...
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 flex-1 flex flex-col">
        {/* Card Name - Anchored to top */}
        <div className="font-semibold text-xs leading-tight mb-1.5">
          {cardName}
        </div>

        {/* Flexible whitespace */}
        <div className="flex-1"></div>

        {/* Bottom section - All info anchored to bottom */}
        <div className="space-y-2">
          {/* Set, Edition and Color */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {set && <span className="font-mono uppercase tracking-wide text-gray-500 dark:text-gray-400">{set}</span>}
              {editionDisplay && (
                <>
                  <span className="text-gray-400 dark:text-gray-500">•</span>
                  <span className="text-gray-500 dark:text-gray-400 uppercase">{editionDisplay}</span>
                </>
              )}
            </div>
            {color && (
              <span className={`w-3 h-3 rounded-full ${getColorDot(color)}`}></span>
            )}
          </div>

          {/* Type */}
          {typeText && (
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {typeText}
            </div>
          )}

          {/* Keywords */}
          {printing.printingDetails?.keywords && printing.printingDetails.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {printing.printingDetails.keywords.slice(0, 3).map((kw: string, i: number) => (
                <KeywordBadge key={`kw-${i}`} keyword={kw} size="sm" />
              ))}
            </div>
          )}

          {/* Price Section - Only show if in individual mode or if space allows */}
          {!isGrouped && (
            <div className="space-y-1">
              {Object.values(prices).some(p => p && p !== "N/A") && (
                <>
                  {renderPriceLine(prices.market, "Market")}
                  {renderPriceLine(prices.low, "Low", true)}
                </>
              )}
            </div>
          )}

          {/* Notes if present */}
          {printing.notes && (
            <div className="text-xs text-gray-600 dark:text-gray-400 italic truncate">
              {printing.notes}
            </div>
          )}

          {/* Badges - Rarity icon and Foiling side by side */}
          <div className="flex items-center gap-2">
            {/* Rarity Icon */}
            {rarity && (
              <RarityIcon 
                rarityCode={rarity} 
                size="sm" 
              />
            )}
            
            {/* Foiling Badge - Clickable for printing swap */}
            {foiling && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (editable && onOpenPrintingSwap) {
                    onOpenPrintingSwap(printing)
                  }
                }}
                className={`text-xs px-2 py-0.5 rounded-full text-center flex-1 transition-all ${foilingInfo.className} ${
                  editable && onOpenPrintingSwap
                    ? 'hover:opacity-80 hover:scale-105 cursor-pointer hover:shadow-md' 
                    : 'cursor-default'
                }`}
                disabled={!editable || !onOpenPrintingSwap}
                title={
                  editable && onOpenPrintingSwap 
                    ? "Click to change printing" 
                    : foilingInfo.name
                }
              >
                {foilingInfo.name}
              </button>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-300 dark:border-gray-600">
          <div className="flex gap-1">
            {editable && (
              <>
                {onAddAnother && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      onAddAnother(printing)
                    }}
                    className="p-1 rounded hover:bg-green-50 dark:hover:bg-green-900 text-green-500 dark:text-green-400"
                    title="Add another copy"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}

                {/* Updated move button logic for new categories */}
                {onMove && (category === 'maindeck' || category === 'inventory' || category === 'equipment') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!isMoving) onMove(printing)
                    }}
                    disabled={isMoving}
                    className={cn(
                      "p-1 rounded text-blue-500 dark:text-blue-400 transition-colors",
                      isMoving
                        ? "opacity-50 cursor-not-allowed animate-pulse"
                        : "hover:bg-blue-50 dark:hover:bg-blue-900"
                    )}
                    title={isMoving ? "Moving..." : `Move to ${
                      category === 'maindeck' ? 'inventory' :
                      category === 'equipment' ? 'inventory' :
                      'main deck'
                    }`}
                  >
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
          
          {editable && (
            <button 
              onClick={(e) => {
                e.stopPropagation()
                onRemove(printing)
              }}
              disabled={isRemoving}
              className={cn(
                "p-1 rounded hover:bg-red-50 dark:hover:bg-red-900 text-red-500 dark:text-red-400 transition-colors",
                isRemoving && "opacity-50 cursor-not-allowed animate-pulse"
              )}
              title={isRemoving ? "Removing..." : "Remove from deck"}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
// // components/deck/DeckPrintingCard.tsx - Enhanced with BinderCard styling
// "use client"

// import React from "react"
// import { Button } from "@/components/ui/button"
// import { Badge } from "@/components/ui/badge"
// import { 
//   Edit3, 
//   Trash2, 
//   Plus, 
//   ArrowUpDown,
//   GripVertical,
//   ExternalLink 
// } from "lucide-react"
// import { RarityIcon } from '@/components/shared/RarityIcon'
// import { cn } from '@/lib/utils'

// interface DeckPrinting {
//   _id?: string;
//   printingId: string;
//   category: "hero" | "equipment" | "main" | "inventory";
//   condition?: string;
//   notes?: string;
//   addedAt: string;
//   isOptimistic?: boolean;
//   printingDetails?: { [key: string]: any };
// }

// interface DeckPrintingCardProps {
//   printing: DeckPrinting;
//   editable: boolean;
//   isGrouped?: boolean;
//   onEdit: (printing: DeckPrinting) => void;
//   onRemove: (printing: DeckPrinting) => void;
//   onAddAnother?: (printing: DeckPrinting) => void;
//   onMove?: (printing: DeckPrinting) => void;
//   onOpenPrintingSwap?: (printing: DeckPrinting) => void;
//   // Drag and drop props from sortable
//   dragAttributes?: any;
//   dragListeners?: any;
//   isDragging?: boolean;
// }

// export default function DeckPrintingCard({
//   printing,
//   editable,
//   isGrouped = false,
//   onEdit,
//   onRemove,
//   onAddAnother,
//   onMove,
//   onOpenPrintingSwap,
//   dragAttributes,
//   dragListeners,
//   isDragging
// }: DeckPrintingCardProps) {

//   // Helper functions from BinderCard
//   const getEditionDisplayName = (code?: string) => {
//     if (!code) return ""
//     const lookupCode = code.toLowerCase()
//     const editions: Record<string, string> = {
//       a: "Alpha", f: "1st", u: "UNL", n: "",
//     }
//     if (editions.hasOwnProperty(lookupCode)) {
//       return editions[lookupCode]
//     }
//     return code.toUpperCase()
//   }

//   const capitalizeTypeText = (text?: string) => {
//     if (!text) return ""
//     return text.split(' ').map(word => {
//       if (word === '//') return word
//       return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
//     }).join(' ')
//   }

//   const getFoilingInfo = (foiling: string) => {
//     const foilingMap = {
//       'R': { name: 'Rainbow Foil', className: 'bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 text-white' },
//       'C': { name: 'Cold Foil', className: 'bg-blue-600 text-white' },
//       'G': { name: 'Gold Foil', className: 'bg-yellow-500 text-black' },
//       'S': { name: 'Non-foil', className: 'bg-gray-500 text-white' }
//     }
//     const code = foiling?.toUpperCase()
//     return foilingMap[code] || { name: 'Non-foil', className: 'bg-gray-500 text-white' }
//   }

//   const getColorDot = (color: string) => {
//     const colors = {
//       'red': 'bg-red-500',
//       'blue': 'bg-blue-500',
//       'yellow': 'bg-yellow-500'
//     }
//     return colors[color] || 'bg-gray-400'
//   }

//   const getImageUrl = () => {
//     return printing.printingDetails?.image_url || "/cardback.webp"
//   }

//   // Get category color for deck-specific styling
//   const getCategoryColor = (category: string) => {
//     const colors = {
//       'hero': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
//       'equipment': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
//       'main': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
//       'sideboard': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
//     }
//     return colors[category] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
//   }

//   // Price rendering helper
//   const renderPriceLine = (price: number | undefined, label: string, isLow = false) => {
//     if (!price || price === "N/A") return null
//     const unitPrice = Number(price)
//     const tcgPlayerUrl = printing.printingDetails?.tcgplayer_url
//     return (
//       <div className={`${isLow ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-gray-600 dark:text-gray-400'} text-xs`}>
//         <div className="flex justify-between items-center">
//           <span className="text-gray-500 dark:text-gray-400">{label}:</span>
//           <div className="flex items-center gap-1">
//             <span>${unitPrice.toFixed(2)}</span>
//             {/* TCGPlayer link - only show on low price line and if URL exists */}
//             {isLow && tcgPlayerUrl && (
//               <button
//                 onClick={(e) => {
//                   e.stopPropagation()
//                   window.open(tcgPlayerUrl, '_blank', 'noopener,noreferrer')
//                 }}
//                 className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
//                 title="View on TCGPlayer"
//               >
//                 <ExternalLink className="w-3 h-3 text-blue-500 hover:text-blue-600" />
//               </button>
//             )}
//           </div>
//         </div>
//       </div>
//     )
//   }

//   // Get card data with comprehensive fallbacks
//   const rarity = printing.printingDetails?.rarity
//   const foiling = printing.printingDetails?.foiling
//   const set = printing.printingDetails?.set_id || printing.printingDetails?.set
//   const edition = printing.printingDetails?.edition
//   const condition = printing.condition || 'NM'
//   const color = printing.printingDetails?.color
//   const editionDisplay = getEditionDisplayName(edition)
//   const typeText = capitalizeTypeText(printing.printingDetails?.type_text)
//   const foilingInfo = getFoilingInfo(foiling)

//   const prices = {
//     low: printing.printingDetails?.tcg_low,
//     mid: printing.printingDetails?.tcg_mid,
//     high: printing.printingDetails?.tcg_high,
//     market: printing.printingDetails?.tcg_market
//   }

//   const cardName = printing.printingDetails?.display_name || 
//                    printing.printingDetails?.name || 
//                    `Card ${printing.printingId}`

//   return (
//     <div
//       className={cn(
//         "w-full sm:w-[200px] rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 transition-all hover:shadow-xl hover:-translate-y-1 flex-shrink-0 flex flex-col",
//         isDragging ? "opacity-50 shadow-2xl" : "shadow-md"
//       )}
//     >
//       {/* Large Image Section */}
//       <div className="relative w-full h-[200px] sm:h-[280px] bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center p-2">
//         <img
//           src={getImageUrl()}
//           alt={cardName}
//           className="max-w-full max-h-full object-contain rounded"
//           loading="lazy"
//           onError={(e) => { e.currentTarget.src = "/cardback.webp" }}
//         />
        
//         {/* Category indicator */}
//         <div className="absolute top-2 left-2">
//           <div className={cn(
//             "text-xs px-2 py-1 rounded-full font-medium capitalize",
//             getCategoryColor(printing.category)
//           )}>
//             {printing.category}
//           </div>
//         </div>

//         {/* Drag handle - only show when draggable */}
//         {editable && dragListeners && (
//           <div 
//             className="absolute top-2 right-2 bg-black/80 text-white p-1 rounded cursor-grab active:cursor-grabbing"
//             {...dragAttributes}
//             {...dragListeners}
//           >
//             <GripVertical className="w-3 h-3" />
//           </div>
//         )}

//         {/* Condition indicator */}
//         {condition && condition !== 'NM' && (
//           <div className="absolute bottom-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded-full font-medium">
//             {condition}
//           </div>
//         )}

//         {/* Optimistic indicator */}
//         {printing.isOptimistic && (
//           <div className="absolute bottom-2 right-2 bg-yellow-600/90 text-white text-xs px-2 py-1 rounded-full font-medium">
//             Saving...
//           </div>
//         )}
//       </div>

//       {/* Info Section */}
//       <div className="p-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 flex-1 flex flex-col">
//         {/* Card Name - Anchored to top */}
//         <div className="font-semibold text-sm leading-tight mb-2">
//           {cardName}
//         </div>

//         {/* Flexible whitespace */}
//         <div className="flex-1"></div>

//         {/* Bottom section - All info anchored to bottom */}
//         <div className="space-y-2">
//           {/* Set, Edition and Color */}
//           <div className="flex items-center justify-between text-xs">
//             <div className="flex items-center gap-2">
//               {set && <span className="font-mono uppercase tracking-wide text-gray-500 dark:text-gray-400">{set}</span>}
//               {editionDisplay && (
//                 <>
//                   <span className="text-gray-400 dark:text-gray-500">•</span>
//                   <span className="text-gray-500 dark:text-gray-400 uppercase">{editionDisplay}</span>
//                 </>
//               )}
//             </div>
//             {color && (
//               <span className={`w-3 h-3 rounded-full ${getColorDot(color)}`}></span>
//             )}
//           </div>

//           {/* Type */}
//           {typeText && (
//             <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
//               {typeText}
//             </div>
//           )}

//           {/* Price Section - Only show if in individual mode or if space allows */}
//           {!isGrouped && (
//             <div className="space-y-1">
//               {Object.values(prices).some(p => p && p !== "N/A") && (
//                 <>
//                   {renderPriceLine(prices.market, "Market")}
//                   {renderPriceLine(prices.low, "Low", true)}
//                 </>
//               )}
//             </div>
//           )}

//           {/* Notes if present */}
//           {printing.notes && (
//             <div className="text-xs text-gray-600 dark:text-gray-400 italic truncate">
//               {printing.notes}
//             </div>
//           )}

//           {/* Badges - Rarity icon and Foiling side by side */}
//           <div className="flex items-center gap-2">
//             {/* Rarity Icon */}
//             {rarity && (
//               <RarityIcon 
//                 rarityCode={rarity} 
//                 size="sm" 
//               />
//             )}
            
//             {/* Foiling Badge - Clickable for printing swap */}
//             {foiling && (
//               <button
//                 onClick={(e) => {
//                   e.preventDefault()
//                   e.stopPropagation()
//                   if (editable && onOpenPrintingSwap) {
//                     onOpenPrintingSwap(printing)
//                   }
//                 }}
//                 className={`text-xs px-2 py-0.5 rounded-full text-center flex-1 transition-all ${foilingInfo.className} ${
//                   editable && onOpenPrintingSwap
//                     ? 'hover:opacity-80 hover:scale-105 cursor-pointer hover:shadow-md' 
//                     : 'cursor-default'
//                 }`}
//                 disabled={!editable || !onOpenPrintingSwap}
//                 title={
//                   editable && onOpenPrintingSwap 
//                     ? "Click to change printing" 
//                     : foilingInfo.name
//                 }
//               >
//                 {foilingInfo.name}
//               </button>
//             )}
//           </div>
//         </div>

//         {/* Action Buttons */}
//         <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-300 dark:border-gray-600">
//           <div className="flex gap-1">
//             {editable && (
//               <>
//                 <button 
//                   onClick={(e) => {
//                     e.stopPropagation()
//                     onEdit(printing)
//                   }}
//                   className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
//                   title="Edit printing"
//                 >
//                   <Edit3 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
//                 </button>
                
//                 {onAddAnother && (
//                   <button 
//                     onClick={(e) => {
//                       e.stopPropagation()
//                       onAddAnother(printing)
//                     }}
//                     className="p-1 rounded hover:bg-green-50 dark:hover:bg-green-900 text-green-500 dark:text-green-400"
//                     title="Add another copy"
//                   >
//                     <Plus className="w-4 h-4" />
//                   </button>
//                 )}

//                 {onMove && (printing.category === 'main' || printing.category === 'sideboard') && (
//                   <button 
//                     onClick={(e) => {
//                       e.stopPropagation()
//                       onMove(printing)
//                     }}
//                     className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900 text-blue-500 dark:text-blue-400"
//                     title={`Move to ${printing.category === 'main' ? 'sideboard' : 'main deck'}`}
//                   >
//                     <ArrowUpDown className="w-4 h-4" />
//                   </button>
//                 )}
//               </>
//             )}
//           </div>
          
//           {editable && (
//             <button 
//               onClick={(e) => {
//                 e.stopPropagation()
//                 onRemove(printing)
//               }}
//               className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900 text-red-500 dark:text-red-400"
//               title="Remove from deck"
//             >
//               <Trash2 className="w-4 h-4" />
//             </button>
//           )}
//         </div>
//       </div>
//     </div>
//   )
// }
// // // components/deck/DeckPrintingCard.tsx - Updated to work with dnd-kit
// // "use client"

// // import React from "react"
// // import { Button } from "@/components/ui/button"
// // import { Badge } from "@/components/ui/badge"
// // import { Edit3, Trash2, ArrowUpDown, Copy, GripVertical } from "lucide-react"
// // import { RarityIcon } from '@/components/shared/RarityIcon'
// // import { cn } from '@/lib/utils'

// // interface DeckPrintingCardProps {
// //   printing: {
// //     _id?: string;
// //     printingId: string;
// //     category: 'hero' | 'equipment' | 'main' | 'sideboard';
// //     condition?: string;
// //     notes?: string;
// //     addedAt: string;
// //     printingDetails?: {
// //       printing_id?: string;
// //       unique_id?: string;
// //       name: string;
// //       display_name: string;
// //       card_unique_id: string;
// //       set_name?: string;
// //       set?: string;
// //       set_id?: string;
// //       edition?: string;
// //       foiling?: string;
// //       color?: string;
// //       type_text?: string;
// //       cost?: number;
// //       power?: number;
// //       defense?: number;
// //       pitch?: number;
// //       tcg_market?: number;
// //       tcg_low?: number;
// //       tcg_mid?: number;
// //       tcg_high?: number;
// //       rarity?: string;
// //       image_url?: string;
// //       [key: string]: any;
// //     };
// //   };
// //   editable: boolean;
// //   compactMode?: boolean;
// //   isGrouped?: boolean; // When shown in a card group vs standalone
// //   showCategoryBadge?: boolean; // Show category for ungrouped views
// //   onEdit?: (printing: any) => void;
// //   onRemove?: (printing: any) => void;
// //   onSwapPrinting?: (printing: any) => void; // Swap to different printing
// //   onMove?: (printing: any) => void; // Move between main/sideboard
// //   onAddAnother?: (printing: any) => void; // Add another copy of same printing
// //   toast?: (opts: { title: string; description: string; variant?: "default" | "destructive" | null }) => void;
  
// //   // DND-KIT: Add new optional props to receive attributes and listeners from the parent
// //   dragAttributes?: Record<string, any>;
// //   dragListeners?: Record<string, any>;
// //   isDragging?: boolean; // Optional prop to handle dragging state from parent
// // }

// // export default function DeckPrintingCard({ 
// //   printing, 
// //   editable, 
// //   compactMode = false,
// //   isGrouped = false,
// //   showCategoryBadge = false,
// //   onEdit, 
// //   onRemove, 
// //   onSwapPrinting,
// //   onMove,
// //   onAddAnother,
// //   toast,
// //   // DND-KIT: Destructure the new props
// //   dragAttributes,
// //   dragListeners,
// //   isDragging = false
// // }: DeckPrintingCardProps) {
  
// //   // Helper function to get edition display name
// //   const getEditionDisplayName = (code?: string) => {
// //     if (!code) return ""
// //     const lookupCode = code.toLowerCase()
// //     const editions: Record<string, string> = {
// //       a: "Alpha",
// //       f: "1st", 
// //       u: "UNL",
// //       n: "", // Normal edition returns empty
// //     }
    
// //     if (editions.hasOwnProperty(lookupCode)) {
// //       return editions[lookupCode]
// //     }
// //     return code.toUpperCase()
// //   }

// //   // Helper function to capitalize type text
// //   const capitalizeTypeText = (text?: string) => {
// //     if (!text) return ""
// //     return text
// //       .split(' ')
// //       .map(word => {
// //         if (word === '//') return word
// //         return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
// //       })
// //       .join(' ')
// //   }

// //   // Helper functions for display
// //   const getFoilingInfo = (foiling?: string) => {
// //     const foilingMap = {
// //       'R': { name: 'Rainbow', className: 'bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 text-white' },
// //       'C': { name: 'Cold', className: 'bg-blue-600 text-white' },
// //       'G': { name: 'Gold', className: 'bg-yellow-500 text-black' },
// //       'S': { name: 'Normal', className: 'bg-gray-500 text-white' }
// //     }
// //     const code = foiling?.toUpperCase()
// //     return foilingMap[code as keyof typeof foilingMap] || { name: 'Normal', className: 'bg-gray-500 text-white' }
// //   }

// //   const getColorDot = (color?: string) => {
// //     if (!color) return 'bg-gray-400'
// //     const colors = {
// //       'red': 'bg-red-500',
// //       'blue': 'bg-blue-500',
// //       'yellow': 'bg-yellow-500'
// //     }
// //     return colors[color as keyof typeof colors] || 'bg-gray-400'
// //   }

// //   const getCategoryColor = (category: string) => {
// //     const colors = {
// //       'hero': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
// //       'equipment': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
// //       'main': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
// //       'sideboard': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
// //     }
// //     return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
// //   }

// //   // Get image URL with comprehensive fallbacks
// //   const getImageUrl = () => {
// //     return printing.printingDetails?.image_url || "/cardback.webp"
// //   }

// //   // Get card data with comprehensive fallbacks and null checks
// //   const details = printing.printingDetails
// //   const cardName = details?.display_name || details?.name || `Card ${printing.printingId}` || 'Unknown Card'
// //   const rarity = details?.rarity
// //   const foiling = details?.foiling
// //   const set = details?.set_id || details?.set
// //   const edition = details?.edition
// //   const condition = printing.condition || 'NM'
// //   const color = details?.color
// //   const editionDisplay = getEditionDisplayName(edition)
// //   const typeText = capitalizeTypeText(details?.type_text)
// //   const foilingInfo = getFoilingInfo(foiling)

// //   // Check if this card can be moved between main/sideboard
// //   const canMove = (printing.category === 'main' || printing.category === 'sideboard') && onMove;
  
// //   // Check if another copy can be added (basic limit check)
// //   const canAddAnother = editable && onAddAnother && 
// //     (printing.category !== 'hero' && printing.category !== 'equipment'); // No multiples for hero/equipment

// //   // Deck-specific sizing - more compact when grouped
// //   const cardWidth = isGrouped ? "w-[160px]" : "w-full sm:w-[180px]"
// //   const imageHeight = isGrouped ? "h-[140px]" : "h-[160px] sm:h-[200px]"

// //   return (
// //     <div
// //       className={cn(
// //         "rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 transition-all hover:shadow-lg hover:-translate-y-1 flex-shrink-0 flex flex-col relative",
// //         cardWidth,
// //         "shadow-md",
// //         isDragging && "opacity-50", // DND-KIT: Use the isDragging prop from parent
// //         canMove && "hover:border-blue-400 dark:hover:border-blue-500"
// //       )}
// //     >
// //       {/* Drag Handle */}
// //         {canMove && (
// //         <div
// //             className="absolute top-2 right-2 z-10 opacity-60 hover:opacity-100 cursor-grab active:cursor-grabbing"
// //             // DND-KIT: Apply listeners and attributes passed down from parent
// //             {...dragListeners}
// //             {...{
// //             ...dragAttributes,
// //             draggable: dragAttributes?.draggable ? 'true' : undefined, // ✅ Fix for React warning
// //             }}
// //         >
// //             <GripVertical className="h-4 w-4 text-gray-500 dark:text-gray-400" />
// //         </div>
// //         )}


// //       {/* Image Section */}
// //       <div className={cn("relative bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center p-2", imageHeight)}>
// //         <img
// //           src={getImageUrl()}
// //           alt={cardName}
// //           className="max-w-full max-h-full object-contain rounded"
// //           loading="lazy"
// //           onError={(e) => { e.currentTarget.src = "/cardback.webp" }}
// //         />
        
// //         {/* Category badge for ungrouped views */}
// //         {showCategoryBadge && (
// //           <div className="absolute top-2 left-2">
// //             <Badge className={cn("text-xs", getCategoryColor(printing.category))}>
// //               {printing.category}
// //             </Badge>
// //           </div>
// //         )}
        
// //         {/* Condition indicator */}
// //         {condition && condition !== 'NM' && (
// //           <div className="absolute top-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded-full font-medium">
// //             {condition}
// //           </div>
// //         )}
// //       </div>

// //       {/* Info Section */}
// //       <div className="p-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 flex-1 flex flex-col">
// //         {/* Card Name - Only show if not grouped (grouped view shows name in header) */}
// //         {!isGrouped && (
// //           <div className="font-semibold text-sm leading-tight mb-2">
// //             {cardName}
// //           </div>
// //         )}

// //         {/* Flexible whitespace */}
// //         <div className="flex-1"></div>

// //         {/* Bottom section */}
// //         <div className="space-y-2">
// //           {/* Set, Edition and Color */}
// //           <div className="flex items-center justify-between text-xs">
// //             <div className="flex items-center gap-2">
// //               {set && <span className="font-mono uppercase tracking-wide text-gray-500 dark:text-gray-400">{set}</span>}
// //               {editionDisplay && (
// //                 <>
// //                   <span className="text-gray-400 dark:text-gray-500">•</span>
// //                   <span className="text-gray-500 dark:text-gray-400 uppercase">{editionDisplay}</span>
// //                 </>
// //               )}
// //             </div>
// //             {color && (
// //               <span className={`w-3 h-3 rounded-full ${getColorDot(color)}`}></span>
// //             )}
// //           </div>

// //           {/* Card Stats - More prominent in deck view */}
// //           {(details?.cost !== undefined || details?.power || details?.defense) && (
// //             <div className="flex items-center justify-center gap-3 text-sm bg-gray-50 dark:bg-gray-700 rounded px-2 py-1">
// //               {details?.cost !== undefined && (
// //                 <span className="font-medium">
// //                   <span className="text-gray-500 dark:text-gray-400">C:</span> {details.cost}
// //                 </span>
// //               )}
// //               {details?.power && (
// //                 <span className="font-medium text-red-600 dark:text-red-400">
// //                   <span className="text-gray-500 dark:text-gray-400">P:</span> {details.power}
// //                 </span>
// //               )}
// //               {details?.defense && (
// //                 <span className="font-medium text-blue-600 dark:text-blue-400">
// //                   <span className="text-gray-500 dark:text-gray-400">D:</span> {details.defense}
// //                 </span>
// //               )}
// //               {details?.pitch && (
// //                 <span className="font-medium text-yellow-600 dark:text-yellow-400">
// //                   <span className="text-gray-500 dark:text-gray-400">Pt:</span> {details.pitch}
// //                 </span>
// //               )}
// //             </div>
// //           )}

// //           {/* Type - more compact in deck view */}
// //           {typeText && !compactMode && (
// //             <div className="text-xs text-gray-500 dark:text-gray-400 text-center truncate">
// //               {typeText}
// //             </div>
// //           )}

// //           {/* Price - only show if not compact */}
// //           {!compactMode && details?.tcg_market && (
// //             <div className="text-center">
// //               <div className="text-sm font-semibold text-green-600 dark:text-green-400">
// //                 ${details.tcg_market.toFixed(2)}
// //               </div>
// //             </div>
// //           )}

// //           {/* Notes if present */}
// //           {printing.notes && (
// //             <div className="text-xs text-gray-600 dark:text-gray-400 italic truncate">
// //               {printing.notes}
// //             </div>
// //           )}

// //           {/* Badges - Rarity and Foiling */}
// //           <div className="flex items-center gap-2">
// //             {/* Rarity Icon */}
// //             {rarity && (
// //               <RarityIcon 
// //                 rarityCode={rarity} 
// //                 size="sm" 
// //               />
// //             )}
            
// //             {/* Foiling Badge */}
// //             {foiling && (
// //               <button
// //                 onClick={(e) => {
// //                   e.preventDefault()
// //                   e.stopPropagation()
// //                   if (editable && onSwapPrinting) {
// //                     onSwapPrinting(printing)
// //                   }
// //                 }}
// //                 className={`text-xs px-2 py-0.5 rounded-full text-center flex-1 transition-all ${foilingInfo.className} ${
// //                   editable && onSwapPrinting
// //                     ? 'hover:opacity-80 hover:scale-105 cursor-pointer hover:shadow-md' 
// //                     : 'cursor-default'
// //                 }`}
// //                 disabled={!editable || !onSwapPrinting}
// //                 title={editable && onSwapPrinting ? "Click to swap printing" : undefined}
// //               >
// //                 {foilingInfo.name}
// //               </button>
// //             )}
// //           </div>
// //         </div>
        
// //         {/* Actions Section */}
// //         {editable && (
// //           <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-300 dark:border-gray-600">
// //             {/* Move between main/sideboard */}
// //             {canMove && (
// //               <Button
// //                 size="sm"
// //                 variant="ghost"
// //                 onClick={(e) => {
// //                   e.stopPropagation()
// //                   onMove(printing)
// //                 }}
// //                 className="text-xs px-2 py-1"
// //                 title={printing.category === 'main' ? 'Move to sideboard' : 'Move to main deck'}
// //               >
// //                 <ArrowUpDown className="w-3 h-3 mr-1" />
// //                 {printing.category === 'main' ? 'SB' : 'Main'}
// //               </Button>
// //             )}
            
// //             <div className="flex gap-1 ml-auto">
// //               {/* Copy Button - Add another of the same printing */}
// //               {canAddAnother && (
// //                 <button 
// //                   onClick={(e) => {
// //                     e.stopPropagation()
// //                     if (onAddAnother) onAddAnother(printing)
// //                   }}
// //                   className="p-1 rounded hover:bg-green-50 dark:hover:bg-green-900 text-green-600 dark:text-green-400"
// //                   title="Add another copy"
// //                 >
// //                   <Copy className="w-4 h-4" />
// //                 </button>
// //               )}
              
// //               <button 
// //                 onClick={(e) => {
// //                   e.stopPropagation()
// //                   if (onEdit) onEdit(printing)
// //                 }}
// //                 className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
// //                 title="Edit card"
// //               >
// //                 <Edit3 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
// //               </button>
// //               <button 
// //                 onClick={(e) => {
// //                   e.stopPropagation()
// //                   if (onRemove) onRemove(printing)
// //                 }}
// //                 className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900 text-red-500 dark:text-red-400"
// //                 title="Remove from deck"
// //               >
// //                 <Trash2 className="w-4 h-4" />
// //               </button>
// //             </div>
// //           </div>
// //         )}
// //       </div>
// //     </div>
// //   )
// // }
// // // // components/deck/DeckPrintingCard.tsx - Updated with copy button and drag-and-drop
// // // "use client"

// // // import React, { useState } from "react"
// // // import { Button } from "@/components/ui/button"
// // // import { Badge } from "@/components/ui/badge"
// // // import { Edit3, Trash2, ArrowUpDown, Copy, GripVertical } from "lucide-react"
// // // import { RarityIcon } from '@/components/shared/RarityIcon'
// // // import { cn } from '@/lib/utils'

// // // interface DeckPrintingCardProps {
// // //   printing: {
// // //     _id?: string;
// // //     printingId: string;
// // //     category: 'hero' | 'equipment' | 'main' | 'sideboard';
// // //     condition?: string;
// // //     notes?: string;
// // //     addedAt: string;
// // //     printingDetails?: {
// // //       printing_id?: string;
// // //       unique_id?: string;
// // //       name: string;
// // //       display_name: string;
// // //       card_unique_id: string;
// // //       set_name?: string;
// // //       set?: string;
// // //       set_id?: string;
// // //       edition?: string;
// // //       foiling?: string;
// // //       color?: string;
// // //       type_text?: string;
// // //       cost?: number;
// // //       power?: number;
// // //       defense?: number;
// // //       pitch?: number;
// // //       tcg_market?: number;
// // //       tcg_low?: number;
// // //       tcg_mid?: number;
// // //       tcg_high?: number;
// // //       rarity?: string;
// // //       image_url?: string;
// // //       [key: string]: any;
// // //     };
// // //   };
// // //   editable: boolean;
// // //   compactMode?: boolean;
// // //   isGrouped?: boolean; // When shown in a card group vs standalone
// // //   showCategoryBadge?: boolean; // Show category for ungrouped views
// // //   onEdit?: (printing: any) => void;
// // //   onRemove?: (printing: any) => void;
// // //   onSwapPrinting?: (printing: any) => void; // Swap to different printing
// // //   onMove?: (printing: any) => void; // Move between main/sideboard
// // //   onAddAnother?: (printing: any) => void; // Add another copy of same printing
// // //   toast?: (opts: { title: string; description: string; variant?: "default" | "destructive" | null }) => void;
// // // }

// // // export default function DeckPrintingCard({ 
// // //   printing, 
// // //   editable, 
// // //   compactMode = false,
// // //   isGrouped = false,
// // //   showCategoryBadge = false,
// // //   onEdit, 
// // //   onRemove, 
// // //   onSwapPrinting,
// // //   onMove,
// // //   onAddAnother,
// // //   toast
// // // }: DeckPrintingCardProps) {
  
// // //   const [isDragging, setIsDragging] = useState(false);
  
// // //   // Helper function to get edition display name
// // //   const getEditionDisplayName = (code?: string) => {
// // //     if (!code) return ""
// // //     const lookupCode = code.toLowerCase()
// // //     const editions: Record<string, string> = {
// // //       a: "Alpha",
// // //       f: "1st", 
// // //       u: "UNL",
// // //       n: "", // Normal edition returns empty
// // //     }
    
// // //     if (editions.hasOwnProperty(lookupCode)) {
// // //       return editions[lookupCode]
// // //     }
// // //     return code.toUpperCase()
// // //   }

// // //   // Helper function to capitalize type text
// // //   const capitalizeTypeText = (text?: string) => {
// // //     if (!text) return ""
// // //     return text
// // //       .split(' ')
// // //       .map(word => {
// // //         if (word === '//') return word
// // //         return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
// // //       })
// // //       .join(' ')
// // //   }

// // //   // Helper functions for display
// // //   const getFoilingInfo = (foiling?: string) => {
// // //     const foilingMap = {
// // //       'R': { name: 'Rainbow', className: 'bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 text-white' },
// // //       'C': { name: 'Cold', className: 'bg-blue-600 text-white' },
// // //       'G': { name: 'Gold', className: 'bg-yellow-500 text-black' },
// // //       'S': { name: 'Normal', className: 'bg-gray-500 text-white' }
// // //     }
// // //     const code = foiling?.toUpperCase()
// // //     return foilingMap[code as keyof typeof foilingMap] || { name: 'Normal', className: 'bg-gray-500 text-white' }
// // //   }

// // //   const getColorDot = (color?: string) => {
// // //     if (!color) return 'bg-gray-400'
// // //     const colors = {
// // //       'red': 'bg-red-500',
// // //       'blue': 'bg-blue-500',
// // //       'yellow': 'bg-yellow-500'
// // //     }
// // //     return colors[color as keyof typeof colors] || 'bg-gray-400'
// // //   }

// // //   const getCategoryColor = (category: string) => {
// // //     const colors = {
// // //       'hero': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
// // //       'equipment': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
// // //       'main': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
// // //       'sideboard': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
// // //     }
// // //     return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
// // //   }

// // //   // Get image URL with comprehensive fallbacks
// // //   const getImageUrl = () => {
// // //     return printing.printingDetails?.image_url || "/cardback.webp"
// // //   }

// // //   // Get card data with comprehensive fallbacks and null checks
// // //   const details = printing.printingDetails
// // //   const cardName = details?.display_name || details?.name || `Card ${printing.printingId}` || 'Unknown Card'
// // //   const rarity = details?.rarity
// // //   const foiling = details?.foiling
// // //   const set = details?.set_id || details?.set
// // //   const edition = details?.edition
// // //   const condition = printing.condition || 'NM'
// // //   const color = details?.color
// // //   const editionDisplay = getEditionDisplayName(edition)
// // //   const typeText = capitalizeTypeText(details?.type_text)
// // //   const foilingInfo = getFoilingInfo(foiling)

// // //   // Check if this card can be moved between main/sideboard
// // //   const canMove = (printing.category === 'main' || printing.category === 'sideboard') && onMove;
  
// // //   // Check if another copy can be added (basic limit check)
// // //   const canAddAnother = editable && onAddAnother && 
// // //     (printing.category !== 'hero' && printing.category !== 'equipment'); // No multiples for hero/equipment

// // //   // Deck-specific sizing - more compact when grouped
// // //   const cardWidth = isGrouped ? "w-[160px]" : "w-full sm:w-[180px]"
// // //   const imageHeight = isGrouped ? "h-[140px]" : "h-[160px] sm:h-[200px]"

// // //   // Handle drag start
// // //   const handleDragStart = (e: React.DragEvent) => {
// // //     if (!canMove) {
// // //       e.preventDefault();
// // //       return;
// // //     }
    
// // //     setIsDragging(true);
// // //     e.dataTransfer.setData('application/json', JSON.stringify({
// // //       type: 'deck-printing',
// // //       printing: printing
// // //     }));
// // //     e.dataTransfer.effectAllowed = 'move';
// // //   };

// // //   // Handle drag end
// // //   const handleDragEnd = () => {
// // //     setIsDragging(false);
// // //   };

// // //   // Handle drop
// // //   const handleDrop = (e: React.DragEvent) => {
// // //     e.preventDefault();
    
// // //     try {
// // //       const data = JSON.parse(e.dataTransfer.getData('application/json'));
// // //       if (data.type === 'deck-printing' && data.printing && onMove) {
// // //         const draggedPrinting = data.printing;
// // //         if ((draggedPrinting.category === 'main' || draggedPrinting.category === 'sideboard') &&
// // //             (printing.category === 'main' || printing.category === 'sideboard') &&
// // //             draggedPrinting.category !== printing.category) {
// // //           onMove(draggedPrinting);
// // //         }
// // //       }
// // //     } catch (error) {
// // //       console.error('Error handling drop:', error);
// // //     }
// // //   };

// // //   // Handle drag over
// // //   const handleDragOver = (e: React.DragEvent) => {
// // //     if (canMove) {
// // //       e.preventDefault();
// // //       e.dataTransfer.dropEffect = 'move';
// // //     }
// // //   };

// // //   return (
// // //     <div
// // //       className={cn(
// // //         "rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 transition-all hover:shadow-lg hover:-translate-y-1 flex-shrink-0 flex flex-col relative",
// // //         cardWidth,
// // //         "shadow-md",
// // //         isDragging && "opacity-50",
// // //         canMove && "hover:border-blue-400 dark:hover:border-blue-500"
// // //       )}
// // //       draggable={canMove}
// // //       onDragStart={handleDragStart}
// // //       onDragEnd={handleDragEnd}
// // //       onDrop={handleDrop}
// // //       onDragOver={handleDragOver}
// // //     >
// // //       {/* Drag Handle */}
// // //       {canMove && (
// // //         <div 
// // //           className="absolute top-2 right-2 z-10 opacity-60 hover:opacity-100 cursor-grab active:cursor-grabbing"
// // //           onMouseDown={(e) => e.stopPropagation()}
// // //         >
// // //           <GripVertical className="h-4 w-4 text-gray-500 dark:text-gray-400" />
// // //         </div>
// // //       )}

// // //       {/* Image Section */}
// // //       <div className={cn("relative bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center p-2", imageHeight)}>
// // //         <img
// // //           src={getImageUrl()}
// // //           alt={cardName}
// // //           className="max-w-full max-h-full object-contain rounded"
// // //           loading="lazy"
// // //           onError={(e) => { e.currentTarget.src = "/cardback.webp" }}
// // //         />
        
// // //         {/* Category badge for ungrouped views */}
// // //         {showCategoryBadge && (
// // //           <div className="absolute top-2 left-2">
// // //             <Badge className={cn("text-xs", getCategoryColor(printing.category))}>
// // //               {printing.category}
// // //             </Badge>
// // //           </div>
// // //         )}
        
// // //         {/* Condition indicator */}
// // //         {condition && condition !== 'NM' && (
// // //           <div className="absolute top-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded-full font-medium">
// // //             {condition}
// // //           </div>
// // //         )}
// // //       </div>

// // //       {/* Info Section */}
// // //       <div className="p-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 flex-1 flex flex-col">
// // //         {/* Card Name - Only show if not grouped (grouped view shows name in header) */}
// // //         {!isGrouped && (
// // //           <div className="font-semibold text-sm leading-tight mb-2">
// // //             {cardName}
// // //           </div>
// // //         )}

// // //         {/* Flexible whitespace */}
// // //         <div className="flex-1"></div>

// // //         {/* Bottom section */}
// // //         <div className="space-y-2">
// // //           {/* Set, Edition and Color */}
// // //           <div className="flex items-center justify-between text-xs">
// // //             <div className="flex items-center gap-2">
// // //               {set && <span className="font-mono uppercase tracking-wide text-gray-500 dark:text-gray-400">{set}</span>}
// // //               {editionDisplay && (
// // //                 <>
// // //                   <span className="text-gray-400 dark:text-gray-500">•</span>
// // //                   <span className="text-gray-500 dark:text-gray-400 uppercase">{editionDisplay}</span>
// // //                 </>
// // //               )}
// // //             </div>
// // //             {color && (
// // //               <span className={`w-3 h-3 rounded-full ${getColorDot(color)}`}></span>
// // //             )}
// // //           </div>

// // //           {/* Card Stats - More prominent in deck view */}
// // //           {(details?.cost !== undefined || details?.power || details?.defense) && (
// // //             <div className="flex items-center justify-center gap-3 text-sm bg-gray-50 dark:bg-gray-700 rounded px-2 py-1">
// // //               {details?.cost !== undefined && (
// // //                 <span className="font-medium">
// // //                   <span className="text-gray-500 dark:text-gray-400">C:</span> {details.cost}
// // //                 </span>
// // //               )}
// // //               {details?.power && (
// // //                 <span className="font-medium text-red-600 dark:text-red-400">
// // //                   <span className="text-gray-500 dark:text-gray-400">P:</span> {details.power}
// // //                 </span>
// // //               )}
// // //               {details?.defense && (
// // //                 <span className="font-medium text-blue-600 dark:text-blue-400">
// // //                   <span className="text-gray-500 dark:text-gray-400">D:</span> {details.defense}
// // //                 </span>
// // //               )}
// // //               {details?.pitch && (
// // //                 <span className="font-medium text-yellow-600 dark:text-yellow-400">
// // //                   <span className="text-gray-500 dark:text-gray-400">Pt:</span> {details.pitch}
// // //                 </span>
// // //               )}
// // //             </div>
// // //           )}

// // //           {/* Type - more compact in deck view */}
// // //           {typeText && !compactMode && (
// // //             <div className="text-xs text-gray-500 dark:text-gray-400 text-center truncate">
// // //               {typeText}
// // //             </div>
// // //           )}

// // //           {/* Price - only show if not compact */}
// // //           {!compactMode && details?.tcg_market && (
// // //             <div className="text-center">
// // //               <div className="text-sm font-semibold text-green-600 dark:text-green-400">
// // //                 ${details.tcg_market.toFixed(2)}
// // //               </div>
// // //             </div>
// // //           )}

// // //           {/* Notes if present */}
// // //           {printing.notes && (
// // //             <div className="text-xs text-gray-600 dark:text-gray-400 italic truncate">
// // //               {printing.notes}
// // //             </div>
// // //           )}

// // //           {/* Badges - Rarity and Foiling */}
// // //           <div className="flex items-center gap-2">
// // //             {/* Rarity Icon */}
// // //             {rarity && (
// // //               <RarityIcon 
// // //                 rarityCode={rarity} 
// // //                 size="sm" 
// // //               />
// // //             )}
            
// // //             {/* Foiling Badge */}
// // //             {foiling && (
// // //               <button
// // //                 onClick={(e) => {
// // //                   e.preventDefault()
// // //                   e.stopPropagation()
// // //                   if (editable && onSwapPrinting) {
// // //                     onSwapPrinting(printing)
// // //                   }
// // //                 }}
// // //                 className={`text-xs px-2 py-0.5 rounded-full text-center flex-1 transition-all ${foilingInfo.className} ${
// // //                   editable && onSwapPrinting
// // //                     ? 'hover:opacity-80 hover:scale-105 cursor-pointer hover:shadow-md' 
// // //                     : 'cursor-default'
// // //                 }`}
// // //                 disabled={!editable || !onSwapPrinting}
// // //                 title={editable && onSwapPrinting ? "Click to swap printing" : undefined}
// // //               >
// // //                 {foilingInfo.name}
// // //               </button>
// // //             )}
// // //           </div>
// // //         </div>
        
// // //         {/* Actions Section */}
// // //         {editable && (
// // //           <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-300 dark:border-gray-600">
// // //             {/* Move between main/sideboard */}
// // //             {canMove && (
// // //               <Button
// // //                 size="sm"
// // //                 variant="ghost"
// // //                 onClick={(e) => {
// // //                   e.stopPropagation()
// // //                   onMove(printing)
// // //                 }}
// // //                 className="text-xs px-2 py-1"
// // //                 title={printing.category === 'main' ? 'Move to sideboard' : 'Move to main deck'}
// // //               >
// // //                 <ArrowUpDown className="w-3 h-3 mr-1" />
// // //                 {printing.category === 'main' ? 'SB' : 'Main'}
// // //               </Button>
// // //             )}
            
// // //             <div className="flex gap-1 ml-auto">
// // //               {/* Copy Button - Add another of the same printing */}
// // //               {canAddAnother && (
// // //                 <button 
// // //                   onClick={(e) => {
// // //                     e.stopPropagation()
// // //                     if (onAddAnother) onAddAnother(printing)
// // //                   }}
// // //                   className="p-1 rounded hover:bg-green-50 dark:hover:bg-green-900 text-green-600 dark:text-green-400"
// // //                   title="Add another copy"
// // //                 >
// // //                   <Copy className="w-4 h-4" />
// // //                 </button>
// // //               )}
              
// // //               <button 
// // //                 onClick={(e) => {
// // //                   e.stopPropagation()
// // //                   if (onEdit) onEdit(printing)
// // //                 }}
// // //                 className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
// // //                 title="Edit card"
// // //               >
// // //                 <Edit3 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
// // //               </button>
// // //               <button 
// // //                 onClick={(e) => {
// // //                   e.stopPropagation()
// // //                   if (onRemove) onRemove(printing)
// // //                 }}
// // //                 className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900 text-red-500 dark:text-red-400"
// // //                 title="Remove from deck"
// // //               >
// // //                 <Trash2 className="w-4 h-4" />
// // //               </button>
// // //             </div>
// // //           </div>
// // //         )}
// // //       </div>
// // //     </div>
// // //   )
// // // }


// // // i was told to update this, but i don't thin it's the full code, it needs to keep the other existing functionality and only update the drag part using the new Library, can you update?

// // // // components/deck/DeckPrintingCard.tsx - Updated to work with dnd-kit
// // // "use client"

// // // import React from "react"
// // // import { Button } from "@/components/ui/button"
// // // import { Badge } from "@/components/ui/badge"
// // // // DND-KIT: Replaced GripVertical with Move for the drag handle icon
// // // import { Edit3, Trash2, ArrowUpDown, Copy, Move } from "lucide-react"
// // // import { RarityIcon } from '@/components/shared/RarityIcon'
// // // import { cn } from '@/lib/utils'

// // // interface DeckPrintingCardProps {
// // //   printing: {
// // //     _id?: string;
// // //     printingId: string;
// // //     category: 'hero' | 'equipment' | 'main' | 'sideboard';
// // //     condition?: string;
// // //     notes?: string;
// // //     addedAt: string;
// // //     printingDetails?: {
// // //       [key: string]: any;
// // //     };
// // //   };
// // //   editable: boolean;
// // //   compactMode?: boolean;
// // //   isGrouped?: boolean;
// // //   showCategoryBadge?: boolean;
// // //   onEdit?: (printing: any) => void;
// // //   onRemove?: (printing: any) => void;
// // //   onSwapPrinting?: (printing: any) => void;
// // //   onMove?: (printing: any) => void;
// // //   onAddAnother?: (printing: any) => void;
// // //   toast?: (opts: any) => void;
  
// // //   // DND-KIT: Add new optional props to receive attributes and listeners from the parent
// // //   dragAttributes?: Record<string, any>;
// // //   dragListeners?: Record<string, any>;
// // // }

// // // export default function DeckPrintingCard({ 
// // //   printing, 
// // //   editable, 
// // //   compactMode = false,
// // //   isGrouped = false,
// // //   showCategoryBadge = false,
// // //   onEdit, 
// // //   onRemove, 
// // //   onSwapPrinting,
// // //   onMove,
// // //   onAddAnother,
// // //   toast,
// // //   // DND-KIT: Destructure the new props
// // //   dragAttributes,
// // //   dragListeners
// // // }: DeckPrintingCardProps) {
  
// // //   // DND-KIT: REMOVED the isDragging state. dnd-kit handles this externally.
// // //   // const [isDragging, setIsDragging] = useState(false);
  
// // //   // All your helper functions remain unchanged
// // //   const getEditionDisplayName = (code?: string) => { /* ... */ };
// // //   const capitalizeTypeText = (text?: string) => { /* ... */ };
// // //   const getFoilingInfo = (foiling?: string) => { /* ... */ };
// // //   const getColorDot = (color?: string) => { /* ... */ };
// // //   const getCategoryColor = (category: string) => { /* ... */ };
// // //   const getImageUrl = () => printing.printingDetails?.image_url || "/cardback.webp";

// // //   // All your data constants remain unchanged
// // //   const details = printing.printingDetails;
// // //   const cardName = details?.display_name || details?.name || `Card ${printing.printingId}` || 'Unknown Card';
// // //   const rarity = details?.rarity;
// // //   const foiling = details?.foiling;
// // //   const set = details?.set_id || details?.set;
// // //   const edition = details?.edition;
// // //   const condition = printing.condition || 'NM';
// // //   const color = details?.color;
// // //   const editionDisplay = getEditionDisplayName(edition);
// // //   const typeText = capitalizeTypeText(details?.type_text);
// // //   const foilingInfo = getFoilingInfo(foiling);

// // //   // All your conditional checks remain unchanged
// // //   const canMove = (printing.category === 'main' || printing.category === 'sideboard') && onMove;
// // //   const canAddAnother = editable && onAddAnother && (printing.category !== 'hero' && printing.category !== 'equipment');
// // //   const cardWidth = isGrouped ? "w-[160px]" : "w-full sm:w-[180px]";
// // //   const imageHeight = isGrouped ? "h-[140px]" : "h-[160px] sm:h-[200px]";

// // //   // DND-KIT: REMOVED all native drag-and-drop handler functions
// // //   // (handleDragStart, handleDragEnd, handleDrop, handleDragOver)

// // //   return (
// // //     // DND-KIT: REMOVED draggable, onDragStart, onDragEnd, onDrop, and onDragOver props.
// // //     // Also removed the isDragging class, as the parent wrapper will handle the opacity change.
// // //     <div
// // //       className={cn(
// // //         "rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 transition-all hover:shadow-lg hover:-translate-y-1 flex-shrink-0 flex flex-col relative",
// // //         cardWidth,
// // //         "shadow-md",
// // //         canMove && "hover:border-blue-400 dark:hover:border-blue-500"
// // //       )}
// // //     >
// // //       {/* Drag Handle */}
// // //       {canMove && (
// // //         <div 
// // //           className="absolute top-2 right-2 z-10 p-1 rounded-full bg-black/50 hover:bg-black/75 cursor-grab active:cursor-grabbing"
// // //           // DND-KIT: Apply the listeners and attributes passed down from the SortablePrintingCard wrapper.
// // //           // This makes ONLY this specific icon the drag handle.
// // //           {...dragAttributes}
// // //           {...dragListeners}
// // //         >
// // //           <Move className="h-4 w-4 text-white" />
// // //         </div>
// // //       )}

// // //       {/* Image Section (No changes here) */}
// // //       <div className={cn("relative bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center p-2", imageHeight)}>
// // //         <img
// // //           src={getImageUrl()}
// // //           alt={cardName}
// // //           className="max-w-full max-h-full object-contain rounded"
// // //           loading="lazy"
// // //           onError={(e) => { e.currentTarget.src = "/cardback.webp" }}
// // //         />
// // //         {showCategoryBadge && (<div className="absolute top-2 left-2"><Badge className={cn("text-xs", getCategoryColor(printing.category))}>{printing.category}</Badge></div>)}
// // //         {condition && condition !== 'NM' && (<div className="absolute top-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded-full font-medium">{condition}</div>)}
// // //       </div>

// // //       {/* Info Section (No changes here) */}
// // //       <div className="p-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 flex-1 flex flex-col">
// // //         {!isGrouped && (<div className="font-semibold text-sm leading-tight mb-2">{cardName}</div>)}
// // //         <div className="flex-1"></div>
// // //         <div className="space-y-2">{/* ... All your info, stats, and badges ... */}</div>
        
// // //         {/* Actions Section (No changes here) */}
// // //         {editable && (
// // //           <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-300 dark:border-gray-600">
// // //             {canMove && (
// // //               <Button
// // //                 size="sm"
// // //                 variant="ghost"
// // //                 onClick={(e) => { e.stopPropagation(); if(onMove) onMove(printing); }}
// // //                 className="text-xs px-2 py-1"
// // //                 title={printing.category === 'main' ? 'Move to sideboard' : 'Move to main deck'}
// // //               >
// // //                 <ArrowUpDown className="w-3 h-3 mr-1" />
// // //                 {printing.category === 'main' ? 'SB' : 'Main'}
// // //               </Button>
// // //             )}
            
// // //             <div className="flex gap-1 ml-auto">
// // //               {canAddAnother && ( <button onClick={(e) => { e.stopPropagation(); if (onAddAnother) onAddAnother(printing); }} className="p-1 rounded hover:bg-green-50 dark:hover:bg-green-900 text-green-600 dark:text-green-400" title="Add another copy"><Copy className="w-4 h-4" /></button>)}
// // //               <button onClick={(e) => { e.stopPropagation(); if (onEdit) onEdit(printing); }} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Edit card"><Edit3 className="w-4 h-4 text-gray-500 dark:text-gray-400" /></button>
// // //               <button onClick={(e) => { e.stopPropagation(); if (onRemove) onRemove(printing); }} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900 text-red-500 dark:text-red-400" title="Remove from deck"><Trash2 className="w-4 h-4" /></button>
// // //             </div>
// // //           </div>
// // //         )}
// // //       </div>
// // //     </div>
// // //   )
// // // }