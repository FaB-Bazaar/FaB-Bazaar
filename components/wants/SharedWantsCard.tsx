// components/wants/SharedWantsCard.tsx

"use client";

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { RarityIcon } from '@/components/shared/RarityIcon';
import FoilCardImage from '@/components/shared/FoilCardImage';
import { getFoilingInfo, getColorDot, renderPriceLine, renderPurchaseLink } from './utils';

interface SharedWantsCardProps {
  card: any;
  isSelected: boolean;
  selectedQty: number;
  maxQty: number;
  onCardSelect: (card: any) => void;
}

const useWindowWidth = () => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    function handleResize() { setWidth(window.innerWidth); }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return width;
};

export default function SharedWantsCard({
  card,
  isSelected,
  selectedQty,
  maxQty,
  onCardSelect,
}: SharedWantsCardProps) {
  const { printingDetails } = card;
  const windowWidth = useWindowWidth();
  const foilingInfo = getFoilingInfo(printingDetails?.foiling || card.foiling);

  const getImageUrl = () => {
    if (printingDetails?.image_url) return printingDetails.image_url;
    if (card.printingId)
      return `https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${card.printingId}/public`;
    if (card.defaultPrintingId)
      return `https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${card.defaultPrintingId}/public`;
    return '/cardback.webp';
  };

  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-lg overflow-hidden cursor-pointer bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all hover:shadow-xl hover:-translate-y-1 flex-shrink-0 flex flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
        isSelected ? 'ring-2 ring-blue-500 shadow-lg' : 'shadow-md',
        isSelected && selectedQty >= maxQty && 'border-dashed'
      )}
      onClick={() => onCardSelect(card)}
    >
      <div className="relative w-full h-[280px] bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center p-2">
        <FoilCardImage
          foiling={printingDetails?.foiling || card.foiling}
          foilInset={null}
          src={getImageUrl()}
          alt={card.name}
          className="w-full h-full"
          imgClassName="max-w-full max-h-full object-contain rounded"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/cardback.webp' }}
        />
        {isSelected && (
          <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-medium">
            {selectedQty}/{maxQty}
          </div>
        )}
        <div className="absolute bottom-2 left-2">
          <div
            className={cn(
              'text-sm px-2 py-1 rounded-full font-medium',
              card.priority === 'high'
                ? 'bg-red-600 text-white'
                : card.priority === 'medium'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-600 text-white'
            )}
          >
            {card.priority}
          </div>
        </div>
      </div>

      <div className="p-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 flex-1 flex flex-col justify-between">
        <div>
          <div className="font-semibold text-sm leading-tight mb-1">
            {card.quantity > 1 && (
              <span className="text-blue-600 dark:text-blue-400 mr-1">{card.quantity}x</span>
            )}
            {card.printingDetails?.display_name || card.name}
          </div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-mono uppercase tracking-wide text-gray-600 dark:text-gray-400">
              {printingDetails?.collector_number || (printingDetails?.set || card.set)?.toUpperCase()}
            </span>
            {(printingDetails?.color || card.color) && (
              <span className={`w-3 h-3 rounded-full ${getColorDot(printingDetails?.color || card.color)}`} />
            )}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 truncate mb-2">
            {printingDetails?.type_text || card.type_text}
          </div>
        </div>

        <div className="space-y-1">
          {windowWidth < 640 ? (
            <>
              {renderPriceLine(printingDetails?.tcg_low, 'Low', card.quantity, true)}
              {renderPurchaseLink(printingDetails?.tcgplayer_url, 'SharedWantsMobilePurchaseLink', true)}
            </>
          ) : (
            <>
              {renderPriceLine(printingDetails?.tcg_market || card.value, 'Market', card.quantity)}
              {renderPriceLine(printingDetails?.tcg_high, 'High', card.quantity)}
              {renderPriceLine(printingDetails?.tcg_mid, 'Mid', card.quantity)}
              {renderPriceLine(printingDetails?.tcg_low, 'Low', card.quantity, true)}
              {renderPurchaseLink(printingDetails?.tcgplayer_url, 'SharedWantsDesktopPurchaseLink')}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 mt-2">
          <RarityIcon rarityCode={printingDetails?.rarity || card.rarity} size="sm" />
          <div className={`text-sm px-2 py-0.5 rounded-full text-center flex-1 ${foilingInfo.className}`}>
            {foilingInfo.name}
          </div>
        </div>
      </div>
    </button>
  );
}
