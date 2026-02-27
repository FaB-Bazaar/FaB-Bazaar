"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, TrendingDown, Eye, AlertTriangle, RefreshCw, ExternalLink, Search } from 'lucide-react';
// Removed tooltip imports to avoid TooltipProvider requirement
import PublicHeroCardDisplay from '@/components/heroes/PublicHeroCardDisplay';
import WhoHasDropdown from '@/components/shared/WhoHasDropdown';
import { TcgAffiliateLink } from '@/components/tracking';

interface OpportunityCardProps {
  printingId: string;
  reason: 'underpriced' | 'trending' | 'supply-issue' | 'correction' | 'outlier';
  confidence: 'low' | 'medium' | 'high';
  priceChange?: {
    old: number;
    new: number;
    percentage: number;
  };
  note?: string;
}

// Helper function to get edition display name
const getEditionDisplayName = (code?: string): string => {
  if (!code) return ""
  const lookupCode = code.toLowerCase()
  const editions: Record<string, string> = {
    a: "Alpha", f: "1st", u: "UNL", n: "", normal: "",
  }
  return editions[lookupCode] || code.toUpperCase()
}

// Helper function to get foiling info
const getFoilingInfo = (foiling: string) => {
  const foilingMap: Record<string, { name: string }> = {
    'R': { name: 'Rainbow Foil' },
    'C': { name: 'Cold Foil' },
    'G': { name: 'Gold Foil' },
    'S': { name: 'Non-foil' }
  }
  const code = foiling?.toUpperCase()
  return foilingMap[code] || { name: 'Non-foil' }
}

// Helper function to get reason styling and icon
const getReasonConfig = (reason: OpportunityCardProps['reason']) => {
  const configs = {
    underpriced: {
      label: 'Potential Buy',
      icon: <TrendingDown className="h-4 w-4" aria-hidden="true" />,
      variant: 'default' as const,
      bgColor: 'bg-green-50 dark:bg-green-950/20',
      borderColor: 'border-green-200 dark:border-green-800'
    },
    trending: {
      label: 'Trending Up',
      icon: <TrendingUp className="h-4 w-4" aria-hidden="true" />,
      variant: 'secondary' as const,
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      borderColor: 'border-blue-200 dark:border-blue-800'
    },
    'supply-issue': {
      label: 'Supply Constraint',
      icon: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
      variant: 'destructive' as const,
      bgColor: 'bg-orange-50 dark:bg-orange-950/20',
      borderColor: 'border-orange-200 dark:border-orange-800'
    },
    correction: {
      label: 'Price Correction',
      icon: <TrendingDown className="h-4 w-4" aria-hidden="true" />,
      variant: 'outline' as const,
      bgColor: 'bg-slate-50 dark:bg-slate-950/20',
      borderColor: 'border-slate-200 dark:border-slate-700'
    },
    outlier: {
      label: 'Unusual Movement',
      icon: <Eye className="h-4 w-4" aria-hidden="true" />,
      variant: 'secondary' as const,
      bgColor: 'bg-purple-50 dark:bg-purple-950/20',
      borderColor: 'border-purple-200 dark:border-purple-800'
    }
  };
  
  return configs[reason];
};

// Helper function to get confidence styling
const getConfidenceConfig = (confidence: OpportunityCardProps['confidence']) => {
  const configs = {
    high: { color: 'bg-green-500', label: 'High confidence in this analysis' },
    medium: { color: 'bg-yellow-500', label: 'Medium confidence in this analysis' },
    low: { color: 'bg-red-500', label: 'Low confidence in this analysis' }
  };
  
  return configs[confidence];
};

// Helper function to get price change badge variant
const getPriceChangeBadgeVariant = (percentage: number) => {
  const absPercentage = Math.abs(percentage);
  
  if (percentage > 0) {
    if (absPercentage >= 50) return 'default'; // Strong positive
    if (absPercentage >= 20) return 'secondary'; // Moderate positive
    return 'outline'; // Small positive
  } else {
    if (absPercentage >= 50) return 'destructive'; // Strong negative
    if (absPercentage >= 20) return 'secondary'; // Moderate negative
    return 'outline'; // Small negative
  }
};

