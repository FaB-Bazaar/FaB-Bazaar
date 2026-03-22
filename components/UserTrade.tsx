"use client";

import React, { useState } from 'react';
import { TrendingUp, Loader2, Eye, ShoppingCart, AlertCircle, ExternalLink, Star, Heart } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation';
import { usersClient } from '@/lib/client';
import type { TradeAnalysisFullDTO } from '@/lib/client/users-client';
import { profileHref } from '@/lib/utils/display-username';

interface UserTradePreviewProps {
  userId: string;
  username: string;
  className?: string;
}

export default function UserTradePreviewDropdown({ userId, username, className = "" }: UserTradePreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TradeAnalysisFullDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState(false);
  const router = useRouter();

  const fetchTradeAnalysis = async () => {
    if (data || loading) return;

    setLoading(true);
    setError(null);

    const result = await usersClient.getTradeAnalysis(userId, 'summary', {
      includeCards: true,
      matchOnPrintingId: true
    });

    setLoading(false);

    if (result.success) {
      setData(result.data);
    } else {
      console.error('Error fetching trade analysis:', result.error);
      setError(result.error);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !data && !loading) {
      fetchTradeAnalysis();
    }
  };

  // Helper functions
  const getPotentialColor = (potential: string) => {
    switch (potential) {
      case 'high': return 'bg-green-100 text-green-800 border-green-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-gray-100 text-gray-600 border-gray-300';
      default: return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  };

  const getPotentialIcon = (potential: string) => {
    switch (potential) {
      case 'high': return <Star className="h-4 w-4" />;
      case 'medium': return <TrendingUp className="h-4 w-4" />;
      default: return null;
    }
  };

  const formatFoiling = (foiling: string) => {
    const foilingMap: Record<string, string> = {
      's': 'NF', 'r': 'RF', 'c': 'CF', 'g': 'GF'
    };
    return foilingMap[foiling?.toLowerCase()] || foiling || 'NF';
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm text-gray-600">Analyzing trade potential...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center py-4 px-3">
          <AlertCircle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
          <span className="text-sm text-red-600">{error}</span>
        </div>
      );
    }

    if (!data) {
      return (
        <div className="py-4 px-3 text-sm text-gray-500 text-center">
          Click to analyze trade potential
        </div>
      );
    }

    const { match_summary, trade_potential, quick_stats, cards } = data;
    const hasCards = cards && (cards.you_have_for_them.length > 0 || cards.they_have_for_you.length > 0);

    return (
      <div className="w-80 max-w-sm">
        <DropdownMenuLabel className="text-sm font-semibold">
          Trade Analysis with {username}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Compatibility Score */}
        <div className="px-3 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <Badge 
              variant="secondary" 
              className={`text-sm ${getPotentialColor(trade_potential)}`}
            >
              {getPotentialIcon(trade_potential)}
              <span className="ml-1">
                {match_summary.compatibility_score}% Match • {trade_potential} potential
              </span>
            </Badge>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-blue-50 p-2 rounded-md">
              <div className="font-medium text-blue-800">You Have</div>
              <div className="text-blue-600">
                {match_summary.you_have_their_wants.count} cards they want
              </div>
              {match_summary.you_have_their_wants.total_value > 0 && (
                <div className="text-xs text-blue-500">
                  ~${match_summary.you_have_their_wants.total_value.toFixed(0)} value
                </div>
              )}
            </div>
            
            <div className="bg-green-50 p-2 rounded-md">
              <div className="font-medium text-green-800">They Have</div>
              <div className="text-green-600">
                {match_summary.they_have_your_wants.count} cards you want
              </div>
              {match_summary.they_have_your_wants.total_value > 0 && (
                <div className="text-xs text-green-500">
                  ~${match_summary.they_have_your_wants.total_value.toFixed(0)} value
                </div>
              )}
            </div>
          </div>

          {/* Expandable Card Details */}
          {hasCards && (
            <div className="space-y-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedCards(!expandedCards);
                }}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                {expandedCards ? 'Hide Card Details' : `Show ${quick_stats.total_mutual_cards} Mutual Cards`}
              </button>

              {expandedCards && (
                <div className="border-t pt-2 space-y-3 max-h-40 overflow-y-auto">
                  {/* Cards They Have That You Want */}
                  {cards.they_have_for_you.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-green-700 mb-1">
                        They have for you:
                      </div>
                      <div className="space-y-1">
                        {cards.they_have_for_you.slice(0, 4).map((card, idx) => (
                          <div key={idx} className="text-xs text-gray-700 flex justify-between">
                            <span>{card.quantity}x {card.name} ({formatFoiling(card.foiling)})</span>
                            {card.totalValue > 0 && (
                              <span className="text-green-600">${card.totalValue.toFixed(0)}</span>
                            )}
                          </div>
                        ))}
                        {cards.they_have_for_you.length > 4 && (
                          <div className="text-xs text-gray-500">
                            +{cards.they_have_for_you.length - 4} more cards
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Cards You Have That They Want */}
                  {cards.you_have_for_them.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-blue-700 mb-1">
                        You have for them:
                      </div>
                      <div className="space-y-1">
                        {cards.you_have_for_them.slice(0, 4).map((card, idx) => (
                          <div key={idx} className="text-xs text-gray-700 flex justify-between">
                            <span>{card.quantity}x {card.name} ({formatFoiling(card.foiling)})</span>
                            {card.totalValue > 0 && (
                              <span className="text-blue-600">${card.totalValue.toFixed(0)}</span>
                            )}
                          </div>
                        ))}
                        {cards.you_have_for_them.length > 4 && (
                          <div className="text-xs text-gray-500">
                            +{cards.you_have_for_them.length - 4} more cards
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* No Trade Potential */}
          {quick_stats.total_mutual_cards === 0 && (
            <div className="text-center py-2">
              <div className="text-sm text-gray-500">No mutual trade opportunities found</div>
              <div className="text-xs text-gray-400 mt-1">
                You might not have overlapping wants/haves
              </div>
            </div>
          )}
        </div>

        <DropdownMenuSeparator />

        {/* Action Buttons */}
        <div className="px-3 py-2 space-y-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(profileHref(username));
            }}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm"
          >
            <Eye className="h-4 w-4" />
            <span>View Profile</span>
            <ExternalLink className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/wants/${userId}`);
            }}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 border border-purple-300 rounded-md hover:bg-purple-50 transition-colors text-sm text-purple-700"
          >
            <Heart className="h-4 w-4" />
            <span>View Wants List</span>
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button 
          size="sm" 
          variant="outline" 
          className={`flex items-center ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          <TrendingUp className="h-3 w-3 mr-1" />
          Trade Preview
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        className="w-auto max-h-[28rem] overflow-y-auto" 
        align="end"
        side="bottom"
      >
        {renderContent()}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}