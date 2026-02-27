/**
 * MongoDB implementation of Binder Service
 *
 * This class implements the IBinderService contract using MongoDB/Mongoose.
 * All MongoDB-specific code is isolated here, making it easy to swap
 * databases by creating a different implementation (e.g., PostgresBinderService).
 */

import Binder, { type IBinder } from '@/models/Binder';
import InventoryItem from '@/models/InventoryItem';
import connectToDatabase from '@/lib/mongodb';
import type {
  IBinderService,
  BinderDTO,
  CreateBinderDTO,
  UpdateBinderDTO,
  BinderListFilters,
  AddCardDTO,
  AddCardsResultDTO,
  BinderCardFilters,
  BinderCardSearchOptions,
  BinderCardsResult,
  InventoryCardDTO,
  UpdateCardDTO,
  SwapPrintingResultDTO,
  BulkUpdateResultDTO,
  TransferResultDTO,
  TransferCardInput,
  TransferSelectedResultDTO,
  CopyBinderOptions,
  BulkToggleByPrintingResult,
  UserCollectionFilters,
  UserCollectionOptions,
  UserCollectionResult,
  PrintingAlternativesResult,
  BinderSummaryDTO,
  ExportCardsResult,
  BinderStatsInfo,
  BinderWithStatsDTO,
  CardSearchResultDTO,
} from '../../contracts/IBinderService';
import type { AsyncResult, PaginationOptions } from '../../contracts/common';
import { Types } from 'mongoose';
import { printingsService } from '../../index';
import mongoose from 'mongoose';

export class MongoBinderService implements IBinderService {
  /**
   * Ensures database connection before operations
   */
  private async ensureConnection(): Promise<void> {
    await connectToDatabase();
  }

  /**
   * Convert Mongoose document to DTO
   */
  private toDTO(doc: IBinder): BinderDTO {
    return {
      _id: doc._id.toString(),
      userId: doc.userId.toString(),
      name: doc.name,
      description: doc.description,
      isPublic: doc.isPublic,
      visibility: doc.visibility,
      tags: doc.tags,
      archived: doc.archived,
      slug: doc.slug,
      discordExternalId: doc.discordExternalId,
      discordUsername: doc.discordUsername,
      discordId: doc.discordId,
      isOnHand: doc.isOnHand,
      thumbnailPrintingId: doc.thumbnailPrintingId,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,

      // Include stats fields when present (calculated by MongoBinderStatsService)
      totalQuantity: doc.totalQuantity,
      quantityForTrade: doc.quantityForTrade,
      quantityNotForTrade: doc.quantityNotForTrade,
      totalValue: doc.totalValue,
      valueForTrade: doc.valueForTrade,
      valueNotForTrade: doc.valueNotForTrade,
      rarityCounts: doc.rarityCounts,
      rarityCountsForTrade: doc.rarityCountsForTrade,
      rarityCountsNotForTrade: doc.rarityCountsNotForTrade,
      showcaseCards: doc.showcaseCards,
      statsUpdatedAt: doc.statsUpdatedAt,
      statsNeedUpdate: doc.statsNeedUpdate,
    };
  }

  /**
   * Check if a binder is viewable by non-owners based on visibility.level
   * visibility.level is the source of truth:
   * - 'public' and 'unlisted' are viewable
   * - 'private' and 'friends' are not (friends requires separate friend check)
   * - Falls back to isPublic for legacy data without visibility.level
   */
  private isBinderViewable(binder: {
    visibility?: { level?: string };
    isPublic?: boolean;
  }): boolean {
    const level = binder.visibility?.level;
    if (level === 'public' || level === 'unlisted') return true;
    // Fallback to isPublic only if visibility.level is undefined (legacy data)
    if (level === undefined) return binder.isPublic === true;
    return false;
  }

  /**
   * Check if user owns the binder
   * @private
   */
  private async checkOwnership(
    binderId: string,
    userId: string
  ): AsyncResult<IBinder> {
    const binder = await Binder.findById(binderId);

    if (!binder) {
      return { success: false, error: 'Binder not found' };
    }

    if (binder.userId.toString() !== userId) {
      return {
        success: false,
        error: 'Access denied: You do not own this binder',
      };
    }

    return { success: true, data: binder };
  }

  /**
   * Create a new binder
   */
  async createBinder(
    userId: string,
    data: CreateBinderDTO
  ): AsyncResult<BinderDTO> {
    try {
      await this.ensureConnection();

      // Validate mcp-binder uniqueness
      if (data.slug === 'mcp-binder') {
        const existingMcpBinder = await Binder.findOne({
          userId: new Types.ObjectId(userId),
          slug: 'mcp-binder'
        });

        if (existingMcpBinder) {
          return {
            success: false,
            error: 'You already have an MCP binder. Only one MCP binder is allowed per user.'
          };
        }
      }

      const binder = new Binder({
        userId: new Types.ObjectId(userId),
        name: data.name,
        description: data.description,
        isPublic: data.isPublic ?? true,
        visibility: data.visibility,
        tags: data.tags || [],
        slug: data.slug,
        discordUsername: data.discordUsername,
        discordId: data.discordId,
      });

      await binder.save();

      return {
        success: true,
        data: this.toDTO(binder),
      };
    } catch (error) {
      console.error('[MongoBinderService] createBinder error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create binder',
      };
    }
  }

  /**
   * Get single binder (with optional access control)
   */
  async getBinder(
    binderId: string,
    requestingUserId?: string
  ): AsyncResult<BinderDTO | null> {
    try {
      await this.ensureConnection();

      const binder = await Binder.findById(binderId);

      if (!binder) {
        return { success: true, data: null };
      }

      // If requesting user is provided, check access
      if (requestingUserId) {
        const isOwner = binder.userId.toString() === requestingUserId;
        const isViewable = this.isBinderViewable(binder);

        if (!isOwner && !isViewable) {
          return {
            success: false,
            error: 'Access denied: This binder is private',
          };
        }
      }

      return {
        success: true,
        data: this.toDTO(binder),
      };
    } catch (error) {
      console.error('[MongoBinderService] getBinder error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get binder',
      };
    }
  }

  /**
   * Update binder (ownership required)
   */
  async updateBinder(
    binderId: string,
    userId: string,
    updates: UpdateBinderDTO
  ): AsyncResult<BinderDTO> {
    try {
      await this.ensureConnection();

      // Check ownership first
      const ownershipCheck = await this.checkOwnership(binderId, userId);
      if (!ownershipCheck.success) {
        return ownershipCheck as AsyncResult<BinderDTO>;
      }

      const binder = ownershipCheck.data;

      // Apply updates
      if (updates.name !== undefined) binder.name = updates.name;
      if (updates.description !== undefined)
        binder.description = updates.description;
      if (updates.isPublic !== undefined) binder.isPublic = updates.isPublic;
      if (updates.visibility !== undefined) {
        binder.visibility = {
          ...binder.visibility,
          ...updates.visibility,
        };
        // Sync isPublic based on visibility.level for legacy consumers
        const level = binder.visibility?.level;
        if (level === 'public' || level === 'unlisted') {
          binder.isPublic = true;
        } else if (level === 'private' || level === 'friends') {
          binder.isPublic = false;
        }
      }
      if (updates.tags !== undefined) binder.tags = updates.tags;
      if (updates.archived !== undefined) binder.archived = updates.archived;
      if (updates.slug !== undefined) binder.slug = updates.slug;
      if (updates.thumbnailPrintingId !== undefined)
        binder.thumbnailPrintingId = updates.thumbnailPrintingId;

      await binder.save();

      return {
        success: true,
        data: this.toDTO(binder),
      };
    } catch (error) {
      console.error('[MongoBinderService] updateBinder error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update binder',
      };
    }
  }

  /**
   * Delete binder (ownership required)
   * NOTE: Also cascades delete to InventoryItems
   */
  async deleteBinder(
    binderId: string,
    userId: string
  ): AsyncResult<boolean> {
    try {
      await this.ensureConnection();

      // Check ownership first
      const ownershipCheck = await this.checkOwnership(binderId, userId);
      if (!ownershipCheck.success) {
        return ownershipCheck as AsyncResult<boolean>;
      }

      // Delete the binder
      await Binder.findByIdAndDelete(binderId);

      // CASCADE: Delete all inventory items for this binder
      await InventoryItem.deleteMany({
        binderId: new Types.ObjectId(binderId),
      });

      console.log(
        `[MongoBinderService] Deleted binder ${binderId} and cascaded to InventoryItems`
      );

      return { success: true, data: true };
    } catch (error) {
      console.error('[MongoBinderService] deleteBinder error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete binder',
      };
    }
  }

