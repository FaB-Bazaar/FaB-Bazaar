/**
 * Trade Analysis Service Contract
 *
 * Analyzes trade compatibility between two users based on their wants and inventory.
 * Calculates match rates, compatibility scores, and provides detailed card-level analysis.
 */

import type { AsyncResult } from './common';

// ====================================
// DTOs (Data Transfer Objects)
// ====================================

/**
 * Card Detail DTO - Detailed information about a matched card
 */
export interface CardDetailDTO {
  inventoryId: string;
  name: string;
  printingId?: string;
  set?: string;
  foiling?: string;
  edition?: string;
  rarity?: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  image_url?: string;
  pricing: {
    tcg_low: number;
    tcg_mid: number;
    tcg_high: number;
    tcg_market: number;
  };
}

/**
 * Match Summary DTO - Summary of cards one user has that another wants
 */
export interface MatchSummaryDTO {
  count: number;
  total_quantity: number;
  total_value: number;
  rate: number;
}

/**
 * Trade Potential - Qualitative assessment of trade viability
 */
export type TradePotential = 'high' | 'medium' | 'low';

/**
 * Balance Status - Indicates which side is ahead in value
 */
export type BalanceStatus = 'you_ahead' | 'they_ahead' | 'balanced';

/**
 * Trade Analysis Options
 */
export interface TradeAnalysisOptions {
  /** Whether to include detailed card lists */
  includeCards?: boolean;
  /** Response format: 'full', 'summary', or 'quick' */
  format?: 'full' | 'summary' | 'quick';
  /** Match mode: true for strict printing matches, false for loose card matches */
  matchOnPrintingId?: boolean;
}

/**
 * Trade Analysis Result DTO - Complete trade compatibility analysis
 */
export interface TradeAnalysisDTO {
  success: true;
  match_summary: {
    you_have_their_wants: MatchSummaryDTO;
    they_have_your_wants: MatchSummaryDTO;
    compatibility_score: number;
  };
  trade_potential: TradePotential;
  quick_stats: {
    total_mutual_cards: number;
    value_difference: number;
    balance_status: BalanceStatus;
    has_mutual_interest: boolean;
  };
  detailed_stats?: {
    target_wants_total: number;
    current_wants_total: number;
    your_tradeable_cards: number;
    their_tradeable_cards: number;
  };
  cards?: {
    you_have_for_them: CardDetailDTO[];
    they_have_for_you: CardDetailDTO[];
  };
  display?: {
    compatibility_score: number;
    trade_potential: TradePotential;
    mutual_cards: number;
    value_difference: number;
  };
}

// ====================================
// Service Interface
// ====================================

/**
 * Trade Analysis Service Interface
 *
 * Provides real-time trade compatibility analysis between two users.
 */
export interface ITradeAnalysisService {
  /**
   * Analyze trade compatibility between current user and target user
   *
   * Compares wants and tradeable inventory to calculate match rates,
   * compatibility scores, and detailed card breakdowns.
   *
   * @param currentUserId - ID of the current user
   * @param targetUserId - ID of the user to analyze compatibility with
   * @param options - Analysis options (cards, format, matching mode)
   * @returns Result containing trade analysis
   *
   * @example
   * ```typescript
   * const result = await tradeAnalysisService.analyzeTradeCompatibility(
   *   currentUserId,
   *   targetUserId,
   *   { includeCards: true, format: 'summary' }
   * );
   * if (result.success) {
   *   console.log(`Compatibility: ${result.data.match_summary.compatibility_score}%`);
   * }
   * ```
   */
  analyzeTradeCompatibility(
    currentUserId: string,
    targetUserId: string,
    options?: TradeAnalysisOptions
  ): AsyncResult<TradeAnalysisDTO>;
}
