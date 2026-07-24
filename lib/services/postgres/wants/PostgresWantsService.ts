/**
 * PostgreSQL implementation of Wants Service
 *
 * Implements IWantsService using PostgreSQL + Drizzle ORM
 * Uses JOINs to eliminate denormalization
 *
 * NOTE: This is a partial implementation with core methods.
 * Additional methods can be implemented as needed.
 */

import { eq, and, sql, inArray, desc, asc } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { wantsItems, users, printings, cards, binders, inventoryItems } from '@/lib/postgres/schema';
import type {
  IWantsService,
  WantsItemDTO,
  CreateWantsItemDTO,
  UpdateWantsItemDTO,
  AddWantsResultDTO,
  RemoveWantsResultDTO,
  WantsFilters,
  WantsListResultDTO,
  WantsStatsDTO,
  PublicWantsResultDTO,
  BulkAddWantsResultDTO,
  ImportResultDTO,
  ImportCardDTO,
  WhoWantsResultDTO,
  WhoWantsGroupedResultDTO,
  WhoWantsFilters,
  WanterDTO,
  WanterGroupedDTO,
  WantedCardDTO,
  WhoWantsSummaryDTO,
  WantsExportDTO,
  AcquireCardInputDTO,
  AcquireWantsResultDTO,
} from '@/lib/services/contracts/IWantsService';
import type { AsyncResult, PaginationOptions } from '@/lib/services/contracts/common';
import { v4 as uuidv4 } from 'uuid';

export class PostgresWantsService implements IWantsService {
  /**
   * Get a single wants item by printing ID
   */
  async getWantsItem(userId: string, printingId: string): AsyncResult<WantsItemDTO | null> {
    try {
      const results = await db
        .select(this.buildSelectFields())
        .from(wantsItems)
        .innerJoin(printings, eq(wantsItems.printingId, printings.printingId))
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .innerJoin(users, eq(wantsItems.userId, users.id))
        .where(and(eq(wantsItems.userId, userId), eq(wantsItems.printingId, printingId)))
        .limit(1);

      if (!results || results.length === 0) {
        return { success: true, data: null };
      }

      return { success: true, data: this.mapToWantsItemDTO(results[0]) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get wants item',
      };
    }
  }

