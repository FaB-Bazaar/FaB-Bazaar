// components/wants/WantsCard.tsx

"use client";

import React, { useState } from "react";
import { Plus, Minus, Trash2 } from "lucide-react";
import { RarityIcon } from '@/components/shared/RarityIcon';
import FoilCardImage from '@/components/shared/FoilCardImage';
import WhoHasDropdown from '@/components/shared/WhoHasDropdown';
import PrintingSwapDialog from '@/components/dialogs/cards/printing-swap-dialog';
import { getCardImageUrl } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSession } from 'next-auth/react';
import { wantsClient } from '@/lib/client';
import { getFoilingInfo, getColorDot, renderPriceLine, renderPurchaseLink } from './utils';


interface WantsCardProps {
  card: {
    id: string;
    name: string;
    quantity: number;
    priority: string;
    printingId?: string;
    defaultPrintingId?: string;
    printingDetails: {
      printing_id: string;
      card_unique_id: string;
      set?: string;
      edition?: string;
      foiling?: string;
      rarity?: string;
      color?: string;
      collector_number?: string;
      type_text?: string;
      tcg_low?: number;
      tcg_mid?: number;
      tcg_high?: number;
      tcg_market?: number;
      tcgplayer_url?: string;
      image_url?: string;
    };
  };
  onQuantityChange: (id: string, newQuantity: number) => void;
  onPriorityChange: (id: string, newPriority: string) => void;
  onRemove: (id: string) => void;
  onPrintingSwap: (cardId: string, oldPrintingId: string, newPrinting: any) => void;
}

