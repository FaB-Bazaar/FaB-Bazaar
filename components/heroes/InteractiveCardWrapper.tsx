// components/heroes/InteractiveCardWrapper.tsx
"use client";

import { useState } from 'react';
import ClientHeroCard from './ClientHeroCard';
import WhoHasDropdown from '@/components/shared/WhoHasDropdown';
import ViewPrintingsDialog from '@/components/dialogs/cards/view-printings-dialog';
import { TcgAffiliateLink } from '@/components/tracking';

interface InteractiveCardWrapperProps {
  card: any;
}

const formatPrice = (price?: number): string => {
  if (typeof price !== 'number' || price <= 0) return 'N/A';
  return `${price.toFixed(2)}`;
};

export default function InteractiveCardWrapper({ card }: InteractiveCardWrapperProps) {
  const [currentCard, setCurrentCard] = useState(card);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSelectPrinting = (newPrinting: any) => {
    // Update the current card with the new printing data
    setCurrentCard({
      ...currentCard,
      ...newPrinting,
      printingId: newPrinting.printing_id
    });
  };

  const handleFoilBadgeClick = () => {
    console.log('Foil badge clicked, opening dialog');
    setDialogOpen(true);
  };

  return (
    <div className="flex flex-col items-center space-y-2 max-w-[200px]">
      {/* Main Card Display */}
      <ClientHeroCard 
        printingId={currentCard.printingId} 
        onFoilBadgeClick={handleFoilBadgeClick}
      />
      
      {/* Card Name */}
      <h4 className="font-semibold text-sm text-center px-2 leading-tight">
        {currentCard.name || currentCard.display_name}
      </h4>
      
      {/* Price Display - if available */}
      {currentCard.tcg_low && (
        <div className="text-center py-1 px-3 bg-green-50 dark:bg-green-900/20 rounded-full">
          <div className="text-sm font-bold text-green-600 dark:text-green-400">
            {formatPrice(currentCard.tcg_low)}
          </div>
          <div className="text-[10px] text-green-700 dark:text-green-500">
            TCG Low
          </div>
        </div>
      )}
      
      {/* Action Section */}
      <div className="flex flex-col items-center space-y-2 w-full">
        
        {/* TCG Affiliate Link - Always show for testing, add more debug info */}
        {currentCard.tcgplayer_url ? (
          <TcgAffiliateLink
            tcgplayerUrl={currentCard.tcgplayer_url}
            feature="CarouselCardPurchase"
            className="flex items-center justify-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-2 px-4 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-blue-200 dark:border-blue-800 w-full"
            title="Purchase on TCGPlayer"
          >
            <img 
              src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
              alt="TCGPlayer"
              className="h-3 w-auto"
            />
            <span className="font-medium">Buy on TCGPlayer</span>
          </TcgAffiliateLink>
        ) : (
          // Debug: Show when URL is missing
          <div className="text-xs text-gray-500 py-1">
            No TCG URL available
          </div>
        )}
        
        {/* WhoHas Dropdown - Larger clickable area */}
        <div className="flex flex-col items-center w-full">
          <div className="w-full flex flex-col items-center py-2 px-4 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
            <WhoHasDropdown 
              printingId={currentCard.printingId} 
              cardName={currentCard.name || currentCard.display_name}
              className="w-full"
            />
            <span className="text-xs text-muted-foreground mt-1">Find owners</span>
          </div>
        </div>
      </div>
      
      {/* Caption */}
      {card.caption && (
        <p className="text-sm italic text-center text-muted-foreground px-2">
          {card.caption}
        </p>
      )}

      {/* Debug info - remove this later */}
      <div className="text-xs text-gray-400 mt-2 text-center">
        <div>ID: {currentCard.printingId}</div>
        <div>TCG URL: {currentCard.tcgplayer_url ? 'Yes' : 'No'}</div>
        <div>Price: {currentCard.tcg_low || 'None'}</div>
      </div>

      {/* ViewPrintings Dialog */}
      <ViewPrintingsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cardName={currentCard.name || currentCard.display_name}
        cardUniqueId={currentCard.card_unique_id || currentCard.printing_card_id}
        onSelectPrinting={handleSelectPrinting}
      />
    </div>
  );
}