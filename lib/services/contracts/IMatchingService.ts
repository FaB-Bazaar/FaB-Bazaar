/**
 * Matching Service Contract
 *
 * Handles bilateral trade matching between users.
 * Calculates what each user has that the other wants.
 */

import type { AsyncResult } from './common';

/**
 * Detailed match information for a single card
 */
export interface CardMatchDetailDTO {
  name: string;
  printingId: string;
  set: string;
  foiling: string;
  color: string;
  quantity: number;
  image_url?: string;
  tcg_market?: number;
}

/**
 * Match counts and percentages
 */
export interface MatchCountsDTO {
  youHaveTheirWants: number;
  youHaveTheirWantsTotalQuantity: number;
  theyHaveYourWants: number;
  theyHaveYourWantsTotalQuantity: number;
  totalTheirWants: number;
  totalYourWants: number;
}

/**
 * Debug information for matching query
 */
export interface MatchDebugDTO {
  currentUserInventoryCount: number;
  targetUserInventoryCount: number;
  currentUserWantsCount: number;
  targetUserWantsCount: number;
}

/**
 * Match rate result with details
 */
export interface MatchRateResultDTO {
  currentUserHasTargetWantsRate: number; // Percentage 0-100
  targetUserHasCurrentUserWantsRate: number; // Percentage 0-100
  matchCounts: MatchCountsDTO;
  details: {
    youHaveTheirWants: CardMatchDetailDTO[];
    theyHaveYourWants: CardMatchDetailDTO[];
  };
  debug?: MatchDebugDTO;
}

/**
 * Matching Service Interface
 *
 * Provides methods for calculating trade matches between users.
 */
export interface IMatchingService {
  /**
   * Calculate bilateral match rate between two users
   *
   * Analyzes:
   * - What currentUser has that targetUser wants
   * - What targetUser has that currentUser wants
   * - Match percentages based on quantities
   *
   * Only considers:
   * - Items marked forTrade: true
   * - Items from binders with binderAllowWhoHas: true
   *
   * @param currentUserId - The ID of the current user (initiating the match)
   * @param targetUserId - The ID of the target user (being matched against)
   * @returns Match rate result with percentages, counts, and card details
   *
   * @example
   * ```typescript
   * const result = await matchingService.calculateMatchRate(
   *   'user123',
   *   'user456'
   * );
   * if (result.success) {
   *   console.log(`You have ${result.data.matchCounts.youHaveTheirWants} of their wants`);
   *   console.log(`Match rate: ${result.data.currentUserHasTargetWantsRate}%`);
   * }
   * ```
   */
  calculateMatchRate(
    currentUserId: string,
    targetUserId: string
  ): AsyncResult<MatchRateResultDTO>;
}