  /**
   * List binders with filters and pagination
   */
  async listBinders(
    filters: BinderListFilters,
    options?: PaginationOptions
  ): AsyncResult<BinderDTO[]> {
    try {
      await this.ensureConnection();

      // Build query
      const query: any = {};

      if (filters.userId) {
        query.userId = new Types.ObjectId(filters.userId);
      }

      if (filters.isPublic !== undefined) {
        query.isPublic = filters.isPublic;
      }

      if (filters.archived !== undefined) {
        // When archived=false, we want to exclude archived binders but include those where archived is undefined
        // When archived=true, we want only explicitly archived binders
        if (filters.archived === false) {
          query.archived = { $ne: true };
        } else {
          query.archived = filters.archived;
        }
      }

      if (filters.tags && filters.tags.length > 0) {
        query.tags = { $in: filters.tags };
      }

      if (filters.discordId) {
        query.discordId = filters.discordId;
      }

      // Build query with pagination
      let queryBuilder = Binder.find(query);

      // Apply sorting
      if (options?.sort) {
        queryBuilder = queryBuilder.sort(options.sort);
      } else {
        // Default sort: newest first
        queryBuilder = queryBuilder.sort({ createdAt: -1 });
      }

      // Apply pagination
      if (options?.skip) {
        queryBuilder = queryBuilder.skip(options.skip);
      }

      if (options?.limit) {
        queryBuilder = queryBuilder.limit(options.limit);
      }

      const binders = await queryBuilder.exec();

      return {
        success: true,
        data: binders.map((binder) => this.toDTO(binder)),
      };
    } catch (error) {
      console.error('[MongoBinderService] listBinders error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to list binders',
      };
    }
  }

  /**
   * Check if user has access to binder
   * Returns true if user owns the binder OR binder is viewable (public/unlisted)
   */
  async checkAccess(
    binderId: string,
    userId: string
  ): AsyncResult<boolean> {
    try {
      await this.ensureConnection();

      const binder = await Binder.findById(binderId).select(
        'userId isPublic visibility'
      );

      if (!binder) {
        return { success: false, error: 'Binder not found' };
      }

      // User owns it OR it's viewable (public/unlisted)
      const hasAccess =
        binder.userId.toString() === userId || this.isBinderViewable(binder);

      return { success: true, data: hasAccess };
    } catch (error) {
      console.error('[MongoBinderService] checkAccess error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to check access',
      };
    }
  }

  // ========================================
  // Card Management Operations (Phase 2B)
  // ========================================

  /**
   * Convert InventoryItem Mongoose document to DTO
   */
  private inventoryItemToDTO(doc: any): InventoryCardDTO {
    return {
      _id: doc._id.toString(),
      userId: doc.userId.toString(),
      binderId: doc.binderId.toString(),
      printingId: doc.printingId,
      quantity: doc.quantity,
      condition: doc.condition,
      language: doc.language,
      notes: doc.notes,
      forTrade: doc.forTrade,
      forSale: doc.forSale,
      acquisitionPrice: doc.acquisitionPrice,
      acquisitionDate: doc.acquisitionDate,
      addedAt: doc.addedAt,
      updatedAt: doc.updatedAt,
      discordUsername: doc.discordUsername,
      discordId: doc.discordId,
      userCountry: doc.userCountry,
      userState: doc.userState,
      binderName: doc.binderName,
      binderSlug: doc.binderSlug,
      binderIsPublic: doc.binderIsPublic,
      card_unique_id: doc.card_unique_id,
      name: doc.name,
      display_name: doc.display_name,
      collector_number: doc.collector_number,
      set: doc.set,
      edition: doc.edition,
      foiling: doc.foiling,
      rarity: doc.rarity,
      is_extended_art: doc.is_extended_art,
      type_text: doc.type_text,
      type_text_display: doc.type_text_display,
      image_url: doc.image_url,
      tcg_market: doc.tcg_market,
      tcg_low: doc.tcg_low,
      tcg_mid: doc.tcg_mid,
      tcg_high: doc.tcg_high,
      has_price: doc.has_price,
      price_updated_at: doc.price_updated_at,
      tcgplayer_url: doc.tcgplayer_url,
    };
  }

  /**
   * Add cards to binder
   */
  async addCardsToBinder(
    binderId: string,
    userId: string,
    cards: AddCardDTO[]
  ): AsyncResult<AddCardsResultDTO> {
    try {
      await this.ensureConnection();

      // Check ownership
      const ownershipCheck = await this.checkOwnership(binderId, userId);
      if (!ownershipCheck.success) {
        return ownershipCheck as AsyncResult<AddCardsResultDTO>;
      }

      const binder = ownershipCheck.data;

      // Fetch user data for denormalization
      const { db } = await connectToDatabase();
      const user = await db.collection('users').findOne({
        _id: new mongoose.Types.ObjectId(userId),
      });

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Aggregate cards by printingId (sum quantities for same printing)
      const aggregatedCards = new Map<string, AddCardDTO>();
      for (const card of cards) {
        if (aggregatedCards.has(card.printingId)) {
          const existing = aggregatedCards.get(card.printingId)!;
          existing.quantity = (existing.quantity || 1) + (card.quantity || 1);
        } else {
          aggregatedCards.set(card.printingId, {
            ...card,
            quantity: card.quantity || 1,
          });
        }
      }

      const processedCards = Array.from(aggregatedCards.values());

      // Fetch printing details using service layer
      const uniquePrintingIds = processedCards.map((c) => c.printingId);
      const printingsResult =
        await printingsService.getPrintingsByIds(uniquePrintingIds);

      if (!printingsResult.success) {
        return {
          success: false,
          error: 'Failed to fetch printing details: ' + printingsResult.error,
        };
      }

      const printingDocs = printingsResult.data.printings;
      const printingMap = new Map(
        printingDocs.map((p) => [p.printing_id, p])
      );

      // Find existing items
      const existingItems = await InventoryItem.find({
        binderId: binder._id,
        printingId: { $in: uniquePrintingIds },
      });
      const existingItemsMap = new Map(
        existingItems.map((item) => [item.printingId, item])
      );

      const operations: any[] = [];
      const results: AddCardsResultDTO['results'] = [];
      const filteredItems: any[] = [];

      // Process each card
      for (const card of processedCards) {
        const printingDoc = printingMap.get(card.printingId);

        if (!printingDoc) {
          results.push({
            printingId: card.printingId,
            success: false,
            error: 'Printing not found',
          });
          continue;
        }

        const existingItem = existingItemsMap.get(card.printingId);
        const quantityToAdd = card.quantity || 1;

        if (existingItem) {
          // Update existing item
          operations.push({
            updateOne: {
              filter: { _id: existingItem._id },
              update: { $inc: { quantity: quantityToAdd } },
            },
          });
          results.push({
            printingId: card.printingId,
            success: true,
            action: 'updated',
            quantityAdded: quantityToAdd,
          });
        } else {
          // Create new item with denormalized fields
          const {
            _id: printingDocId,
            printing_id,
            created_at,
            updated_at,
            ...printingFields
          } = printingDoc as any;

          const newInventoryItem = {
            userId: new Types.ObjectId(userId),
            binderId: binder._id,
            printingId: printing_id,
            quantity: quantityToAdd,
            condition: card.condition || 'NM',
            language: card.language || 'EN',
            notes: card.notes || '',
            forTrade: card.forTrade !== undefined ? card.forTrade : true,
            forSale: card.forSale !== undefined ? card.forSale : false,
            acquisitionPrice: card.acquisitionPrice || printingDoc.tcg_market,
            acquisitionDate: card.acquisitionDate,
            addedAt: new Date(),

            // Denormalized user fields
            discordUsername: user.username || user.discordUsername,
            discordId: user.discordId,
            userCountry: user.country,
            userState: user.state,

            // Denormalized binder fields
            binderName: binder.name,
            binderSlug: binder.slug,
            binderIsPublic: binder.isPublic,
            binderAllowWhoHas: binder.visibility?.allowWhoHas === true,
            binderAllowInSearch: binder.visibility?.allowInSearch === true,
            binderAllowInMatching: binder.visibility?.allowInMatching === true,
            binderAllowDiscordCommands:
              binder.visibility?.allowDiscordCommands === true,
            binderAllowApiExport: binder.visibility?.allowApiExport === true,
            binderAllowWebhooks: binder.visibility?.allowWebhooks === true,

            // Renamed printing timestamps
            printingCreatedAt: created_at,
            printingUpdatedAt: updated_at,

            // All other printing fields
            ...printingFields,
          };

          operations.push({
            insertOne: { document: newInventoryItem },
          });
          results.push({
            printingId: card.printingId,
            success: true,
            action: 'added',
            quantityAdded: quantityToAdd,
          });
        }
      }

      // Execute bulk operations
      if (operations.length > 0) {
        await InventoryItem.bulkWrite(operations);
      }

      // Mark binder stats as needing update
      await Binder.updateOne(
        { _id: binder._id },
        { $set: { statsNeedUpdate: true } }
      );

      // Calculate summary
      const summary = {
        total: results.length,
        added: results.filter((r) => r.action === 'added').length,
        updated: results.filter((r) => r.action === 'updated').length,
        failed: results.filter((r) => !r.success).length,
        filtered: filteredItems.length,
      };

      return {
        success: true,
        data: {
          summary,
          results,
          filteredItems: filteredItems.length > 0 ? filteredItems : undefined,
        },
      };
    } catch (error) {
      console.error('[MongoBinderService] addCardsToBinder error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to add cards to binder',
      };
    }
  }

