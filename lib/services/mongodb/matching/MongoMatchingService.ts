/**
 * MongoDB implementation of Matching Service
 *
 * Handles bilateral trade matching between users.
 * Extracted from /users/match-rate route.
 */

import connectToDatabase from '@/lib/mongodb';
import WantsItem from '@/models/WantsItem';
import InventoryItem from '@/models/InventoryItem';
import mongoose from 'mongoose';
import type {
  IMatchingService,
  MatchRateResultDTO,
  CardMatchDetailDTO,
  MatchCountsDTO,
  MatchDebugDTO,
} from '../../contracts/IMatchingService';
import type { AsyncResult } from '../../contracts/common';

export class MongoMatchingService implements IMatchingService {
  /**
   * Ensures database connection before operations
   */
  private async ensureConnection(): Promise<void> {
    await connectToDatabase();
  }

  /**
   * Helper function to extract printing ID from item
   */
  private getPrintingId(item: any): string | null {
    return item.printingId || null;
  }

  /**
   * Calculate bilateral match rate between two users
   */
  async calculateMatchRate(
    currentUserId: string,
    targetUserId: string
  ): AsyncResult<MatchRateResultDTO> {
    try {
      await this.ensureConnection();

      // Convert IDs to ObjectIds for consistent querying
      const currentUserObjectId = new mongoose.Types.ObjectId(currentUserId);
      const targetUserObjectId = new mongoose.Types.ObjectId(targetUserId);

      // --- DATA FETCHING ---

      // 1. Get both users' wants items
      const [currentUserWants, targetUserWants, currentUserInventory, targetUserInventory] =
        await Promise.all([
          WantsItem.find({ userId: currentUserObjectId }).lean(),
          WantsItem.find({ userId: targetUserObjectId }).lean(),
          // 2. Get ALL inventory items for both users that are available for trade
          InventoryItem.find({
            userId: currentUserObjectId,
            forTrade: true,
            binderAllowWhoHas: true, // Only include items from binders that allow "who has" queries
          }).lean(),
          InventoryItem.find({
            userId: targetUserObjectId,
            forTrade: true,
            binderAllowWhoHas: true,
          }).lean(),
        ]);

      // --- MATCHING LOGIC ---

      // Create maps for O(1) lookup performance
      const currentUserInventoryMap = new Map<
        string,
        { totalQuantity: number; items: any[] }
      >();
      const targetUserInventoryMap = new Map<
        string,
        { totalQuantity: number; items: any[] }
      >();

      // Build inventory maps: printingId -> { totalQuantity, items[] }
      currentUserInventory.forEach((item) => {
        const printingId = this.getPrintingId(item);
        if (!printingId) return;

        if (!currentUserInventoryMap.has(printingId)) {
          currentUserInventoryMap.set(printingId, { totalQuantity: 0, items: [] });
        }
        const existing = currentUserInventoryMap.get(printingId)!;
        existing.totalQuantity += item.quantity || 1;
        existing.items.push(item);
      });

      targetUserInventory.forEach((item) => {
        const printingId = this.getPrintingId(item);
        if (!printingId) return;

        if (!targetUserInventoryMap.has(printingId)) {
          targetUserInventoryMap.set(printingId, { totalQuantity: 0, items: [] });
        }
        const existing = targetUserInventoryMap.get(printingId)!;
        existing.totalQuantity += item.quantity || 1;
        existing.items.push(item);
      });

      // --- CALCULATE "YOU HAVE THEIR WANTS" ---
      let youHaveTheirWantsCount = 0;
      let youHaveTheirWantsTotalQuantity = 0;
      const youHaveTheirWantsDetails: CardMatchDetailDTO[] = [];

      for (const targetWant of targetUserWants) {
        const wantedPrintingId = this.getPrintingId(targetWant);
        if (!wantedPrintingId) continue;

        const youHaveThis = currentUserInventoryMap.get(wantedPrintingId);
        if (youHaveThis) {
          youHaveTheirWantsCount++;
          youHaveTheirWantsTotalQuantity += youHaveThis.totalQuantity;

          // Use the first inventory item for display details
          const firstItem = youHaveThis.items[0];
          youHaveTheirWantsDetails.push({
            name: firstItem.display_name || firstItem.name,
            printingId: wantedPrintingId,
            set: firstItem.set,
            foiling: firstItem.foiling,
            color: firstItem.color || '',
            quantity: youHaveThis.totalQuantity,
            image_url: firstItem.image_url,
            tcg_market: firstItem.tcg_market,
          });

          console.log(
            `✅ YOU HAVE THEIR WANT: ${firstItem.display_name} (${wantedPrintingId})`
          );
        }
      }

      // --- CALCULATE "THEY HAVE YOUR WANTS" ---
      let theyHaveYourWantsCount = 0;
      let theyHaveYourWantsTotalQuantity = 0;
      const theyHaveYourWantsDetails: CardMatchDetailDTO[] = [];

      for (const currentUserWant of currentUserWants) {
        const wantedPrintingId = this.getPrintingId(currentUserWant);
        if (!wantedPrintingId) continue;

        const theyHaveThis = targetUserInventoryMap.get(wantedPrintingId);
        if (theyHaveThis) {
          theyHaveYourWantsCount++;
          theyHaveYourWantsTotalQuantity += theyHaveThis.totalQuantity;

          // Use the first inventory item for display details
          const firstItem = theyHaveThis.items[0];
          theyHaveYourWantsDetails.push({
            name: firstItem.display_name || firstItem.name,
            printingId: wantedPrintingId,
            set: firstItem.set,
            foiling: firstItem.foiling,
            color: firstItem.color || '',
            quantity: theyHaveThis.totalQuantity,
            image_url: firstItem.image_url,
            tcg_market: firstItem.tcg_market,
          });

          console.log(
            `✅ THEY HAVE YOUR WANT: ${firstItem.display_name} (${wantedPrintingId})`
          );
        }
      }

      // --- CALCULATE MATCH RATES ---
      const totalTargetWantsQuantity = targetUserWants.reduce(
        (sum, want) => sum + (want.quantity || 1),
        0
      );
      const totalCurrentUserWantsQuantity = currentUserWants.reduce(
        (sum, want) => sum + (want.quantity || 1),
        0
      );

      const currentUserHasTargetWantsRate =
        totalTargetWantsQuantity > 0
          ? (youHaveTheirWantsTotalQuantity / totalTargetWantsQuantity) * 100
          : 0;

      const targetUserHasCurrentUserWantsRate =
        totalCurrentUserWantsQuantity > 0
          ? (theyHaveYourWantsTotalQuantity / totalCurrentUserWantsQuantity) * 100
          : 0;

      console.log(`📊 FINAL RESULTS:`);
      console.log(
        `You have ${youHaveTheirWantsCount} of their wants (${youHaveTheirWantsTotalQuantity} total quantity)`
      );
      console.log(
        `They have ${theyHaveYourWantsCount} of your wants (${theyHaveYourWantsTotalQuantity} total quantity)`
      );

      const matchCounts: MatchCountsDTO = {
        youHaveTheirWants: youHaveTheirWantsCount,
        youHaveTheirWantsTotalQuantity: youHaveTheirWantsTotalQuantity,
        theyHaveYourWants: theyHaveYourWantsCount,
        theyHaveYourWantsTotalQuantity: theyHaveYourWantsTotalQuantity,
        totalTheirWants: totalTargetWantsQuantity,
        totalYourWants: totalCurrentUserWantsQuantity,
      };

      const debug: MatchDebugDTO = {
        currentUserInventoryCount: currentUserInventory.length,
        targetUserInventoryCount: targetUserInventory.length,
        currentUserWantsCount: currentUserWants.length,
        targetUserWantsCount: targetUserWants.length,
      };

      return {
        success: true,
        data: {
          currentUserHasTargetWantsRate: Number.parseFloat(
            currentUserHasTargetWantsRate.toFixed(1)
          ),
          targetUserHasCurrentUserWantsRate: Number.parseFloat(
            targetUserHasCurrentUserWantsRate.toFixed(1)
          ),
          matchCounts,
          details: {
            youHaveTheirWants: youHaveTheirWantsDetails,
            theyHaveYourWants: theyHaveYourWantsDetails,
          },
          debug,
        },
      };
    } catch (error) {
      console.error('[MongoMatchingService] calculateMatchRate error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate match rate',
      };
    }
  }
}
