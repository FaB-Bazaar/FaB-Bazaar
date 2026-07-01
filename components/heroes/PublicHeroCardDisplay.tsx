//components/heroes/PublicHeroCardDisplay.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { RarityIcon } from '@/components/shared/RarityIcon';
import { Layers, Star } from "lucide-react";
import { getSetName, getFoilingName, getEditionName, getVariantStyles } from "@/lib/fab-formatters";
import { cn } from "@/lib/utils";
import ViewPrintingsDialog from '@/components/dialogs/cards/view-printings-dialog';
import { TcgAffiliateLink } from '@/components/tracking';

const formatPrice = (price?: number): string => {
  if (typeof price !== 'number' || price <= 0) return 'N/A';
  return `$${price.toFixed(2)}`;
};

const getColorDotClass = (color?: string) => {
  switch (color) {
    case 'red': return 'bg-red-500';
    case 'yellow': return 'bg-yellow-500';
    case 'blue': return 'bg-blue-500';
    default: return 'bg-gray-400';
  }
};

interface PublicHeroCardDisplayProps {
  card: any;
  variant?: 'full' | 'carousel';
  enablePrintingDialog?: boolean;
  onFoilBadgeClick?: () => void;
}

export default function PublicHeroCardDisplay({ 
  card, 
  variant = 'full', 
  enablePrintingDialog = false,
  onFoilBadgeClick 
}: PublicHeroCardDisplayProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentCard, setCurrentCard] = useState(card);
  
  if (!card) return null;

  const { 
    name, display_name, image_url, rarity, foiling, set, edition,
    tcg_low, printing_id, is_extended_art, color, tcgplayer_url
  } = currentCard;

  const setCode = (set || '').toUpperCase();

  const handleSelectPrinting = (newPrinting: any) => {
    setCurrentCard(newPrinting);
    setDialogOpen(false);
  };

  const handleFoilBadgeClick = () => {
    if (onFoilBadgeClick) {
      onFoilBadgeClick(); // Use the passed handler first
    } else if (enablePrintingDialog) {
      setDialogOpen(true);
    }
  };

  // Carousel variant - simplified for carousel display
  if (variant === 'carousel') {
    return (
      <>
        <div className="flex flex-col rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 shadow-lg group transition-all hover:shadow-xl hover:-translate-y-1 max-w-[200px]">
          <Link href={`/printing/${printing_id}`} className="block">
            <div className="relative aspect-[63/88] w-full bg-gray-100 dark:bg-gray-700">
              <img src={image_url || "/cardback.webp"} alt={display_name} className="w-full h-full object-cover" loading="lazy" />
            </div>
          </Link>
          
          <div className="p-2 space-y-2">
            <h3 className="font-semibold text-xs leading-tight truncate">{display_name}</h3>
            
            {/* Foiling badge - clickable if dialog is enabled */}
            {enablePrintingDialog ? (
              <button
                onClick={handleFoilBadgeClick}
                className={cn(
                  "text-xs px-2 py-1 rounded text-center transition-all hover:opacity-80 cursor-pointer w-full",
                  getVariantStyles(rarity, foiling)
                )}
              >
                {getFoilingName(foiling, is_extended_art)}
              </button>
            ) : (
              <div className={cn(
                "text-xs px-2 py-1 rounded text-center",
                getVariantStyles(rarity, foiling)
              )}>
                {getFoilingName(foiling, is_extended_art)}
              </div>
            )}
            
            {/* Replace Price with Affiliate Link */}
            {tcg_low && tcgplayer_url ? (
              <TcgAffiliateLink
                tcgplayerUrl={tcgplayer_url}
                feature="CarouselCardPrice"
                className="flex items-center justify-center gap-1 text-sm text-white font-bold bg-green-600 hover:bg-green-700 transition-colors py-1.5 px-3 rounded w-full"
                title="Purchase on TCGPlayer"
              >
                <span>{formatPrice(tcg_low)}</span>
                <img 
                  src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
                  alt="TCGPlayer"
                  className="h-3 w-auto"
                />
              </TcgAffiliateLink>
            ) : tcg_low ? (
              <div className="text-center">
                <span className="text-sm font-bold text-green-500">{formatPrice(tcg_low)}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* ViewPrintings Dialog */}
        {enablePrintingDialog && (
          <ViewPrintingsDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            cardName={display_name || name}
            cardUniqueId={currentCard.card_unique_id || currentCard.collector_number}
            onSelectPrinting={handleSelectPrinting}
          />
        )}
      </>
    );
  }

  // Full variant - your original full card display
  return (
    <>
      <div className="flex flex-col rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 shadow-lg group transition-all hover:shadow-xl hover:-translate-y-1">
        <Link href={`/printing/${printing_id}`} className="block">
          <div className="relative aspect-[63/88] w-full bg-gray-100 dark:bg-gray-700">
            <img src={image_url || "/cardback.webp"} alt={display_name} className="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
          </div>
        </Link>

        <div className="p-3 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start gap-2">
              <h3 className="font-semibold text-sm leading-tight mb-1 truncate text-gray-900 dark:text-gray-100" title={display_name}>
                {display_name}
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

          <div className="space-y-3 pt-2">
            {/* Foiling badge - clickable if dialog is enabled, otherwise link */}
            {enablePrintingDialog ? (
              <button
                onClick={handleFoilBadgeClick}
                className={cn(
                  "w-full justify-center text-xs h-auto py-1.5 font-semibold transition-opacity hover:opacity-80",
                  "flex items-center gap-2 rounded-md border cursor-pointer",
                  getVariantStyles(rarity, foiling)
                )}
              >
                <span className="font-mono">{getEditionName(edition) || 'Normal'}</span>
                <RarityIcon rarityCode={rarity} size="sm" />
                <span>{getFoilingName(foiling, is_extended_art)}</span>
                {rarity === 'v' && <Star className="w-3 h-3" />}
                <Layers className="w-3 h-3 opacity-70" />
              </button>
            ) : (
              <Link
                href={`/printing/${printing_id}`}
                className={cn(
                    "w-full justify-center text-xs h-auto py-1.5 font-semibold transition-opacity",
                    "flex items-center gap-2 rounded-md border",
                    getVariantStyles(rarity, foiling)
                )}
              >
                <span className="font-mono">{getEditionName(edition) || 'Normal'}</span>
                <RarityIcon rarityCode={rarity} size="sm" />
                <span>{getFoilingName(foiling, is_extended_art)}</span>
                {rarity === 'v' && <Star className="w-3 h-3" />}
                <Layers className="w-3 h-3 opacity-70" />
              </Link>
            )}

            {/* Replace basic link with TcgAffiliateLink */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-300 dark:border-gray-700">
              {tcgplayer_url ? (
                <TcgAffiliateLink
                  tcgplayerUrl={tcgplayer_url}
                  feature="FullCardPrice"
                  className="flex items-center gap-2 text-lg font-bold text-green-500 dark:text-green-400 hover:text-green-600 dark:hover:text-green-300 transition-colors"
                  title="Purchase on TCGPlayer"
                >
                  <span>{formatPrice(tcg_low)}</span>
                  <img 
                    src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
                    alt="TCGPlayer"
                    className="h-4 w-auto"
                  />
                </TcgAffiliateLink>
              ) : (
                <span className="text-lg font-bold text-green-500 dark:text-green-400">
                  {formatPrice(tcg_low)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ViewPrintings Dialog */}
      {enablePrintingDialog && (
        <ViewPrintingsDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          cardName={display_name || name}
          cardUniqueId={currentCard.card_unique_id || currentCard.collector_number}
          onSelectPrinting={handleSelectPrinting}
        />
      )}
    </>
  );
}
