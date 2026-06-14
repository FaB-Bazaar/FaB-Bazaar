/**
 * PostgreSQL implementation of Inventory Service
 *
 * Implements IInventoryService using PostgreSQL + Drizzle ORM
 * Uses JOINs to eliminate denormalization, groups results in-memory
 */

import { eq, and, sql, inArray, gte, exists } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { inventoryItems, users, binders, printings, cards, wantsItems, userFollowedStores } from '@/lib/postgres/schema';
import { sumOwnedByPrintingId, sumOwnedByCardUniqueId } from './ownership-queries';
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
  StoreTradeMatchDTO,
  StoreTradeCardDTO,
  StoreWantMatchDTO,
  StoreWantMatchOwnerDTO,
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

      // Privacy scoping: this backs a PUBLIC endpoint. Non-owners only see
      // for-trade cards from binders the owner made public & trade-discoverable
      // (same gate as executeWhoHasQuery). The owner sees all their own.
      const isOwner = !!options.requestingUserId && options.requestingUserId === userId;
      if (!isOwner) {
        conditions.push(eq(binders.isPublic, true));
        conditions.push(eq(binders.allowWhoHas, true));
      }

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
        .innerJoin(binders, eq(inventoryItems.binderId, binders.id))
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

      // Followed-stores filtering: restrict owners to those who follow at least
      // one of the given stores. An empty array means no restriction.
      if (filters.followedStoreIds && filters.followedStoreIds.length > 0) {
        whereConditions.push(
          exists(
            db
              .select({ one: sql`1` })
              .from(userFollowedStores)
              .where(
                and(
                  eq(userFollowedStores.userId, inventoryItems.userId),
                  inArray(userFollowedStores.locationId, filters.followedStoreIds),
                ),
              ),
          ),
        );
      }

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

  async getStoreTradeMatches(
    storeId: string,
    userId: string
  ): AsyncResult<StoreTradeMatchDTO[]> {
    try {
      // Q1: Store followers who have forTrade items that I want
      // quantity = how many *I* want (from my wants_items)
      const theyHaveRows = await db
        .select({
          userId: users.id,
          username: users.username,
          displayUsername: users.displayUsername,
          avatarUrl: users.avatarUrl,
          discordAvatar: users.discordAvatar,
          printingId: inventoryItems.printingId,
          displayName: cards.displayName,
          set: printings.set,
          foiling: printings.foiling,
          quantity: sql<number>`(SELECT wi.quantity FROM wants_items wi WHERE wi.user_id = ${userId} AND wi.printing_id = ${inventoryItems.printingId} LIMIT 1)`,
          tcgMarket: printings.tcgMarket,
          imageUrl: printings.imageUrl,
          collectorNumber: printings.collectorNumber,
        })
        .from(inventoryItems)
        .innerJoin(users, eq(inventoryItems.userId, users.id))
        .innerJoin(binders, eq(inventoryItems.binderId, binders.id))
        .innerJoin(printings, eq(inventoryItems.printingId, printings.printingId))
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .innerJoin(
          userFollowedStores,
          and(
            eq(userFollowedStores.userId, inventoryItems.userId),
            eq(userFollowedStores.locationId, storeId)
          )
        )
        .where(
          and(
            sql`${inventoryItems.userId} != ${userId}`,
            eq(inventoryItems.forTrade, true),
            eq(binders.allowInMatching, true),
            sql`${inventoryItems.printingId} IN (SELECT printing_id FROM wants_items WHERE user_id = ${userId})`
          )
        );

      // Q2: Store followers who want items I have forTrade
      // quantity = how many *I* have forTrade (from my inventory_items)
      const theyWantRows = await db
        .select({
          userId: users.id,
          username: users.username,
          displayUsername: users.displayUsername,
          avatarUrl: users.avatarUrl,
          discordAvatar: users.discordAvatar,
          printingId: wantsItems.printingId,
          displayName: cards.displayName,
          set: printings.set,
          foiling: printings.foiling,
          quantity: sql<number>`(SELECT SUM(ii.quantity) FROM inventory_items ii JOIN binders b ON b.id = ii.binder_id WHERE ii.user_id = ${userId} AND ii.printing_id = ${wantsItems.printingId} AND ii.for_trade = true AND b.allow_in_matching = true)`,
          tcgMarket: printings.tcgMarket,
          imageUrl: printings.imageUrl,
        })
        .from(wantsItems)
        .innerJoin(users, eq(wantsItems.userId, users.id))
        .innerJoin(printings, eq(wantsItems.printingId, printings.printingId))
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .innerJoin(
          userFollowedStores,
          and(
            eq(userFollowedStores.userId, wantsItems.userId),
            eq(userFollowedStores.locationId, storeId)
          )
        )
        .where(
          and(
            sql`${wantsItems.userId} != ${userId}`,
            sql`${wantsItems.printingId} IN (
              SELECT ii.printing_id FROM inventory_items ii
              JOIN binders b ON b.id = ii.binder_id
              WHERE ii.user_id = ${userId} AND ii.for_trade = true AND b.allow_in_matching = true
            )`
          )
        );

      // Group by user
      const matchMap = new Map<string, StoreTradeMatchDTO>();

      const foilingLabel = (f: string | null): string => {
        switch (f?.toLowerCase()) {
          case 'r': case 'rf': case 'rainbow': return 'RF';
          case 'c': case 'cf': case 'cold': return 'CF';
          default: return 'NF';
        }
      };

      const getOrCreate = (row: typeof theyHaveRows[0]): StoreTradeMatchDTO => {
        if (!matchMap.has(row.userId)) {
          matchMap.set(row.userId, {
            userId: row.userId,
            username: row.username,
            displayUsername: row.displayUsername,
            avatarUrl: row.avatarUrl ?? row.discordAvatar ?? null,
            theyHaveYouWant: [],
            theyWantYouHave: [],
          });
        }
        return matchMap.get(row.userId)!;
      };

      for (const row of theyHaveRows) {
        getOrCreate(row).theyHaveYouWant.push({
          printingId: row.printingId,
          displayName: row.displayName ?? row.printingId,
          set: row.set ?? '',
          foiling: foilingLabel(row.foiling),
          quantity: row.quantity ?? 1,
          tcgMarket: row.tcgMarket,
          imageUrl: row.imageUrl,
          collectorNumber: row.collectorNumber,
        });
      }

      for (const row of theyWantRows) {
        getOrCreate(row).theyWantYouHave.push({
          printingId: row.printingId,
          displayName: row.displayName ?? row.printingId,
          set: row.set ?? '',
          foiling: foilingLabel(row.foiling),
          quantity: row.quantity ?? 1,
          tcgMarket: row.tcgMarket,
          imageUrl: row.imageUrl,
          collectorNumber: row.collectorNumber,
        });
      }

      // Sort: mutual matches first, then by total card count
      const matches = [...matchMap.values()].sort((a, b) => {
        const aMutual = a.theyHaveYouWant.length > 0 && a.theyWantYouHave.length > 0 ? 1 : 0;
        const bMutual = b.theyHaveYouWant.length > 0 && b.theyWantYouHave.length > 0 ? 1 : 0;
        if (bMutual !== aMutual) return bMutual - aMutual;
        return (b.theyHaveYouWant.length + b.theyWantYouHave.length) - (a.theyHaveYouWant.length + a.theyWantYouHave.length);
      });

      return { success: true, data: matches };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get store trade matches' };
    }
  }

  async getStoreWantMatches(
    storeId: string,
    userId: string
  ): AsyncResult<StoreWantMatchDTO[]> {
    try {
      // The viewer's wants joined to store-followers' for-trade inventory.
      // One row per (wanted printing × owner × matching binder holding it).
      const rows = await db
        .select({
          printingId: wantsItems.printingId,
          wantedQuantity: wantsItems.quantity,
          collectorNumber: printings.collectorNumber,
          displayName: cards.displayName,
          set: printings.set,
          foiling: printings.foiling,
          imageUrl: printings.imageUrl,
          tcgMarket: printings.tcgMarket,
          ownerId: users.id,
          ownerUsername: users.username,
          ownerDisplayUsername: users.displayUsername,
          ownerAvatarUrl: users.avatarUrl,
          ownerDiscordAvatar: users.discordAvatar,
          ownerQuantity: inventoryItems.quantity,
        })
        .from(wantsItems)
        .innerJoin(inventoryItems, eq(inventoryItems.printingId, wantsItems.printingId))
        .innerJoin(
          binders,
          and(eq(binders.id, inventoryItems.binderId), eq(binders.allowInMatching, true))
        )
        .innerJoin(users, eq(users.id, inventoryItems.userId))
        .innerJoin(
          userFollowedStores,
          and(
            eq(userFollowedStores.userId, inventoryItems.userId),
            eq(userFollowedStores.locationId, storeId)
          )
        )
        .innerJoin(printings, eq(printings.printingId, wantsItems.printingId))
        .innerJoin(cards, eq(cards.cardUniqueId, printings.cardUniqueId))
        .where(
          and(
            eq(wantsItems.userId, userId),
            sql`${inventoryItems.userId} != ${userId}`,
            eq(inventoryItems.forTrade, true)
          )
        );

      const foilingLabel = (f: string | null): string => {
        switch (f?.toLowerCase()) {
          case 'r': case 'rf': case 'rainbow': return 'RF';
          case 'c': case 'cf': case 'cold': return 'CF';
          default: return 'NF';
        }
      };

      // Group by wanted printing; sum each owner's for-trade quantity (an owner
      // may hold the printing across several matching binders).
      const byPrinting = new Map<string, StoreWantMatchDTO & { _owners: Map<string, StoreWantMatchOwnerDTO> }>();

      for (const row of rows) {
        let entry = byPrinting.get(row.printingId);
        if (!entry) {
          entry = {
            printingId: row.printingId,
            collectorNumber: row.collectorNumber,
            displayName: row.displayName ?? row.printingId,
            set: row.set ?? '',
            foiling: foilingLabel(row.foiling),
            imageUrl: row.imageUrl,
            tcgMarket: row.tcgMarket,
            wantedQuantity: row.wantedQuantity ?? 1,
            owners: [],
            _owners: new Map(),
          };
          byPrinting.set(row.printingId, entry);
        }
        const existing = entry._owners.get(row.ownerId);
        if (existing) {
          existing.quantity += row.ownerQuantity ?? 1;
        } else {
          entry._owners.set(row.ownerId, {
            userId: row.ownerId,
            username: row.ownerUsername,
            displayUsername: row.ownerDisplayUsername,
            avatarUrl: row.ownerAvatarUrl ?? row.ownerDiscordAvatar ?? null,
            quantity: row.ownerQuantity ?? 1,
          });
        }
      }

      const data = [...byPrinting.values()]
        .map(({ _owners, ...rest }) => ({ ...rest, owners: [..._owners.values()] }))
        .sort((a, b) => b.owners.length - a.owners.length || a.displayName.localeCompare(b.displayName));

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get store want matches' };
    }
  }

  async getOwnedCountsByPrintingId(
    userId: string,
    printingIds: string[]
  ): AsyncResult<Record<string, number>> {
    try {
      const data = await sumOwnedByPrintingId(userId, printingIds);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get owned counts by printing' };
    }
  }

  async getOwnedCountsByCardUniqueId(
    userId: string,
    cardUniqueIds: string[]
  ): AsyncResult<Record<string, number>> {
    try {
      const data = await sumOwnedByCardUniqueId(userId, cardUniqueIds);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get owned counts by card' };
    }
  }
}
