/**
 * MongoDB implementation of Denormalization Service
 *
 * Handles syncing denormalized fields across inventory items and wants items
 * when source documents are updated.
 */

import connectToDatabase from '@/lib/mongodb';
import { Types } from 'mongoose';
import type {
  IDenormalizationService,
  SyncResultDTO,
  CleanupResultDTO,
  BatchSyncResultDTO,
} from '../../contracts/IDenormalizationService';
import type { AsyncResult } from '../../contracts/common';

export class MongoDenormalizationService implements IDenormalizationService {
  /**
   * Ensure database connection and return db reference
   */
  private async getDb() {
    const { db } = await connectToDatabase();
    return db;
  }

  // ====================================
  // Binder Denormalization
  // ====================================

  /**
   * Sync inventory items with binder settings
   */
  async syncInventoryWithBinder(
    binderId: string,
    inventoryItemId?: string
  ): AsyncResult<SyncResultDTO> {
    try {
      const db = await this.getDb();
      const binderObjectId = new Types.ObjectId(binderId);

      // Get the current binder settings
      const binder = await db.collection('binders').findOne(
        { _id: binderObjectId },
        { projection: { visibility: 1, isPublic: 1, name: 1, slug: 1 } }
      );

      if (!binder) {
        console.warn(`[MongoDenormalizationService] Binder ${binderId} not found`);
        return { success: true, data: { syncedCount: 0 } };
      }

      // Derive binderIsPublic from visibility.level (source of truth)
      // 'public' and 'unlisted' are viewable; fallback to isPublic for legacy data
      const level = binder.visibility?.level;
      let isPublicDerived: boolean;
      if (level === 'public' || level === 'unlisted') {
        isPublicDerived = true;
      } else if (level === 'private' || level === 'friends') {
        isPublicDerived = false;
      } else {
        // Legacy data without visibility.level - use isPublic directly
        isPublicDerived = binder.isPublic === true;
      }

      // Determine what to sync - all visibility fields
      const syncData = {
        binderAllowWhoHas: binder.visibility?.allowWhoHas === true,
        binderAllowInSearch: binder.visibility?.allowInSearch === true,
        binderAllowInMatching: binder.visibility?.allowInMatching === true,
        binderAllowDiscordCommands: binder.visibility?.allowDiscordCommands === true,
        binderAllowApiExport: binder.visibility?.allowApiExport === true,
        binderIsPublic: isPublicDerived,
        binderName: binder.name,
        binderSlug: binder.slug,
      };

      // Update specific item or all items in binder
      const query = inventoryItemId
        ? { _id: new Types.ObjectId(inventoryItemId), binderId: binderObjectId }
        : { binderId: binderObjectId };

      const result = await db.collection('inventory_items').updateMany(
        query,
        { $set: syncData }
      );

      console.log(`[MongoDenormalizationService] Synced ${result.modifiedCount} inventory items with binder ${binderId} settings`);

      return { success: true, data: { syncedCount: result.modifiedCount } };
    } catch (error) {
      console.error(`[MongoDenormalizationService] Failed to sync inventory items with binder ${binderId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync inventory with binder',
      };
    }
  }

  // ====================================
  // Wants List Denormalization
  // ====================================

  /**
   * Sync wants items with user data
   */
  async syncWantsWithUser(userId: string): AsyncResult<SyncResultDTO> {
    try {
      const db = await this.getDb();
      const userObjectId = new Types.ObjectId(userId);

      // Get the current user data
      const user = await db.collection('users').findOne(
        { _id: userObjectId },
        {
          projection: {
            discordUsername: 1,
            username: 1,
            discordId: 1,
            country: 1,
            state: 1,
          },
        }
      );

      if (!user) {
        console.warn(`[MongoDenormalizationService] User ${userId} not found`);
        return { success: true, data: { syncedCount: 0 } };
      }

      // Prepare denormalized user fields
      const syncData = {
        discordUsername: user.discordUsername || user.username || 'Unknown',
        discordId: user.discordId || '',
        userCountry: user.country,
        userState: user.state,
        updatedAt: new Date(),
      };

      // Update all wants items for this user
      const result = await db.collection('wants_items').updateMany(
        { userId: userObjectId },
        { $set: syncData }
      );

      console.log(`[MongoDenormalizationService] Synced ${result.modifiedCount} wants items with user ${userId} data`);

      return { success: true, data: { syncedCount: result.modifiedCount } };
    } catch (error) {
      console.error(`[MongoDenormalizationService] Failed to sync wants items with user ${userId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync wants with user',
      };
    }
  }

  /**
   * Sync wants items with printing data
   */
  async syncWantsWithPrinting(printingId: string): AsyncResult<SyncResultDTO> {
    try {
      const db = await this.getDb();

      // Get the current printing data
      const printing = await db.collection('printings').findOne(
        { printing_id: printingId }
      );

      if (!printing) {
        console.warn(`[MongoDenormalizationService] Printing ${printingId} not found`);
        return { success: true, data: { syncedCount: 0 } };
      }

      // Prepare denormalized printing fields
      const syncData: Record<string, any> = {
        card_unique_id: printing.card_unique_id,
        display_name: printing.display_name || printing.name,
        name: printing.name,
        set: printing.set,
        edition: printing.edition,
        foiling: printing.foiling,
        rarity: printing.rarity,
        collector_number: printing.collector_number,
        color: printing.color,
        type_text: printing.type_text,
        type_text_display: printing.type_text_display,
        is_extended_art: printing.is_extended_art,
        image_url: printing.image_url,
        tcgplayer_url: printing.tcgplayer_url,
        tcg_low: printing.tcg_low,
        tcg_mid: printing.tcg_mid,
        tcg_high: printing.tcg_high,
        tcg_market: printing.tcg_market,
        has_price: printing.has_price,
        updatedAt: new Date(),
      };

      // Add optional date fields if present
      if (printing.price_updated_at) {
        syncData.price_updated_at = new Date(printing.price_updated_at);
      }
      if (printing.createdAt) {
        syncData.printingCreatedAt = new Date(printing.createdAt);
      }
      if (printing.updatedAt) {
        syncData.printingUpdatedAt = new Date(printing.updatedAt);
      }

      // Update all wants items for this printing
      const result = await db.collection('wants_items').updateMany(
        { printingId },
        { $set: syncData }
      );

      console.log(`[MongoDenormalizationService] Synced ${result.modifiedCount} wants items with printing ${printingId} data`);

      return { success: true, data: { syncedCount: result.modifiedCount } };
    } catch (error) {
      console.error(`[MongoDenormalizationService] Failed to sync wants items with printing ${printingId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync wants with printing',
      };
    }
  }

  /**
   * Batch sync multiple printings at once
   */
  async batchSyncWantsWithPrintings(
    printingIds: string[]
  ): AsyncResult<BatchSyncResultDTO> {
    try {
      let totalSynced = 0;
      let itemsProcessed = 0;

      for (const printingId of printingIds) {
        const result = await this.syncWantsWithPrinting(printingId);
        if (result.success) {
          totalSynced += result.data.syncedCount;
        }
        itemsProcessed++;
      }

      console.log(`[MongoDenormalizationService] Batch synced ${itemsProcessed} printings, ${totalSynced} items updated`);

      return {
        success: true,
        data: { totalSynced, itemsProcessed },
      };
    } catch (error) {
      console.error('[MongoDenormalizationService] Failed batch sync:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed batch sync',
      };
    }
  }

  // ====================================
  // Cleanup Operations
  // ====================================

  /**
   * Clean up wants items for a deleted user
   */
  async cleanupUserWantsItems(userId: string): AsyncResult<CleanupResultDTO> {
    try {
      const db = await this.getDb();
      const userObjectId = new Types.ObjectId(userId);

      const result = await db.collection('wants_items').deleteMany(
        { userId: userObjectId }
      );

      console.log(`[MongoDenormalizationService] Deleted ${result.deletedCount} wants items for user ${userId}`);

      return { success: true, data: { deletedCount: result.deletedCount } };
    } catch (error) {
      console.error(`[MongoDenormalizationService] Failed to cleanup wants items for user ${userId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cleanup user wants items',
      };
    }
  }

  /**
   * Clean up wants items for a deleted printing
   */
  async cleanupPrintingWantsItems(printingId: string): AsyncResult<CleanupResultDTO> {
    try {
      const db = await this.getDb();

      const result = await db.collection('wants_items').deleteMany(
        { printingId }
      );

      console.log(`[MongoDenormalizationService] Deleted ${result.deletedCount} wants items for printing ${printingId}`);

      return { success: true, data: { deletedCount: result.deletedCount } };
    } catch (error) {
      console.error(`[MongoDenormalizationService] Failed to cleanup wants items for printing ${printingId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cleanup printing wants items',
      };
    }
  }
}
