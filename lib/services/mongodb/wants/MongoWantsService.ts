/**
 * MongoDB implementation of the Wants Service
 *
 * Handles all wants list operations with proper denormalization
 * and consistent error handling via AsyncResult.
 */

import WantsItem, { type IWantsItem } from '@/models/WantsItem';
import User from '@/models/User';
import connectToDatabase from '@/lib/mongodb';
import { Types } from 'mongoose';
import type {
  IWantsService,
  WantsItemDTO,
  CreateWantsItemDTO,
  UpdateWantsItemDTO,
  WantsFilters,
  AddWantsResultDTO,
  BulkAddWantsResultDTO,
  RemoveWantsResultDTO,
  ImportCardDTO,
  ImportResultDTO,
  WantsListResultDTO,
  PublicWantsResultDTO,
  WhoWantsResultDTO,
  WanterDTO,
  WantsStatsDTO,
  // Batch "who wants" types
  WhoWantsFilters,
  WhoWantsGroupedResultDTO,
  WanterGroupedDTO,
  WantedCardDTO,
  // Export types
  WantsExportDTO,
} from '../../contracts/IWantsService';
import type { AsyncResult, PaginationOptions } from '../../contracts/common';

/**
 * Escape special regex characters to prevent NoSQL injection
 */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class MongoWantsService implements IWantsService {
  /**
   * Ensure database connection before operations
   */
  private async ensureConnection(): Promise<void> {
    await connectToDatabase();
  }

  /**
   * Convert a WantsItem document to DTO
   */
  private toDTO(doc: IWantsItem | any): WantsItemDTO {
    const plain = doc.toObject ? doc.toObject() : doc;
    return {
      _id: plain._id?.toString() || plain._id,
      userId: plain.userId?.toString() || plain.userId,
      printingId: plain.printingId,
      card_unique_id: plain.card_unique_id,
      quantity: plain.quantity || 1,
      priority: plain.priority || 'medium',
      notes: plain.notes,
      value: plain.value,
      // Privacy and flags
      isPublic: plain.isPublic,
      isTemporary: plain.isTemporary,
      forTrade: plain.forTrade,
      forSale: plain.forSale,
      // User organization
      tags: plain.tags,
      condition: plain.condition,
      language: plain.language,
      // Denormalized user fields
      discordUsername: plain.discordUsername,
      discordId: plain.discordId,
      userCountry: plain.userCountry,
      userState: plain.userState,
      // Denormalized card fields
      display_name: plain.display_name,
      name: plain.name,
      set: plain.set,
      edition: plain.edition,
      foiling: plain.foiling,
      rarity: plain.rarity,
      collector_number: plain.collector_number,
      color: plain.color,
      type_text: plain.type_text,
      type_text_display: plain.type_text_display,
      is_extended_art: plain.is_extended_art,
      image_url: plain.image_url,
      tcgplayer_url: plain.tcgplayer_url,
      artVariation: plain.artVariation,
      // Pricing fields
      tcg_low: plain.tcg_low,
      tcg_mid: plain.tcg_mid,
      tcg_high: plain.tcg_high,
      tcg_market: plain.tcg_market,
      has_price: plain.has_price,
      price_updated_at: plain.price_updated_at,
      // Timestamps
      printingCreatedAt: plain.printingCreatedAt,
      printingUpdatedAt: plain.printingUpdatedAt,
      addedAt: plain.addedAt || plain.createdAt,
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
    };
  }

  /**
   * Fetch printing data from the printings collection
   */
  private async getPrintingData(printingId: string): Promise<any | null> {
    const { db } = await connectToDatabase();
    const printingsCollection = db.collection('printings');
    return printingsCollection.findOne({ printing_id: printingId });
  }

  /**
   * Fetch user data for denormalization
   */
  private async getUserData(userId: string): Promise<any | null> {
    try {
      return await User.findById(userId).lean();
    } catch {
      return null;
    }
  }

  /**
   * Build query filter from WantsFilters
   */
  private buildQueryFilter(userId: string, filters?: WantsFilters): any {
    const query: any = { userId: new Types.ObjectId(userId) };

    if (filters?.search) {
      const escapedSearch = escapeRegex(filters.search);
      query.$or = [
        { display_name: { $regex: escapedSearch, $options: 'i' } },
        { name: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    if (filters?.priority) {
      query.priority = filters.priority;
    }

    if (filters?.set) {
      query.set = filters.set;
    }

    if (filters?.rarity) {
      query.rarity = filters.rarity;
    }

    if (filters?.foiling) {
      query.foiling = filters.foiling;
    }

    if (filters?.edition) {
      query.edition = filters.edition;
    }

    return query;
  }

  // ====================================
  // Single Item Operations
  // ====================================

  async getWantsItem(userId: string, printingId: string): AsyncResult<WantsItemDTO | null> {
    try {
      await this.ensureConnection();

      const item = await WantsItem.findOne({
        userId: new Types.ObjectId(userId),
        printingId,
      }).lean();

      if (!item) {
        return { success: true, data: null };
      }

      return { success: true, data: this.toDTO(item) };
    } catch (error) {
      console.error('[MongoWantsService] getWantsItem error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get wants item',
      };
    }
  }

  async addWantsItem(userId: string, data: CreateWantsItemDTO): AsyncResult<AddWantsResultDTO> {
    try {
      await this.ensureConnection();

      const { printingId, quantity = 1, priority = 'medium', notes = '' } = data;

      // Check if item already exists
      const existingItem = await WantsItem.findOne({
        userId: new Types.ObjectId(userId),
        printingId,
      });

      if (existingItem) {
        // Update quantity
        existingItem.quantity += quantity;
        if (priority) existingItem.priority = priority;
        if (notes) existingItem.notes = notes;
        existingItem.updatedAt = new Date();
        await existingItem.save();

        return {
          success: true,
          data: {
            success: true,
            action: 'updated',
            item: this.toDTO(existingItem),
            message: `Updated quantity to ${existingItem.quantity}`,
          },
        };
      }

      // Fetch printing data for denormalization
      const printingData = await this.getPrintingData(printingId);
      if (!printingData) {
        return {
          success: false,
          error: `Printing not found: ${printingId}`,
        };
      }

      // Fetch user data for denormalization
      const userData = await this.getUserData(userId);
      if (!userData) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Create new wants item with denormalized data
      const newItem = await WantsItem.create({
        userId: new Types.ObjectId(userId),
        printingId,
        card_unique_id: printingData.card_unique_id,
        quantity,
        priority,
        notes,
        // Denormalized user fields
        discordUsername: userData.discordUsername || userData.username || 'Unknown',
        discordId: userData.discordId || '',
        userCountry: userData.country,
        userState: userData.state,
        // Denormalized printing fields
        display_name: printingData.display_name || printingData.name,
        name: printingData.name,
        set: printingData.set,
        edition: printingData.edition,
        foiling: printingData.foiling,
        rarity: printingData.rarity,
        collector_number: printingData.collector_number,
        type_text: printingData.type_text,
        image_url: printingData.image_url,
        tcg_low: printingData.tcg_low,
        tcg_mid: printingData.tcg_mid,
        tcg_high: printingData.tcg_high,
        tcg_market: printingData.tcg_market,
        has_price: printingData.has_price,
        addedAt: new Date(),
      });

      return {
        success: true,
        data: {
          success: true,
          action: 'created',
          item: this.toDTO(newItem),
        },
      };
    } catch (error) {
      console.error('[MongoWantsService] addWantsItem error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add wants item',
      };
    }
  }

  async updateWantsItem(
    userId: string,
    printingId: string,
    updates: UpdateWantsItemDTO
  ): AsyncResult<WantsItemDTO> {
    try {
      await this.ensureConnection();

      const item = await WantsItem.findOne({
        userId: new Types.ObjectId(userId),
        printingId,
      });

      if (!item) {
        return {
          success: false,
          error: 'Wants item not found',
        };
      }

      // Apply updates
      if (updates.quantity !== undefined) item.quantity = updates.quantity;
      if (updates.priority !== undefined) item.priority = updates.priority;
      if (updates.notes !== undefined) item.notes = updates.notes;
      if (updates.value !== undefined) item.value = String(updates.value);
      if (updates.set !== undefined) item.set = updates.set;
      if (updates.rarity !== undefined) item.rarity = updates.rarity;
      if (updates.foiling !== undefined) item.foiling = updates.foiling;
      if (updates.edition !== undefined) item.edition = updates.edition;
      if (updates.artVariation !== undefined) item.artVariation = updates.artVariation;
      if (updates.image_url !== undefined) item.image_url = updates.image_url;

      item.updatedAt = new Date();
      await item.save();

      return { success: true, data: this.toDTO(item) };
    } catch (error) {
      console.error('[MongoWantsService] updateWantsItem error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update wants item',
      };
    }
  }

  async removeWantsItem(
    userId: string,
    printingId: string,
    quantity?: number
  ): AsyncResult<RemoveWantsResultDTO> {
    try {
      await this.ensureConnection();

      const item = await WantsItem.findOne({
        userId: new Types.ObjectId(userId),
        printingId,
      });

      if (!item) {
        return {
          success: false,
          error: 'Wants item not found',
        };
      }

      // If no quantity specified or quantity >= current, remove completely
      if (!quantity || quantity >= item.quantity) {
        await WantsItem.deleteOne({
          userId: new Types.ObjectId(userId),
          printingId,
        });

        return {
          success: true,
          data: {
            success: true,
            action: 'removed',
            remainingQuantity: 0,
          },
        };
      }

      // Reduce quantity
      item.quantity -= quantity;
      item.updatedAt = new Date();
      await item.save();

      return {
        success: true,
        data: {
          success: true,
          action: 'reduced',
          remainingQuantity: item.quantity,
        },
      };
    } catch (error) {
      console.error('[MongoWantsService] removeWantsItem error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove wants item',
      };
    }
  }

  // ====================================
  // List Operations
  // ====================================

  async getUserWants(
    userId: string,
    filters?: WantsFilters,
    options?: PaginationOptions
  ): AsyncResult<WantsListResultDTO> {
    try {
      await this.ensureConnection();

      const query = this.buildQueryFilter(userId, filters);
      const skip = options?.skip || 0;
      const limit = options?.limit || 100;
      const sort = options?.sort || { addedAt: -1 };

      const [items, total] = await Promise.all([
        WantsItem.find(query).sort(sort).skip(skip).limit(limit).lean(),
        WantsItem.countDocuments(query),
      ]);

      return {
        success: true,
        data: {
          items: items.map((item) => this.toDTO(item)),
          total,
          page: Math.floor(skip / limit) + 1,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('[MongoWantsService] getUserWants error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get wants list',
      };
    }
  }

  async countUserWants(userId: string): AsyncResult<number> {
    try {
      await this.ensureConnection();

      const count = await WantsItem.countDocuments({
        userId: new Types.ObjectId(userId),
      });

      return { success: true, data: count };
    } catch (error) {
      console.error('[MongoWantsService] countUserWants error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to count wants',
      };
    }
  }

  async getTotalWantsQuantity(userId: string): AsyncResult<number> {
    try {
      await this.ensureConnection();

      const result = await WantsItem.aggregate([
        { $match: { userId: new Types.ObjectId(userId) } },
        { $group: { _id: null, totalQuantity: { $sum: '$quantity' } } },
      ]);

      const totalQuantity = result.length > 0 ? result[0].totalQuantity : 0;
      return { success: true, data: totalQuantity };
    } catch (error) {
      console.error('[MongoWantsService] getTotalWantsQuantity error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get total wants quantity',
      };
    }
  }

  async getWantsStats(userId: string): AsyncResult<WantsStatsDTO> {
    try {
      await this.ensureConnection();

      const result = await WantsItem.aggregate([
        { $match: { userId: new Types.ObjectId(userId) } },
        {
          $group: {
            _id: null,
            // Unique cards (document count)
            totalUniqueCards: { $sum: 1 },
            // Total quantity (sum of all quantities)
            totalCardQuantity: { $sum: { $ifNull: ['$quantity', 1] } },
            // High priority unique count
            highPriorityUniqueCount: {
              $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] },
            },
            // High priority total quantity
            highPriorityQuantity: {
              $sum: {
                $cond: [
                  { $eq: ['$priority', 'high'] },
                  { $ifNull: ['$quantity', 1] },
                  0,
                ],
              },
            },
            // Total estimated value (price * quantity)
            totalEstimatedValue: {
              $sum: {
                $multiply: [
                  { $ifNull: ['$tcg_market', { $ifNull: ['$tcg_mid', 0] }] },
                  { $ifNull: ['$quantity', 1] },
                ],
              },
            },
          },
        },
      ]);

      const stats = result[0] || {
        totalUniqueCards: 0,
        totalCardQuantity: 0,
        highPriorityUniqueCount: 0,
        highPriorityQuantity: 0,
        totalEstimatedValue: 0,
      };

      return {
        success: true,
        data: {
          totalUniqueCards: stats.totalUniqueCards,
          totalCardQuantity: stats.totalCardQuantity,
          highPriorityUniqueCount: stats.highPriorityUniqueCount,
          highPriorityQuantity: stats.highPriorityQuantity,
          totalEstimatedValue: stats.totalEstimatedValue,
        },
      };
    } catch (error) {
      console.error('[MongoWantsService] getWantsStats error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get wants stats',
      };
    }
  }

  async getPublicWants(
    userId: string,
    filters?: WantsFilters,
    options?: PaginationOptions
  ): AsyncResult<PublicWantsResultDTO> {
    try {
      await this.ensureConnection();

      // Fetch user to get user info
      const user = await User.findById(userId).lean();
      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // NOTE: Wants lists are always public, so no privacy check is needed
      const query = this.buildQueryFilter(userId, filters);

      const skip = options?.skip || 0;
      const limit = options?.limit || 100;
      const sort = options?.sort || { addedAt: -1 };

      const [items, total] = await Promise.all([
        WantsItem.find(query).sort(sort).skip(skip).limit(limit).lean(),
        WantsItem.countDocuments(query),
      ]);

      return {
        success: true,
        data: {
          items: items.map((item) => this.toDTO(item)),
          total,
          user: {
            _id: (user._id as Types.ObjectId).toString(),
            username: user.username,
            discordUsername: user.discordUsername,
            country: user.country,
            state: user.state,
          },
          isPublic: true, // Always true
        },
      };
    } catch (error) {
      console.error('[MongoWantsService] getPublicWants error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get public wants',
      };
    }
  }

  // ====================================
  // Bulk Operations
  // ====================================

  async bulkAddWants(
    userId: string,
    items: CreateWantsItemDTO[]
  ): AsyncResult<BulkAddWantsResultDTO> {
    try {
      await this.ensureConnection();

      const results: BulkAddWantsResultDTO['results'] = [];
      let added = 0;
      let updated = 0;
      let failed = 0;

      for (const item of items) {
        const result = await this.addWantsItem(userId, item);

        if (result.success) {
          results.push({
            printingId: item.printingId,
            success: true,
            action: result.data.action,
          });

          if (result.data.action === 'created') {
            added++;
          } else {
            updated++;
          }
        } else {
          results.push({
            printingId: item.printingId,
            success: false,
            error: result.error,
          });
          failed++;
        }
      }

      return {
        success: true,
        data: {
          summary: {
            total: items.length,
            added,
            updated,
            failed,
          },
          results,
        },
      };
    } catch (error) {
      console.error('[MongoWantsService] bulkAddWants error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to bulk add wants',
      };
    }
  }

  async bulkImportWants(userId: string, cards: ImportCardDTO[]): AsyncResult<ImportResultDTO> {
    try {
      await this.ensureConnection();

      const { db } = await connectToDatabase();
      const printingsCollection = db.collection('printings');

      let added = 0;
      let updated = 0;
      let skipped = 0;
      let notFound = 0;
      const notFoundCards: string[] = [];
      const results: ImportResultDTO['results'] = [];

      for (const card of cards) {
        let printingId = card.printingId;
        let cardName = card.name;

        // If no printingId, look up by name
        if (!printingId && cardName) {
          const escapedCardName = escapeRegex(cardName);
          const query: any = {
            $or: [
              { name: { $regex: `^${escapedCardName}$`, $options: 'i' } },
              { display_name: { $regex: `^${escapedCardName}$`, $options: 'i' } },
            ],
          };

          // Add pitch filter if provided
          if (card.pitch !== undefined) {
            query.pitch = card.pitch;
          }

          const printing = await printingsCollection.findOne(query);

          if (printing) {
            printingId = printing.printing_id;
          } else {
            notFound++;
            notFoundCards.push(cardName);
            results?.push({
              name: cardName,
              success: false,
              error: 'Card not found',
            });
            continue;
          }
        }

        if (!printingId) {
          skipped++;
          results?.push({
            name: cardName,
            success: false,
            error: 'No printingId or name provided',
          });
          continue;
        }

        // Add or update the wants item
        const result = await this.addWantsItem(userId, {
          printingId,
          quantity: card.quantity || 1,
          priority: card.priority || 'medium',
        });

        if (result.success) {
          if (result.data.action === 'created') {
            added++;
          } else {
            updated++;
          }
          results?.push({
            printingId,
            name: cardName,
            success: true,
            action: result.data.action,
          });
        } else {
          skipped++;
          results?.push({
            printingId,
            name: cardName,
            success: false,
            error: result.error,
          });
        }
      }

      return {
        success: true,
        data: {
          summary: {
            added,
            updated,
            skipped,
            notFound,
          },
          notFoundCards,
          results,
        },
      };
    } catch (error) {
      console.error('[MongoWantsService] bulkImportWants error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import wants',
      };
    }
  }

  // ====================================
  // "Who Wants" Queries
  // ====================================

  async getWhoWantsPrinting(
    printingId: string,
    options?: PaginationOptions
  ): AsyncResult<WhoWantsResultDTO> {
    try {
      await this.ensureConnection();

      const skip = options?.skip || 0;
      const limit = options?.limit || 50;
      const sort = options?.sort || { addedAt: -1 };

      // NOTE: No isPublic filter - wants lists are always public
      const query = {
        printingId,
      };

      const [items, total] = await Promise.all([
        WantsItem.find(query).sort(sort).skip(skip).limit(limit).lean(),
        WantsItem.countDocuments(query),
      ]);

      const wanters: WanterDTO[] = items.map((item: any) => ({
        userId: item.userId?.toString(),
        username: item.discordUsername,
        discordUsername: item.discordUsername,
        discordId: item.discordId,
        country: item.userCountry,
        state: item.userState,
        quantity: item.quantity,
        priority: item.priority,
        addedAt: item.addedAt || item.createdAt,
      }));

      // Get card name from first item
      const cardName = items.length > 0 ? (items[0] as any).display_name : undefined;

      return {
        success: true,
        data: {
          wanters,
          total,
          printingId,
          cardName,
        },
      };
    } catch (error) {
      console.error('[MongoWantsService] getWhoWantsPrinting error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get wanters',
      };
    }
  }

  async getWhoWantsCard(
    cardUniqueId: string,
    options?: PaginationOptions
  ): AsyncResult<WhoWantsResultDTO> {
    try {
      await this.ensureConnection();

      const skip = options?.skip || 0;
      const limit = options?.limit || 50;
      const sort = options?.sort || { addedAt: -1 };

      // NOTE: No isPublic filter - wants lists are always public
      const query = {
        card_unique_id: cardUniqueId,
      };

      const [items, total] = await Promise.all([
        WantsItem.find(query).sort(sort).skip(skip).limit(limit).lean(),
        WantsItem.countDocuments(query),
      ]);

      const wanters: WanterDTO[] = items.map((item: any) => ({
        userId: item.userId?.toString(),
        username: item.discordUsername,
        discordUsername: item.discordUsername,
        discordId: item.discordId,
        country: item.userCountry,
        state: item.userState,
        quantity: item.quantity,
        priority: item.priority,
        addedAt: item.addedAt || item.createdAt,
      }));

      // Get card name from first item
      const cardName = items.length > 0 ? (items[0] as any).name : undefined;

      return {
        success: true,
        data: {
          wanters,
          total,
          cardUniqueId,
          cardName,
        },
      };
    } catch (error) {
      console.error('[MongoWantsService] getWhoWantsCard error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get wanters',
      };
    }
  }

  // ====================================
  // Batch "Who Wants" Queries (for API route)
  // ====================================

  /**
   * Shared implementation for batch who wants queries
   */
  private async executeWhoWantsQuery(
    searchIds: string[],
    searchMode: 'specific_printings' | 'all_versions',
    filters: WhoWantsFilters = {},
    options: PaginationOptions = {}
  ): AsyncResult<WhoWantsGroupedResultDTO> {
    try {
      // Validate input
      if (!searchIds.length) {
        return { success: false, error: 'No valid IDs provided' };
      }
      if (searchIds.length > 20) {
        return { success: false, error: 'Too many IDs (max 20)' };
      }

      await this.ensureConnection();

      const page = Math.floor((options.skip || 0) / (options.limit || 50)) + 1;
      const limit = options.limit || 50;

      // Build query
      const query: Record<string, any> = {};

      if (searchMode === 'all_versions') {
        query.card_unique_id = { $in: searchIds };
      } else {
        query.printingId = { $in: searchIds };
      }

      // Geo filtering
      if (filters.country) {
        query.userCountry = filters.country;
      }
      if (filters.state) {
        query.userState = filters.state;
      }

      // Execute query - no isPublic filter, wants are always public
      const allWantsItems = await WantsItem.find(query).lean();

      // Group results by user
      const wanterMap = new Map<
        string,
        {
          user_id: string;
          username: string;
          discord_id: string | null;
          country: string | null;
          wanted_cards: Map<string, WantedCardDTO>;
          total_cards_wanted: number;
          total_value: number;
          unique_printings_wanted: Set<string>;
          high_priority_count: number;
        }
      >();

      for (const item of allWantsItems) {
        // Skip items missing required data
        if (!item.discordUsername) {
          continue;
        }

        const userId = item.userId.toString();

        // Create user entry if needed
        if (!wanterMap.has(userId)) {
          wanterMap.set(userId, {
            user_id: userId,
            username: item.discordUsername,
            discord_id: item.discordId || null,
            country: item.userCountry || null,
            wanted_cards: new Map(),
            total_cards_wanted: 0,
            total_value: 0,
            unique_printings_wanted: new Set(),
            high_priority_count: 0,
          });
        }

        const wanter = wanterMap.get(userId)!;
        const printingId = item.printingId;

        // Create card entry if needed
        if (!wanter.wanted_cards.has(printingId)) {
          wanter.wanted_cards.set(printingId, {
            printing_id: printingId,
            display_name: item.display_name,
            quantity: 0,
            priority: item.priority,
            notes: item.notes || '',
            tcg_market: item.tcg_market || 0,
            tcg_low: item.tcg_low || 0,
            set: item.set,
            edition: item.edition,
            foiling: item.foiling,
            rarity: item.rarity,
            color: item.color || '',
            image_url: item.image_url || '',
            tags: item.tags || [],
          });
        }

        const card = wanter.wanted_cards.get(printingId)!;
        card.quantity += item.quantity;

        // Update user totals
        wanter.total_cards_wanted += item.quantity;
        wanter.total_value += (item.tcg_low || 0) * item.quantity;
        wanter.unique_printings_wanted.add(printingId);

        if (item.priority === 'high') {
          wanter.high_priority_count++;
        }
      }

      // Convert to arrays and format
      let wanters: WanterGroupedDTO[] = Array.from(wanterMap.values()).map(
        (wanter) => ({
          user_id: wanter.user_id,
          username: wanter.username,
          discord_id: wanter.discord_id,
          country: wanter.country,
          wanted_cards: Array.from(wanter.wanted_cards.values()),
          total_cards_wanted: wanter.total_cards_wanted,
          total_value: Math.round(wanter.total_value * 100) / 100,
          unique_printings_wanted: wanter.unique_printings_wanted.size,
          high_priority_count: wanter.high_priority_count,
        })
      );

      // Apply sorting
      const sortBy = filters.sortBy || 'username';
      switch (sortBy) {
        case 'quantity':
          wanters.sort((a, b) => b.total_cards_wanted - a.total_cards_wanted);
          break;
        case 'priority':
          wanters.sort((a, b) => b.high_priority_count - a.high_priority_count);
          break;
        case 'username':
        default:
          wanters.sort((a, b) => a.username.localeCompare(b.username));
          break;
      }

      // Paginate
      const totalWanters = wanters.length;
      const totalPages = Math.ceil(totalWanters / limit);
      const startIndex = (page - 1) * limit;
      const paginatedWanters = wanters.slice(startIndex, startIndex + limit);

      // Build summary
      const summary = {
        total_wanters_found: totalWanters,
        total_cards_wanted: wanters.reduce(
          (sum, w) => sum + w.total_cards_wanted,
          0
        ),
        total_unique_printings: new Set(
          allWantsItems.map((item) => item.printingId)
        ).size,
        high_priority_total: wanters.reduce(
          (sum, w) => sum + w.high_priority_count,
          0
        ),
        page,
        limit,
        total_pages: totalPages,
        search_mode: searchMode,
        filters_applied: {
          country: filters.country || null,
          state: filters.state || null,
        },
      };

      return {
        success: true,
        data: {
          wanters: paginatedWanters,
          summary,
        },
      };
    } catch (error) {
      console.error('[MongoWantsService] executeWhoWantsQuery error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to find wanters',
      };
    }
  }

  /**
   * Find all users who want specific printings (batch query)
   */
  async getWhoWantsPrintings(
    printingIds: string[],
    filters?: WhoWantsFilters,
    options?: PaginationOptions
  ): AsyncResult<WhoWantsGroupedResultDTO> {
    return this.executeWhoWantsQuery(
      printingIds,
      'specific_printings',
      filters,
      options
    );
  }

  /**
   * Find all users who want any printing of specified cards (batch query)
   */
  async getWhoWantsCards(
    cardUniqueIds: string[],
    filters?: WhoWantsFilters,
    options?: PaginationOptions
  ): AsyncResult<WhoWantsGroupedResultDTO> {
    return this.executeWhoWantsQuery(
      cardUniqueIds,
      'all_versions',
      filters,
      options
    );
  }

  // ====================================
  // Trade Analysis Methods
  // ====================================

  /**
   * Get all wants items for a user
   *
   * Returns all wants items for a user (simplified format for trade analysis).
   * No pagination - returns all items.
   */
  async getAllWantsForUser(userId: string): AsyncResult<WantsItemDTO[]> {
    try {
      await this.ensureConnection();

      const items = await WantsItem.find({
        userId: new Types.ObjectId(userId),
      }).lean();

      return {
        success: true,
        data: items.map((item) => this.toDTO(item)),
      };
    } catch (error) {
      console.error('[MongoWantsService] getAllWantsForUser error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get all wants for user',
      };
    }
  }

  // ====================================
  // Export Methods
  // ====================================

  /**
   * Export all wants items for a user
   *
   * Returns all user's wants with full card details for export.
   * Used by /user/export/wants endpoint.
   */
  async exportWants(userId: string): AsyncResult<WantsExportDTO[]> {
    try {
      await this.ensureConnection();

      const items = await WantsItem.find({
        userId: new Types.ObjectId(userId),
      })
        .sort({ addedAt: -1 }) // Most recent first
        .lean();

      const exportData: WantsExportDTO[] = items.map((item: any) => ({
        printingId: item.printingId,
        display_name: item.display_name || item.name || 'Unknown Card',
        set: item.set || '',
        foiling: item.foiling || 'Regular',
        quantity: item.quantity || 1,
        priority: item.priority || 'medium',
        notes: item.notes,
        addedAt: item.addedAt || item.createdAt || new Date(),
        tcg_market: item.tcg_market,
        tcg_low: item.tcg_low,
        image_url: item.image_url,
      }));

      return {
        success: true,
        data: exportData,
      };
    } catch (error) {
      console.error('[MongoWantsService] exportWants error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export wants',
      };
    }
  }
}
