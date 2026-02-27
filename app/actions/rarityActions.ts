"use server"; // This directive is crucial. It marks all functions in this file as server-only.

import { binderStatsService, binderService, wantsService } from '@/lib/services';

/**
 * Calculates and updates complete stats (including rarity counts) for a single binder.
 * Migrated to use binderStatsService (2026-01-12).
 *
 * @param binderId The binder ID string (or pass binder._id if you have a document)
 */
export async function recalculateAndSaveBinder(binderId: string) {
  try {
    // Use binderStatsService to calculate and save complete stats
    const result = await binderStatsService.updateStats(binderId);

    if (!result.success) {
      throw new Error(result.error || 'Failed to update binder stats');
    }

    console.log(`[RarityAction] Updated binder ${binderId} via statsService:`, result.data?.rarityCounts);
    return { success: true };
  } catch (error) {
    console.error(`[RarityAction] Failed to recalculate and save binder ${binderId}:`, error);
    return { success: false, error: 'Failed to save binder with new counts.' };
  }
}

/**
 * Recalculates complete stats for ALL binders belonging to a specific user.
 * Migrated to use binderService and binderStatsService (2026-01-12).
 *
 * @param userId The string representation of the user's ID.
 */
export async function recalculateAllUserBinders(userId: string) {
  try {
    if (!userId) throw new Error("User ID is required.");

    // Get all user's binders using service layer
    const bindersResult = await binderService.getUserBinders(userId);

    if (!bindersResult.success) {
      throw new Error(bindersResult.error || 'Failed to fetch user binders');
    }

    const binders = bindersResult.data || [];

    if (binders.length === 0) {
      console.log(`[RarityAction] No binders found for user ${userId}. Nothing to update.`);
      return { success: true, updatedCount: 0 };
    }

    // Update stats for each binder concurrently using binderStatsService
    const updatePromises = binders.map(binder =>
      binderStatsService.updateStats(binder._id)
    );

    await Promise.all(updatePromises);

    console.log(`[RarityAction] Successfully updated ${binders.length} binders for user ${userId} via statsService.`);
    return { success: true, updatedCount: binders.length };
  } catch (error) {
    console.error(`[RarityAction] Failed to recalculate binders for user ${userId}:`, error);
    return { success: false, error: 'Failed to recalculate user binders.' };
  }
}

// ============================================================================
// LEGACY/DEPRECATED FUNCTIONS
// ============================================================================
// The functions below are for the old WantsList schema (embedded cards array).
// The schema was migrated to use normalized WantsItem documents.
// The WantsList model no longer exists (/models/WantsList.ts deleted).
// These functions are kept for backwards compatibility but cannot run.
// Modern wants system uses wantsService with wants_items collection.
// ============================================================================

/**
 * @deprecated Legacy function for old WantsList schema (no longer exists)
 * Modern schema uses WantsItem collection - use wantsService instead
 */
export async function recalculateAndSaveWantsList(wantsList: any) {
  console.warn('[RarityAction] recalculateAndSaveWantsList is deprecated. WantsList model no longer exists.');
  console.warn('[RarityAction] Modern schema uses WantsItem collection. Use wantsService for wants operations.');
  return { success: false, error: "WantsList model no longer exists. Use wantsService with wants_items collection." };
}

/**
 * @deprecated Legacy function for old WantsList schema (no longer exists)
 * Modern schema uses WantsItem collection - use wantsService instead
 */
export async function recalculateAllUserWantsLists(userId: string) {
  console.warn('[RarityAction] recalculateAllUserWantsLists is deprecated. WantsList model no longer exists.');
  console.warn('[RarityAction] Modern schema uses WantsItem collection. Use wantsService for wants operations.');
  return { success: false, error: "WantsList model no longer exists. Use wantsService with wants_items collection." };
}