  /**
   * Get binder cards with filtering, sorting, and pagination
   */
  async getBinderCards(
    binderId: string,
    filters: BinderCardFilters,
    options: BinderCardSearchOptions
  ): AsyncResult<BinderCardsResult> {
    try {
      await this.ensureConnection();

      // Fetch all cards from binder
      const allCards = await InventoryItem.find({
        binderId: new Types.ObjectId(binderId),
      })
        .lean()
        .exec();

      // Server-side filtering
      let filteredCards = allCards.filter((card: any) => {
        // Search filter
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          if (!card.display_name?.toLowerCase().includes(searchLower)) {
            return false;
          }
        }

        // Exact match filters
        if (filters.rarity && card.rarity !== filters.rarity) return false;
        if (filters.foiling && card.foiling !== filters.foiling) return false;
        if (filters.set && card.set !== filters.set) return false;
        if (filters.condition && card.condition !== filters.condition)
          return false;

        // Boolean filters
        if (filters.forTrade !== undefined && card.forTrade !== filters.forTrade)
          return false;

        return true;
      });

      // Server-side sorting
      const sortBy = options.sortBy || 'default';
      const sortedCards = [...filteredCards]; // Don't mutate

      switch (sortBy) {
        case 'name':
          sortedCards.sort((a: any, b: any) =>
            (a.display_name || '').localeCompare(b.display_name || '')
          );
          break;
        case 'quantity-desc':
          sortedCards.sort((a: any, b: any) => (b.quantity || 0) - (a.quantity || 0));
          break;
        case 'quantity-asc':
          sortedCards.sort((a: any, b: any) => (a.quantity || 0) - (b.quantity || 0));
          break;
        case 'tcg-market-desc':
          sortedCards.sort(
            (a: any, b: any) => (b.tcg_market || 0) - (a.tcg_market || 0)
          );
          break;
        case 'tcg-market-asc':
          sortedCards.sort(
            (a: any, b: any) => (a.tcg_market || 0) - (b.tcg_market || 0)
          );
          break;
        case 'tcg-low-desc':
          sortedCards.sort((a: any, b: any) => (b.tcg_low || 0) - (a.tcg_low || 0));
          break;
        case 'tcg-low-asc':
          sortedCards.sort((a: any, b: any) => (a.tcg_low || 0) - (b.tcg_low || 0));
          break;
        default:
          // 'default' - sort by addedAt (newest first)
          sortedCards.sort((a: any, b: any) => {
            const dateA = new Date(a.addedAt || 0).getTime();
            const dateB = new Date(b.addedAt || 0).getTime();
            return dateB - dateA;
          });
          break;
      }

      // Generate metadata
      const rarities = new Set<string>();
      const foilings = new Set<string>();
      const sets = new Set<string>();
      const conditions = new Set<string>();
      let forTradeCount = 0;

      for (const card of allCards) {
        if (card.rarity) rarities.add(card.rarity);
        if (card.foiling) foilings.add(card.foiling);
        if (card.set) sets.add(card.set);
        if (card.condition) conditions.add(card.condition);
        if (card.forTrade) forTradeCount++;
      }

      const metadata = {
        uniqueValues: {
          rarities: Array.from(rarities).filter(Boolean).sort(),
          foilings: Array.from(foilings).filter(Boolean).sort(),
          sets: Array.from(sets).filter(Boolean).sort(),
          conditions: Array.from(conditions).filter(Boolean).sort(),
        },
        counts: {
          forTrade: forTradeCount,
          notForTrade: allCards.length - forTradeCount,
        },
      };

      // Pagination
      const page = options.page || 1;
      const limit = options.limit || 48;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedCards = sortedCards.slice(startIndex, endIndex);

      // Convert to DTOs
      const cardDTOs = paginatedCards.map((card) =>
        this.inventoryItemToDTO(card)
      );

      const totalPages = Math.ceil(sortedCards.length / limit);

      return {
        success: true,
        data: {
          cards: cardDTOs,
          pagination: {
            page,
            limit,
            total: sortedCards.length,
            totalPages,
          },
          metadata,
        },
      };
    } catch (error) {
      console.error('[MongoBinderService] getBinderCards error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get binder cards',
      };
    }
  }

  /**
   * Get single card from binder
   */
  async getBinderCard(
    binderId: string,
    cardId: string,
    requestingUserId?: string
  ): AsyncResult<InventoryCardDTO | null> {
    try {
      await this.ensureConnection();

      // Find the card
      const card = await InventoryItem.findOne({
        _id: new Types.ObjectId(cardId),
        binderId: new Types.ObjectId(binderId),
      }).lean();

      if (!card) {
        return { success: true, data: null };
      }

      // If requesting user is provided, check access
      if (requestingUserId) {
        const binder = await Binder.findById(binderId).select(
          'userId isPublic visibility'
        );

        if (!binder) {
          return { success: false, error: 'Binder not found' };
        }

        const isOwner = binder.userId.toString() === requestingUserId;
        const isViewable = this.isBinderViewable(binder);

        if (!isOwner && !isViewable) {
          return {
            success: false,
            error: 'Access denied: This binder is private',
          };
        }
      }

      return {
        success: true,
        data: this.inventoryItemToDTO(card),
      };
    } catch (error) {
      console.error('[MongoBinderService] getBinderCard error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get binder card',
      };
    }
  }

  /**
   * Update a single card in binder
   */
  async updateBinderCard(
    binderId: string,
    cardId: string,
    userId: string,
    updates: UpdateCardDTO
  ): AsyncResult<InventoryCardDTO> {
    try {
      await this.ensureConnection();

      // Check ownership
      const ownershipCheck = await this.checkOwnership(binderId, userId);
      if (!ownershipCheck.success) {
        return ownershipCheck;
      }
      const binder = ownershipCheck.data!;

      // Build update data
      const updateData: any = { updatedAt: new Date() };
      if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
      if (updates.condition !== undefined) updateData.condition = updates.condition;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.forTrade !== undefined) updateData.forTrade = updates.forTrade;
      if (updates.forSale !== undefined) updateData.forSale = updates.forSale;
      if (updates.language !== undefined) updateData.language = updates.language;

      // Update the card
      const updatedCard = await InventoryItem.findOneAndUpdate(
        {
          _id: new Types.ObjectId(cardId),
          binderId: new Types.ObjectId(binderId),
        },
        { $set: updateData },
        { new: true }
      ).lean();

      if (!updatedCard) {
        return {
          success: false,
          error: 'Card not found in this binder',
        };
      }

      // Mark binder as needing stats update
      await Binder.updateOne(
        { _id: binder._id },
        { $set: { statsNeedUpdate: true } }
      );

      return {
        success: true,
        data: this.inventoryItemToDTO(updatedCard),
      };
    } catch (error) {
      console.error('[MongoBinderService] updateBinderCard error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update binder card',
      };
    }
  }

  /**
   * Swap card to different printing
   * If duplicate exists, merge quantities and delete original
   * Otherwise, update printing data while preserving user metadata
   */
  async swapCardPrinting(
    binderId: string,
    cardId: string,
    userId: string,
    newPrintingId: string
  ): AsyncResult<SwapPrintingResultDTO> {
    try {
      await this.ensureConnection();

      if (!newPrintingId) {
        return {
          success: false,
          error: 'Missing newPrintingId',
        };
      }

      // Check ownership
      const ownershipCheck = await this.checkOwnership(binderId, userId);
      if (!ownershipCheck.success) {
        return ownershipCheck;
      }
      const binder = ownershipCheck.data!;

      // 1. Fetch the new printing data using service layer
      const printingResult = await printingsService.getPrintingById(
        newPrintingId
      );

      if (!printingResult.success || !printingResult.data) {
        return {
          success: false,
          error: printingResult.error || 'New printing data not found',
        };
      }

      const newPrintingData = printingResult.data;

      // 2. Check if user owns the inventory item and it's in the right binder
      const existingItem = await InventoryItem.findOne({
        _id: new Types.ObjectId(cardId),
        userId: new Types.ObjectId(userId),
        binderId: binder._id,
      });

      if (!existingItem) {
        return {
          success: false,
          error: 'Inventory item not found or access denied',
        };
      }

      // 3. Check if user already has this printing in the same binder
      const duplicateCheck = await InventoryItem.findOne({
        userId: new Types.ObjectId(userId),
        binderId: binder._id,
        printingId: newPrintingId,
        _id: { $ne: new Types.ObjectId(cardId) }, // Exclude current item
      });

      // If duplicate exists, merge quantities and delete the original
      if (duplicateCheck) {
        const newQuantity = duplicateCheck.quantity + existingItem.quantity;

        const mergeUpdates: any = {
          quantity: newQuantity,
          updatedAt: new Date(),
          forTrade: duplicateCheck.forTrade || existingItem.forTrade,
          forSale: duplicateCheck.forSale || existingItem.forSale,
        };

        // Preserve acquisition info if newer
        if (
          existingItem.acquisitionDate &&
          (!duplicateCheck.acquisitionDate ||
            new Date(existingItem.acquisitionDate) >
              new Date(duplicateCheck.acquisitionDate))
        ) {
          mergeUpdates.acquisitionPrice = existingItem.acquisitionPrice;
          mergeUpdates.acquisitionDate = existingItem.acquisitionDate;
        }

        // Merge notes if both have notes and they're different
        if (
          existingItem.notes &&
          duplicateCheck.notes &&
          existingItem.notes !== duplicateCheck.notes
        ) {
          mergeUpdates.notes = `${duplicateCheck.notes} | Merged: ${existingItem.notes}`;
        }

        await InventoryItem.updateOne(
          { _id: duplicateCheck._id },
          { $set: mergeUpdates }
        );

        await InventoryItem.deleteOne({ _id: new Types.ObjectId(cardId) });

        // Mark binder as needing stats update
        await Binder.updateOne(
          { _id: binder._id },
          { $set: { statsNeedUpdate: true } }
        );

        // Fetch the updated card for return
        const updatedCard = await InventoryItem.findById(duplicateCheck._id).lean();

        return {
          success: true,
          data: {
            success: true,
            message: `Printing swapped and quantities merged. You now have ${newQuantity} copies of this printing.`,
            merged: true,
            newQuantity: newQuantity,
            mergedIntoCardId: duplicateCheck._id.toString(),
            updatedCard: updatedCard ? this.inventoryItemToDTO(updatedCard) : undefined,
          },
        };
      }

      // 4. No duplicate - update ONLY the printing-specific fields, preserve user metadata
      const updateFields: any = {
        printingId: newPrintingData.printing_id,
        printing_id: newPrintingData.printing_id,
        name: newPrintingData.name,
        display_name: newPrintingData.display_name,
        collector_number: newPrintingData.collector_number,
        foiling: newPrintingData.foiling,
        edition: newPrintingData.edition,
        set: newPrintingData.set,
        rarity: newPrintingData.rarity,
        is_extended_art: newPrintingData.is_extended_art,
        type_text: newPrintingData.type_text,
        type_text_display: newPrintingData.type_text_display,
        image_url: newPrintingData.image_url,
        tcg_market: newPrintingData.tcg_market,
        tcg_low: newPrintingData.tcg_low,
        tcg_mid: newPrintingData.tcg_mid,
        tcg_high: newPrintingData.tcg_high,
        has_price: newPrintingData.has_price,
        price_updated_at: newPrintingData.price_updated_at,
        tcgplayer_url: newPrintingData.tcgplayer_url,
        updated_at: new Date(),
        updatedAt: new Date(),
      };

      // 5. Perform the update
      await InventoryItem.updateOne(
        { _id: new Types.ObjectId(cardId) },
        { $set: updateFields }
      );

      // Mark binder as needing stats update
      await Binder.updateOne(
        { _id: binder._id },
        { $set: { statsNeedUpdate: true } }
      );

      // Fetch the updated card for return
      const updatedCard = await InventoryItem.findById(cardId).lean();

      return {
        success: true,
        data: {
          success: true,
          message: 'Printing swapped successfully',
          merged: false,
          updatedCard: updatedCard ? this.inventoryItemToDTO(updatedCard) : undefined,
        },
      };
    } catch (error) {
      console.error('[MongoBinderService] swapCardPrinting error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to swap card printing',
      };
    }
  }

  /**
   * Delete a card from binder
   */
  async deleteBinderCard(
    binderId: string,
    cardId: string,
    userId: string
  ): AsyncResult<boolean> {
    try {
      await this.ensureConnection();

      // Check ownership
      const ownershipCheck = await this.checkOwnership(binderId, userId);
      if (!ownershipCheck.success) {
        return ownershipCheck;
      }
      const binder = ownershipCheck.data!;

      // Delete the card
      const deletedCard = await InventoryItem.findOneAndDelete({
        _id: new Types.ObjectId(cardId),
        binderId: binder._id,
      });

      if (!deletedCard) {
        return {
          success: false,
          error: 'Card not found in this binder',
        };
      }

      // Mark binder as needing stats update
      await Binder.updateOne(
        { _id: binder._id },
        { $set: { statsNeedUpdate: true } }
      );

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('[MongoBinderService] deleteBinderCard error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to delete binder card',
      };
    }
  }

  /**
   * Bulk update cards in binder
   * Can update all cards or specific cards by IDs
   */
  async bulkUpdateCards(
    binderId: string,
    userId: string,
    field: 'forTrade' | 'forSale' | 'condition' | 'language',
    value: any,
    cardIds?: string[]
  ): AsyncResult<BulkUpdateResultDTO> {
    try {
      await this.ensureConnection();

      // Check ownership
      const ownershipCheck = await this.checkOwnership(binderId, userId);
      if (!ownershipCheck.success) {
        return ownershipCheck;
      }
      const binder = ownershipCheck.data!;

      // Build update filter
      const filter: any = {
        binderId: binder._id,
      };

      // If specific card IDs provided, only update those
      if (cardIds && cardIds.length > 0) {
        filter._id = { $in: cardIds.map((id) => new Types.ObjectId(id)) };
      }

      // Build update data
      const updateData: any = {
        [field]: value,
        updatedAt: new Date(),
      };

      // Perform bulk update
      const result = await InventoryItem.updateMany(filter, { $set: updateData });

      // Mark binder as needing stats update
      await Binder.updateOne(
        { _id: binder._id },
        { $set: { statsNeedUpdate: true } }
      );

      return {
        success: true,
        data: {
          success: true,
          modifiedCount: result.modifiedCount,
        },
      };
    } catch (error) {
      console.error('[MongoBinderService] bulkUpdateCards error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to bulk update cards',
      };
    }
  }

  /**
   * Transfer all cards from source binder to target binder
   * Merges quantities for duplicate printings
   */
  async transferAllCards(
    sourceBinderId: string,
    targetBinderId: string,
    userId: string
  ): AsyncResult<TransferResultDTO> {
    try {
      await this.ensureConnection();

      // Validate same binder
      if (sourceBinderId === targetBinderId) {
        return {
          success: false,
          error: 'Source and target binders cannot be the same',
        };
      }

      // Check ownership of both binders
      const [sourceCheck, targetCheck] = await Promise.all([
        this.checkOwnership(sourceBinderId, userId),
        this.checkOwnership(targetBinderId, userId),
      ]);

      if (!sourceCheck.success) return sourceCheck;
      if (!targetCheck.success) return targetCheck;

      const sourceBinder = sourceCheck.data!;
      const targetBinder = targetCheck.data!;

      // Fetch all cards from source binder
      const sourceCards = await InventoryItem.find({
        binderId: sourceBinder._id,
      }).lean();

      if (sourceCards.length === 0) {
        return {
          success: true,
          data: {
            success: true,
            transferred: 0,
            merged: 0,
            message: 'Source binder is empty, nothing to transfer',
          },
        };
      }

      // Fetch existing cards in target binder (to check for duplicates)
      const targetCards = await InventoryItem.find({
        binderId: targetBinder._id,
      }).lean();

      // Create a map of existing target cards by printingId
      const targetCardsMap = new Map(targetCards.map((card) => [card.printingId, card]));

      // Prepare operations
      const operations: any[] = [];
      let transferredCount = 0;
      let mergedCount = 0;

      for (const sourceCard of sourceCards) {
        const existingTargetCard = targetCardsMap.get(sourceCard.printingId);

        if (existingTargetCard) {
          // Duplicate exists - merge quantity and notes
          const newQuantity = existingTargetCard.quantity + sourceCard.quantity;
          const mergedNotes = [existingTargetCard.notes, sourceCard.notes]
            .filter((note) => note && note.trim())
            .join(' | ');

          operations.push({
            updateOne: {
              filter: { _id: existingTargetCard._id },
              update: {
                $set: {
                  quantity: newQuantity,
                  notes: mergedNotes,
                  updatedAt: new Date(),
                },
              },
            },
          });

          mergedCount++;
        } else {
          // New card - prepare to insert with updated binderId
          const { _id, ...cardData } = sourceCard;

          operations.push({
            insertOne: {
              document: {
                ...cardData,
                binderId: targetBinder._id,
                binderName: targetBinder.name,
                binderSlug: targetBinder.slug,
                binderIsPublic: targetBinder.isPublic,
                addedAt: new Date(),
              },
            },
          });

          transferredCount++;
        }
      }

      // Execute all operations in a single bulkWrite
      if (operations.length > 0) {
        await InventoryItem.bulkWrite(operations);
      }

      // Delete all cards from source binder
      await InventoryItem.deleteMany({
        binderId: sourceBinder._id,
      });

      // Mark both binders as needing stats update
      await Promise.all([
        Binder.updateOne(
          { _id: sourceBinder._id },
          { $set: { statsNeedUpdate: true } }
        ),
        Binder.updateOne(
          { _id: targetBinder._id },
          { $set: { statsNeedUpdate: true } }
        ),
      ]);

      return {
        success: true,
        data: {
          success: true,
          transferred: transferredCount,
          merged: mergedCount,
          message: `Successfully transferred ${sourceCards.length} cards from "${sourceBinder.name}" to "${targetBinder.name}"`,
        },
      };
    } catch (error) {
      console.error('[MongoBinderService] transferAllCards error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to transfer cards',
      };
    }
  }

  /**
   * Transfer selected cards from source binder to target binder
   * Supports partial quantity transfers (e.g., transfer 2 of 5 cards)
   */
  async transferSelectedCards(
    sourceBinderId: string,
    targetBinderId: string,
    userId: string,
    cardsToTransfer: TransferCardInput[]
  ): AsyncResult<TransferSelectedResultDTO> {
    try {
      await this.ensureConnection();

      // Validate same binder
      if (sourceBinderId === targetBinderId) {
        return {
          success: false,
          error: 'Source and target binders cannot be the same',
        };
      }

      if (!cardsToTransfer || cardsToTransfer.length === 0) {
        return {
          success: false,
          error: 'No cards specified for transfer',
        };
      }

      // Validate input format
      const invalidInputs = cardsToTransfer.filter(
        (c) => !c.cardId || typeof c.quantity !== 'number' || c.quantity <= 0
      );
      if (invalidInputs.length > 0) {
        return {
          success: false,
          error: 'Invalid card input: each card must have cardId and positive quantity',
        };
      }

      // Check ownership of both binders
      const [sourceCheck, targetCheck] = await Promise.all([
        this.checkOwnership(sourceBinderId, userId),
        this.checkOwnership(targetBinderId, userId),
      ]);

      if (!sourceCheck.success) return sourceCheck as AsyncResult<TransferSelectedResultDTO>;
      if (!targetCheck.success) return targetCheck as AsyncResult<TransferSelectedResultDTO>;

      const sourceBinder = sourceCheck.data!;
      const targetBinder = targetCheck.data!;

      // Fetch selected cards from source binder
      const cardIds = cardsToTransfer.map((c) => c.cardId);
      const sourceCards = await InventoryItem.find({
        _id: { $in: cardIds.map((id) => new Types.ObjectId(id)) },
        binderId: sourceBinder._id,
      }).lean();

      // Create map of source cards by ID
      const sourceCardsMap = new Map(
        sourceCards.map((card: any) => [card._id.toString(), card])
      );

      // Validate all requested cards exist
      const missingCards = cardsToTransfer.filter(
        (c) => !sourceCardsMap.has(c.cardId)
      );
      if (missingCards.length > 0) {
        return {
          success: false,
          error: `${missingCards.length} card(s) not found in source binder`,
        };
      }

      // Validate quantities don't exceed available
      const invalidQuantities = cardsToTransfer.filter((c) => {
        const sourceCard = sourceCardsMap.get(c.cardId);
        return sourceCard && c.quantity > sourceCard.quantity;
      });
      if (invalidQuantities.length > 0) {
        return {
          success: false,
          error: `Requested quantity exceeds available for ${invalidQuantities.length} card(s)`,
        };
      }

      // Fetch existing cards in target binder (to check for duplicates)
      const printingIds = sourceCards.map((card: any) => card.printingId);
      const targetCards = await InventoryItem.find({
        binderId: targetBinder._id,
        printingId: { $in: printingIds },
      }).lean();

      // Create a map of existing target cards by printingId
      const targetCardsMap = new Map(
        targetCards.map((card: any) => [card.printingId, card])
      );

      // Prepare operations
      const sourceOperations: any[] = [];
      const targetOperations: any[] = [];
      const results: TransferSelectedResultDTO['results'] = [];

      let fullyTransferred = 0;
      let partiallyTransferred = 0;
      let mergedInTarget = 0;
      let totalQuantityTransferred = 0;

      for (const { cardId, quantity: transferQuantity } of cardsToTransfer) {
        const sourceCard = sourceCardsMap.get(cardId)!;
        const isFullTransfer = transferQuantity >= sourceCard.quantity;
        const remainingInSource = isFullTransfer ? 0 : sourceCard.quantity - transferQuantity;

        // Handle source binder operations
        if (isFullTransfer) {
          // Delete entire card from source
          sourceOperations.push({
            deleteOne: { filter: { _id: new Types.ObjectId(cardId) } },
          });
          fullyTransferred++;
        } else {
          // Reduce quantity in source
          sourceOperations.push({
            updateOne: {
              filter: { _id: new Types.ObjectId(cardId) },
              update: {
                $set: {
                  quantity: remainingInSource,
                  updatedAt: new Date(),
                },
              },
            },
          });
          partiallyTransferred++;
        }

        // Handle target binder operations
        const existingTargetCard = targetCardsMap.get(sourceCard.printingId);
        let mergedIntoTarget = false;
        let targetQuantity = transferQuantity;

        if (existingTargetCard) {
          // Merge into existing card
          const newTargetQuantity = existingTargetCard.quantity + transferQuantity;
          const mergedNotes = [existingTargetCard.notes, sourceCard.notes]
            .filter((note: string) => note && note.trim())
            .join(' | ');

          targetOperations.push({
            updateOne: {
              filter: { _id: existingTargetCard._id },
              update: {
                $set: {
                  quantity: newTargetQuantity,
                  notes: mergedNotes || '',
                  updatedAt: new Date(),
                },
              },
            },
          });

          mergedIntoTarget = true;
          targetQuantity = newTargetQuantity;
          mergedInTarget++;

          // Update the map so subsequent cards with same printingId know about the new quantity
          targetCardsMap.set(sourceCard.printingId, {
            ...existingTargetCard,
            quantity: newTargetQuantity,
          });
        } else {
          // Insert new card in target
          const { _id, ...cardData } = sourceCard;

          const newTargetCard = {
            ...cardData,
            quantity: transferQuantity,
            binderId: targetBinder._id,
            binderName: targetBinder.name,
            binderSlug: targetBinder.slug,
            binderIsPublic: targetBinder.isPublic,
            binderAllowWhoHas: targetBinder.visibility?.allowWhoHas === true,
            binderAllowInSearch: targetBinder.visibility?.allowInSearch === true,
            binderAllowInMatching: targetBinder.visibility?.allowInMatching === true,
            binderAllowDiscordCommands: targetBinder.visibility?.allowDiscordCommands === true,
            binderAllowApiExport: targetBinder.visibility?.allowApiExport === true,
            binderAllowWebhooks: targetBinder.visibility?.allowWebhooks === true,
            addedAt: new Date(),
          };

          targetOperations.push({
            insertOne: { document: newTargetCard },
          });

          // Add to map for potential subsequent merges
          targetCardsMap.set(sourceCard.printingId, {
            ...newTargetCard,
            _id: 'pending', // Will be assigned on insert
          });
        }

        totalQuantityTransferred += transferQuantity;

        results.push({
          success: true,
          cardId,
          printingId: sourceCard.printingId,
          name: sourceCard.display_name || sourceCard.name,
          action: isFullTransfer ? 'transferred' : 'partial_transfer',
          quantity: transferQuantity,
          remainingInSource,
          mergedInTarget: mergedIntoTarget,
          targetQuantity,
        });
      }

      // Execute all operations
      if (sourceOperations.length > 0) {
        await InventoryItem.bulkWrite(sourceOperations);
      }
      if (targetOperations.length > 0) {
        await InventoryItem.bulkWrite(targetOperations);
      }

      // Mark both binders as needing stats update
      await Promise.all([
        Binder.updateOne(
          { _id: sourceBinder._id },
          { $set: { statsNeedUpdate: true } }
        ),
        Binder.updateOne(
          { _id: targetBinder._id },
          { $set: { statsNeedUpdate: true } }
        ),
      ]);

      return {
        success: true,
        data: {
          success: true,
          summary: {
            totalRequested: cardsToTransfer.length,
            successful: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            fullyTransferred,
            partiallyTransferred,
            mergedInTarget,
            totalQuantityTransferred,
          },
          results,
          message: `Successfully transferred ${totalQuantityTransferred} cards from "${sourceBinder.name}" to "${targetBinder.name}"`,
        },
      };
    } catch (error) {
      console.error('[MongoBinderService] transferSelectedCards error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to transfer cards',
      };
    }
  }

  /**
   * Copy entire binder (creates new binder with all cards)
   * Supports privacy enforcement for copying other users' public binders
   */
  async copyBinder(
    sourceBinderId: string,
    userId: string,
    newName: string,
    options?: CopyBinderOptions
  ): AsyncResult<BinderDTO> {
    try {
      await this.ensureConnection();

      if (!newName || !newName.trim()) {
        return {
          success: false,
          error: 'New binder name is required',
        };
      }

      const enforcePrivacy = options?.enforcePrivacy ?? false;

      // For privacy-enforced copies (copying someone else's binder), we need different access check
      // Check if source binder exists and user has access (owns it or it's public)
      const sourceBinder = await Binder.findById(sourceBinderId);
      if (!sourceBinder) {
        return { success: false, error: 'Source binder not found' };
      }

      const isOwner = sourceBinder.userId.toString() === userId;
      const isPublic = sourceBinder.isPublic === true;

      // If not owner and not public, deny access
      if (!isOwner && !isPublic) {
        return { success: false, error: 'Access denied: This binder is private' };
      }

      // Fetch current user for denormalization (needed if enforcing privacy)
      const { db } = await connectToDatabase();
      let currentUser: any = null;
      if (enforcePrivacy || !isOwner) {
        const userDoc = await db.collection('users').findOne({
          _id: new mongoose.Types.ObjectId(userId),
        });
        if (!userDoc) {
          return { success: false, error: 'User not found' };
        }
        currentUser = userDoc;
      }

      // Create new binder - always private when copying with privacy enforcement
      const newBinderData: any = {
        userId: new Types.ObjectId(userId), // Always assign to copying user
        name: newName,
        description: enforcePrivacy ? '' : sourceBinder.description,
        isPublic: enforcePrivacy ? false : sourceBinder.isPublic,
        visibility: enforcePrivacy
          ? {
              level: 'private',
              allowInSearch: false,
              allowInMatching: false,
              allowDiscordCommands: false,
              allowApiExport: false,
              allowWhoHas: false,
              allowWebhooks: false,
            }
          : sourceBinder.visibility,
        tags: sourceBinder.tags,
        slug: options?.slug,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newBinder = await Binder.create(newBinderData);

      // Fetch all cards from source binder
      const sourceCards = await InventoryItem.find({
        binderId: sourceBinder._id,
      }).lean();

      if (sourceCards.length > 0) {
        // Prepare cards for new binder
        const newCards = sourceCards.map((card: any) => {
          const { _id, ...cardData } = card;

          // Privacy adjustments when copying someone else's binder
          const privacyAdjustments = enforcePrivacy
            ? {
                // Trading/selling - always false for personal copies
                forTrade: false,
                forSale: false,

                // Clear private notes
                notes: '',

                // Reset acquisition to current market price
                acquisitionPrice: card.tcg_market || null,
                acquisitionDate: new Date(),

                // User denormalization - update to current user
                userId: new Types.ObjectId(userId),
                discordUsername: currentUser?.username || currentUser?.discordUsername || '',
                discordId: currentUser?.discordId || '',
                avatarUrl: currentUser?.avatarUrl || '',
                userCountry: currentUser?.country || '',
                userState: currentUser?.state || '',
                userIsStore: false,
                userStoreId: undefined,

                // Binder visibility flags - all disabled for private copy
                binderAllowWhoHas: false,
                binderAllowInSearch: false,
                binderAllowInMatching: false,
                binderAllowDiscordCommands: false,
                binderAllowApiExport: false,
                binderAllowWebhooks: false,
              }
            : {
                // Just update userId for non-privacy copies
                userId: new Types.ObjectId(userId),
              };

          return {
            ...cardData,
            ...privacyAdjustments,
            binderId: newBinder._id,
            binderName: newBinder.name,
            binderSlug: newBinder.slug,
            binderIsPublic: newBinder.isPublic,
            addedAt: new Date(),
          };
        });

        // Insert all cards
        await InventoryItem.insertMany(newCards);

        // Mark new binder as needing stats update
        await Binder.updateOne(
          { _id: newBinder._id },
          { $set: { statsNeedUpdate: true } }
        );
      }

      return {
        success: true,
        data: this.toDTO(newBinder),
      };
    } catch (error) {
      console.error('[MongoBinderService] copyBinder error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to copy binder',
      };
    }
  }

  // ========================================
  // Cross-Binder Operations
  // ========================================

  /**
   * Toggle forTrade status for all cards with specified printing IDs across ALL user's binders
   */
  async toggleForTradeByPrintingIds(
    userId: string,
    printingIds: string[],
    forTrade: boolean
  ): AsyncResult<BulkToggleByPrintingResult> {
    try {
      await this.ensureConnection();

      if (!printingIds || printingIds.length === 0) {
        return {
          success: false,
          error: 'No printing IDs provided',
        };
      }

      const result = await InventoryItem.updateMany(
        {
          userId: new Types.ObjectId(userId),
          printingId: { $in: printingIds },
          quantity: { $gt: 0 },
        },
        {
          $set: { forTrade, updatedAt: new Date() },
        }
      );

      return {
        success: true,
        data: {
          modifiedCount: result.modifiedCount,
          printingIdsProcessed: printingIds.length,
        },
      };
    } catch (error) {
      console.error('[MongoBinderService] toggleForTradeByPrintingIds error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to toggle forTrade by printing IDs',
      };
    }
  }

  /**
   * Get ALL cards across all user's binders with filtering and sorting
   */
  async getAllCardsForUser(
    userId: string,
    filters?: UserCollectionFilters,
    options?: UserCollectionOptions
  ): AsyncResult<UserCollectionResult> {
    try {
      await this.ensureConnection();

      // 1. Fetch user's non-archived binders
      const binders = await Binder.find({
        userId: new Types.ObjectId(userId),
        archived: { $ne: true },
      })
        .select('_id name')
        .lean();

      if (binders.length === 0) {
        return {
          success: true,
          data: {
            cards: [],
            metadata: {
              uniqueValues: {
                rarities: [],
                foilings: [],
                sets: [],
                conditions: [],
              },
              counts: { forTrade: 0, notForTrade: 0 },
            },
            binders: [],
          },
        };
      }

      const binderIds = binders.map((b) => b._id);

      // 2. Fetch ALL cards from all binders
      const allCards = await InventoryItem.find({
        binderId: { $in: binderIds },
      })
        .lean()
        .exec();

      // 3. Generate metadata from ALL cards (before filtering)
      const rarities = new Set<string>();
      const foilings = new Set<string>();
      const sets = new Set<string>();
      const conditions = new Set<string>();
      let forTradeCount = 0;

      for (const card of allCards) {
        if (card.rarity) rarities.add(card.rarity);
        if (card.foiling) foilings.add(card.foiling);
        if (card.set) sets.add(card.set);
        if (card.condition) conditions.add(card.condition);
        if (card.forTrade) forTradeCount++;
      }

      const metadata = {
        uniqueValues: {
          rarities: Array.from(rarities).filter(Boolean).sort(),
          foilings: Array.from(foilings).filter(Boolean).sort(),
          sets: Array.from(sets).filter(Boolean).sort(),
          conditions: Array.from(conditions).filter(Boolean).sort(),
        },
        counts: {
          forTrade: forTradeCount,
          notForTrade: allCards.length - forTradeCount,
        },
      };

      // 4. Apply filtering
      let filteredCards = allCards;

      if (filters) {
        filteredCards = allCards.filter((card: any) => {
          // Search filter
          if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            if (!card.display_name?.toLowerCase().includes(searchLower)) {
              return false;
            }
          }

          // Exact match filters
          if (filters.rarity && card.rarity !== filters.rarity) return false;
          if (filters.foiling && card.foiling !== filters.foiling) return false;
          if (filters.set && card.set !== filters.set) return false;
          if (filters.condition && card.condition !== filters.condition)
            return false;

          // Boolean filters
          if (filters.forTrade !== undefined && card.forTrade !== filters.forTrade)
            return false;

          return true;
        });
      }

      // 5. Apply sorting
      const sortBy = options?.sortBy || 'default';
      const sortedCards = [...filteredCards];

      switch (sortBy) {
        case 'name':
          sortedCards.sort((a: any, b: any) =>
            (a.display_name || '').localeCompare(b.display_name || '')
          );
          break;
        case 'quantity-desc':
          sortedCards.sort((a: any, b: any) => (b.quantity || 0) - (a.quantity || 0));
          break;
        case 'quantity-asc':
          sortedCards.sort((a: any, b: any) => (a.quantity || 0) - (b.quantity || 0));
          break;
        case 'tcg-market-desc':
          sortedCards.sort(
            (a: any, b: any) => (b.tcg_market || 0) - (a.tcg_market || 0)
          );
          break;
        case 'tcg-market-asc':
          sortedCards.sort(
            (a: any, b: any) => (a.tcg_market || 0) - (b.tcg_market || 0)
          );
          break;
        case 'tcg-low-desc':
          sortedCards.sort((a: any, b: any) => (b.tcg_low || 0) - (a.tcg_low || 0));
          break;
        case 'tcg-low-asc':
          sortedCards.sort((a: any, b: any) => (a.tcg_low || 0) - (b.tcg_low || 0));
          break;
        default:
          // 'default' - sort by addedAt (newest first)
          sortedCards.sort((a: any, b: any) => {
            const dateA = new Date(a.addedAt || 0).getTime();
            const dateB = new Date(b.addedAt || 0).getTime();
            return dateB - dateA;
          });
          break;
      }

      // 6. Convert to DTOs
      const cardDTOs = sortedCards.map((card) => this.inventoryItemToDTO(card));

      return {
        success: true,
        data: {
          cards: cardDTOs,
          metadata,
          binders: binders.map((b) => ({
            _id: b._id.toString(),
            name: b.name,
          })),
        },
      };
    } catch (error) {
      console.error('[MongoBinderService] getAllCardsForUser error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get all cards for user',
      };
    }
  }

  /**
   * Get all printing alternatives for a card with user's ownership info
   * Used for printing swap dialogs across binder, deck, and wants contexts
   */
  async getPrintingAlternatives(
    cardUniqueId: string,
    userId?: string
  ): AsyncResult<PrintingAlternativesResult> {
    try {
      await this.ensureConnection();

      if (!cardUniqueId) {
        return {
          success: false,
          error: 'cardUniqueId is required',
        };
      }

      // Fetch all printings for this card using the service layer
      const printingsResult = await printingsService.getPrintingsForCard(cardUniqueId);

      if (!printingsResult.success) {
        return {
          success: false,
          error: printingsResult.error || 'Failed to fetch printings',
        };
      }

      const allPrintings = printingsResult.data.printings;

      if (allPrintings.length === 0) {
        return {
          success: true,
          data: {
            cardUniqueId,
            cardName: '',
            alternatives: [],
          },
        };
      }

      // Build ownership map if userId provided
      let ownedMap = new Map<string, number>();

      if (userId) {
        const inventoryItems = await InventoryItem.find(
          {
            userId: new Types.ObjectId(userId),
            card_unique_id: cardUniqueId,
            quantity: { $gt: 0 },
          },
          {
            printingId: 1,
            quantity: 1,
          }
        ).lean();

        ownedMap = new Map(
          inventoryItems.map((item: any) => [item.printingId, item.quantity])
        );
      }

      // Combine printings with ownership info
      const alternatives = allPrintings.map((printing: any) => ({
        printingId: printing.printing_id,
        name: printing.name,
        display_name: printing.display_name,
        image_url: printing.image_url,
        set: printing.set,
        edition: printing.edition,
        rarity: printing.rarity,
        foiling: printing.foiling,
        is_extended_art: printing.is_extended_art,
        tcg_low: printing.tcg_low,
        tcg_market: printing.tcg_market,
        tcg_mid: printing.tcg_mid,
        tcg_high: printing.tcg_high,
        quantity: ownedMap.get(printing.printing_id) || 0,
        isOwned: ownedMap.has(printing.printing_id),
      }));

      return {
        success: true,
        data: {
          cardUniqueId,
          cardName: allPrintings[0]?.name || '',
          alternatives,
        },
      };
    } catch (error) {
      console.error('[MongoBinderService] getPrintingAlternatives error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get printing alternatives',
      };
    }
  }

  // ====================================
  // Lookup and Export Operations
  // ====================================

  /**
   * Find binder by ID, slug, or discordExternalId
   * Consolidates various binder lookup patterns into a single method
   */
  async findBinderByIdOrSlug(
    identifier: string,
    userId?: string
  ): AsyncResult<BinderDTO | null> {
    try {
      await this.ensureConnection();

      const isObjectId = Types.ObjectId.isValid(identifier);
      let binder: IBinder | null = null;

      if (isObjectId) {
        binder = await Binder.findById(identifier);
        // If userId provided and binder found, verify ownership
        if (userId && binder && binder.userId.toString() !== userId) {
          return { success: true, data: null };
        }
      } else {
        // Handle slug/discordExternalId lookup
        if (userId) {
          binder = await Binder.findOne({
            userId: new Types.ObjectId(userId),
            $or: [{ slug: identifier }, { discordExternalId: identifier }],
          });
        } else {
          binder = await Binder.findOne({
            $or: [{ slug: identifier }, { discordExternalId: identifier }],
          });
        }
      }

      if (!binder) {
        return { success: true, data: null };
      }

      return { success: true, data: this.toDTO(binder) };
    } catch (error) {
      console.error('[MongoBinderService] findBinderByIdOrSlug error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to find binder',
      };
    }
  }

  /**
   * Get all cards for export (no pagination)
   * Used by export routes that need complete card data
   */
  async getAllCardsForExport(
    binderId: string,
    userId?: string
  ): AsyncResult<ExportCardsResult> {
    try {
      await this.ensureConnection();

      // Find the binder
      const binderResult = await this.findBinderByIdOrSlug(binderId, userId);
      if (!binderResult.success) {
        return { success: false, error: binderResult.error };
      }

      if (!binderResult.data) {
        return { success: false, error: 'Binder not found' };
      }

      const binder = binderResult.data;

      // Get all cards from inventory
      const allCards = await InventoryItem.find({
        binderId: new Types.ObjectId(binder._id),
      }).lean();

      // Convert to DTOs
      const cardDTOs: InventoryCardDTO[] = allCards.map((item: any) =>
        this.inventoryItemToDTO(item)
      );

      // Sum quantities for total card count (not just row count)
      const totalCards = cardDTOs.reduce((sum, card) => sum + (card.quantity || 1), 0);

      return {
        success: true,
        data: {
          cards: cardDTOs,
          binderName: binder.name,
          totalCards,
        },
      };
    } catch (error) {
      console.error('[MongoBinderService] getAllCardsForExport error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get cards for export',
      };
    }
  }

  /**
   * List user's binders as lightweight summaries
   * Excludes archived binders by default
   */
  async listUserBindersSummary(userId: string): AsyncResult<BinderSummaryDTO[]> {
    try {
      await this.ensureConnection();

      const binders = await Binder.find(
        { userId: new Types.ObjectId(userId), archived: { $ne: true } },
        { name: 1, slug: 1, discordExternalId: 1 }
      )
        .sort({ updatedAt: -1 })
        .lean();

      const summaries: BinderSummaryDTO[] = binders.map((b: any) => ({
        _id: b._id.toString(),
        name: b.name,
        slug: b.slug,
        discordExternalId: b.discordExternalId,
      }));

      return { success: true, data: summaries };
    } catch (error) {
      console.error('[MongoBinderService] listUserBindersSummary error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to list binder summaries',
      };
    }
  }

  /**
   * Get or create binder by slug
   * Used for Discord bot and API operations that need to ensure a binder exists
   */
  async getOrCreateBinderBySlug(
    userId: string,
    slug: string
  ): AsyncResult<BinderDTO> {
    try {
      await this.ensureConnection();

      // Try to find existing binder by slug or discordExternalId (legacy support)
      let binder = await Binder.findOne({
        userId: new Types.ObjectId(userId),
        $or: [{ slug }, { discordExternalId: slug }],
      });

      if (!binder) {
        // Create new binder with the slug
        binder = new Binder({
          userId: new Types.ObjectId(userId),
          name: slug, // Use slug as initial name
          slug,
          isPublic: false,
          visibility: {
            level: 'private',
            allowInSearch: false,
            allowInMatching: false,
            allowDiscordCommands: true,
            allowApiExport: true,
            allowWhoHas: false,
            allowWebhooks: false,
          },
        });
        await binder.save();
      }

      return { success: true, data: this.toDTO(binder) };
    } catch (error) {
      console.error('[MongoBinderService] getOrCreateBinderBySlug error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get or create binder',
      };
    }
  }

  /**
   * Get user's primary (first) binder
   * Used for legacy export functionality
   */
  async getUserPrimaryBinder(userId: string): AsyncResult<BinderDTO | null> {
    try {
      await this.ensureConnection();

      const binder = await Binder.findOne({
        userId: new Types.ObjectId(userId),
        archived: { $ne: true },
      }).sort({ createdAt: 1 }); // Get oldest (first) non-archived binder

      if (!binder) {
        return { success: true, data: null };
      }

      return { success: true, data: this.toDTO(binder) };
    } catch (error) {
      console.error('[MongoBinderService] getUserPrimaryBinder error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get primary binder',
      };
    }
  }

  /**
   * Get binder stats system info
   * Returns processing statistics from system_info collection
   */
  async getBinderStatsSystemInfo(): AsyncResult<BinderStatsInfo | null> {
    try {
      await this.ensureConnection();

      // Access system_info collection directly via mongoose connection
      const db = mongoose.connection.db;
      if (!db) {
        return { success: false, error: 'Database connection not available' };
      }

      const binderStats = await db.collection('system_info').findOne(
        { _id: 'binder_stats_system' as any },
        {
          projection: {
            lastStatsRun: 1,
            updatedAt: 1,
            stats: 1,
          },
        }
      );

      if (!binderStats) {
        return { success: true, data: null };
      }

      // Calculate time ago helper
      const getTimeAgo = (date: Date | null): string => {
        if (!date) return 'Never';

        const now = new Date();
        const runTime = new Date(date);
        const diffMs = now.getTime() - runTime.getTime();

        const minutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (days > 0) {
          return `${days} day${days > 1 ? 's' : ''} ago`;
        } else if (hours > 0) {
          return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else if (minutes > 0) {
          return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else {
          return 'Just now';
        }
      };

      // Check if update is recent (within last 24 hours)
      const isRecentUpdate = (date: Date | null): boolean => {
        if (!date) return false;

        const now = new Date();
        const runTime = new Date(date);
        const diffMs = now.getTime() - runTime.getTime();
        const hoursAgo = diffMs / (1000 * 60 * 60);

        return hoursAgo <= 24;
      };

      const response: BinderStatsInfo = {
        lastRun: binderStats.lastStatsRun || null,
        updatedAt: binderStats.updatedAt || null,
        status: {
          lastRunAgo: getTimeAgo(binderStats.lastStatsRun),
          isRecent: isRecentUpdate(binderStats.lastStatsRun),
        },
        lastRunStats: binderStats.stats
          ? {
              bindersProcessed: binderStats.stats.bindersProcessed || 0,
              bindersSuccessful: binderStats.stats.bindersSuccessful || 0,
              bindersFailed: binderStats.stats.bindersFailed || 0,
              processingTimeSeconds: binderStats.stats.processingTimeSeconds || 0,
              avgProcessingTimePerBinder:
                binderStats.stats.avgProcessingTimePerBinder || 0,
              batchSize: binderStats.stats.batchSize || 100,
            }
          : null,
      };

      return { success: true, data: response };
    } catch (error) {
      console.error('[MongoBinderService] getBinderStatsSystemInfo error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get binder stats system info',
      };
    }
  }

  /**
   * Get user's binders with stats for collection aggregation
   * Excludes archived binders by default
   */
  async getUserBindersWithStats(userId: string): AsyncResult<BinderWithStatsDTO[]> {
    try {
      await this.ensureConnection();

      const binders = await Binder.find(
        { userId: new Types.ObjectId(userId), archived: { $ne: true } },
        {
          _id: 1,
          userId: 1,
          name: 1,
          description: 1,
          tags: 1,
          slug: 1,
          isOnHand: 1,
          isPublic: 1,
          visibility: 1,
          updatedAt: 1,
          showcaseCards: 1,
          stats: 1,
        }
      )
        .sort({ updatedAt: -1 })
        .lean();

      const bindersWithStats: BinderWithStatsDTO[] = binders.map((b: any) => {
        const dto: BinderWithStatsDTO = {
          _id: b._id.toString(),
          userId: b.userId.toString(),
          name: b.name,
          description: b.description || null,
          tags: b.tags || [],
          slug: b.slug || null,
          isOnHand: b.isOnHand || false,
          isPublic: b.isPublic,
          visibility: b.visibility,
          updatedAt: b.updatedAt,
          stats: b.stats,
        };

        // Handle showcaseCards with MongoDB number format conversion
        if (b.showcaseCards && Array.isArray(b.showcaseCards)) {
          dto.showcaseCards = b.showcaseCards.map((card: any) => ({
            printingId: card.printingId,
            tcg_low:
              typeof card.tcg_low === 'number'
                ? card.tcg_low
                : typeof card.tcg_low === 'object' && card.tcg_low?.$numberDouble
                ? parseFloat(card.tcg_low.$numberDouble)
                : 0,
            rarity: card.rarity || 'c',
          }));
        }

        return dto;
      });

      return { success: true, data: bindersWithStats };
    } catch (error) {
      console.error('[MongoBinderService] getUserBindersWithStats error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get user binders with stats',
      };
    }
  }

  /**
   * Search for cards by name across all user's binders
   * Returns cards grouped by card ID with their locations
   */
  async searchUserCards(
    userId: string,
    searchQuery: string,
    limit: number = 50
  ): AsyncResult<CardSearchResultDTO[]> {
    try {
      await this.ensureConnection();

      const results = await Binder.aggregate([
        // Stage 1: Find all binders belonging to the user
        {
          $match: {
            userId: new Types.ObjectId(userId),
            archived: { $ne: true },
          },
        },

        // Stage 2: Deconstruct the 'cards' array to work with individual cards
        { $unwind: '$cards' },

        // Stage 3: Filter the cards by name using a case-insensitive regex
        { $match: { 'cards.name': { $regex: searchQuery, $options: 'i' } } },

        // Stage 4: Group the results by card to consolidate findings
        {
          $group: {
            _id: '$cards.cardId', // Group by the unique card ID
            name: { $first: '$cards.name' },
            imageUrl: { $first: '$cards.printingDetails.image_url' },
            locations: {
              $push: {
                binderId: '$_id',
                binderName: '$name',
                binderSlug: '$slug',
                quantity: '$cards.quantity',
                forTrade: '$cards.forTrade',
              },
            },
          },
        },

        // Stage 5: Sort the final results alphabetically
        { $sort: { name: 1 } },

        // Stage 6: Limit the number of results to prevent overload
        { $limit: limit },
      ]);

      const formattedResults: CardSearchResultDTO[] = results.map((result: any) => ({
        _id: result._id,
        name: result.name,
        imageUrl: result.imageUrl,
        locations: result.locations.map((loc: any) => ({
          binderId: loc.binderId.toString(),
          binderName: loc.binderName,
          binderSlug: loc.binderSlug,
          quantity: loc.quantity,
          forTrade: loc.forTrade,
        })),
      }));

      return { success: true, data: formattedResults };
    } catch (error) {
      console.error('[MongoBinderService] searchUserCards error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to search user cards',
      };
    }
  }
}
