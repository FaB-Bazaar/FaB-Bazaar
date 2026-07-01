"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RarityIcon } from '@/components/shared/RarityIcon'
import { Layers, Plus, Minus, X } from "lucide-react"
import { getSetName, getFoilingName, getEditionName, getVariantStyles } from "@/lib/fab-formatters"
import { cn } from "@/lib/utils"

interface DeckImportResult {
  printingId: string
  quantity: number
  category: 'hero' | 'equipment' | 'maindeck' | 'inventory'
  cardName: string
  printingDetails?: any
}

interface DeckImportCardProps {
  item: DeckImportResult
  index: number
  availablePrintings: any[]
  onQuantityChange: (index: number, newQuantity: number) => void
  onCategoryChange: (index: number, newCategory: 'hero' | 'equipment' | 'maindeck' | 'inventory') => void
  onPrintingChange: (index: number, newPrintingId: string) => void
  onRemove: (index: number) => void
}

const formatPrice = (price: any): string => {
  const num = Number(price)
  if (isNaN(num) || num <= 0) return 'N/A'
  return `$${num.toFixed(2)}`
}

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'hero': return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-700'
    case 'equipment': return 'text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-900/20 dark:border-purple-700'
    case 'maindeck': return 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-700'
    case 'inventory': return 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-700'
    default: return 'text-gray-600 bg-gray-50 border-gray-300 dark:text-gray-400 dark:bg-gray-900/20 dark:border-gray-700'
  }
}

export default function DeckImportCard({
  item,
  index,
  availablePrintings,
  onQuantityChange,
  onCategoryChange,
  onPrintingChange,
  onRemove
}: DeckImportCardProps) {
  const printing = item.printingDetails

  if (!printing) {
    return (
      <div className="flex flex-col rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 shadow-lg p-4">
        <p className="text-sm text-red-500 dark:text-red-400">No printing details available</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => onRemove(index)}>
          Remove Card
        </Button>
      </div>
    )
  }

  const {
    display_name, name, image_url, rarity, foiling,
    set, edition, tcg_low, is_extended_art
  } = printing

  const setCode = (set || '').toUpperCase()

  return (
    <div className="flex flex-col rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 shadow-lg group transition-all">
      <div className="relative aspect-[63/88] w-full bg-gray-100 dark:bg-gray-700">
        <img
          src={image_url || "/cardback.webp"}
          alt={display_name || name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute top-2 left-2">
          <Badge variant="secondary" className="bg-black/80 text-white font-bold pointer-events-none">
            {item.quantity}x
          </Badge>
        </div>
        <div className="absolute top-2 right-2">
          <Badge className={cn("text-xs font-semibold", getCategoryColor(item.category))}>
            {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
          </Badge>
        </div>
      </div>

      <div className="p-3 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <div className="flex justify-between items-start gap-2">
            <h3 className="font-semibold text-sm leading-tight mb-1 truncate text-gray-900 dark:text-gray-100" title={display_name || name}>
              {display_name || name}
            </h3>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 border-t border-b border-gray-300 dark:border-gray-700 py-2 my-2">
            <div className="flex flex-col">
              <span className="font-mono">{setCode}</span>
              <span className="text-gray-800 dark:text-gray-300 font-semibold">{getSetName(set)}</span>
            </div>
            <div className="h-8 border-l border-gray-300 dark:border-gray-700 mx-2"></div>
            <div className="flex flex-col text-right">
              <span className="font-bold text-lg text-green-600 dark:text-green-400">{formatPrice(tcg_low)}</span>
              {formatPrice(tcg_low) !== 'N/A' && <span className="text-[10px] -mt-1 text-green-700 dark:text-green-600">TCG Low</span>}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {/* Printing selector */}
          {availablePrintings.length > 1 ? (
            <Select value={item.printingId} onValueChange={(value) => onPrintingChange(index, value)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono">{getEditionName(edition) || 'Normal'}</span>
                    <RarityIcon rarityCode={rarity} size="sm" />
                    <span>{getFoilingName(foiling, is_extended_art)}</span>
                    {availablePrintings.length > 1 && (
                      <Badge variant="outline" className="ml-auto text-xs">
                        {availablePrintings.length} printings
                      </Badge>
                    )}
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availablePrintings.map((p) => (
                  <SelectItem key={p.printing_id} value={p.printing_id}>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono">{getEditionName(p.edition) || 'Normal'}</span>
                      <RarityIcon rarityCode={p.rarity} size="sm" />
                      <span>{getFoilingName(p.foiling, p.is_extended_art)}</span>
                      <span className="ml-2 text-gray-500">{getSetName(p.set)}</span>
                      {p.tcg_low > 0 && (
                        <span className="ml-auto text-green-600 font-semibold">${p.tcg_low.toFixed(2)}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div
              className={cn(
                "w-full justify-center text-xs h-auto py-1.5 font-semibold",
                "flex items-center gap-2 rounded-md border",
                getVariantStyles(rarity, foiling)
              )}
            >
              <span className="font-mono">{getEditionName(edition) || 'Normal'}</span>
              <RarityIcon rarityCode={rarity} size="sm" />
              <span>{getFoilingName(foiling, is_extended_art)}</span>
            </div>
          )}

          {/* Quantity and category controls */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => onQuantityChange(index, Math.max(1, item.quantity - 1))}
                disabled={item.quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="font-bold text-center w-6 text-gray-900 dark:text-gray-100">{item.quantity}</span>
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => onQuantityChange(index, item.quantity + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Category selector */}
          <Select value={item.category} onValueChange={(value) => onCategoryChange(index, value as any)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hero">Hero</SelectItem>
              <SelectItem value="equipment">Equipment</SelectItem>
              <SelectItem value="maindeck">Main Deck</SelectItem>
              <SelectItem value="inventory">Inventory</SelectItem>
            </SelectContent>
          </Select>

          {/* Remove button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(index)}
            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
          >
            <X className="h-4 w-4 mr-2" />
            Remove
          </Button>
        </div>
      </div>
    </div>
  )
}