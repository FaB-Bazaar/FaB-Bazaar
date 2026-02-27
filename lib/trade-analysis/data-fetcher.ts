// lib/trade-analysis/data-fetcher.ts
// NOTE: This file now uses the service layer - no direct MongoDB access.

import { wantsService, inventoryService } from '@/lib/services';
import { Card, WantsList as WantsListType } from './types';

export interface FetchedData {
  targetWantsLists: WantsListType[];
  currentUserTradeableCards: Card[];
  targetUserTradeableCards: Card[];
  currentUserWantsLists: WantsListType[];
}

/**
 * Fetches all required data for trade analysis in parallel
 * Uses service layer for data access
 */
export async function fetchTradeData(
  currentUserId: string,
  targetUserId: string
): Promise<FetchedData> {
  // Validate user IDs
  if (!currentUserId || !targetUserId) {
    throw new Error('Invalid user ID format');
  }

  // Fetch all data in parallel for better performance
  const [
    targetWantsResult,
    currentUserTradeableResult,
    targetUserTradeableResult,
    currentUserWantsResult
  ] = await Promise.all([
    // Target user's wants - what they're looking for
    wantsService.getAllWantsForUser(targetUserId),

    // Current user's tradeable inventory
    inventoryService.getTradeableItems(currentUserId),

    // Target user's tradeable inventory
    inventoryService.getTradeableItems(targetUserId),

    // Current user's wants - what they're looking for
    wantsService.getAllWantsForUser(currentUserId)
  ]);

  // Handle errors from service calls
  if (!targetWantsResult.success) {
    throw new Error(targetWantsResult.error || 'Failed to fetch target wants');
  }
  if (!currentUserTradeableResult.success) {
    throw new Error(currentUserTradeableResult.error || 'Failed to fetch current user tradeable items');
  }
  if (!targetUserTradeableResult.success) {
    throw new Error(targetUserTradeableResult.error || 'Failed to fetch target user tradeable items');
  }
  if (!currentUserWantsResult.success) {
    throw new Error(currentUserWantsResult.error || 'Failed to fetch current user wants');
  }

  const targetWantsItems = targetWantsResult.data;
  const currentUserTradeableCards = currentUserTradeableResult.data as Card[];
  const targetUserTradeableCards = targetUserTradeableResult.data as Card[];
  const currentUserWantsItems = currentUserWantsResult.data;

  // Transform WantsItem arrays to match old WantsList format with cards array
  const targetWantsLists: WantsListType[] = targetWantsItems.length > 0 ? [{
    cards: targetWantsItems as Card[],
    userId: targetUserId
  }] : [];

  const currentUserWantsLists: WantsListType[] = currentUserWantsItems.length > 0 ? [{
    cards: currentUserWantsItems as Card[],
    userId: currentUserId
  }] : [];

  return {
    targetWantsLists,
    currentUserTradeableCards,
    targetUserTradeableCards,
    currentUserWantsLists
  };
}
