// components/featured-cards/FeaturedCard.tsx
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import WhoHasDropdown from '@/components/shared/WhoHasDropdown'; // Make sure this path is correct

// Define the shape of the card data this component expects
interface FeaturedCardProps {
  card: {
    printing_id: string;
    name: string;
    set: string;
    foiling: string;
    tcg_market?: number;
    image_url?: string;
    uniqueOwners?: number;
  };
}

export default function FeaturedCard({ card }: FeaturedCardProps) {
  const [imageError, setImageError] = useState(false);

  // Helper to get a display name and style for foiling
  const getFoilingInfo = (foilingCode: string) => {
    switch (foilingCode?.toLowerCase()) {
      case 'r': return { name: 'RF', style: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' };
      case 'c': return { name: 'CF', style: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' };
      case 'g': return { name: 'GF', style: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' };
      default: return null; // Don't display a badge for Non-foil
    }
  };

  const foilingInfo = getFoilingInfo(card.foiling);
  const hasPrice = card.tcg_market != null && card.tcg_market > 0;

  return (
    <Card className="bg-card group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <Link href={`/printing/${card.printing_id}`} className="block">
        {/* Card Image Section */}
        <div className="relative aspect-[63/88] w-full bg-muted">
          {imageError || !card.image_url ? (
            <div className="flex h-full w-full items-center justify-center p-2">
              <div className="text-center text-xs text-muted-foreground">{card.name}</div>
            </div>
          ) : (
            <img
              src={card.image_url}
              alt={card.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImageError(true)}
              loading="lazy"
            />
          )}
          {foilingInfo && (
            <Badge className={`absolute top-2 left-2 pointer-events-none ${foilingInfo.style}`}>
              {foilingInfo.name}
            </Badge>
          )}
        </div>
      </Link>
      
      {/* Card Info Section */}
      <CardContent className="p-3">
        <h3 className="font-semibold text-sm line-clamp-1 truncate">{card.name}</h3>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs uppercase text-muted-foreground">{card.set}</span>
          {hasPrice && (
            <span className="text-sm font-medium text-green-500">
              ${card.tcg_market!.toFixed(2)}
            </span>
          )}
        </div>
        
        {/* Who Has This Button */}
        <div className="mt-3 flex items-center justify-between border-t pt-2">
          <div className="text-xs text-muted-foreground">
            {card.uniqueOwners ? (
              <span>{card.uniqueOwners} owner{card.uniqueOwners !== 1 ? 's' : ''}</span>
            ) : (
              <span>&nbsp;</span> // Keep space for alignment
            )}
          </div>
          <WhoHasDropdown
            printingId={card.printing_id}
            cardName={card.name}
          />
        </div>
      </CardContent>
    </Card>
  );
}