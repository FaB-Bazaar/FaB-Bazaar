import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';

interface SpotlightCardServerProps {
  card: any; // Card data passed from server
  title?: string;
}

/**
 * Server-side compatible spotlight card that renders card info without client-side fetching
 */
export default function SpotlightCardServer({
  card,
  title
}: SpotlightCardServerProps) {
  if (!card) {
    return (
      <div className="not-prose my-6">
        <Card className="p-6 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
          <div className="text-red-600 dark:text-red-400 font-medium">
            Card not found
          </div>
        </Card>
      </div>
    );
  }

  // Use custom title or fall back to card name
  const displayTitle = title || card.display_name || card.name;

  return (
    <div className="not-prose my-6">
      <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 border-2">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Card Display - Simple image */}
            <div className="flex-shrink-0">
              <div className="w-48 h-auto bg-muted rounded-lg flex items-center justify-center p-4">
                {card.image_url ? (
                  <img
                    src={card.image_url}
                    alt={card.display_name || card.name}
                    className="max-w-full max-h-full object-contain rounded"
                  />
                ) : (
                  <div className="text-muted-foreground text-center">
                    <div className="font-medium">{card.display_name || card.name}</div>
                    <div className="text-sm">Image not available</div>
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 space-y-4">
              {/* Header with spotlight badge */}
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  variant="default"
                  className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700"
                >
                  <Star className="h-4 w-4" />
                  Card Spotlight
                </Badge>
              </div>

              {/* Card Title */}
              <div>
                <h3 className="font-semibold text-lg">{displayTitle}</h3>
                <div className="flex flex-wrap gap-2 mt-1 text-sm text-muted-foreground">
                  {card.set && <span>{card.set}</span>}
                  {card.edition && <span>• {card.edition}</span>}
                  {card.rarity && <span>• {card.rarity}</span>}
                  {card.foiling && card.foiling !== 'Normal' && <span>• {card.foiling}</span>}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}