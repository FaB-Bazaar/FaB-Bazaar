/**
 * PostgreSQL implementation of Binder Service
 *
 * Implements IBinderService using PostgreSQL + Drizzle ORM
 * Uses JOINs to eliminate denormalization, transactions for ACID operations
 *
 * This is the most complex service with 30 methods including:
 * - CRUD operations
 * - Card management (add, update, delete, swap)
 * - Transfer operations with partial quantities
 * - Stats tracking and aggregation
 */

import { eq, and, or, sql, inArray, desc, asc, like, ilike } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { binders, inventoryItems, users, printings, cards } from '@/lib/postgres/schema';
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
  PrintingAlternativeDTO,
  ExportCardsResult,
  BinderSummaryDTO,
  BinderStatsInfo,
  BinderWithStatsDTO,
  CardSearchResultDTO,
  VisibilityDTO,
} from '@/lib/services/contracts/IBinderService';
import type { AsyncResult, PaginationOptions } from '@/lib/services/contracts/common';
import { v4 as uuidv4 } from 'uuid';

export class PostgresBinderService implements IBinderService {
  // ============================================================================
  // CORE CRUD OPERATIONS
  // ============================================================================

  /**
   * Create a new binder
   */
  async createBinder(userId: string, data: CreateBinderDTO): AsyncResult<BinderDTO> {
    try {
      const [newBinder] = await db
        .insert(binders)
        .values({
          id: uuidv4(),
          userId,
          name: data.name,
          description: data.description || '',
          isPublic: data.isPublic ?? true,
          slug: data.slug || null,
          visibilityLevel: data.visibility?.level || 'public',
          allowInSearch: data.visibility?.allowInSearch ?? true,
          allowInMatching: data.visibility?.allowInMatching ?? true,
          allowDiscordCommands: data.visibility?.allowDiscordCommands ?? true,
          allowApiExport: data.visibility?.allowApiExport ?? true,
          allowWhoHas: data.visibility?.allowWhoHas ?? true,
          allowWebhooks: data.visibility?.allowWebhooks ?? false,
          statsNeedUpdate: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return { success: true, data: this.mapToBinderDTO(newBinder) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create binder',
      };
    }
  }

  /**
   * Get single binder
   */
  async getBinder(binderId: string, requestingUserId?: string): AsyncResult<BinderDTO | null> {
    try {
      const binder = await db.query.binders.findFirst({
        where: eq(binders.id, binderId),
      });

      if (!binder) {
        return { success: true, data: null };
      }

      // Check access
      const isOwner = requestingUserId && binder.userId === requestingUserId;
      const isPublic = binder.isPublic;

      if (!isOwner && !isPublic) {
        return { success: false, error: 'Access denied: This binder is private' };
      }

      return { success: true, data: this.mapToBinderDTO(binder) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get binder',
      };
    }
  }

  /**
   * Update binder
   */
  async updateBinder(binderId: string, userId: string, updates: UpdateBinderDTO): AsyncResult<BinderDTO> {
    try {
      // Verify ownership
      const existing = await db.query.binders.findFirst({
        where: and(eq(binders.id, binderId), eq(binders.userId, userId)),
      });

      if (!existing) {
        return { success: false, error: 'Binder not found or access denied' };
      }

      const updateData: any = {
        updatedAt: new Date(),
        lastActivityAt: new Date(),
      };

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.isPublic !== undefined) updateData.isPublic = updates.isPublic;
      if (updates.slug !== undefined) updateData.slug = updates.slug;
      if (updates.thumbnailPrintingId !== undefined) updateData.thumbnailPrintingId = updates.thumbnailPrintingId;

      if (updates.visibility) {
        if (updates.visibility.level !== undefined) updateData.visibilityLevel = updates.visibility.level;
        if (updates.visibility.allowInSearch !== undefined) updateData.allowInSearch = updates.visibility.allowInSearch;
        if (updates.visibility.allowInMatching !== undefined) updateData.allowInMatching = updates.visibility.allowInMatching;
        if (updates.visibility.allowDiscordCommands !== undefined) updateData.allowDiscordCommands = updates.visibility.allowDiscordCommands;
        if (updates.visibility.allowApiExport !== undefined) updateData.allowApiExport = updates.visibility.allowApiExport;
        if (updates.visibility.allowWhoHas !== undefined) updateData.allowWhoHas = updates.visibility.allowWhoHas;
        if (updates.visibility.allowWebhooks !== undefined) updateData.allowWebhooks = updates.visibility.allowWebhooks;
      }

      const [updated] = await db
        .update(binders)
        .set(updateData)
        .where(eq(binders.id, binderId))
        .returning();

      return { success: true, data: this.mapToBinderDTO(updated) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update binder',
      };
    }
  }

  /**
   * Delete binder (also deletes related inventory items via CASCADE)
   */
  async deleteBinder(binderId: string, userId: string): AsyncResult<boolean> {
    try {
      // Verify ownership
      const existing = await db.query.binders.findFirst({
        where: and(eq(binders.id, binderId), eq(binders.userId, userId)),
      });

      if (!existing) {
        return { success: false, error: 'Binder not found or access denied' };
      }

      // Delete binder (CASCADE deletes inventory items)
      await db.delete(binders).where(eq(binders.id, binderId));

      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete binder',
      };
    }
  }

  /**
   * List binders with filters
   */
  async listBinders(filters: BinderListFilters, options?: PaginationOptions): AsyncResult<BinderDTO[]> {
    try {
      const conditions = [];

      if (filters.userId) conditions.push(eq(binders.userId, filters.userId));
      if (filters.isPublic !== undefined) conditions.push(eq(binders.isPublic, filters.isPublic));
      if (filters.archived !== undefined) conditions.push(eq(binders.archived, filters.archived));
      else conditions.push(eq(binders.archived, false)); // exclude archived by default
      if (filters.discordId) {
        // Join with users to filter by discordId
        const userResults = await db.query.users.findMany({
          where: eq(users.discordId, filters.discordId),
        });
        if (userResults.length > 0) {
          conditions.push(eq(binders.userId, userResults[0].id));
        } else {
          return { success: true, data: [] };
        }
      }

      const results = await db.query.binders.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        limit: options?.limit,
        offset: options?.skip,
        orderBy: desc(binders.createdAt),
      });

