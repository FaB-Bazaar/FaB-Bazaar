// components/browse/BulkResultCard.tsx
"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RarityIcon } from '@/components/shared/RarityIcon';
import { Layers, ExternalLink, Plus, Minus, Copy, Trash2, Star, Check, PlusCircle } from "lucide-react";

import { getSetName, getFoilingName, getEditionName, getVariantStyles } from "@/lib/fab-formatters";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const formatPrice = (price: any): string => {
  const num = Number(price);
  if (isNaN(num) || num <= 0) return 'N/A';
  return `$${num.toFixed(2)}`;
};

const getColorDotClass = (color: string) => {
    switch (color) {
      case 'red': return 'bg-red-500';
      case 'yellow': return 'bg-yellow-500';
      case 'blue': return 'bg-blue-500';
      default: return 'bg-gray-400';
    }
  };
  
  interface BulkResultCardProps {
    cardInstance: any; 
    onPrintingView: (instanceId: string) => void; 
    onQuantityChange: (instanceId: string, newQuantity: number) => void;
    onToggleTrade: (instanceId: string) => void;
    onDuplicate: (instanceId: string) => void;
    onRemove: (instanceId: string) => void;
    onToggleStaged: (instanceId: string) => void; 
  }

  export default function BulkResultCard({
  cardInstance, onPrintingView, onQuantityChange, onToggleTrade, onDuplicate, onRemove, onToggleStaged
}: BulkResultCardProps) {
  const { instanceId, selectedPrinting, quantity, forTrade, card_unique_id, isStaged } = cardInstance;
  
  // ✅ Add null check before destructuring
  if (!selectedPrinting) {
    return (
      <div className="flex flex-col rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 shadow-lg p-4">
        <p className="text-sm text-red-500 dark:text-red-400">No matching printing found for the selected filters.</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => onRemove(instanceId)}>
          Remove Card
        </Button>
      </div>
    );
  }
  
  const { 
    display_name, name, image_url, rarity, foiling, 
    set, edition, tcg_low, printing_id, is_extended_art, color
  } = selectedPrinting;

  const setCode = (set || '').toUpperCase();

  return (
    <div className={cn(
      "flex flex-col rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 shadow-lg group transition-all",
      isStaged && "ring-2 ring-blue-500 dark:ring-blue-400"
    )}>
      <div className="relative aspect-[63/88] w-full bg-gray-100 dark:bg-gray-700">
        <img src={image_url || "/cardback.webp"} alt={display_name || name} className="w-full h-full object-cover" loading="lazy" />
        <div className="absolute top-2 left-2">
          <Badge variant="secondary" className="bg-black/80 text-white font-bold pointer-events-none">{quantity}x</Badge>
        </div>
      </div>

      <div className="p-3 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <div className="flex justify-between items-start gap-2">
            <h3 className="font-semibold text-sm leading-tight mb-1 truncate text-gray-900 dark:text-gray-100" title={display_name || name}>
              {display_name || name}
            </h3>
            {color && <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${getColorDotClass(color)}`} title={color.charAt(0).toUpperCase() + color.slice(1)}></div>}
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
            {/* --- THIS IS THE CORRECTED CODE BLOCK --- */}
            <div
                className={cn(
                    "w-full justify-center text-xs h-auto py-1.5 font-semibold transition-opacity", // Base styles
                    "flex items-center gap-2 rounded-md border", // Re-adds button-like structure
                    "cursor-pointer", // Makes it feel interactive
                    getVariantStyles(rarity, foiling) // Your dynamic gradient/color styles
                )}
                onClick={() => onPrintingView(instanceId)}
              >
                <span className="font-mono">{getEditionName(edition) || 'Normal'}</span>
                <RarityIcon rarityCode={rarity} size="sm" />
                <span>{getFoilingName(foiling, is_extended_art)}</span>
                {rarity === 'v' && <Star className="w-3 h-3" />}
                <Layers className="w-3 h-3 opacity-70" />
            </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="h-7 w-7 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => onQuantityChange(instanceId, Math.max(1, quantity - 1))} disabled={quantity <= 1}>
                <Minus className="h-4 w-4" />
              </Button>
              <span className="font-bold text-center w-6 text-gray-900 dark:text-gray-100">{quantity}</span>
              <Button size="icon" variant="outline" className="h-7 w-7 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => onQuantityChange(instanceId, quantity + 1)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id={`trade-${instanceId}`} checked={forTrade} onCheckedChange={() => onToggleTrade(instanceId)} />
              <label htmlFor={`trade-${instanceId}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">For Trade</label>
            </div>
          </div>
          
          <div className="flex items-center gap-2 pt-2 border-t border-gray-300 dark:border-gray-700">
             <Button
                size="sm"
                variant={isStaged ? "default" : "secondary"}
                className={cn(
                  "flex-1 transition-colors",
                  isStaged && "bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600"
                )}
                onClick={() => onToggleStaged(instanceId)}
              >
                {isStaged ? ( <Check className="mr-1.5 h-4 w-4" /> ) : ( <PlusCircle className="mr-1.5 h-4 w-4" /> )}
                {isStaged ? "Staged" : "To Stage"}
             </Button>

             <div className="flex items-center">
                <Button size="icon" variant="ghost" className="h-8 w-8 transition-colors text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700" asChild>
                  <Link href={`/printing/${printing_id}`} target="_blank" title="View Details"><ExternalLink className="h-4 w-4" /></Link>
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 transition-colors text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700" onClick={() => onDuplicate(instanceId)} title="Duplicate Card">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-500 dark:text-red-400 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors" onClick={() => onRemove(instanceId)} title="Remove Card">
                  <Trash2 className="h-4 w-4" />
                </Button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}