const WantsCard: React.FC<WantsCardProps> = ({
  card,
  onQuantityChange,
  onPriorityChange,
  onRemove,
  onPrintingSwap
}) => {
  const { printingDetails } = card;
  const [isPrintingSwapOpen, setIsPrintingSwapOpen] = useState(false);
  const { data: session } = useSession();
  const userCountry = session?.user?.country;
  const foilingInfo = getFoilingInfo(printingDetails?.foiling);

  return (
    <div className="w-full rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 transition-all hover:shadow-xl hover:shadow-gray-300/60 dark:hover:shadow-2xl hover:-translate-y-1 flex-shrink-0 flex flex-col shadow-md shadow-gray-300/50 dark:shadow-lg">

      {/* Image Section */}
      <div className="relative w-full h-[230px] sm:h-[322px] bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center p-2">
        <FoilCardImage
          foiling={printingDetails?.foiling}
          foilInset={null}
          src={getCardImageUrl(card)}
          alt={card.name}
          className="w-full h-full"
          imgClassName="max-w-full max-h-full object-contain rounded"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/cardback.webp" }}
        />
        {card.quantity > 1 && <div className="absolute top-2 right-2 bg-blue-600 dark:bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium">{card.quantity}x</div>}
        <div className="absolute bottom-2 left-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => { e.stopPropagation(); const p = ['low', 'medium', 'high']; onPriorityChange(card.id, p[(p.indexOf(card.priority) + 1) % p.length]); }}
                className={`text-xs px-2 py-1 rounded-full font-medium transition-all hover:scale-105 cursor-pointer ${card.priority === 'high' ? 'bg-red-600 hover:bg-red-700 text-white' : card.priority === 'medium' ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-gray-600 hover:bg-gray-700 text-white'}`}
              >
                {card.priority}
              </button>
            </TooltipTrigger>
            <TooltipContent sideOffset={8}>
              <p>Click to cycle priority (current: {card.priority})</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Info Section */}
      <div className="p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 flex-1 flex flex-col">
        <div className="font-semibold text-sm leading-tight mb-2">
          {card.quantity > 1 && <span className="text-blue-600 dark:text-blue-400 mr-1">{card.quantity}x</span>}
          {printingDetails?.display_name || card.name}
        </div>
        <div className="flex-1"></div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono uppercase tracking-wide text-gray-600 dark:text-gray-400">{printingDetails?.collector_number?.toUpperCase() || ''}</span>
            {printingDetails?.color && <span className={`w-3 h-3 rounded-full ${getColorDot(printingDetails.color)}`}></span>}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 truncate">{printingDetails?.type_text}</div>
          <div className="space-y-1">
            {renderPriceLine(printingDetails?.tcg_market, "Market", card.quantity)}
            {renderPriceLine(printingDetails?.tcg_high, "High", card.quantity)}
            {renderPriceLine(printingDetails?.tcg_mid, "Mid", card.quantity)}
            {renderPriceLine(printingDetails?.tcg_low, "Low", card.quantity, true)}
            {renderPurchaseLink(printingDetails?.tcgplayer_url, "WantsPurchaseLink")}
          </div>
          <div className="flex items-center gap-2">
            <RarityIcon rarityCode={printingDetails?.rarity} size="sm" />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => { e.stopPropagation(); setIsPrintingSwapOpen(true); }}
                  className={`text-sm px-2 py-0.5 rounded-full text-center flex-1 transition-all hover:scale-105 cursor-pointer hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${foilingInfo.className}`}
                >
                  {foilingInfo.name}
                </button>
              </TooltipTrigger>
              <TooltipContent sideOffset={8}>
                <p>Swap {card.name}</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* ACTION BAR */}
          <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => { e.stopPropagation(); onQuantityChange(card.id, Math.max(1, card.quantity - 1)); }}
                    className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 flex items-center justify-center text-xs transition-colors"
                  >
                    <Minus className="w-3 h-3 text-gray-700 dark:text-gray-200" />
                  </button>
                </TooltipTrigger>
              </Tooltip>
              <span className="w-3 text-center text-sm font-medium">{card.quantity}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => { e.stopPropagation(); onQuantityChange(card.id, card.quantity + 1); }}
                    className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 flex items-center justify-center text-xs transition-colors"
                  >
                    <Plus className="w-3 h-3 text-gray-700 dark:text-gray-200" />
                  </button>
                </TooltipTrigger>
              </Tooltip>
            </div>
            <div className="flex items-center gap-2">
              {card.printingDetails?.printing_id && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <WhoHasDropdown
                        printingId={card.printingDetails.printing_id}
                        cardName={card.name}
                        searchMode="printing"
                        country={userCountry}
                      />
                    </div>
                  </TooltipTrigger>
                </Tooltip>
              )}
              {card.printingDetails?.card_unique_id && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <WhoHasDropdown
                        cardUniqueId={card.printingDetails.card_unique_id}
                        cardName={card.name}
                        searchMode="unique"
                        country={userCountry}
                      />
                    </div>
                  </TooltipTrigger>
                </Tooltip>
              )}
              <div className="w-px h-4 bg-gray-200 dark:bg-gray-600"></div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemove(card.id); }}
                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      <PrintingSwapDialog
        open={isPrintingSwapOpen}
        onOpenChange={setIsPrintingSwapOpen}
        currentPrinting={{
          printingId: printingDetails?.printing_id || card.printingId || '',
          cardUniqueId: printingDetails?.card_unique_id,
          cardName: card.name
        }}
        onSwap={async (newPrinting) => {
          const currentPrintingId = printingDetails?.printing_id || card.printingId || card.id || '';
          const removeResult = await wantsClient.removeWantsItem(currentPrintingId, true);
          if (!removeResult.success) {
            return { success: false, error: removeResult.error || 'Failed to remove old printing' };
          }
          const addResult = await wantsClient.addWantsItem(
            newPrinting.printing_id,
            card.quantity,
            card.priority as 'high' | 'medium' | 'low'
          );
          return { success: addResult.success, error: addResult.success ? undefined : addResult.error };
        }}
        onSwapComplete={(newPrinting) => {
          const currentPrintingId = printingDetails?.printing_id || card.printingId || card.id || '';
          onPrintingSwap(card.id, currentPrintingId, newPrinting);
        }}
      />
    </div>
  );
};

export default WantsCard;
