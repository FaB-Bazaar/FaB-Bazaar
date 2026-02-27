/**
 * PostgreSQL implementation of Inventory Service
 *
 * Implements IInventoryService using PostgreSQL + Drizzle ORM
 * Uses JOINs to eliminate denormalization, groups results in-memory
 */

import { eq, and, sql, inArray, gte } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { inventoryItems, users, binders, printings, cards } from '@/lib/postgres/schema';
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
} from '@/lib/services/contracts/IInventoryService';
import type { AsyncResult, PaginationOptions } from '@/lib/services/contracts/common';

export class PostgresInventoryService implements IInventoryService {
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
   */
  async getTradeableItems(userId: string): AsyncResult<TradeableItemDTO[]> {
    try {
      const results = await db
        .select({
          id: inventoryItems.id,
          userId: inventoryItems.userId,
          binderId: inventoryItems.binderId,
          printingId: inventoryItems.printingId,
          quantity: inventoryItems.quantity,
          forTrade: inventoryItems.forTrade,
          // Card fields via JOINs
          cardUniqueId: cards.cardUniqueId,
          name: cards.name,
          displayName: cards.displayName,
          set: printings.set,
          rarity: printings.rarity,
          tcgLow: printings.tcgLow,
          tcgMarket: printings.tcgMarket,
        })
        .from(inventoryItems)
        .innerJoin(users, eq(inventoryItems.userId, users.id))
        .innerJoin(binders, eq(inventoryItems.binderId, binders.id))
        .innerJoin(printings, eq(inventoryItems.printingId, printings.printingId))
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .where(
          and(
            eq(inventoryItems.userId, userId),
            eq(inventoryItems.forTrade, true),
            eq(binders.allowInMatching, true)
          )
        );

      const tradeableItems: TradeableItemDTO[] = results.map((row) => ({
        _id: row.id,
        userId: row.userId,
        binderId: row.binderId,
        printingId: row.printingId,
        card_unique_id: row.cardUniqueId,
        quantity: row.quantity,
        forTrade: row.forTrade,
        display_name: row.displayName,
        name: row.name,
        set: row.set,
        rarity: row.rarity,
        tcg_low: row.tcgLow ?? undefined,
        tcg_market: row.tcgMarket ?? undefined,
      }));

      return { success: true, data: tradeableItems };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get tradeable items',
      };
    }
  }

  /**
   * Get paginated tradeable cards for a user (public endpoint)
   */
  async getTradeableCards(
    userId: string,
    options: TradeableCardsOptions
  ): AsyncResult<PaginatedTradeableCards> {
    try {
      // Build where conditions
      const conditions = [
        eq(inventoryItems.userId, userId),
        eq(inventoryItems.forTrade, true),
      ];

      // Add search filter
      if (options.search) {
        conditions.push(sql`${cards.displayName} ILIKE ${`%${options.search}%`}`);
      }

      // Build sort
      const sortField = options.sortBy || 'name';
      const sortOrder = options.sortOrder || 'asc';

      let orderByClause: any[];
      switch (sortField) {
        case 'name':
          orderByClause = [
            sortOrder === 'desc'
              ? sql`${cards.displayName} DESC`
              : sql`${cards.displayName} ASC`,
          ];
          break;
        case 'set':
          orderByClause = [
            sortOrder === 'desc' ? sql`${printings.set} DESC` : sql`${printings.set} ASC`,
            sql`${cards.displayName} ASC`,
          ];
          break;
        case 'price':
          orderByClause = [
            sortOrder === 'desc'
              ? sql`${printings.tcgMarket} DESC NULLS LAST`
              : sql`${printings.tcgMarket} ASC NULLS LAST`,
            sql`${cards.displayName} ASC`,
          ];
          break;
        case 'quantity':
          orderByClause = [
            sortOrder === 'desc'
              ? sql`${inventoryItems.quantity} DESC`
              : sql`${inventoryItems.quantity} ASC`,
            sql`${cards.displayName} ASC`,
          ];
          break;
        default:
          orderByClause = [sql`${cards.displayName} ASC`];
      }

      // Get total count
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(inventoryItems)
        .innerJoin(printings, eq(inventoryItems.printingId, printings.printingId))
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .where(and(...conditions));

      const total = countResult?.count || 0;

      // Calculate pagination
      const limit = options.limit || 20;
      const page = Math.floor((options.skip || 0) / limit) + 1;
      const totalPages = Math.ceil(total / limit);

      // Get paginated items
      const results = await db
        .select({
          id: inventoryItems.id,
          printingId: inventoryItems.printingId,
          binderId: inventoryItems.binderId,
          quantity: inventoryItems.quantity,
          condition: inventoryItems.condition,
          forTrade: inventoryItems.forTrade,
          // Printing fields
          set: printings.set,
          foiling: printings.foiling,
          tcgMarket: printings.tcgMarket,
          imageUrl: printings.imageUrl,
          // Card fields
          displayName: cards.displayName,
          // Binder fields
          binderName: binders.name,
        })
        .from(inventoryItems)
        .innerJoin(binders, eq(inventoryItems.binderId, binders.id))
        .innerJoin(printings, eq(inventoryItems.printingId, printings.printingId))
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .where(and(...conditions))
        .orderBy(...orderByClause)
        .limit(limit)
        .offset(options.skip || 0);

      const tradeableCards: TradeableCardDTO[] = results.map((row) => ({
        _id: row.id,
        printingId: row.printingId,
        display_name: row.displayName || 'Unknown Card',
        set: row.set || '',
        foiling: row.foiling || 'Regular',
        condition: row.condition || 'NM',
        quantity: row.quantity,
        forTrade: row.forTrade,
        tcg_market: row.tcgMarket ?? undefined,
        image_url: row.imageUrl ?? undefined,
        binderId: row.binderId,
        binderName: row.binderName || '',
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
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get tradeable cards',
      };
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Shared implementation for both "who has" query types
   * Uses JOINs to fetch all data, then groups in-memory
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

      const page = Math.floor((options.skip || 0) / (options.limit || 50)) + 1;
      const limit = options.limit || 50;

      // Build where conditions
      const whereConditions = [];

      // Search by printingId or cardUniqueId
      if (searchMode === 'all_versions') {
        whereConditions.push(inArray(cards.cardUniqueId, searchIds));
      } else {
        whereConditions.push(inArray(printings.printingId, searchIds));
      }

      // Privacy filters - required for whoHas
      whereConditions.push(eq(binders.allowWhoHas, true));
      whereConditions.push(eq(binders.isPublic, true));

      // Geo filtering
      if (filters.country) {
        whereConditions.push(eq(users.countryCode, filters.country));
      }

      // Note: State filtering requires a state field in users table
      // if (filters.state) {
      //   whereConditions.push(eq(users.state, filters.state));
      // }

      // Activity filtering: exclude binders not touched in X days
      // COALESCE falls back to updatedAt then createdAt for binders that predate this feature
      if (filters.activeWithinDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - filters.activeWithinDays);
        whereConditions.push(
          gte(
            sql`COALESCE(${binders.lastActivityAt}, ${binders.updatedAt}, ${binders.createdAt})`,
            cutoffDate
          )
        );
      }

      // Execute query with JOINs
      const allInventoryItems = await db
        .select({
          // Inventory item fields
          itemId: inventoryItems.id,
          userId: inventoryItems.userId,
          binderId: inventoryItems.binderId,
          printingId: inventoryItems.printingId,
          quantity: inventoryItems.quantity,
          condition: inventoryItems.condition,
          forTrade: inventoryItems.forTrade,
          // User fields via JOIN
          username: users.username,
          discordId: users.discordId,
          avatarUrl: users.avatarUrl,
          // Binder fields via JOIN
          binderName: binders.name,
          binderSlug: binders.slug,
          // Printing fields via JOIN
          set: printings.set,
          edition: printings.edition,
          foiling: printings.foiling,
          rarity: printings.rarity,
          tcgLow: printings.tcgLow,
          tcgMarket: printings.tcgMarket,
          imageUrl: printings.imageUrl,
          // Card fields via JOIN
          displayName: cards.displayName,
        })
        .from(inventoryItems)
        .innerJoin(users, eq(inventoryItems.userId, users.id))
        .innerJoin(binders, eq(inventoryItems.binderId, binders.id))
        .innerJoin(printings, eq(inventoryItems.printingId, printings.printingId))
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .where(and(...whereConditions));

      const itemsBeforeFiltering = allInventoryItems.length;

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

      // Group results: owners → binders → cards (in-memory)
      const grouped = this.groupWhoHasResults(filteredItems);

      // Sort owners by username
      grouped.owners.sort((a, b) => a.username.localeCompare(b.username));

      // Paginate owners
      const totalOwners = grouped.owners.length;
      const totalPages = Math.ceil(totalOwners / limit);
      const startIndex = (page - 1) * limit;
      const paginatedOwners = grouped.owners.slice(startIndex, startIndex + limit);

      // Calculate summary stats
      const summary: WhoHasSummaryDTO = {
        total_owners_found: totalOwners,
        total_cards_found: grouped.totalCardsFound,
        total_value_found: Math.round(grouped.totalValue * 100) / 100,
        ids_requested: searchIds.length,
        unique_printings_found: grouped.uniquePrintings.size,
        items_before_filtering: itemsBeforeFiltering,
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
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find card owners',
      };
    }
  }

  /**
   * Group inventory items into 3-level structure: owners → binders → cards
   * This replaces MongoDB's aggregation pipeline with in-memory grouping
   */
  private groupWhoHasResults(items: any[]): {
    owners: OwnerDTO[];
    totalCardsFound: number;
    totalValue: number;
    uniquePrintings: Set<string>;
  } {
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

    for (const item of items) {
      // Skip items missing required data
      if (!item.username || !item.binderName) {
        continue;
      }

      const ownerId = item.userId;
      const binderId = item.binderId;

      // Create owner entry if needed
      if (!ownerMap.has(ownerId)) {
        ownerMap.set(ownerId, {
          user_id: ownerId,
          username: item.username,
          discord_id: item.discordId || '',
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
          binder_slug: item.binderSlug || '',
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
          display_name: item.displayName,
          total_quantity: 0,
          conditions: {},
          tcg_market: item.tcgMarket ?? undefined,
          tcg_low: item.tcgLow ?? undefined,
          set: item.set,
          edition: item.edition,
          foiling: item.foiling,
          rarity: item.rarity,
          image_url: item.imageUrl ?? undefined,
        });
      }

      const card = binder.matching_cards.get(printingId)!;
      card.total_quantity += item.quantity;
      card.conditions[item.condition] = (card.conditions[item.condition] || 0) + item.quantity;

      // Update binder totals
      binder.total_cards_found += item.quantity;
      binder.total_value += (item.tcgLow || 0) * item.quantity;

      // Update owner totals
      owner.total_cards_found += item.quantity;
      owner.total_value += (item.tcgLow || 0) * item.quantity;
      owner.unique_printings_found.add(printingId);
    }

    // Convert to arrays and format
    const owners: OwnerDTO[] = Array.from(ownerMap.values()).map((owner) => ({
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

    // Calculate global stats
    const allUniquePrintings = new Set<string>();
    let totalCardsFound = 0;
    let totalValue = 0;

    for (const owner of ownerMap.values()) {
      totalCardsFound += owner.total_cards_found;
      totalValue += owner.total_value;
      for (const printingId of owner.unique_printings_found) {
        allUniquePrintings.add(printingId);
      }
    }

    return {
      owners,
      totalCardsFound,
      totalValue,
      uniquePrintings: allUniquePrintings,
    };
  }
}
