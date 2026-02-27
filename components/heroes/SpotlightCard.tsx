"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Star } from 'lucide-react';
import PublicHeroCardDisplay from '@/components/heroes/PublicHeroCardDisplay';
import WhoHasDropdown from '@/components/shared/WhoHasDropdown';
import CardMention from '@/components/heroes/CardMention';

interface SpotlightCardProps {
  printingId: string;
  title?: string;
  commentary?: string;
}

/**
 * Displays a featured card with rich commentary and editorial content.
 * Designed for highlighting interesting cards with detailed analysis and strategic insights.
 */

// Helper function to get edition display name
function getEditionDisplayName(code?: string): string {
  if (!code) return ""
  const lookupCode = code.toLowerCase()
  const editions: Record<string, string> = {
    a: "Alpha", f: "1st", u: "UNL", n: "", normal: "",
  }
  return editions[lookupCode] || code.toUpperCase()
}

// Helper function to get foiling info
function getFoilingInfo(foiling: string) {
  const foilingMap: Record<string, { name: string }> = {
    'R': { name: 'Rainbow Foil' },
    'C': { name: 'Cold Foil' },
    'G': { name: 'Gold Foil' },
    'S': { name: 'Non-foil' }
  }
  const code = foiling?.toUpperCase()
  return foilingMap[code] || { name: 'Non-foil' }
}

// Function to parse commentary text and convert **card names** to CardMention components
function parseCommentary(text: string): React.ReactNode {
  if (!text) return null;

  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    // Check if this part is a card mention (wrapped in **)
    if (part.startsWith('**') && part.endsWith('**')) {
      const cardName = part.slice(2, -2); // Remove the ** markers
      return <CardMention key={index} cardName={cardName} />;
    }

    // Regular text - preserve line breaks
    return part.split('\n').map((line, lineIndex, lines) => (
      <React.Fragment key={`${index}-${lineIndex}`}>
        {line}
        {lineIndex < lines.length - 1 && <br />}
      </React.Fragment>
    ));
  });
}

export default function SpotlightCard({
  printingId,
  title,
  commentary
}: SpotlightCardProps) {
  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const fetchCardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const query = new URLSearchParams({ printingIds: printingId });
      const response = await fetch(`/api/printings/search?${query.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success && data.data.printings.length > 0) {
        setCard(data.data.printings[0]);
      } else {
        throw new Error('Card not found in response');
      }
    } catch (error) {
      console.error("Failed to fetch card data for SpotlightCard", error);
      setError(error instanceof Error ? error.message : 'Failed to load card data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCardData();
  }, [printingId]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    fetchCardData();
  };

  if (loading) {
    return (
      <div className="not-prose my-6">
        <Card className="p-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-muted-foreground">Loading spotlight card...</span>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="not-prose my-6">
        <Card className="p-6 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-600 dark:text-red-400 font-medium">
                {error || `Card not found: ${printingId}`}
              </p>
              {retryCount < 3 && (
                <p className="text-sm text-red-500 dark:text-red-300 mt-1">
                  This might be a temporary issue.
                </p>
              )}
            </div>
            {retryCount < 3 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="border-red-300 text-red-600 hover:bg-red-100 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // Use custom title or fall back to card name
  const displayTitle = title || card.display_name || card.name;

  // Process edition and foiling for display
  const editionDisplay = getEditionDisplayName(card.edition);
  const foilingInfo = getFoilingInfo(card.foiling);

  return (
    <div className="not-prose my-6">
      <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 border-2">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Card Display */}
            <div className="flex-shrink-0">
              <PublicHeroCardDisplay
                card={card}
                variant="carousel"
                enablePrintingDialog={true}
              />
            </div>

            {/* Content */}
            <div className="flex-1 space-y-4">
              {/* Header with spotlight badge */}
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  variant="default"
                  className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700"
                  aria-label="Featured card spotlight"
                >
                  <Star className="h-4 w-4" aria-hidden="true" />
                  Card Spotlight
                </Badge>
              </div>

              {/* Card Title */}
              <div>
                <h3 className="font-semibold text-lg">{displayTitle}</h3>
                <div className="flex flex-wrap gap-2 mt-1 text-sm text-muted-foreground">
                  {card.set && <span>{card.set.toUpperCase()}</span>}
                  {editionDisplay && <span>• {editionDisplay}</span>}
                  {card.rarity && <span>• {card.rarity.toUpperCase()}</span>}
                  {card.foiling && card.foiling !== 'Normal' && <span>• {foilingInfo.name}</span>}
                </div>
              </div>

              {/* Commentary with card mentions */}
              {commentary && (
                <div className="bg-background/50 rounded-lg p-4 border">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {parseCommentary(commentary)}
                  </div>
                </div>
              )}

              {/* Action Bar - Who Has buttons */}
              <div className="pt-3 mt-3 border-t border-border/50">
                <div className="space-y-2">
                  {/* Who Has This Exact Copy */}
                  {card.printing_id && (
                    <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <div className="font-medium text-sm">Who has this exact copy</div>
                        <div className="text-xs text-muted-foreground">Same set, edition, and foiling</div>
                      </div>
                      <WhoHasDropdown
                        printingId={card.printing_id}
                        cardName={card.display_name || card.name}
                        searchMode="printing"
                      />
                    </div>
                  )}

                  {/* Who Has Other Versions */}
                  {card.card_unique_id && (
                    <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <div className="font-medium text-sm">Who has other versions of this card</div>
                        <div className="text-xs text-muted-foreground">Any set, edition, or foiling</div>
                      </div>
                      <WhoHasDropdown
                        cardUniqueId={card.card_unique_id}
                        cardName={card.display_name || card.name}
                        searchMode="unique"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}