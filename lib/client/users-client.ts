/**
 * Users Client Service
 *
 * Client-side API abstraction for user and profile operations.
 * Consolidates user-related fetch() calls from ~5 different components.
 */

import type { ApiResponse } from './types';
import { buildQueryParams, handleResponse, handleError } from './utils';

// ====================================
// Type Definitions (local until server contract exists)
// ====================================

/**
 * User profile DTO
 */
export interface UserProfileDTO {
  _id: string;
  username?: string;
  email?: string;
  discordId?: string;
  discordUsername?: string;
  country?: string;
  state?: string;
  isPublic?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Trade analysis result (legacy/simplified format)
 */
export interface TradeAnalysisDTO {
  targetUser: {
    userId: string;
    username?: string;
    discordUsername?: string;
  };
  theyHaveThatIWant: number;
  iHaveThatTheyWant: number;
  potentialTradeValue: number;
  matchPercentage: number;
  topMatches?: Array<{
    printingId: string;
    name: string;
    tcgMarket?: number;
  }>;
}

/**
 * Complete trade analysis response with all details
 * Returned by /api/trade-analysis endpoint
 */
export interface TradeAnalysisFullDTO {
  success: boolean;
  match_summary: {
    you_have_their_wants: {
      count: number;
      total_quantity: number;
      total_value: number;
      rate: number;
    };
    they_have_your_wants: {
      count: number;
      total_quantity: number;
      total_value: number;
      rate: number;
    };
    compatibility_score: number;
  };
  trade_potential: "high" | "medium" | "low";
  quick_stats: {
    total_mutual_cards: number;
    value_difference: number;
    balance_status: string;
    has_mutual_interest: boolean;
  };
  cards?: {
    you_have_for_them: Array<{
      name: string;
      quantity: number;
      foiling: string;
      totalValue: number;
      printingId?: string;
      set?: string;
      edition?: string;
      rarity?: string;
      unitValue?: number;
      image_url?: string;
    }>;
    they_have_for_you: Array<{
      name: string;
      quantity: number;
      foiling: string;
      totalValue: number;
      printingId?: string;
      set?: string;
      edition?: string;
      rarity?: string;
      unitValue?: number;
      image_url?: string;
    }>;
  };
}

/**
 * Options for trade analysis requests
 */
export interface TradeAnalysisOptions {
  includeCards?: boolean;
  matchOnPrintingId?: boolean;
}

/**
 * Match rate result
 */
export interface MatchRateDTO {
  matchRate: number;
  theyHave: number;
  iWant: number;
  iHave: number;
  theyWant: number;
}

/**
 * Profile update data
 */
export interface UpdateProfileDTO {
  username?: string;
  country?: string;
  state?: string;
  isPublic?: boolean;
}

/**
 * Complete profile data
 */
export interface CompleteProfileDTO {
  username: string;
  discordUsername?: string;
  city?: string;
  state?: string;
  country?: string;
  country_id?: string;
}

/**
 * Discord info update data
 */
export interface UpdateDiscordInfoDTO {
  discordId: string;
  discordUsername: string;
}

// ====================================
// Profile Operations
// ====================================

/**
 * Get current user's profile
 *
 * @returns Current user's profile data
 *
 * @example
 * ```typescript
 * const result = await getCurrentUser();
 * if (result.success) {
 *   console.log(`Logged in as: ${result.data.username}`);
 * }
 * ```
 */
export async function getCurrentUser(): Promise<ApiResponse<UserProfileDTO>> {
  try {
    const response = await fetch('/api/user/profile');
    return await handleResponse<UserProfileDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Get authenticated user's profile from auth endpoint
 *
 * Returns the current user's complete profile including session information.
 * Used by the profile page to display user account details.
 *
 * @returns Current user's profile data with session type
 *
 * @example
 * ```typescript
 * const result = await getAuthMe();
 * if (result.success) {
 *   console.log(`Logged in as: ${result.data.user.username}`);
 * }
 * ```
 */
export async function getAuthMe(): Promise<
  ApiResponse<{
    success: boolean;
    user: {
      id: string;
      username?: string;
      email?: string;
      discordUsername?: string;
      createdAt?: Date;
      roles?: any;
      isLocalGamingStore?: boolean;
      isPatreon?: boolean;
      isShop?: boolean;
      isTcgSeller?: boolean;
    };
    sessionType: string;
  }>
> {
  try {
    const response = await fetch('/api/auth/me');
    return await handleResponse(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Get another user's profile
 *
 * @param userId - Target user's ID
 * @returns User's public profile data
 *
 * @example
 * ```typescript
 * const result = await getUserProfile('user123');
 * if (result.success) {
 *   console.log(result.data.username, result.data.country);
 * }
 * ```
 */
export async function getUserProfile(
  userId: string
): Promise<ApiResponse<UserProfileDTO>> {
  try {
    const response = await fetch(`/api/users/${userId}/profile`);
    return await handleResponse<UserProfileDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Update current user's profile
 *
 * @param updates - Fields to update
 * @returns Updated profile
 *
 * @example
 * ```typescript
 * const result = await updateProfile({
 *   country: 'US',
 *   state: 'CA'
 * });
 * ```
 */
export async function updateProfile(
  updates: UpdateProfileDTO
): Promise<ApiResponse<UserProfileDTO>> {
  try {
    const response = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return await handleResponse<UserProfileDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Complete user's profile (after registration)
 *
 * @param data - Profile completion data
 * @returns Completed profile
 *
 * @example
 * ```typescript
 * const result = await completeProfile({
 *   username: 'mynewusername',
 *   country: 'US',
 *   state: 'CA'
 * });
 * ```
 */
export async function completeProfile(
  data: CompleteProfileDTO
): Promise<ApiResponse<UserProfileDTO>> {
  try {
    const response = await fetch('/api/user/complete-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await handleResponse<UserProfileDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

// ====================================
// User Search Operations
// ====================================

/**
 * Search for a user
 *
 * @param query - Search query (username, Discord ID, or user ID)
 * @returns Matching user or null
 *
 * @example
 * ```typescript
 * const result = await findUser('someusername');
 * if (result.success && result.data) {
 *   console.log(`Found: ${result.data.username}`);
 * }
 * ```
 */
export async function findUser(
  query: string
): Promise<ApiResponse<UserProfileDTO | null>> {
  try {
    const params = buildQueryParams({ q: query });
    const response = await fetch(`/api/users/find?${params.toString()}`);
    return await handleResponse<UserProfileDTO | null>(response);
  } catch (error) {
    return handleError(error);
  }
}

// ====================================
// Trade Analysis Operations
// ====================================

/**
 * Get trade compatibility analysis with another user
 *
 * Returns comprehensive trade analysis including match percentages,
 * compatibility scores, and optionally detailed card lists.
 *
 * @param targetUserId - The user to analyze trades with
 * @param format - Response format ('full', 'summary', or 'quick')
 * @param options - Additional options (includeCards, matchOnPrintingId)
 * @returns Trade analysis with matches and values
 *
 * @example
 * ```typescript
 * const result = await getTradeAnalysis('user123', 'summary', {
 *   includeCards: true,
 *   matchOnPrintingId: true
 * });
 * if (result.success) {
 *   console.log(`Compatibility: ${result.data.match_summary.compatibility_score}%`);
 *   console.log(`Trade potential: ${result.data.trade_potential}`);
 * }
 * ```
 */
export async function getTradeAnalysis(
  targetUserId: string,
  format: 'full' | 'summary' | 'quick' = 'summary',
  options?: TradeAnalysisOptions
): Promise<ApiResponse<TradeAnalysisFullDTO>> {
  try {
    const params = buildQueryParams({
      targetUserId,
      format,
      includeCards: options?.includeCards ? 'true' : undefined,
      matchOnPrintingId: options?.matchOnPrintingId !== false ? 'true' : 'false',
    });
    const response = await fetch(`/api/trade-analysis?${params.toString()}`);
    return await handleResponse<TradeAnalysisFullDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Get match rate percentage with another user
 *
 * @param targetUserId - The user to check match rate with
 * @returns Match rate data
 *
 * @example
 * ```typescript
 * const result = await getMatchRate('user123');
 * if (result.success) {
 *   console.log(`Match rate: ${result.data.matchRate}%`);
 * }
 * ```
 */
export async function getMatchRate(
  targetUserId: string
): Promise<ApiResponse<MatchRateDTO>> {
  try {
    const params = buildQueryParams({ targetUserId });
    const response = await fetch(`/api/users/match-rate?${params.toString()}`);
    return await handleResponse<MatchRateDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

// ====================================
// Discord Operations
// ====================================

/**
 * Update Discord connection info
 *
 * @param discordData - Discord ID and username
 * @returns Updated profile
 *
 * @example
 * ```typescript
 * const result = await updateDiscordInfo({
 *   discordId: '123456789',
 *   discordUsername: 'myuser#1234'
 * });
 * ```
 */
export async function updateDiscordInfo(
  discordData: UpdateDiscordInfoDTO
): Promise<ApiResponse<UserProfileDTO>> {
  try {
    const response = await fetch('/api/user/update-discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordData),
    });
    return await handleResponse<UserProfileDTO>(response);
  } catch (error) {
    return handleError(error);
  }
}

// ====================================
// Account Operations
// ====================================

/**
 * Delete user's account
 *
 * WARNING: This is permanent and cannot be undone.
 *
 * @returns Success status
 *
 * @example
 * ```typescript
 * const result = await deleteAccount();
 * if (result.success) {
 *   // Redirect to home or login page
 * }
 * ```
 */
export async function deleteAccount(): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const response = await fetch('/api/user/delete-account', {
      method: 'DELETE',
    });
    return await handleResponse<{ success: boolean }>(response);
  } catch (error) {
    return handleError(error);
  }
}
