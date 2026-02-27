/**
 * MongoDB implementation of the Inventory Service
 *
 * Handles "who has" queries for finding card owners across inventory items.
 * Uses denormalized data in inventory_items collection for fast filtering.
 */

import connectToDatabase from '@/lib/mongodb';
import { Types } from 'mongoose';
import type {
  IInventoryService,
  WhoHasFilters,
  WhoHasResultDTO,
  OwnerDTO,
  BinderMatchDTO,
  MatchingCardDTO,
  WhoHasSummaryDTO,
  WhoHasMetadataDTO,
  TradeableItemDTO,
  TradeableCardsOptions,
  PaginatedTradeableCards,
  TradeableCardDTO,
} from '../../contracts/IInventoryService';
import type { AsyncResult, PaginationOptions } from '../../contracts/common';

export class MongoInventoryService implements IInventoryService {
  /**
   * Ensure database connection and return db reference
   */
  private async getDb() {
    const { db } = await connectToDatabase();
    return db;
  }

  /**
   * Shared implementation for both query types
   */
  private async executeWhoHasQuery(
    searchIds: string[],
    searchMode: 'specific_printings' | 'all_versions',
    filters: WhoHasFilters = {},
    options: PaginationOptions = {}
  ): AsyncResult<WhoHasResultDTO> {
    try {
      // Validate input
      if (!searchIds.length) {
        return { success: false, error: 'No valid IDs provided' };
      }
      if (searchIds.length > 20) {
        return { success: false, error: 'Too many IDs (max 20)' };
      }

      const db = await this.getDb();
      const page = Math.floor((options.skip || 0) / (options.limit || 50)) + 1;
      const limit = options.limit || 50;

      // Build query
      const query: Record<string, any> = {};

      if (searchMode === 'all_versions') {
        query.card_unique_id = { $in: searchIds };
      } else {
        query.printingId = { $in: searchIds };
      }

      // Privacy filters - required for whoHas
      query.binderAllowWhoHas = true;
      query.binderIsPublic = true;

      // Geo filtering
      if (filters.country) {
        query.userCountry = filters.country;
      }
      if (filters.state) {
        query.userState = filters.state;
      }

      // Execute query
      const allInventoryItems = await db
        .collection('inventory_items')
        .find(query)
        .toArray();

      // Apply server-side filters
      let filteredItems = allInventoryItems;

      if (filters.forTradeOnly) {
        filteredItems = filteredItems.filter((item) => item.forTrade === true);
      }

      if (filters.minCondition) {
        const conditionOrder: Record<string, number> = {
          NM: 5,
          LP: 4,
          MP: 3,
          HP: 2,
          DMG: 1,
        };
        const minValue = conditionOrder[filters.minCondition] || 0;
        filteredItems = filteredItems.filter(
          (item) => (conditionOrder[item.condition] || 0) >= minValue
        );
      }

      // Group results: owners -> binders -> cards
      const ownerMap = new Map<
        string,
        {
          user_id: string;
          username: string;
          discord_id: string;
          avatar_url: string | null;
          binders: Map<
            string,
            {
              binder_id: string;
              binder_name: string;
              binder_slug: string;
              matching_cards: Map<string, MatchingCardDTO>;
              total_cards_found: number;
              total_value: number;
            }
          >;
          total_cards_found: number;
          total_value: number;
          unique_printings_found: Set<string>;
        }
      >();

      for (const item of filteredItems) {
        // Skip items missing required denormalized data
        if (!item.discordUsername || !item.binderName) {
          continue;
        }

        const ownerId = item.userId.toString();
        const binderId = item.binderId.toString();

        // Create owner entry if needed
        if (!ownerMap.has(ownerId)) {
          ownerMap.set(ownerId, {
            user_id: ownerId,
            username: item.discordUsername,
            discord_id: item.discordId,
            avatar_url: item.avatarUrl || null,
            binders: new Map(),
            total_cards_found: 0,
            total_value: 0,
            unique_printings_found: new Set(),
          });
        }

        const owner = ownerMap.get(ownerId)!;

        // Create binder entry if needed
        if (!owner.binders.has(binderId)) {
          owner.binders.set(binderId, {
            binder_id: binderId,
            binder_name: item.binderName,
            binder_slug: item.binderSlug,
            matching_cards: new Map(),
            total_cards_found: 0,
            total_value: 0,
          });
        }

        const binder = owner.binders.get(binderId)!;
        const printingId = item.printingId;

        // Create card entry if needed
        if (!binder.matching_cards.has(printingId)) {
          binder.matching_cards.set(printingId, {
            printing_id: printingId,
            display_name: item.display_name,
            total_quantity: 0,
            conditions: {},
            tcg_market: item.tcg_market,
            tcg_low: item.tcg_low,
            set: item.set,
            edition: item.edition,
            foiling: item.foiling,
            rarity: item.rarity,
            image_url: item.image_url,
          });
        }

        const card = binder.matching_cards.get(printingId)!;
        card.total_quantity += item.quantity;
        card.conditions[item.condition] =
          (card.conditions[item.condition] || 0) + item.quantity;

        // Update binder totals
        binder.total_cards_found += item.quantity;
        binder.total_value += (item.tcg_low || 0) * item.quantity;

        // Update owner totals
        owner.total_cards_found += item.quantity;
        owner.total_value += (item.tcg_low || 0) * item.quantity;
        owner.unique_printings_found.add(printingId);
      }

      // Convert to arrays and format
      let owners: OwnerDTO[] = Array.from(ownerMap.values()).map((owner) => ({
        user_id: owner.user_id,
        username: owner.username,
        discord_id: owner.discord_id,
        avatar_url: owner.avatar_url,
        binders: Array.from(owner.binders.values()).map(
          (binder): BinderMatchDTO => ({
            binder_id: binder.binder_id,
            binder_name: binder.binder_name,
            binder_slug: binder.binder_slug,
            matching_cards: Array.from(binder.matching_cards.values()),
            total_cards_found: binder.total_cards_found,
            total_value: Math.round(binder.total_value * 100) / 100,
          })
        ),
        total_cards_found: owner.total_cards_found,
        total_value: Math.round(owner.total_value * 100) / 100,
        unique_printings_found: owner.unique_printings_found.size,
      }));

      // Sort by username
      owners.sort((a, b) => a.username.localeCompare(b.username));

      // Paginate
      const totalOwners = owners.length;
      const totalPages = Math.ceil(totalOwners / limit);
      const startIndex = (page - 1) * limit;
      const paginatedOwners = owners.slice(startIndex, startIndex + limit);

      // Calculate summary stats
      const allUniquePrintings = new Set<string>();
      for (const owner of ownerMap.values()) {
        for (const printingId of owner.unique_printings_found) {
          allUniquePrintings.add(printingId);
        }
      }

      const summary: WhoHasSummaryDTO = {
        total_owners_found: totalOwners,
        total_cards_found: owners.reduce(
          (sum, owner) => sum + owner.total_cards_found,
          0
        ),
        total_value_found:
          Math.round(
            owners.reduce((sum, owner) => sum + owner.total_value, 0) * 100
          ) / 100,
        ids_requested: searchIds.length,
        unique_printings_found: allUniquePrintings.size,
        items_before_filtering: allInventoryItems.length,
        items_after_filtering: filteredItems.length,
      };

      const metadata: WhoHasMetadataDTO = {
        current_page: page,
        total_pages: totalPages,
        owners_per_page: limit,
        owners_in_page: paginatedOwners.length,
        has_next_page: page < totalPages,
        has_previous_page: page > 1,
        filters_applied: {
          for_trade_only: filters.forTradeOnly || false,
          min_condition: filters.minCondition || null,
          country: filters.country || null,
          state: filters.state || null,
          binder_allow_who_has: true,
        },
      };

      return {
        success: true,
        data: {
          requested_ids: searchIds,
          search_mode: searchMode,
          summary,
          metadata,
          owners: paginatedOwners,
        },
      };
    } catch (error) {
      console.error('[MongoInventoryService] executeWhoHasQuery error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to find card owners',
      };
    }
  }

