/**
 * Trade Matching Service Contract
 *
 * Handles trade opportunity discovery and matching logic.
 * Works with the trade_matches collection populated by nightly cron jobs.
 */

import type { AsyncResult } from './common';
import type mongoose from 'mongoose';

// ====================================
// DTOs (Data Transfer Objects)
// ====================================

/**
 * Card Match DTO - Represents a card that matches in a trade
 */
export interface CardMatchDTO {
  card_unique_id: string;
  card_name: string;
  wanted_printing_id: string;
  inventory_item_id: string;
  owned_printing_id: string;
  owned_printing_name: string;
  quantity: number;
  condition?: string;
  language?: string;
  // Denormalized inventory fields
  image_url?: string;
  display_name?: string;
  set?: string;
  edition?: string;
  foiling?: string;
  rarity?: string;
  type_text?: string;
  tcg_low?: number;
  tcg_mid?: number;
  tcg_high?: number;
  tcg_market?: number;
  tcgplayer_url?: string;
  binder_name?: string;
  binder_slug?: string;
  binder_id?: string;
  printing_card_id?: string;
  forTrade: boolean;
}

/**
 * Trade Partner DTO - Represents a potential trade partner
 */
export interface TradePartnerDTO {
  owner_user_id: string;
  owner_username: string;
  card_matches: CardMatchDTO[];
  exact_printing_matches: CardMatchDTO[];
}

/**
 * Trade Opportunities DTO - Complete trade opportunities for a user
 */
export interface TradeOpportunitiesDTO {
  id: string;
  wanter_user_id: string;
  wanter_username: string;
  wantslist_id?: string;
  analyzed_at: Date;
  total_partners: number;
  total_card_matches: number;
  total_exact_matches: number;
  trade_partners: TradePartnerDTO[];
}

// ====================================
// Service Interface
// ====================================

/**
 * Trade Matching Service Interface
 *
 * Provides access to pre-calculated trade matches from nightly analysis.
 */
export interface ITradeMatchingService {
  /**
   * Get trade opportunities for a specific user
   *
   * Returns enriched trade matches with inventory item details.
   *
   * @param userId - User ID to get trade opportunities for
   * @returns Result containing trade opportunities or null if none found
   *
   * @example
   * ```typescript
   * const result = await tradeMatchingService.getTradeOpportunities(userId);
   * if (result.success && result.data) {
   *   console.log(`Found ${result.data.total_partners} potential trade partners`);
   * }
   * ```
   */
  getTradeOpportunities(userId: string | mongoose.Types.ObjectId): AsyncResult<TradeOpportunitiesDTO | null>;
}