  /**
   * Add a card to wants list
   */
  async addWantsItem(userId: string, data: CreateWantsItemDTO): AsyncResult<AddWantsResultDTO> {
    try {
      // Check if item already exists
      const existing = await this.getWantsItem(userId, data.printingId);

      if (existing.success && existing.data) {
        // Update quantity
        const newQuantity = existing.data.quantity + (data.quantity || 1);
        const [updated] = await db
          .update(wantsItems)
          .set({
            quantity: newQuantity,
            updatedAt: new Date(),
          })
          .where(and(eq(wantsItems.userId, userId), eq(wantsItems.printingId, data.printingId)))
          .returning();

        const updatedItem = await this.getWantsItem(userId, data.printingId);

        return {
          success: true,
          data: {
            success: true,
            action: 'updated',
            item: updatedItem.data!,
            message: `Quantity updated to ${newQuantity}`,
          },
        };
      }

      // Create new item
      const [newItem] = await db
        .insert(wantsItems)
        .values({
          id: uuidv4(),
          userId,
          printingId: data.printingId,
          quantity: data.quantity || 1,
          priority: data.priority || 'medium',
          notes: data.notes || '',
          addedAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      const createdItem = await this.getWantsItem(userId, data.printingId);

      return {
        success: true,
        data: {
          success: true,
          action: 'created',
          item: createdItem.data!,
          message: 'Added to wants list',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add wants item',
      };
    }
  }

  /**
   * Update an existing wants item
   */
  async updateWantsItem(
    userId: string,
    printingId: string,
    updates: UpdateWantsItemDTO
  ): AsyncResult<WantsItemDTO> {
    try {
      await db
        .update(wantsItems)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(and(eq(wantsItems.userId, userId), eq(wantsItems.printingId, printingId)));

      const updated = await this.getWantsItem(userId, printingId);

      if (!updated.success || !updated.data) {
        return { success: false, error: 'Item not found after update' };
      }

      return { success: true, data: updated.data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update wants item',
      };
    }
  }

  /**
   * Remove a card from wants list
   */
  async removeWantsItem(
    userId: string,
    printingId: string,
    quantity?: number
  ): AsyncResult<RemoveWantsResultDTO> {
    try {
      const existing = await this.getWantsItem(userId, printingId);

      if (!existing.success || !existing.data) {
        return { success: false, error: 'Item not found' };
      }

      if (quantity && quantity < existing.data.quantity) {
        // Reduce quantity
        const newQuantity = existing.data.quantity - quantity;
        await db
          .update(wantsItems)
          .set({ quantity: newQuantity, updatedAt: new Date() })
          .where(and(eq(wantsItems.userId, userId), eq(wantsItems.printingId, printingId)));

        return {
          success: true,
          data: {
            success: true,
            action: 'reduced',
            remainingQuantity: newQuantity,
          },
        };
      }

      // Remove completely
      await db
        .delete(wantsItems)
        .where(and(eq(wantsItems.userId, userId), eq(wantsItems.printingId, printingId)));

      return {
        success: true,
        data: {
          success: true,
          action: 'removed',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove wants item',
      };
    }
  }

  /**
   * Mark wants cards as acquired into a binder
   *
   * Runs in a single transaction: each card is added to the target binder
   * (merged into an existing NM/EN row for the same printing when present)
   * and its wants item is reduced or removed. Acquire quantities are clamped
   * to the currently wanted quantity.
   */
  async acquireWantsToBinder(
    userId: string,
    targetBinderId: string,
    cardsToAcquire: AcquireCardInputDTO[]
  ): AsyncResult<AcquireWantsResultDTO> {
    try {
      return await db.transaction(async (tx) => {
        // Verify binder ownership
        const targetBinder = await tx.query.binders.findFirst({
          where: and(eq(binders.id, targetBinderId), eq(binders.userId, userId)),
        });

        if (!targetBinder) {
          return {
            success: false,
            error: 'Target binder not found or access denied',
          } as AsyncResult<AcquireWantsResultDTO>;
        }

        const results: AcquireWantsResultDTO['results'] = [];
        let successful = 0;
        let failed = 0;
        let fullyAcquired = 0;
        let partiallyAcquired = 0;
        let mergedInBinder = 0;
        let totalQuantityAcquired = 0;

        for (const acquire of cardsToAcquire) {
          try {
            // Lock the wants row
            const [wantsRow] = await tx
              .select()
              .from(wantsItems)
              .where(and(eq(wantsItems.userId, userId), eq(wantsItems.printingId, acquire.printingId)))
              .for('update');

            if (!wantsRow) {
              failed++;
              results.push({
                success: false,
                printingId: acquire.printingId,
                name: '',
                action: 'acquired',
                quantity: 0,
                remainingWanted: 0,
                error: 'Card not found in wants list',
              });
              continue;
            }

            const quantityToAcquire = Math.min(acquire.quantity, wantsRow.quantity);
            const remainingWanted = wantsRow.quantity - quantityToAcquire;

            // Card name for the result payload
            const [printingInfo] = await tx
              .select({ displayName: cards.displayName })
              .from(printings)
              .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
              .where(eq(printings.printingId, acquire.printingId))
              .limit(1);

            const cardName = printingInfo?.displayName || 'Unknown';

            // Merge into an existing binder row with default condition/language
            const [existingItem] = await tx
              .select()
              .from(inventoryItems)
              .where(
                and(
                  eq(inventoryItems.binderId, targetBinderId),
                  eq(inventoryItems.printingId, acquire.printingId),
                  eq(inventoryItems.condition, 'NM'),
                  eq(inventoryItems.language, 'EN')
                )
              )
              .for('update');

            if (existingItem) {
              await tx
                .update(inventoryItems)
                .set({ quantity: existingItem.quantity + quantityToAcquire, updatedAt: new Date() })
                .where(eq(inventoryItems.id, existingItem.id));

              mergedInBinder++;
            } else {
              await tx.insert(inventoryItems).values({
                id: uuidv4(),
                userId,
                binderId: targetBinderId,
                printingId: acquire.printingId,
                quantity: quantityToAcquire,
                condition: 'NM',
                language: 'EN',
                forTrade: false,
                forSale: false,
                acquisitionDate: new Date(),
                addedAt: new Date(),
                updatedAt: new Date(),
              });
            }

            // Reduce or remove the wants row
            if (remainingWanted > 0) {
              await tx
                .update(wantsItems)
                .set({ quantity: remainingWanted, updatedAt: new Date() })
                .where(eq(wantsItems.id, wantsRow.id));

              partiallyAcquired++;
            } else {
              await tx.delete(wantsItems).where(eq(wantsItems.id, wantsRow.id));
              fullyAcquired++;
            }

            successful++;
            totalQuantityAcquired += quantityToAcquire;

            results.push({
              success: true,
              printingId: acquire.printingId,
              name: cardName,
              action: remainingWanted > 0 ? 'partial_acquire' : 'acquired',
              quantity: quantityToAcquire,
              remainingWanted,
              mergedInBinder: !!existingItem,
              binderQuantity: existingItem
                ? existingItem.quantity + quantityToAcquire
                : quantityToAcquire,
            });
          } catch (error) {
            failed++;
            results.push({
              success: false,
              printingId: acquire.printingId,
              name: '',
              action: 'acquired',
              quantity: 0,
              remainingWanted: 0,
              error: error instanceof Error ? error.message : 'Acquire failed',
            });
          }
        }

        if (successful > 0) {
          await tx
            .update(binders)
            .set({ statsNeedUpdate: true, lastActivityAt: new Date() })
            .where(eq(binders.id, targetBinderId));
        }

        return {
          success: true,
          data: {
            success: true,
            summary: {
              totalRequested: cardsToAcquire.length,
              successful,
              failed,
              fullyAcquired,
              partiallyAcquired,
              mergedInBinder,
              totalQuantityAcquired,
            },
            results,
            message: `Acquired ${totalQuantityAcquired} cards (${successful} operations successful, ${failed} failed)`,
          },
        } as AsyncResult<AcquireWantsResultDTO>;
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to acquire wants cards',
      };
    }
  }

  /**
   * Get user's wants list with filtering and pagination
   */
  async getUserWants(
    userId: string,
    filters?: WantsFilters,
    options?: PaginationOptions
  ): AsyncResult<WantsListResultDTO> {
    try {
      const conditions = [eq(wantsItems.userId, userId)];

      // Apply filters
      if (filters?.search) {
        conditions.push(sql`${cards.displayName} ILIKE ${`%${filters.search}%`}`);
      }

      if (filters?.priority) {
        conditions.push(eq(wantsItems.priority, filters.priority));
      }

      if (filters?.set) {
        conditions.push(eq(printings.set, filters.set.toLowerCase()));
      }

      if (filters?.rarity) {
        conditions.push(eq(printings.rarity, filters.rarity.toLowerCase()));
      }

      if (filters?.foiling) {
        conditions.push(eq(printings.foiling, filters.foiling.toLowerCase()));
      }

      if (filters?.edition) {
        conditions.push(eq(printings.edition, filters.edition.toLowerCase()));
      }

      // Get total count
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(wantsItems)
        .innerJoin(printings, eq(wantsItems.printingId, printings.printingId))
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .where(and(...conditions));

      const total = countResult?.count || 0;

      // Get paginated results
      const limit = options?.limit || 50;
      const skip = options?.skip || 0;
      const page = Math.floor(skip / limit) + 1;
      const pages = Math.ceil(total / limit);

      const results = await db
        .select(this.buildSelectFields())
        .from(wantsItems)
        .innerJoin(printings, eq(wantsItems.printingId, printings.printingId))
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .innerJoin(users, eq(wantsItems.userId, users.id))
        .where(and(...conditions))
        .orderBy(desc(wantsItems.addedAt))
        .limit(limit)
        .offset(skip);

      const items = results.map((row) => this.mapToWantsItemDTO(row));

      return {
        success: true,
        data: { items, total, page, pages },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get wants list',
      };
    }
  }

  /**
   * Count total wants items for a user
   */
  async countUserWants(userId: string): AsyncResult<number> {
    try {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(wantsItems)
        .where(eq(wantsItems.userId, userId));

      return { success: true, data: result?.count || 0 };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to count wants',
      };
    }
  }

  /**
   * Get total quantity of all wants items for a user
   */
  async getTotalWantsQuantity(userId: string): AsyncResult<number> {
    try {
      const [result] = await db
        .select({ total: sql<number>`sum(${wantsItems.quantity})::int` })
        .from(wantsItems)
        .where(eq(wantsItems.userId, userId));

      return { success: true, data: result?.total || 0 };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get total quantity',
      };
    }
  }

  /**
   * Get wants list statistics for a user
   */
  async getWantsStats(userId: string): AsyncResult<WantsStatsDTO> {
    try {
      const [stats] = await db
        .select({
          totalUniqueCards: sql<number>`count(*)::int`,
          totalCardQuantity: sql<number>`sum(${wantsItems.quantity})::int`,
          highPriorityUniqueCount: sql<number>`count(*) FILTER (WHERE ${wantsItems.priority} = 'high')::int`,
          highPriorityQuantity: sql<number>`sum(${wantsItems.quantity}) FILTER (WHERE ${wantsItems.priority} = 'high')::int`,
          totalEstimatedValue: sql<number>`sum(${printings.tcgMarket} * ${wantsItems.quantity})::real`,
        })
        .from(wantsItems)
        .innerJoin(printings, eq(wantsItems.printingId, printings.printingId))
        .where(eq(wantsItems.userId, userId));

      return {
        success: true,
        data: {
          totalUniqueCards: stats?.totalUniqueCards || 0,
          totalCardQuantity: stats?.totalCardQuantity || 0,
          highPriorityUniqueCount: stats?.highPriorityUniqueCount || 0,
          highPriorityQuantity: stats?.highPriorityQuantity || 0,
          totalEstimatedValue: Math.round((stats?.totalEstimatedValue || 0) * 100) / 100,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get wants stats',
      };
    }
  }

  /**
   * Get another user's public wants list
   */
  async getPublicWants(
    userId: string,
    filters?: WantsFilters,
    options?: PaginationOptions
  ): AsyncResult<PublicWantsResultDTO> {
    try {
      // Get user info
      const userResult = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          id: true,
          username: true,
          discordUsername: true,
          countryCode: true,
        },
      });

      if (!userResult) {
        return { success: false, error: 'User not found' };
      }

      // Get wants list
      const wantsResult = await this.getUserWants(userId, filters, options);

      if (!wantsResult.success) {
        return { success: false, error: wantsResult.error };
      }

      return {
        success: true,
        data: {
          items: wantsResult.data.items,
          total: wantsResult.data.total,
          user: {
            _id: userResult.id,
            username: userResult.username,
            discordUsername: userResult.discordUsername || undefined,
            country: userResult.countryCode || undefined,
          },
          isPublic: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get public wants',
      };
    }
  }

  /**
   * Add multiple cards to wants list
   */
  async bulkAddWants(userId: string, items: CreateWantsItemDTO[]): AsyncResult<BulkAddWantsResultDTO> {
    try {
      const results: Array<{
        printingId: string;
        success: boolean;
        action?: 'created' | 'updated';
        error?: string;
      }> = [];

      let added = 0;
      let updated = 0;
      let failed = 0;

      for (const item of items) {
        const result = await this.addWantsItem(userId, item);

        if (result.success) {
          if (result.data.action === 'created') added++;
          else if (result.data.action === 'updated') updated++;

          results.push({
            printingId: item.printingId,
            success: true,
            action: result.data.action,
          });
        } else {
          failed++;
          results.push({
            printingId: item.printingId,
            success: false,
            error: result.error,
          });
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
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to bulk add wants',
      };
    }
  }

  /**
   * Import cards with name-based lookup
   */
  async bulkImportWants(userId: string, cards: ImportCardDTO[]): AsyncResult<ImportResultDTO> {
    // TODO: Implement name-based card lookup from printings table
    return {
      success: false,
      error: 'bulkImportWants not implemented yet - requires name-based lookup',
    };
  }

  /**
   * Get all users who want a specific printing
   */
  async getWhoWantsPrinting(printingId: string, options?: PaginationOptions): AsyncResult<WhoWantsResultDTO> {
    // TODO: Implement
    return { success: false, error: 'getWhoWantsPrinting not implemented yet' };
  }

  /**
   * Get all users who want any printing of a card
   */
  async getWhoWantsCard(cardUniqueId: string, options?: PaginationOptions): AsyncResult<WhoWantsResultDTO> {
    // TODO: Implement
    return { success: false, error: 'getWhoWantsCard not implemented yet' };
  }

  /**
   * Find all users who want specific printings (batch query)
   */
  async getWhoWantsPrintings(
    printingIds: string[],
    filters?: WhoWantsFilters,
    options?: PaginationOptions
  ): AsyncResult<WhoWantsGroupedResultDTO> {
    // TODO: Implement with grouping similar to InventoryService
    return { success: false, error: 'getWhoWantsPrintings not implemented yet' };
  }

  /**
   * Find all users who want any printing of specified cards (batch query)
   */
  async getWhoWantsCards(
    cardUniqueIds: string[],
    filters?: WhoWantsFilters,
    options?: PaginationOptions
  ): AsyncResult<WhoWantsGroupedResultDTO> {
    // TODO: Implement with grouping similar to InventoryService
    return { success: false, error: 'getWhoWantsCards not implemented yet' };
  }

  /**
   * Get all wants items for a user (for trade analysis)
   */
  async getAllWantsForUser(userId: string): AsyncResult<WantsItemDTO[]> {
    try {
      const results = await db
        .select(this.buildSelectFields())
        .from(wantsItems)
        .innerJoin(printings, eq(wantsItems.printingId, printings.printingId))
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .innerJoin(users, eq(wantsItems.userId, users.id))
        .where(eq(wantsItems.userId, userId));

      return { success: true, data: results.map((row) => this.mapToWantsItemDTO(row)) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get wants for user',
      };
    }
  }

  /**
   * Export all wants items for a user
   */
  async exportWants(userId: string): AsyncResult<WantsExportDTO[]> {
    try {
      const results = await db
        .select({
          printingId: wantsItems.printingId,
          quantity: wantsItems.quantity,
          priority: wantsItems.priority,
          notes: wantsItems.notes,
          addedAt: wantsItems.addedAt,
          displayName: cards.displayName,
          set: printings.set,
          foiling: printings.foiling,
          tcgMarket: printings.tcgMarket,
          tcgLow: printings.tcgLow,
          imageUrl: printings.imageUrl,
        })
        .from(wantsItems)
        .innerJoin(printings, eq(wantsItems.printingId, printings.printingId))
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .where(eq(wantsItems.userId, userId))
        .orderBy(desc(wantsItems.addedAt));

      const exportData: WantsExportDTO[] = results.map((row) => ({
        printingId: row.printingId,
        display_name: row.displayName,
        set: row.set,
        foiling: row.foiling,
        quantity: row.quantity,
        priority: row.priority as 'high' | 'medium' | 'low',
        notes: row.notes || undefined,
        addedAt: row.addedAt,
        tcg_market: row.tcgMarket ?? undefined,
        tcg_low: row.tcgLow ?? undefined,
        image_url: row.imageUrl ?? undefined,
      }));

      return { success: true, data: exportData };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export wants',
      };
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Build SELECT fields for wants queries
   */
  private buildSelectFields() {
    return {
      // Wants item fields
      id: wantsItems.id,
      userId: wantsItems.userId,
      printingId: wantsItems.printingId,
      quantity: wantsItems.quantity,
      priority: wantsItems.priority,
      notes: wantsItems.notes,
      addedAt: wantsItems.addedAt,
      updatedAt: wantsItems.updatedAt,
      // Printing fields via JOIN
      set: printings.set,
      edition: printings.edition,
      foiling: printings.foiling,
      rarity: printings.rarity,
      collectorNumber: printings.collectorNumber,
      isExtendedArt: printings.isExtendedArt,
      imageUrl: printings.imageUrl,
      tcgplayerUrl: printings.tcgplayerUrl,
      tcgLow: printings.tcgLow,
      tcgMid: printings.tcgMid,
      tcgHigh: printings.tcgHigh,
      tcgMarket: printings.tcgMarket,
      hasPrice: printings.hasPrice,
      priceUpdatedAt: printings.priceUpdatedAt,
      printingCreatedAt: printings.createdAt,
      printingUpdatedAt: printings.updatedAt,
      // Card fields via JOIN
      cardUniqueId: cards.cardUniqueId,
      name: cards.name,
      displayName: cards.displayName,
      pitch: cards.pitch,
      color: cards.color,
      typeText: cards.typeText,
      typeTextDisplay: cards.typeTextDisplay,
      text: cards.text,
      // User fields via JOIN
      discordUsername: users.discordUsername,
      discordId: users.discordId,
      userCountry: users.countryCode,
    };
  }

  /**
   * Map database row to WantsItemDTO
   */
  private mapToWantsItemDTO(row: any): WantsItemDTO {
    return {
      _id: row.id,
      userId: row.userId,
      printingId: row.printingId,
      card_unique_id: row.cardUniqueId,
      quantity: row.quantity,
      priority: row.priority,
      notes: row.notes || undefined,
      // Denormalized user fields
      discordUsername: row.discordUsername || undefined,
      discordId: row.discordId || undefined,
      userCountry: row.userCountry || undefined,
      // Denormalized printing fields
      display_name: row.displayName,
      name: row.name,
      pitch: row.pitch ?? undefined,
      set: row.set,
      edition: row.edition,
      foiling: row.foiling,
      rarity: row.rarity,
      collector_number: row.collectorNumber || undefined,
      color: row.color || undefined,
      type_text: row.typeText || undefined,
      type_text_display: row.typeTextDisplay || undefined,
      card_text: row.text || undefined,
      is_extended_art: row.isExtendedArt || false,
      image_url: row.imageUrl || undefined,
      tcgplayer_url: row.tcgplayerUrl || undefined,
      // Pricing fields
      tcg_low: row.tcgLow ?? undefined,
      tcg_mid: row.tcgMid ?? undefined,
      tcg_high: row.tcgHigh ?? undefined,
      tcg_market: row.tcgMarket ?? undefined,
      has_price: row.hasPrice || false,
      price_updated_at: row.priceUpdatedAt || undefined,
      // Timestamps
      printingCreatedAt: row.printingCreatedAt || undefined,
      printingUpdatedAt: row.printingUpdatedAt || undefined,
      addedAt: row.addedAt,
      createdAt: row.addedAt,
      updatedAt: row.updatedAt || undefined,
    };
  }
}