  /**
   * Find all owners who have specific printings
   */
  async getWhoHasPrintings(
    printingIds: string[],
    filters?: WhoHasFilters,
    options?: PaginationOptions
  ): AsyncResult<WhoHasResultDTO> {
    return this.executeWhoHasQuery(
      printingIds,
      'specific_printings',
      filters,
      options
    );
  }

  /**
   * Find all owners who have any printing of specified cards
   */
  async getWhoHasCards(
    cardUniqueIds: string[],
    filters?: WhoHasFilters,
    options?: PaginationOptions
  ): AsyncResult<WhoHasResultDTO> {
    return this.executeWhoHasQuery(
      cardUniqueIds,
      'all_versions',
      filters,
      options
    );
  }

  /**
   * Get tradeable inventory items for a user
   *
   * Returns items from binders where:
   * - forTrade: true
   * - binderAllowWhoHas: true (allows trading/matching)
   *
   * Used by trade analysis to find what a user has available to trade.
   */
  async getTradeableItems(
    userId: string
  ): AsyncResult<TradeableItemDTO[]> {
    try {
      const db = await this.getDb();

      const items = await db
        .collection('inventory_items')
        .find({
          userId: new Types.ObjectId(userId),
          forTrade: true,
          binderAllowWhoHas: true,
        })
        .toArray();

      const tradeableItems: TradeableItemDTO[] = items.map((item: any) => ({
        _id: item._id.toString(),
        userId: item.userId.toString(),
        binderId: item.binderId.toString(),
        printingId: item.printingId,
        card_unique_id: item.card_unique_id,
        quantity: item.quantity || 1,
        forTrade: item.forTrade === true,
        display_name: item.display_name,
        name: item.name,
        set: item.set,
        rarity: item.rarity,
        tcg_low: item.tcg_low,
        tcg_market: item.tcg_market,
      }));

      return { success: true, data: tradeableItems };
    } catch (error) {
      console.error('[MongoInventoryService] getTradeableItems error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get tradeable items',
      };
    }
  }