      return { success: true, data: results.map((b) => this.mapToBinderDTO(b)) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list binders',
      };
    }
  }

  /**
   * Check if user has access to binder
   */
  async checkAccess(binderId: string, userId: string): AsyncResult<boolean> {
    try {
      const binder = await db.query.binders.findFirst({
        where: eq(binders.id, binderId),
      });

      if (!binder) {
        return { success: true, data: false };
      }

      const hasAccess = binder.userId === userId || binder.isPublic;
      return { success: true, data: hasAccess };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check access',
      };
    }
  }

  // ============================================================================
  // CARD MANAGEMENT OPERATIONS
  // ============================================================================

  /**
   * Add cards to binder
   */
  async addCardsToBinder(binderId: string, userId: string, cards: AddCardDTO[]): AsyncResult<AddCardsResultDTO> {
    try {
      // Verify ownership
      const binder = await db.query.binders.findFirst({
        where: and(eq(binders.id, binderId), eq(binders.userId, userId)),
      });

      if (!binder) {
        return { success: false, error: 'Binder not found or access denied' };
      }

      const results: AddCardsResultDTO['results'] = [];
      let added = 0;
      let updated = 0;
      let failed = 0;

      for (const card of cards) {
        try {
          // Verify the printing exists before inserting (FK constraint guard)
          const printingExists = await db.query.printings.findFirst({
            where: eq(printings.printingId, card.printingId),
            columns: { printingId: true },
          });
          if (!printingExists) {
            failed++;
            results.push({
              printingId: card.printingId,
              success: false,
              error: `Printing not found in database: ${card.printingId}`,
            });
            continue;
          }

          // Check if card already exists (same printing, condition, language)
          const existing = await db.query.inventoryItems.findFirst({
            where: and(
              eq(inventoryItems.binderId, binderId),
              eq(inventoryItems.printingId, card.printingId),
              eq(inventoryItems.condition, card.condition || 'NM'),
              eq(inventoryItems.language, card.language || 'EN')
            ),
          });

          if (existing) {
            // Update quantity
            const newQuantity = existing.quantity + (card.quantity || 1);
            await db
              .update(inventoryItems)
              .set({ quantity: newQuantity, updatedAt: new Date() })
              .where(eq(inventoryItems.id, existing.id));

            updated++;
            results.push({
              printingId: card.printingId,
              success: true,
              action: 'updated',
              quantityAdded: card.quantity || 1,
            });
          } else {
            // Add new card
            await db.insert(inventoryItems).values({
              id: uuidv4(),
              userId,
              binderId,
              printingId: card.printingId,
              quantity: card.quantity || 1,
              condition: card.condition || 'NM',
              language: card.language || 'EN',
              notes: card.notes || '',
              forTrade: card.forTrade ?? false,
              forSale: card.forSale ?? false,
              acquisitionPrice: card.acquisitionPrice ?? null,
              acquisitionDate: card.acquisitionDate ?? null,
              addedAt: new Date(),
              updatedAt: new Date(),
            });

            added++;
            results.push({
              printingId: card.printingId,
              success: true,
              action: 'added',
              quantityAdded: card.quantity || 1,
            });
          }
        } catch (error) {
          failed++;
          // Expose the real DB error from error.cause (Drizzle wraps PG errors)
          const cause = (error as any)?.cause;
          const dbMessage = cause?.message || cause?.detail || cause?.code;
          const message = error instanceof Error ? error.message : 'Failed to add card';
          results.push({
            printingId: card.printingId,
            success: false,
            error: dbMessage ? `${message} | DB: ${dbMessage}` : message,
          });
        }
      }

      // Mark stats as needing update and record activity
      await db.update(binders).set({ statsNeedUpdate: true, lastActivityAt: new Date() }).where(eq(binders.id, binderId));

      return {
        success: true,
        data: {
          summary: {
            total: cards.length,
            added,
            updated,
            failed,
            filtered: 0,
          },
          results,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add cards to binder',
      };
    }
  }

  /**
   * Get binder cards with filtering/sorting
   */
  async getBinderCards(
    binderId: string,
    filters: BinderCardFilters,
    options: BinderCardSearchOptions
  ): AsyncResult<BinderCardsResult> {
    try {
      const conditions = [eq(inventoryItems.binderId, binderId)];

      // Apply filters
      if (filters.search) {
        conditions.push(sql`${cards.displayName} ILIKE ${`%${filters.search}%`}`);
      }

      if (filters.rarity) {
        conditions.push(eq(printings.rarity, filters.rarity.toLowerCase()));
      }

      if (filters.foiling) {
        conditions.push(eq(printings.foiling, filters.foiling.toLowerCase()));
      }

      if (filters.set) {
        conditions.push(eq(printings.set, filters.set.toLowerCase()));
      }

      if (filters.condition) {
        conditions.push(eq(inventoryItems.condition, filters.condition));
      }

      if (filters.forTrade !== undefined) {
        conditions.push(eq(inventoryItems.forTrade, filters.forTrade));
      }

      if (filters.class) {
        if (filters.class === 'generic') {
          conditions.push(eq(cards.isGeneric, true));
        } else {
          conditions.push(sql`${cards.classes} @> ARRAY[${filters.class}]::text[]`);
        }
      }

      if (filters.startsWith) {
        conditions.push(sql`${cards.displayName} ILIKE ${filters.startsWith + '%'}`);
      }

      // Get total count
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(inventoryItems)
        .innerJoin(printings, eq(inventoryItems.printingId, printings.printingId))
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .where(and(...conditions));

      const total = countResult?.count || 0;

      // Pagination
      const page = options.page || 1;
      const limit = options.limit || 48;
      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(total / limit);

      // Sorting
      const orderByClause = this.buildCardOrderBy(options.sortBy);

      // Get cards
      const results = await db
        .select(this.buildInventoryCardSelectFields())
        .from(inventoryItems)
        .innerJoin(binders, eq(inventoryItems.binderId, binders.id))
        .innerJoin(users, eq(inventoryItems.userId, users.id))
        .innerJoin(printings, eq(inventoryItems.printingId, printings.printingId))
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .where(and(...conditions))
        .orderBy(...orderByClause)
        .limit(limit)
        .offset(offset);

      const cardDTOs = results.map((row) => this.mapToInventoryCardDTO(row));

      // Get metadata (unique values and counts)
      const metadata = await this.getBinderCardMetadata(binderId);

      return {
        success: true,
        data: {
          cards: cardDTOs,
          pagination: { page, limit, total, totalPages },
          metadata,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get binder cards',
      };
    }
  }

  /**
   * Get single card from binder
   */
  async getBinderCard(binderId: string, cardId: string, requestingUserId?: string): AsyncResult<InventoryCardDTO | null> {
    try {
      // Check access first
      const accessResult = await this.checkAccess(binderId, requestingUserId || '');
      if (!accessResult.success || !accessResult.data) {
        return { success: true, data: null };
      }

      const results = await db
        .select(this.buildInventoryCardSelectFields())
        .from(inventoryItems)
        .innerJoin(binders, eq(inventoryItems.binderId, binders.id))
        .innerJoin(users, eq(inventoryItems.userId, users.id))
        .innerJoin(printings, eq(inventoryItems.printingId, printings.printingId))
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .where(and(eq(inventoryItems.id, cardId), eq(inventoryItems.binderId, binderId)))
        .limit(1);

      if (!results || results.length === 0) {
        return { success: true, data: null };
      }

      return { success: true, data: this.mapToInventoryCardDTO(results[0]) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get binder card',
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
      // Verify ownership
      const binder = await db.query.binders.findFirst({
        where: and(eq(binders.id, binderId), eq(binders.userId, userId)),
      });

      if (!binder) {
        return { success: false, error: 'Binder not found or access denied' };
      }

      await db
        .update(inventoryItems)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(inventoryItems.id, cardId), eq(inventoryItems.binderId, binderId)));

      // Mark stats as needing update and record activity
      await db.update(binders).set({ statsNeedUpdate: true, lastActivityAt: new Date() }).where(eq(binders.id, binderId));

      const updated = await this.getBinderCard(binderId, cardId, userId);

      if (!updated.success || !updated.data) {
        return { success: false, error: 'Card not found after update' };
      }

      return { success: true, data: updated.data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update binder card',
      };
    }
  }

  /**
   * Swap card to different printing (with merge logic)
   */
  async swapCardPrinting(
    binderId: string,
    cardId: string,
    userId: string,
    newPrintingId: string
  ): AsyncResult<SwapPrintingResultDTO> {
    try {
      return await db.transaction(async (tx) => {
        // Get the source card
        const [sourceCard] = await tx
          .select()
          .from(inventoryItems)
          .where(and(eq(inventoryItems.id, cardId), eq(inventoryItems.binderId, binderId)))
          .for('update');

        if (!sourceCard) {
          return {
            success: false,
            error: 'Card not found',
          } as AsyncResult<SwapPrintingResultDTO>;
        }

        // Check if target printing already exists in binder (same condition & language)
        const [targetCard] = await tx
          .select()
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.binderId, binderId),
              eq(inventoryItems.printingId, newPrintingId),
              eq(inventoryItems.condition, sourceCard.condition),
              eq(inventoryItems.language, sourceCard.language)
            )
          )
          .for('update');

        if (targetCard) {
          // Merge: add source quantity to target, delete source
          const newQuantity = targetCard.quantity + sourceCard.quantity;
          await tx
            .update(inventoryItems)
            .set({ quantity: newQuantity, updatedAt: new Date() })
            .where(eq(inventoryItems.id, targetCard.id));

          await tx.delete(inventoryItems).where(eq(inventoryItems.id, cardId));

          await tx.update(binders).set({ statsNeedUpdate: true, lastActivityAt: new Date() }).where(eq(binders.id, binderId));

          return {
            success: true,
            data: {
              success: true,
              message: `Merged ${sourceCard.quantity} into existing card`,
              merged: true,
              newQuantity,
              mergedIntoCardId: targetCard.id,
            },
          } as AsyncResult<SwapPrintingResultDTO>;
        } else {
          // Swap: update printing ID
          await tx
            .update(inventoryItems)
            .set({ printingId: newPrintingId, updatedAt: new Date() })
            .where(eq(inventoryItems.id, cardId));

          await tx.update(binders).set({ statsNeedUpdate: true, lastActivityAt: new Date() }).where(eq(binders.id, binderId));

          return {
            success: true,
            data: {
              success: true,
              message: 'Printing swapped successfully',
              merged: false,
            },
          } as AsyncResult<SwapPrintingResultDTO>;
        }
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to swap card printing',
      };
    }
  }

  /**
   * Delete a card from binder
   */
  async deleteBinderCard(binderId: string, cardId: string, userId: string): AsyncResult<boolean> {
    try {
      // Verify ownership
      const binder = await db.query.binders.findFirst({
        where: and(eq(binders.id, binderId), eq(binders.userId, userId)),
      });

      if (!binder) {
        return { success: false, error: 'Binder not found or access denied' };
      }

      await db.delete(inventoryItems).where(and(eq(inventoryItems.id, cardId), eq(inventoryItems.binderId, binderId)));

      // Mark stats as needing update and record activity
      await db.update(binders).set({ statsNeedUpdate: true, lastActivityAt: new Date() }).where(eq(binders.id, binderId));

      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete binder card',
      };
    }
  }

  /**
   * Bulk update cards in binder
   */
  async bulkUpdateCards(
    binderId: string,
    userId: string,
    field: 'forTrade' | 'forSale' | 'condition' | 'language',
    value: any,
    cardIds?: string[]
  ): AsyncResult<BulkUpdateResultDTO> {
    try {
      // Verify ownership
      const binder = await db.query.binders.findFirst({
        where: and(eq(binders.id, binderId), eq(binders.userId, userId)),
      });

      if (!binder) {
        return { success: false, error: 'Binder not found or access denied' };
      }

      const conditions = [eq(inventoryItems.binderId, binderId)];

      if (cardIds && cardIds.length > 0) {
        conditions.push(inArray(inventoryItems.id, cardIds));
      }

      const result = await db
        .update(inventoryItems)
        .set({ [field]: value, updatedAt: new Date() })
        .where(and(...conditions));

      await db.update(binders).set({ statsNeedUpdate: true, lastActivityAt: new Date() }).where(eq(binders.id, binderId));

      return {
        success: true,
        data: {
          success: true,
          modifiedCount: result.rowCount || 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to bulk update cards',
      };
    }
  }

  /**
   * Transfer all cards between binders
   */
  async transferAllCards(sourceBinderId: string, targetBinderId: string, userId: string): AsyncResult<TransferResultDTO> {
    try {
      return await db.transaction(async (tx) => {
        // Verify ownership of both binders
        const [sourceBinder, targetBinder] = await Promise.all([
          tx.query.binders.findFirst({ where: and(eq(binders.id, sourceBinderId), eq(binders.userId, userId)) }),
          tx.query.binders.findFirst({ where: and(eq(binders.id, targetBinderId), eq(binders.userId, userId)) }),
        ]);

        if (!sourceBinder || !targetBinder) {
          return {
            success: false,
            error: 'Source or target binder not found or access denied',
          } as AsyncResult<TransferResultDTO>;
        }

        // Get all cards from source
        const sourceCards = await tx
          .select()
          .from(inventoryItems)
          .where(eq(inventoryItems.binderId, sourceBinderId))
          .for('update');

        let transferred = 0;
        let merged = 0;

        for (const card of sourceCards) {
          // Check if target has same card (same printing, condition, language)
          const [targetCard] = await tx
            .select()
            .from(inventoryItems)
            .where(
              and(
                eq(inventoryItems.binderId, targetBinderId),
                eq(inventoryItems.printingId, card.printingId),
                eq(inventoryItems.condition, card.condition),
                eq(inventoryItems.language, card.language)
              )
            )
            .for('update');

          if (targetCard) {
            // Merge quantities into target and remove source
            await tx
              .update(inventoryItems)
              .set({ quantity: targetCard.quantity + card.quantity, updatedAt: new Date() })
              .where(eq(inventoryItems.id, targetCard.id));

            await tx.delete(inventoryItems).where(eq(inventoryItems.id, card.id));

            merged++;
          } else {
            // Move card
            await tx
              .update(inventoryItems)
              .set({ binderId: targetBinderId, updatedAt: new Date() })
              .where(eq(inventoryItems.id, card.id));

            transferred++;
          }
        }

        // Update stats flags and record activity for both binders
        await tx.update(binders).set({ statsNeedUpdate: true, lastActivityAt: new Date() }).where(inArray(binders.id, [sourceBinderId, targetBinderId]));

        return {
          success: true,
          data: {
            success: true,
            transferred,
            merged,
            message: `Transferred ${transferred} cards, merged ${merged} cards`,
          },
        } as AsyncResult<TransferResultDTO>;
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to transfer all cards',
      };
    }
  }

  /**
   * Transfer selected cards between binders with partial quantity support
   */
  async transferSelectedCards(
    sourceBinderId: string,
    targetBinderId: string,
    userId: string,
    cardsToTransfer: TransferCardInput[]
  ): AsyncResult<TransferSelectedResultDTO> {
    try {
      return await db.transaction(async (tx) => {
        // Verify ownership
        const [sourceBinder, targetBinder] = await Promise.all([
          tx.query.binders.findFirst({ where: and(eq(binders.id, sourceBinderId), eq(binders.userId, userId)) }),
          tx.query.binders.findFirst({ where: and(eq(binders.id, targetBinderId), eq(binders.userId, userId)) }),
        ]);

        if (!sourceBinder || !targetBinder) {
          return {
            success: false,
            error: 'Source or target binder not found or access denied',
          } as AsyncResult<TransferSelectedResultDTO>;
        }

        const results: TransferSelectedResultDTO['results'] = [];
        let successful = 0;
        let failed = 0;
        let fullyTransferred = 0;
        let partiallyTransferred = 0;
        let mergedInTarget = 0;
        let totalQuantityTransferred = 0;

        for (const transfer of cardsToTransfer) {
          try {
            // Get source card
            const [sourceCard] = await tx
              .select()
              .from(inventoryItems)
              .where(and(eq(inventoryItems.id, transfer.cardId), eq(inventoryItems.binderId, sourceBinderId)))
              .for('update');

            if (!sourceCard) {
              failed++;
              results.push({
                success: false,
                cardId: transfer.cardId,
                printingId: '',
                name: '',
                action: 'transferred',
                quantity: 0,
                remainingInSource: 0,
                error: 'Card not found in source binder',
              });
              continue;
            }

            const quantityToTransfer = Math.min(transfer.quantity, sourceCard.quantity);
            const remainingInSource = sourceCard.quantity - quantityToTransfer;

            // Check if target has same card
            const [targetCard] = await tx
              .select()
              .from(inventoryItems)
              .where(
                and(
                  eq(inventoryItems.binderId, targetBinderId),
                  eq(inventoryItems.printingId, sourceCard.printingId),
                  eq(inventoryItems.condition, sourceCard.condition),
                  eq(inventoryItems.language, sourceCard.language)
                )
              )
              .for('update');

            // Get card name for result
            const [printingInfo] = await tx
              .select({ displayName: cards.displayName })
              .from(printings)
              .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
              .where(eq(printings.printingId, sourceCard.printingId))
              .limit(1);

            const cardName = printingInfo?.displayName || 'Unknown';

            if (targetCard) {
              // Merge into target
              await tx
                .update(inventoryItems)
                .set({ quantity: targetCard.quantity + quantityToTransfer, updatedAt: new Date() })
                .where(eq(inventoryItems.id, targetCard.id));

              mergedInTarget++;
            } else {
              // Create new card in target
              await tx.insert(inventoryItems).values({
                id: uuidv4(),
                userId,
                binderId: targetBinderId,
                printingId: sourceCard.printingId,
                quantity: quantityToTransfer,
                condition: sourceCard.condition,
                language: sourceCard.language,
                notes: sourceCard.notes,
                forTrade: sourceCard.forTrade,
                forSale: sourceCard.forSale,
                addedAt: new Date(),
                updatedAt: new Date(),
              });
            }

            // Update or delete source card
            if (remainingInSource > 0) {
              await tx
                .update(inventoryItems)
                .set({ quantity: remainingInSource, updatedAt: new Date() })
                .where(eq(inventoryItems.id, sourceCard.id));

              partiallyTransferred++;
            } else {
              await tx.delete(inventoryItems).where(eq(inventoryItems.id, sourceCard.id));
              fullyTransferred++;
            }

            successful++;
            totalQuantityTransferred += quantityToTransfer;

            results.push({
              success: true,
              cardId: transfer.cardId,
              printingId: sourceCard.printingId,
              name: cardName,
              action: remainingInSource > 0 ? 'partial_transfer' : 'transferred',
              quantity: quantityToTransfer,
              remainingInSource,
              mergedInTarget: !!targetCard,
              targetQuantity: targetCard ? targetCard.quantity + quantityToTransfer : quantityToTransfer,
            });
          } catch (error) {
            failed++;
            results.push({
              success: false,
              cardId: transfer.cardId,
              printingId: '',
              name: '',
              action: 'transferred',
              quantity: 0,
              remainingInSource: 0,
              error: error instanceof Error ? error.message : 'Transfer failed',
            });
          }
        }

        // Update stats flags and record activity for both binders
        await tx.update(binders).set({ statsNeedUpdate: true, lastActivityAt: new Date() }).where(inArray(binders.id, [sourceBinderId, targetBinderId]));

        return {
          success: true,
          data: {
            success: true,
            summary: {
              totalRequested: cardsToTransfer.length,
              successful,
              failed,
              fullyTransferred,
              partiallyTransferred,
              mergedInTarget,
              totalQuantityTransferred,
            },
            results,
            message: `Transferred ${totalQuantityTransferred} cards (${successful} operations successful, ${failed} failed)`,
          },
        } as AsyncResult<TransferSelectedResultDTO>;
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to transfer selected cards',
      };
    }
  }

  /**
   * Copy entire binder
   */
  async copyBinder(
    sourceBinderId: string,
    userId: string,
    newName: string,
    options?: CopyBinderOptions
  ): AsyncResult<BinderDTO> {
    try {
      return await db.transaction(async (tx) => {
        // Get source binder
        const sourceBinder = await tx.query.binders.findFirst({
          where: eq(binders.id, sourceBinderId),
        });

        if (!sourceBinder) {
          return {
            success: false,
            error: 'Source binder not found',
          } as AsyncResult<BinderDTO>;
        }

        // Check access if not owner
        if (sourceBinder.userId !== userId && !sourceBinder.isPublic) {
          return {
            success: false,
            error: 'Access denied',
          } as AsyncResult<BinderDTO>;
        }

        // Create new binder
        const [newBinder] = await tx
          .insert(binders)
          .values({
            id: uuidv4(),
            userId,
            name: newName,
            description: sourceBinder.description,
            isPublic: options?.enforcePrivacy ? false : sourceBinder.isPublic,
            slug: options?.slug || null,
            visibilityLevel: sourceBinder.visibilityLevel,
            allowInSearch: sourceBinder.allowInSearch,
            allowInMatching: sourceBinder.allowInMatching,
            allowDiscordCommands: sourceBinder.allowDiscordCommands,
            allowApiExport: sourceBinder.allowApiExport,
            allowWhoHas: sourceBinder.allowWhoHas,
            allowWebhooks: sourceBinder.allowWebhooks,
            statsNeedUpdate: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Copy all cards
        const sourceCards = await tx.select().from(inventoryItems).where(eq(inventoryItems.binderId, sourceBinderId));

        for (const card of sourceCards) {
          await tx.insert(inventoryItems).values({
            id: uuidv4(),
            userId,
            binderId: newBinder.id,
            printingId: card.printingId,
            quantity: card.quantity,
            condition: card.condition,
            language: card.language,
            notes: options?.enforcePrivacy ? '' : card.notes,
            forTrade: options?.enforcePrivacy ? false : card.forTrade,
            forSale: card.forSale,
            addedAt: new Date(),
            updatedAt: new Date(),
          });
        }

        return {
          success: true,
          data: this.mapToBinderDTO(newBinder),
        } as AsyncResult<BinderDTO>;
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to copy binder',
      };
    }
  }

  // ============================================================================
  // CROSS-BINDER OPERATIONS
  // ============================================================================

  /**
   * Toggle forTrade status for all cards with specified printing IDs across ALL user's binders
   */
  async toggleForTradeByPrintingIds(
    userId: string,
    printingIds: string[],
    forTrade: boolean
  ): AsyncResult<BulkToggleByPrintingResult> {
    try {
      const result = await db
        .update(inventoryItems)
        .set({ forTrade, updatedAt: new Date() })
        .where(and(eq(inventoryItems.userId, userId), inArray(inventoryItems.printingId, printingIds)));

      return {
        success: true,
        data: {
          modifiedCount: result.rowCount || 0,
          printingIdsProcessed: printingIds.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle forTrade',
      };
    }
  }

  /**
   * Get ALL cards across all user's binders with filtering
   */
  async getAllCardsForUser(
    userId: string,
    filters?: UserCollectionFilters,
    options?: UserCollectionOptions
  ): AsyncResult<UserCollectionResult> {
    try {
      const whereConditions = [eq(inventoryItems.userId, userId)];

      if (filters?.search) {
        whereConditions.push(sql`${cards.displayName} ILIKE ${`%${filters.search}%`}`);
      }
      if (filters?.rarity) {
        whereConditions.push(eq(printings.rarity, filters.rarity.toLowerCase()));
      }
      if (filters?.foiling) {
        whereConditions.push(eq(printings.foiling, filters.foiling.toLowerCase()));
      }
      if (filters?.set) {
        whereConditions.push(eq(printings.set, filters.set.toLowerCase()));
      }
      if (filters?.condition) {
        whereConditions.push(eq(inventoryItems.condition, filters.condition));
      }
      if (filters?.forTrade !== undefined) {
        whereConditions.push(eq(inventoryItems.forTrade, filters.forTrade));
      }

      const orderByClause = this.buildCardOrderBy(options?.sortBy);

      const results = await db
        .select(this.buildInventoryCardSelectFields())
        .from(inventoryItems)
        .innerJoin(binders, eq(inventoryItems.binderId, binders.id))
        .innerJoin(users, eq(inventoryItems.userId, users.id))
        .innerJoin(printings, eq(inventoryItems.printingId, printings.printingId))
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .where(and(...whereConditions))
        .orderBy(...orderByClause);

      const cardDTOs = results.map((row) => this.mapToInventoryCardDTO(row));

      // Get metadata across all user's cards
      const [rarities, foilings, sets, conditionValues] = await Promise.all([
        db.selectDistinct({ value: printings.rarity })
          .from(inventoryItems)
          .innerJoin(printings, eq(inventoryItems.printingId, printings.printingId))
          .where(eq(inventoryItems.userId, userId)),
        db.selectDistinct({ value: printings.foiling })
          .from(inventoryItems)
          .innerJoin(printings, eq(inventoryItems.printingId, printings.printingId))
          .where(eq(inventoryItems.userId, userId)),
        db.selectDistinct({ value: printings.set })
          .from(inventoryItems)
          .innerJoin(printings, eq(inventoryItems.printingId, printings.printingId))
          .where(eq(inventoryItems.userId, userId)),
        db.selectDistinct({ value: inventoryItems.condition })
          .from(inventoryItems)
          .where(eq(inventoryItems.userId, userId)),
      ]);

      const [forTradeCount, notForTradeCount] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` })
          .from(inventoryItems)
          .where(and(eq(inventoryItems.userId, userId), eq(inventoryItems.forTrade, true))),
        db.select({ count: sql<number>`count(*)::int` })
          .from(inventoryItems)
          .where(and(eq(inventoryItems.userId, userId), eq(inventoryItems.forTrade, false))),
      ]);

      const userBinders = await db
        .select({ id: binders.id, name: binders.name })
        .from(binders)
        .where(eq(binders.userId, userId));

      return {
        success: true,
        data: {
          cards: cardDTOs,
          metadata: {
            uniqueValues: {
              rarities: rarities.map((r) => r.value),
              foilings: foilings.map((f) => f.value),
              sets: sets.map((s) => s.value),
              conditions: conditionValues.map((c) => c.value),
            },
            counts: {
              forTrade: forTradeCount[0]?.count || 0,
              notForTrade: notForTradeCount[0]?.count || 0,
            },
          },
          binders: userBinders.map((b) => ({ _id: b.id, name: b.name })),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user collection',
      };
    }
  }

  /**
   * Get all printing alternatives for a card with user's ownership info
   */
  async getPrintingAlternatives(cardUniqueId: string, userId?: string): AsyncResult<PrintingAlternativesResult> {
    // TODO: Implement printing alternatives query
    return { success: false, error: 'getPrintingAlternatives not implemented yet' };
  }

  // ============================================================================
  // LOOKUP AND EXPORT OPERATIONS
  // ============================================================================

  /**
   * Find binder by ID, slug, or discordExternalId
   */
  async findBinderByIdOrSlug(identifier: string, userId?: string): AsyncResult<BinderDTO | null> {
    try {
      const conditions = userId
        ? [eq(binders.userId, userId), or(eq(binders.id, identifier), eq(binders.slug, identifier))]
        : [or(eq(binders.id, identifier), eq(binders.slug, identifier))];

      const binder = await db.query.binders.findFirst({
        where: and(...conditions),
      });

      if (!binder) {
        return { success: true, data: null };
      }

      return { success: true, data: this.mapToBinderDTO(binder) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find binder',
      };
    }
  }

  /**
   * Get all cards for export (no pagination)
   */
  async getAllCardsForExport(binderId: string, userId?: string): AsyncResult<ExportCardsResult> {
    try {
      // Check access
      if (userId) {
        const accessResult = await this.checkAccess(binderId, userId);
        if (!accessResult.success || !accessResult.data) {
          return { success: false, error: 'Access denied' };
        }
      }

      const binder = await db.query.binders.findFirst({
        where: eq(binders.id, binderId),
      });

      if (!binder) {
        return { success: false, error: 'Binder not found' };
      }

      const results = await db
        .select(this.buildInventoryCardSelectFields())
        .from(inventoryItems)
        .innerJoin(binders, eq(inventoryItems.binderId, binders.id))
        .innerJoin(users, eq(inventoryItems.userId, users.id))
        .innerJoin(printings, eq(inventoryItems.printingId, printings.printingId))
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .where(eq(inventoryItems.binderId, binderId))
        .orderBy(asc(cards.displayName));

      const cardDTOs = results.map((row) => this.mapToInventoryCardDTO(row));

      return {
        success: true,
        data: {
          cards: cardDTOs,
          binderName: binder.name,
          totalCards: cardDTOs.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export cards',
      };
    }
  }

  /**
   * List user's binders as lightweight summaries
   */
  async listUserBindersSummary(userId: string): AsyncResult<BinderSummaryDTO[]> {
    try {
      const results = await db
        .select({
          id: binders.id,
          name: binders.name,
          slug: binders.slug,
        })
        .from(binders)
        .where(eq(binders.userId, userId))
        .orderBy(desc(binders.createdAt));

      const summaries: BinderSummaryDTO[] = results.map((row) => ({
        _id: row.id,
        name: row.name,
        slug: row.slug || undefined,
      }));

      return { success: true, data: summaries };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list binder summaries',
      };
    }
  }

  /**
   * Get or create binder by slug
   */
  async getOrCreateBinderBySlug(userId: string, slug: string): AsyncResult<BinderDTO> {
    try {
      const existing = await db.query.binders.findFirst({
        where: and(eq(binders.userId, userId), eq(binders.slug, slug)),
      });

      if (existing) {
        return { success: true, data: this.mapToBinderDTO(existing) };
      }

      // Create new binder
      return this.createBinder(userId, {
        name: slug,
        slug,
        isPublic: true,
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get or create binder',
      };
    }
  }

  /**
   * Get user's primary (first) binder
   */
  async getUserPrimaryBinder(userId: string): AsyncResult<BinderDTO | null> {
    try {
      const binder = await db.query.binders.findFirst({
        where: eq(binders.userId, userId),
        orderBy: asc(binders.createdAt),
      });

      if (!binder) {
        return { success: true, data: null };
      }

      return { success: true, data: this.mapToBinderDTO(binder) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get primary binder',
      };
    }
  }

  /**
   * Calculate binder statistics using SQL aggregates
   *
   * Calculates real-time stats for quantities, values, and rarity counts.
   * Uses PostgreSQL aggregates for performance (typically 2-5ms execution time).
   *
   * @param binderId - The binder ID to calculate stats for
   * @returns Complete binder statistics
   */
  private async calculateBinderStats(binderId: string) {
    try {
      // Get overall stats with price aggregations
      const [overallStats] = await db
        .select({
          totalQuantity: sql<number>`COALESCE(SUM(${inventoryItems.quantity}), 0)::int`,
          quantityForTrade: sql<number>`COALESCE(SUM(CASE WHEN ${inventoryItems.forTrade} THEN ${inventoryItems.quantity} ELSE 0 END), 0)::int`,
          quantityNotForTrade: sql<number>`COALESCE(SUM(CASE WHEN NOT ${inventoryItems.forTrade} THEN ${inventoryItems.quantity} ELSE 0 END), 0)::int`,

          // Total value across all pricing types
          totalValueMarket: sql<number>`COALESCE(SUM(${inventoryItems.quantity} * ${printings.tcgMarket}), 0)::real`,
          totalValueLow: sql<number>`COALESCE(SUM(${inventoryItems.quantity} * ${printings.tcgLow}), 0)::real`,
          totalValueMid: sql<number>`COALESCE(SUM(${inventoryItems.quantity} * ${printings.tcgMid}), 0)::real`,
          totalValueHigh: sql<number>`COALESCE(SUM(${inventoryItems.quantity} * ${printings.tcgHigh}), 0)::real`,

          // For trade value
          forTradeValueMarket: sql<number>`COALESCE(SUM(CASE WHEN ${inventoryItems.forTrade} THEN ${inventoryItems.quantity} * ${printings.tcgMarket} ELSE 0 END), 0)::real`,
          forTradeValueLow: sql<number>`COALESCE(SUM(CASE WHEN ${inventoryItems.forTrade} THEN ${inventoryItems.quantity} * ${printings.tcgLow} ELSE 0 END), 0)::real`,
          forTradeValueMid: sql<number>`COALESCE(SUM(CASE WHEN ${inventoryItems.forTrade} THEN ${inventoryItems.quantity} * ${printings.tcgMid} ELSE 0 END), 0)::real`,
          forTradeValueHigh: sql<number>`COALESCE(SUM(CASE WHEN ${inventoryItems.forTrade} THEN ${inventoryItems.quantity} * ${printings.tcgHigh} ELSE 0 END), 0)::real`,

          // Not for trade value
          notForTradeValueMarket: sql<number>`COALESCE(SUM(CASE WHEN NOT ${inventoryItems.forTrade} THEN ${inventoryItems.quantity} * ${printings.tcgMarket} ELSE 0 END), 0)::real`,
          notForTradeValueLow: sql<number>`COALESCE(SUM(CASE WHEN NOT ${inventoryItems.forTrade} THEN ${inventoryItems.quantity} * ${printings.tcgLow} ELSE 0 END), 0)::real`,
          notForTradeValueMid: sql<number>`COALESCE(SUM(CASE WHEN NOT ${inventoryItems.forTrade} THEN ${inventoryItems.quantity} * ${printings.tcgMid} ELSE 0 END), 0)::real`,
          notForTradeValueHigh: sql<number>`COALESCE(SUM(CASE WHEN NOT ${inventoryItems.forTrade} THEN ${inventoryItems.quantity} * ${printings.tcgHigh} ELSE 0 END), 0)::real`,
        })
        .from(inventoryItems)
        .leftJoin(printings, eq(inventoryItems.printingId, printings.printingId))
        .where(eq(inventoryItems.binderId, binderId));

      // Get rarity counts (overall, for-trade, not-for-trade)
      const rarityCounts = await db
        .select({
          rarity: printings.rarity,
          total: sql<number>`COALESCE(SUM(${inventoryItems.quantity}), 0)::int`,
          forTrade: sql<number>`COALESCE(SUM(CASE WHEN ${inventoryItems.forTrade} THEN ${inventoryItems.quantity} ELSE 0 END), 0)::int`,
          notForTrade: sql<number>`COALESCE(SUM(CASE WHEN NOT ${inventoryItems.forTrade} THEN ${inventoryItems.quantity} ELSE 0 END), 0)::int`,
        })
        .from(inventoryItems)
        .leftJoin(printings, eq(inventoryItems.printingId, printings.printingId))
        .where(eq(inventoryItems.binderId, binderId))
        .groupBy(printings.rarity);

      // Build rarity count objects
      const rarityCountsObj: Record<string, number> = {};
      const rarityCountsForTradeObj: Record<string, number> = {};
      const rarityCountsNotForTradeObj: Record<string, number> = {};

      rarityCounts.forEach((row) => {
        if (row.rarity) {
          rarityCountsObj[row.rarity] = row.total || 0;
          rarityCountsForTradeObj[row.rarity] = row.forTrade || 0;
          rarityCountsNotForTradeObj[row.rarity] = row.notForTrade || 0;
        }
      });

      // Get showcase cards (top 10 most valuable cards)
      const showcaseCards = await db
        .select({
          printingId: inventoryItems.printingId,
          tcg_low: printings.tcgLow,
          rarity: printings.rarity,
        })
        .from(inventoryItems)
        .leftJoin(printings, eq(inventoryItems.printingId, printings.printingId))
        .where(eq(inventoryItems.binderId, binderId))
        .orderBy(desc(printings.tcgLow))
        .limit(10);

      return {
        totalQuantity: overallStats?.totalQuantity || 0,
        quantityForTrade: overallStats?.quantityForTrade || 0,
        quantityNotForTrade: overallStats?.quantityNotForTrade || 0,
        totalValue: {
          tcg_market: overallStats?.totalValueMarket || 0,
          tcg_low: overallStats?.totalValueLow || 0,
          tcg_mid: overallStats?.totalValueMid || 0,
          tcg_high: overallStats?.totalValueHigh || 0,
        },
        valueForTrade: {
          tcg_market: overallStats?.forTradeValueMarket || 0,
          tcg_low: overallStats?.forTradeValueLow || 0,
          tcg_mid: overallStats?.forTradeValueMid || 0,
          tcg_high: overallStats?.forTradeValueHigh || 0,
        },
        valueNotForTrade: {
          tcg_market: overallStats?.notForTradeValueMarket || 0,
          tcg_low: overallStats?.notForTradeValueLow || 0,
          tcg_mid: overallStats?.notForTradeValueMid || 0,
          tcg_high: overallStats?.notForTradeValueHigh || 0,
        },
        rarityCounts: rarityCountsObj,
        rarityCountsForTrade: rarityCountsForTradeObj,
        rarityCountsNotForTrade: rarityCountsNotForTradeObj,
        showcaseCards: showcaseCards.map((sc) => ({
          printingId: sc.printingId,
          tcg_low: sc.tcg_low || 0,
          rarity: sc.rarity || 'C',
        })),
      };
    } catch (error) {
      console.error('[calculateBinderStats] Error:', error);
      // Return empty stats on error
      return {
        totalQuantity: 0,
        quantityForTrade: 0,
        quantityNotForTrade: 0,
        totalValue: { tcg_market: 0, tcg_low: 0, tcg_mid: 0, tcg_high: 0 },
        valueForTrade: { tcg_market: 0, tcg_low: 0, tcg_mid: 0, tcg_high: 0 },
        valueNotForTrade: { tcg_market: 0, tcg_low: 0, tcg_mid: 0, tcg_high: 0 },
        rarityCounts: {},
        rarityCountsForTrade: {},
        rarityCountsNotForTrade: {},
        showcaseCards: [],
      };
    }
  }

  /**
   * Get binder stats system info
   */
  async getBinderStatsSystemInfo(): AsyncResult<BinderStatsInfo | null> {
    // PostgreSQL calculates stats on-demand, no system_info tracking needed
    return { success: true, data: null };
  }

  /**
   * Get user's binders with calculated stats
   *
   * Retrieves all binders for a user and calculates real-time statistics
   * for each binder using SQL aggregates.
   */
  async getUserBindersWithStats(userId: string): AsyncResult<BinderWithStatsDTO[]> {
    try {
      const results = await db.query.binders.findMany({
        where: and(eq(binders.userId, userId), eq(binders.archived, false)),
        orderBy: desc(binders.createdAt),
      });

      // Calculate stats for each binder
      const withStats: BinderWithStatsDTO[] = await Promise.all(
        results.map(async (b) => {
          const stats = await this.calculateBinderStats(b.id);

          return {
            _id: b.id,
            userId: b.userId,
            name: b.name,
            description: b.description || null,
            slug: b.slug || null,
            isPublic: b.isPublic,
            visibility: {
              level: b.visibilityLevel || 'public',
              allowInSearch: b.allowInSearch,
              allowInMatching: b.allowInMatching,
              allowDiscordCommands: b.allowDiscordCommands,
              allowApiExport: b.allowApiExport,
              allowWhoHas: b.allowWhoHas,
              allowWebhooks: b.allowWebhooks,
            },
            updatedAt: b.updatedAt,
            showcaseCards: stats.showcaseCards,
            stats,
          };
        })
      );

      return { success: true, data: withStats };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get binders with stats',
      };
    }
  }

  /**
   * Search for cards by name across all user's binders
   */
  async searchUserCards(userId: string, searchQuery: string, limit = 50): AsyncResult<CardSearchResultDTO[]> {
    try {
      const rows = await db
        .select({
          cardUniqueId: cards.cardUniqueId,
          cardName: cards.name,
          imageUrl: printings.imageUrl,
          binderId: binders.id,
          binderName: binders.name,
          binderSlug: binders.slug,
          quantity: inventoryItems.quantity,
          forTrade: inventoryItems.forTrade,
        })
        .from(inventoryItems)
        .innerJoin(printings, eq(inventoryItems.printingId, printings.printingId))
        .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .innerJoin(binders, eq(inventoryItems.binderId, binders.id))
        .where(
          and(
            eq(inventoryItems.userId, userId),
            ilike(cards.name, `%${searchQuery}%`)
          )
        );

      // Group rows by card, collecting all binder locations
      const cardMap = new Map<string, CardSearchResultDTO>();

      for (const row of rows) {
        if (!cardMap.has(row.cardUniqueId)) {
          if (cardMap.size >= limit) continue;
          cardMap.set(row.cardUniqueId, {
            _id: row.cardUniqueId,
            name: row.cardName,
            imageUrl: row.imageUrl ?? undefined,
            locations: [],
          });
        }

        const card = cardMap.get(row.cardUniqueId)!;
        const existing = card.locations.find(l => l.binderId === row.binderId);
        if (existing) {
          existing.quantity += row.quantity;
        } else {
          card.locations.push({
            binderId: row.binderId,
            binderName: row.binderName,
            binderSlug: row.binderSlug ?? undefined,
            quantity: row.quantity,
            forTrade: row.forTrade,
          });
        }
      }

      return { success: true, data: Array.from(cardMap.values()) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search cards',
      };
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private mapToBinderDTO(binder: any): BinderDTO {
    return {
      _id: binder.id,
      userId: binder.userId,
      name: binder.name,
      description: binder.description || undefined,
      isPublic: binder.isPublic,
      visibility: {
        level: binder.visibilityLevel || 'public',
        allowInSearch: binder.allowInSearch ?? true,
        allowInMatching: binder.allowInMatching ?? true,
        allowDiscordCommands: binder.allowDiscordCommands ?? true,
        allowApiExport: binder.allowApiExport ?? true,
        allowWhoHas: binder.allowWhoHas ?? true,
        allowWebhooks: binder.allowWebhooks ?? false,
      },
      slug: binder.slug || undefined,
      createdAt: binder.createdAt,
      updatedAt: binder.updatedAt,
      statsNeedUpdate: binder.statsNeedUpdate || false,
      statsUpdatedAt: binder.statsUpdatedAt || undefined,
    };
  }

  private buildInventoryCardSelectFields() {
    return {
      // Inventory item fields
      id: inventoryItems.id,
      userId: inventoryItems.userId,
      binderId: inventoryItems.binderId,
      printingId: inventoryItems.printingId,
      quantity: inventoryItems.quantity,
      condition: inventoryItems.condition,
      language: inventoryItems.language,
      notes: inventoryItems.notes,
      forTrade: inventoryItems.forTrade,
      forSale: inventoryItems.forSale,
      acquisitionPrice: inventoryItems.acquisitionPrice,
      acquisitionDate: inventoryItems.acquisitionDate,
      addedAt: inventoryItems.addedAt,
      updatedAt: inventoryItems.updatedAt,
      // User fields
      discordUsername: users.discordUsername,
      discordId: users.discordId,
      userCountry: users.countryCode,
      // Binder fields
      binderName: binders.name,
      binderSlug: binders.slug,
      binderIsPublic: binders.isPublic,
      // Printing fields
      set: printings.set,
      edition: printings.edition,
      foiling: printings.foiling,
      rarity: printings.rarity,
      collectorNumber: printings.collectorNumber,
      isExtendedArt: printings.isExtendedArt,
      artVariations: printings.artVariations,
      foilInsetTop: printings.foilInsetTop,
      foilInsetRight: printings.foilInsetRight,
      foilInsetBottom: printings.foilInsetBottom,
      foilInsetLeft: printings.foilInsetLeft,
      foilInsetRound: printings.foilInsetRound,
      imageUrl: printings.imageUrl,
      tcgMarket: printings.tcgMarket,
      tcgLow: printings.tcgLow,
      tcgMid: printings.tcgMid,
      tcgHigh: printings.tcgHigh,
      hasPrice: printings.hasPrice,
      priceUpdatedAt: printings.priceUpdatedAt,
      tcgplayerUrl: printings.tcgplayerUrl,
      // Card fields
      cardUniqueId: cards.cardUniqueId,
      name: cards.name,
      displayName: cards.displayName,
      color: cards.color,
      typeText: cards.typeText,
      typeTextDisplay: cards.typeTextDisplay,
    };
  }

  private mapToInventoryCardDTO(row: any): InventoryCardDTO {
    return {
      _id: row.id,
      userId: row.userId,
      binderId: row.binderId,
      printingId: row.printingId,
      quantity: row.quantity,
      condition: row.condition,
      language: row.language,
      notes: row.notes || '',
      forTrade: row.forTrade,
      forSale: row.forSale,
      acquisitionPrice: row.acquisitionPrice ?? undefined,
      acquisitionDate: row.acquisitionDate ?? undefined,
      addedAt: row.addedAt,
      updatedAt: row.updatedAt,
      // User fields
      discordUsername: row.discordUsername || '',
      discordId: row.discordId || '',
      userCountry: row.userCountry || undefined,
      // Binder fields
      binderName: row.binderName,
      binderSlug: row.binderSlug || undefined,
      binderIsPublic: row.binderIsPublic,
      // Printing fields
      card_unique_id: row.cardUniqueId,
      name: row.name,
      display_name: row.displayName,
      color: row.color || undefined,
      collector_number: row.collectorNumber || '',
      set: row.set,
      edition: row.edition,
      foiling: row.foiling,
      rarity: row.rarity,
      is_extended_art: row.isExtendedArt || false,
      art_variations: row.artVariations || [],
      foil_inset_top: row.foilInsetTop ?? null,
      foil_inset_right: row.foilInsetRight ?? null,
      foil_inset_bottom: row.foilInsetBottom ?? null,
      foil_inset_left: row.foilInsetLeft ?? null,
      foil_inset_round: row.foilInsetRound ?? null,
      type_text: row.typeText || '',
      type_text_display: row.typeTextDisplay || '',
      image_url: row.imageUrl || '',
      tcg_market: row.tcgMarket ?? undefined,
      tcg_low: row.tcgLow ?? undefined,
      tcg_mid: row.tcgMid ?? undefined,
      tcg_high: row.tcgHigh ?? undefined,
      has_price: row.hasPrice || false,
      price_updated_at: row.priceUpdatedAt || undefined,
      tcgplayer_url: row.tcgplayerUrl || undefined,
    };
  }

  private buildCardOrderBy(sortBy?: string): any[] {
    switch (sortBy) {
      case 'quantity-desc':
        return [desc(inventoryItems.quantity), asc(cards.displayName)];
      case 'quantity-asc':
        return [asc(inventoryItems.quantity), asc(cards.displayName)];
      case 'tcg-market-desc':
        return [desc(printings.tcgMarket), asc(cards.displayName)];
      case 'tcg-market-asc':
        return [asc(printings.tcgMarket), asc(cards.displayName)];
      case 'tcg-low-desc':
        return [desc(printings.tcgLow), asc(cards.displayName)];
      case 'tcg-low-asc':
        return [asc(printings.tcgLow), asc(cards.displayName)];
      case 'name':
      default:
        return [asc(cards.displayName)];
    }
  }

  private async getBinderCardMetadata(binderId: string): Promise<BinderCardsResult['metadata']> {
    try {
      // Get unique values
      const [rarities, foilings, sets, conditions] = await Promise.all([
        db.selectDistinct({ value: printings.rarity })
          .from(inventoryItems)
          .innerJoin(printings, eq(inventoryItems.printingId, printings.printingId))
          .where(eq(inventoryItems.binderId, binderId)),
        db.selectDistinct({ value: printings.foiling })
          .from(inventoryItems)
          .innerJoin(printings, eq(inventoryItems.printingId, printings.printingId))
          .where(eq(inventoryItems.binderId, binderId)),
        db.selectDistinct({ value: printings.set })
          .from(inventoryItems)
          .innerJoin(printings, eq(inventoryItems.printingId, printings.printingId))
          .where(eq(inventoryItems.binderId, binderId)),
        db.selectDistinct({ value: inventoryItems.condition })
          .from(inventoryItems)
          .where(eq(inventoryItems.binderId, binderId)),
      ]);

      // Get counts, quantity stats, and price totals in parallel
      const [forTradeCount, notForTradeCount, quantityAndPriceStats, priceRow, rarityRows] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` })
          .from(inventoryItems)
          .where(and(eq(inventoryItems.binderId, binderId), eq(inventoryItems.forTrade, true))),
        db.select({ count: sql<number>`count(*)::int` })
          .from(inventoryItems)
          .where(and(eq(inventoryItems.binderId, binderId), eq(inventoryItems.forTrade, false))),
        db.select({
          totalCards: sql<number>`COALESCE(SUM(${inventoryItems.quantity}), 0)::int`,
          forTradeCards: sql<number>`COALESCE(SUM(CASE WHEN ${inventoryItems.forTrade} THEN ${inventoryItems.quantity} ELSE 0 END), 0)::int`,
          totalValueLow: sql<number>`COALESCE(SUM(${inventoryItems.quantity} * ${printings.tcgLow}), 0)::real`,
          totalValueMarket: sql<number>`COALESCE(SUM(${inventoryItems.quantity} * ${printings.tcgMarket}), 0)::real`,
          totalValueMid: sql<number>`COALESCE(SUM(${inventoryItems.quantity} * ${printings.tcgMid}), 0)::real`,
          totalValueHigh: sql<number>`COALESCE(SUM(${inventoryItems.quantity} * ${printings.tcgHigh}), 0)::real`,
          forTradeValueLow: sql<number>`COALESCE(SUM(CASE WHEN ${inventoryItems.forTrade} THEN ${inventoryItems.quantity} * ${printings.tcgLow} ELSE 0 END), 0)::real`,
          notForTradeValueLow: sql<number>`COALESCE(SUM(CASE WHEN NOT ${inventoryItems.forTrade} THEN ${inventoryItems.quantity} * ${printings.tcgLow} ELSE 0 END), 0)::real`,
        })
          .from(inventoryItems)
          .leftJoin(printings, eq(inventoryItems.printingId, printings.printingId))
          .where(eq(inventoryItems.binderId, binderId)),
        db.select({ priceUpdatedAt: sql<Date>`MAX(${printings.priceUpdatedAt})` })
          .from(inventoryItems)
          .innerJoin(printings, eq(inventoryItems.printingId, printings.printingId))
          .where(eq(inventoryItems.binderId, binderId)),
        db.select({
          rarity: printings.rarity,
          count: sql<number>`COALESCE(SUM(${inventoryItems.quantity}), 0)::int`,
        })
          .from(inventoryItems)
          .innerJoin(printings, eq(inventoryItems.printingId, printings.printingId))
          .where(eq(inventoryItems.binderId, binderId))
          .groupBy(printings.rarity),
      ]);

      const row = quantityAndPriceStats[0];
      const rarityCounts: Record<string, number> = {};
      for (const r of rarityRows) {
        if (r.rarity) rarityCounts[r.rarity] = r.count;
      }

      return {
        uniqueValues: {
          rarities: rarities.map((r) => r.value),
          foilings: foilings.map((f) => f.value),
          sets: sets.map((s) => s.value),
          conditions: conditions.map((c) => c.value),
        },
        counts: {
          forTrade: forTradeCount[0]?.count || 0,
          notForTrade: notForTradeCount[0]?.count || 0,
        },
        stats: {
          totalCards: row?.totalCards || 0,
          forTradeCount: row?.forTradeCards || 0,
          totalValue: {
            tcg_low: row?.totalValueLow || 0,
            tcg_market: row?.totalValueMarket || 0,
            tcg_mid: row?.totalValueMid || 0,
            tcg_high: row?.totalValueHigh || 0,
          },
          valueForTrade: { tcg_low: row?.forTradeValueLow || 0 },
          valueNotForTrade: { tcg_low: row?.notForTradeValueLow || 0 },
          rarityCounts,
        },
        priceUpdatedAt: priceRow[0]?.priceUpdatedAt || null,
      };
    } catch (error) {
      // Return empty metadata on error
      return {
        uniqueValues: {
          rarities: [],
          foilings: [],
          sets: [],
          conditions: [],
        },
        counts: {
          forTrade: 0,
          notForTrade: 0,
        },
        stats: {
          totalCards: 0,
          forTradeCount: 0,
          totalValue: { tcg_low: 0, tcg_market: 0, tcg_mid: 0, tcg_high: 0 },
          valueForTrade: { tcg_low: 0 },
          valueNotForTrade: { tcg_low: 0 },
          rarityCounts: {},
        },
        priceUpdatedAt: null,
      };
    }
  }
}
