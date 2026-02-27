import { TradeAnalysisResult } from './types';

export type ResponseFormat = 'full' | 'summary' | 'quick';

/**
 * Formats the trade analysis result based on the requested format
 * Updated to work with InventoryItem-based data structure
 */
export function formatResponse(
  analysis: TradeAnalysisResult,
  format: ResponseFormat,
  includeCards: boolean,
  additionalStats?: {
    targetWantsTotalQuantity: number;
    currentWantsTotalQuantity: number;
    // Removed binder counts since we no longer fetch binders
    // currentUserBindersCount: number;
    // targetUserBindersCount: number;
    currentUserTradeableCards: number;
    targetUserTradeableCards: number;
  }
): any {
  const baseResponse = {
    success: true,
    match_summary: {
      you_have_their_wants: {
        count: analysis.youHaveTheirWants.count,
        total_quantity: analysis.youHaveTheirWants.totalQuantity,
        total_value: analysis.youHaveTheirWants.totalValue,
        rate: analysis.youHaveTheirWants.rate
      },
      they_have_your_wants: {
        count: analysis.theyHaveYourWants.count,
        total_quantity: analysis.theyHaveYourWants.totalQuantity,
        total_value: analysis.theyHaveYourWants.totalValue,
        rate: analysis.theyHaveYourWants.rate
      },
      compatibility_score: Math.round(analysis.compatibilityScore * 10) / 10
    },
    trade_potential: analysis.tradePotential,
    quick_stats: {
      total_mutual_cards: analysis.totalMutualCards,
      value_difference: Math.round(Math.abs(analysis.valueDifference) * 100) / 100,
      balance_status: analysis.balanceStatus,
      has_mutual_interest: analysis.hasMutualInterest
    }
  };

  // Format based on requested type
  switch (format) {
    case 'quick':
      // Minimal response for UI dropdowns/previews
      return {
        ...baseResponse,
        display: {
          compatibility_score: Math.round(analysis.compatibilityScore),
          trade_potential: analysis.tradePotential,
          mutual_cards: analysis.totalMutualCards,
          value_difference: Math.round(Math.abs(analysis.valueDifference))
        }
      };

    case 'summary':
      // Medium detail response
      const summaryResponse = { ...baseResponse };
      
      // Include cards if requested
      if (includeCards) {
        return {
          ...summaryResponse,
          cards: {
            you_have_for_them: analysis.youHaveTheirWants.cards || [],
            they_have_for_you: analysis.theyHaveYourWants.cards || []
          }
        };
      }
      
      return summaryResponse;

    case 'full':
    default:
      // Full detailed response
      const fullResponse = {
        ...baseResponse,
        detailed_stats: additionalStats ? {
          target_wants_total: additionalStats.targetWantsTotalQuantity,
          current_wants_total: additionalStats.currentWantsTotalQuantity,
          // Updated field names to reflect they're card counts, not binder counts
          your_tradeable_cards: additionalStats.currentUserTradeableCards,
          their_tradeable_cards: additionalStats.targetUserTradeableCards
        } : undefined
      };
      
      // Include cards if requested
      if (includeCards) {
        return {
          ...fullResponse,
          cards: {
            you_have_for_them: analysis.youHaveTheirWants.cards || [],
            they_have_for_you: analysis.theyHaveYourWants.cards || []
          }
        };
      }
      
      return fullResponse;
  }
}