  // ====================================
  // Public API Methods
  // ====================================

  /**
   * Get paginated tradeable cards for a user (public endpoint)
   */
  async getTradeableCards(
    userId: string,
    options: TradeableCardsOptions
  ): AsyncResult<PaginatedTradeableCards> {
    try {
      const db = await this.getDb();

      // Build query
      const query: any = {
        userId: new Types.ObjectId(userId),
        forTrade: true,
      };

      // Add search filter if provided
      if (options.search) {
        query.display_name = { $regex: options.search, $options: 'i' };
      }

      // Build sort
      const sortField = options.sortBy || 'display_name';
      const sortOrder = options.sortOrder === 'desc' ? -1 : 1;

      let sortQuery: any = {};
      switch (sortField) {
        case 'name':
          sortQuery = { display_name: sortOrder };
          break;
        case 'set':
          sortQuery = { set: sortOrder, display_name: 1 };
          break;
        case 'price':
          sortQuery = { tcg_market: sortOrder, display_name: 1 };
          break;
        case 'quantity':
          sortQuery = { quantity: sortOrder, display_name: 1 };
          break;
        default:
          sortQuery = { display_name: sortOrder };
      }

      // Get total count
      const total = await db.collection('inventory_items').countDocuments(query);

      // Calculate pagination
      const page = Math.floor((options.skip || 0) / (options.limit || 20)) + 1;
      const limit = options.limit || 20;
      const totalPages = Math.ceil(total / limit);

      // Get paginated items
      const items = await db
        .collection('inventory_items')
        .find(query)
        .sort(sortQuery)
        .skip(options.skip || 0)
        .limit(limit)
        .toArray();

      // Map to DTOs
      const tradeableCards: TradeableCardDTO[] = items.map((item: any) => ({
        _id: item._id.toString(),
        printingId: item.printingId,
        display_name: item.display_name || item.name || 'Unknown Card',
        set: item.set || '',
        foiling: item.foiling || 'Regular',
        condition: item.condition || 'NM',
        quantity: item.quantity || 1,
        forTrade: item.forTrade === true,
        tcg_market: item.tcg_market,
        image_url: item.image_url,
        binderId: item.binderId?.toString() || '',
        binderName: item.binderName || '',
      }));

      return {
        success: true,
        data: {
          items: tradeableCards,
          total,
          page,
          limit,
          totalPages,
        },
      };
    } catch (error) {
      console.error('[MongoInventoryService] getTradeableCards error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get tradeable cards',
      };
    }
  }
}
