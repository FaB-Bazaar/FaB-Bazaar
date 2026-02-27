//components/heroes/InteractiveCarouselCard.tsx
"use client";

import { useState } from 'react';
import HeroCard from '@/components/heroes/HeroCard';
import WhoHasDropdown from '@/components/shared/WhoHasDropdown';
import ViewPrintingsDialog from '@/components/dialogs/cards/view-printings-dialog';
import { RarityIcon } from '@/components/shared/RarityIcon';
import { Layers, ExternalLink, Star } from "lucide-react";
import { getSetName, getFoilingName, getEditionName, getVariantStyles } from "@/lib/fab-formatters";
import { cn } from "@/lib/utils";

const formatPrice = (price?: number): string => {
  if (typeof price !== 'number' || price <= 0) return 'N/A';
  return `$${price.toFixed(2)}`;
};

interface InteractiveCarouselCardProps {
  card: any;
}

export default function InteractiveCarouselCard({ card }: InteractiveCarouselCardProps) {
  const [currentCard, setCurrentCard] = useState(card);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSelectPrinting = (newPrinting: any) => {
    setCurrentCard(newPrinting);
  };

  return (
    <div className="text-center space-y-2">
      {/* Card Image */}
      <HeroCard printingId={currentCard.printingId} />
      
      {/* Card Name */}
      <h4 className="font-semibold text-sm px-2">{currentCard.name || currentCard.display_name}</h4>
      
      {/* Clickable Foiling Badge */}
      <button
        onClick={() => setDialogOpen(true)}
        className={cn(
          "mx-auto px-3 py-1.5 text-xs font-semibold rounded-md border transition-all hover:opacity-80",
          "flex items-center gap-2",
          getVariantStyles(currentCard.rarity, currentCard.foiling)
        )}
      >
        <span className="font-mono">{getEditionName(currentCard.edition) || 'Normal'}</span>
        <RarityIcon rarityCode={currentCard.rarity} size="sm" />
        <span>{getFoilingName(currentCard.foiling, currentCard.is_extended_art)}</span>
        {currentCard.rarity === 'v' && <Star className="w-3 h-3" />}
        <Layers className="w-3 h-3 opacity-70" />
      </button>

      {/* Price Display */}
      {currentCard.tcg_low && (
        <div className="flex items-center justify-center gap-1.5">
          <a 
            href={currentCard.tcgplayer_url || '#'} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-green-500 hover:text-green-600"
          >
            <span className="font-bold text-lg">{formatPrice(currentCard.tcg_low)}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {/* WhoHas Dropdown */}
      <WhoHasDropdown printingId={currentCard.printingId} cardName={currentCard.name} />
      
      {/* Caption if exists */}
      {card.caption && <p className="mt-2 text-sm italic">{card.caption}</p>}

      {/* ViewPrintings Dialog */}
      <ViewPrintingsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cardName={currentCard.name || currentCard.display_name}
        cardUniqueId={currentCard.card_unique_id}
        onSelectPrinting={handleSelectPrinting}
      />
    </div>
  );
}