/**
 * Displays a card opportunity with pricing data, confidence level, and editorial context.
 * Designed for daily price movement articles to highlight buying opportunities and outliers.
 */
export default function OpportunityCard({ 
  printingId, 
  reason, 
  confidence, 
  priceChange,
  note 
}: OpportunityCardProps) {
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
      console.error("Failed to fetch card data for OpportunityCard", error);
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

  const reasonConfig = getReasonConfig(reason);
  const confidenceConfig = getConfidenceConfig(confidence);

  // Process edition and foiling for display
  const editionDisplay = card ? getEditionDisplayName(card.edition) : '';
  const foilingInfo = card ? getFoilingInfo(card.foiling) : { name: 'Non-foil' };

  if (loading) {
    return (
      <div className="not-prose my-6">
        <Card className="p-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-muted-foreground">Loading opportunity analysis...</span>
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

  // Normalize percentage - handle both decimal (0.3) and percentage (30) formats
  const normalizedPercentage = priceChange ? 
    (Math.abs(priceChange.percentage) <= 1 ? priceChange.percentage * 100 : priceChange.percentage) : 0;

  return (
    <div className="not-prose my-6">
      <Card className={`${reasonConfig.bgColor} ${reasonConfig.borderColor} border-2`}>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Card Display - Using PublicHeroCardDisplay for consistency */}
            <div className="flex-shrink-0">
              <PublicHeroCardDisplay 
                card={card} 
                variant="carousel"
                enablePrintingDialog={true}
              />
            </div>

            {/* Content */}
            <div className="flex-1 space-y-4">
              {/* Header with badges */}
              <div className="flex flex-wrap items-center gap-3">
                <Badge 
                  variant={reasonConfig.variant} 
                  className="flex items-center gap-1"
                  aria-label={`Opportunity type: ${reasonConfig.label}`}
                >
                  {reasonConfig.icon}
                  {reasonConfig.label}
                </Badge>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Confidence:</span>
                  <div className="flex items-center gap-1">
                    <div 
                      className={`w-3 h-3 rounded-full ${confidenceConfig.color}`}
                      aria-label={confidenceConfig.label}
                      title={confidenceConfig.label}
                    />
                    <span className="text-sm font-medium capitalize">{confidence}</span>
                  </div>
                </div>
              </div>

              {/* Card Name and Details */}
              <div>
                <h3 className="font-semibold text-lg">{card.display_name || card.name}</h3>
                <div className="flex flex-wrap gap-2 mt-1 text-sm text-muted-foreground">
                  {card.set && <span>{card.set.toUpperCase()}</span>}
                  {editionDisplay && <span>• {editionDisplay}</span>}
                  {card.rarity && <span>• {card.rarity.toUpperCase()}</span>}
                  {card.foiling && card.foiling !== 'Normal' && <span>• {foilingInfo.name}</span>}
                </div>
              </div>

              {/* Price Change */}
              {priceChange && (
                <div className="flex items-center gap-4">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Price: </span>
                    <span className="line-through text-muted-foreground">${priceChange.old.toFixed(2)}</span>
                    <span className="mx-2">→</span>
                    <span className="font-semibold">${priceChange.new.toFixed(2)}</span>
                  </div>
                  <Badge 
                    variant={getPriceChangeBadgeVariant(normalizedPercentage)}
                    aria-label={`Price change: ${normalizedPercentage > 0 ? 'increased' : 'decreased'} by ${Math.abs(normalizedPercentage).toFixed(1)} percent`}
                  >
                    {normalizedPercentage > 0 ? '+' : ''}{normalizedPercentage.toFixed(1)}%
                  </Badge>
                </div>
              )}

              {/* Editorial Note */}
              {note && (
                <div className="bg-background/50 rounded-lg p-4 border">
                  <p className="text-sm leading-relaxed">{note}</p>
                </div>
              )}

              {/* Action Bar - Stacked Who Has buttons with explanations */}
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
