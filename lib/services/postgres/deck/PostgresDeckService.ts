/**
 * PostgreSQL implementation of IDeckService
 *
 * Clean, normalized implementation:
 * - NO embedded printingDetails (use JOINs instead)
 * - NO cached counts (calculate on-demand with SQL)
 * - NO redundant pitch field (get from cards table)
 */

import { db } from '@/lib/postgres/db';
import { decks, deckCards, printings, cards, inventoryItems, binders, users, articles } from '@/lib/postgres/schema';
import { eq, and, sql, inArray, desc, asc, or } from 'drizzle-orm';
import { getBannedCardIds } from '@/lib/fab-banned-cards';
import { nanoid } from 'nanoid';
import { sumOwnedByPrintingId, sumForTradeByPrintingId } from '../inventory/ownership-queries';
import type {
  IDeckService,
  DeckDTO,
  DeckSummaryDTO,
  PublicDeckSummaryDTO,
  DeckPrintingDTO,
  DeckCategory,
  CreateDeckDTO,
  UpdateDeckDTO,
  AddPrintingDTO,
  AddPrintingResultDTO,
  UpdatePrintingDTO,
  BatchUpdatePrintingsResultDTO,
  UpdatePrintingResultDTO,
  BulkImportResultDTO,
  DeckListFilters,
  PublicDeckFilters,
  DeckStatsDTO,
  OwnershipStatusDTO,
  InventoryComparisonDTO,
  AllocationDTO,
} from '../../contracts/IDeckService';
import type { AsyncResult, PaginationOptions } from '../../contracts/common';

export class PostgresDeckService implements IDeckService {
  // ====================================
  // Helper Methods
  // ====================================

  /**
   * Convert database row to DeckDTO with card details
   */
  private async toDeckDTO(deckRow: any): Promise<DeckDTO> {
    // Fetch deck cards with card/printing details via JOIN
    const deckCardsWithDetails = await db
      .select({
        // deck_cards fields
        id: deckCards.id,
        printingId: deckCards.printingId,
        quantity: deckCards.quantity,
        category: deckCards.category,
        notes: deckCards.notes,
        addedAt: deckCards.addedAt,
        // card fields (via printings -> cards JOIN)
        cardName: cards.name,
        cardDisplayName: cards.displayName,
        cardUniqueId: cards.cardUniqueId,
        types: cards.types,
        classes: cards.classes,
        talents: cards.talents,
        keywords: cards.keywords,
        keywordsDisplay: cards.keywordsDisplay,
        pitch: cards.pitch,
        cost: cards.cost,
        defense: cards.defense,
        power: cards.power,
        text: cards.text,
        // printing fields
        set: printings.set,
        edition: printings.edition,
        foiling: printings.foiling,
        rarity: printings.rarity,
        collectorNumber: printings.collectorNumber,
        imageUrl: printings.imageUrl,
        tcgMarket: printings.tcgMarket,
        tcgLow: printings.tcgLow,
        tcgMid: printings.tcgMid,
        tcgHigh: printings.tcgHigh,
        tcgplayerUrl: printings.tcgplayerUrl,
        otherFacePrintingId: printings.otherFacePrintingId,
        isFrontFace: printings.isFrontFace,
      })
      .from(deckCards)
      .leftJoin(printings, eq(deckCards.printingId, printings.printingId))
      .leftJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
      .where(eq(deckCards.deckId, deckRow.id));


    // Batch-fetch other face image URLs for DFC cards
    const otherFaceIds = [...new Set(
      deckCardsWithDetails.map(dc => dc.otherFacePrintingId).filter(Boolean) as string[]
    )];
    const otherFaceImageMap = new Map<string, string>();
    if (otherFaceIds.length > 0) {
      const otherFaceRows = await db
        .select({ printingId: printings.printingId, imageUrl: printings.imageUrl })
        .from(printings)
        .where(inArray(printings.printingId, otherFaceIds));
      for (const row of otherFaceRows) {
        if (row.imageUrl) otherFaceImageMap.set(row.printingId, row.imageUrl);
      }
    }

    return this.buildDeckDTO(deckRow, deckCardsWithDetails, otherFaceImageMap);
  }

  /**
   * Build a DeckDTO from pre-fetched card data (used by batched list operations)
   */
  private buildDeckDTO(
    deckRow: any,
    deckCardsWithDetails: any[],
    otherFaceImageMap: Map<string, string>
  ): DeckDTO {
    // Group cards by category
    const categorizeCards = (category: DeckCategory): DeckPrintingDTO[] => {
      const categoryCards = deckCardsWithDetails
        .filter((dc) => dc.category === category)
        .map((dc) => {
          const dto = {
            printingId: dc.printingId,
            quantity: dc.quantity,  // ✅ CRITICAL: Include quantity from database
            notes: dc.notes || undefined,
            addedAt: dc.addedAt || undefined,
            printingDetails: {
              name: dc.cardName || undefined,
              display_name: dc.cardDisplayName || undefined,
              card_unique_id: dc.cardUniqueId || undefined,
              set: dc.set || undefined,
              edition: dc.edition || undefined,
              foiling: dc.foiling || undefined,
              rarity: dc.rarity || undefined,
              collector_number: dc.collectorNumber || undefined,
              image_url: dc.imageUrl || undefined,
              tcg_market: dc.tcgMarket || undefined,
              tcg_low: dc.tcgLow || undefined,
              tcg_mid: dc.tcgMid || undefined,
              tcg_high: dc.tcgHigh || undefined,
              tcgplayer_url: dc.tcgplayerUrl || undefined,
              other_face_printing_id: dc.otherFacePrintingId ?? null,
              is_front_face: dc.isFrontFace ?? true,
              other_face_image_url: dc.otherFacePrintingId
                ? (otherFaceImageMap.get(dc.otherFacePrintingId) ?? null)
                : null,
              types: dc.types || undefined,
              classes: dc.classes || undefined,
              talents: dc.talents || undefined,
              keywords: dc.keywords || undefined,
              keywords_display: dc.keywordsDisplay || undefined,
              pitch: dc.pitch || undefined,  // ✅ Also include pitch for color grouping
              cost: dc.cost ?? undefined,
              defense: dc.defense ?? undefined,
              power: dc.power ?? undefined,
              text: dc.text || undefined,
            },
          };

          return dto;
        });

      return categoryCards;
    };

    // Calculate counts and value (instead of storing them)
    const allCards = deckCardsWithDetails;
    const totalCards = allCards
      .filter(dc => dc.category !== 'hero' && dc.category !== 'benched')
      .reduce((sum, dc) => sum + (dc.quantity || 0), 0);
    const estimatedValue = allCards.reduce((sum, dc) => sum + (dc.tcgMarket || 0) * (dc.quantity || 0), 0);

    return {
      _id: deckRow.id,
      publicId: deckRow.publicId,
      userId: deckRow.userId,
      name: deckRow.name,
      slug: deckRow.slug || undefined,
      description: deckRow.description || undefined,
      format: deckRow.format,
      heroName: deckRow.heroName || undefined,
      visibility: deckRow.visibility || 'unlisted',
      isPublic: deckRow.visibility !== 'private',
      metafyGuideId: deckRow.metafyGuideId || undefined,
      availableOnTalishar: deckRow.availableOnTalishar ?? false,
      featured: deckRow.featured ?? false,
      isSystemDeck: deckRow.isSystemDeck ?? false,

      // Category arrays (JOINed data, not embedded)
      hero: categorizeCards('hero'),
      equipment: categorizeCards('equipment'),
      maindeck: categorizeCards('maindeck'),
      inventory: categorizeCards('inventory'),
      benched: categorizeCards('benched'),
      tokens: categorizeCards('tokens' as DeckCategory),

      // Calculated stats (not cached)
      totalCards,
      estimatedValue,
      heroCount: categorizeCards('hero').reduce((s, c) => s + (c.quantity ?? 1), 0),
      equipmentCount: categorizeCards('equipment').reduce((s, c) => s + (c.quantity ?? 1), 0),
      maindeckCount: categorizeCards('maindeck').reduce((s, c) => s + (c.quantity ?? 1), 0),
      inventoryCount: categorizeCards('inventory').reduce((s, c) => s + (c.quantity ?? 1), 0),
      benchedCount: categorizeCards('benched').reduce((s, c) => s + (c.quantity ?? 1), 0),
      tokensCount: categorizeCards('tokens' as DeckCategory).reduce((s, c) => s + (c.quantity ?? 1), 0),
      cardPoolCount: totalCards,

      createdAt: deckRow.createdAt,
      updatedAt: deckRow.updatedAt,
      tags: deckRow.tags || undefined,
      metadata: deckRow.metadata || undefined,
      coOwners: deckRow.coOwners || [],
      eventName: deckRow.eventName ?? null,
      eventDate: deckRow.eventDate ?? null,
      placing: deckRow.placing ?? null,
    };
  }

  /**
   * Convert database row to DeckSummaryDTO (lightweight)
   */
  private toSummaryDTO(deckRow: any, requestingUserId?: string): DeckSummaryDTO {
    return {
      _id: deckRow.id,
      publicId: deckRow.publicId,
      userId: deckRow.userId,
      name: deckRow.name,
      slug: deckRow.slug || undefined,
      format: deckRow.format,
      heroName: deckRow.heroName || undefined,
      visibility: deckRow.visibility || 'unlisted',
      isPublic: deckRow.visibility !== 'private',
      availableOnTalishar: deckRow.availableOnTalishar ?? false,
      featured: deckRow.featured ?? false,
      isSystemDeck: deckRow.isSystemDeck ?? false,
      totalCards: deckRow.totalCards || 0,
      estimatedValue: deckRow.estimatedValue || 0,
      updatedAt: deckRow.updatedAt,
      isCoOwned: requestingUserId
        ? deckRow.userId !== requestingUserId && (deckRow.coOwners || []).includes(requestingUserId)
        : false,
    };
  }

  /**
   * Generate unique slug for a deck
   */
  async generateUniqueSlug(
    userId: string,
    baseName: string
  ): AsyncResult<string> {
    try {
      // Create base slug from name
      let baseSlug = baseName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50)
        .replace(/^-+|-+$/g, '');

      if (!baseSlug) {
        baseSlug = 'deck';
      }

      let slug = baseSlug;
      let counter = 1;

      // Check for uniqueness
      while (true) {
        const existing = await db
          .select({ id: decks.id })
          .from(decks)
          .where(and(eq(decks.userId, userId), eq(decks.slug, slug)))
          .limit(1);

        if (existing.length === 0) {
          break;
        }

        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      return { success: true, data: slug };
    } catch (error) {
      console.error('[PostgresDeckService.generateUniqueSlug] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate slug',
      };
    }
  }

  // ====================================
  // Lookup Methods
  // ====================================

  async findBySlugOrId(
    identifier: string,
    userId: string
  ): AsyncResult<DeckDTO | null> {
    try {
      // Try finding by slug first
      let deckRow = await db
        .select()
        .from(decks)
        .where(and(eq(decks.userId, userId), eq(decks.slug, identifier)))
        .limit(1);

      // If not found by slug, try by id (backwards compat)
      if (deckRow.length === 0) {
        deckRow = await db
          .select()
          .from(decks)
          .where(and(eq(decks.userId, userId), eq(decks.id, identifier)))
          .limit(1);
      }

      if (deckRow.length === 0) {
        return { success: true, data: null };
      }

      const deckDTO = await this.toDeckDTO(deckRow[0]);
      return { success: true, data: deckDTO };
    } catch (error) {
      console.error('[PostgresDeckService.findBySlugOrId] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find deck',
      };
    }
  }

  async findBySlug(
    slug: string,
    userId: string
  ): AsyncResult<DeckDTO | null> {
    try {
      const deckRow = await db
        .select()
        .from(decks)
        .where(and(eq(decks.userId, userId), eq(decks.slug, slug)))
        .limit(1);

      if (deckRow.length === 0) {
        return { success: true, data: null };
      }

      const deckDTO = await this.toDeckDTO(deckRow[0]);
      return { success: true, data: deckDTO };
    } catch (error) {
      console.error('[PostgresDeckService.findBySlug] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find deck by slug',
      };
    }
  }

  async findById(
    deckId: string,
    userId?: string
  ): AsyncResult<DeckDTO | null> {
    try {
      const conditions = userId
        ? and(eq(decks.id, deckId), or(eq(decks.userId, userId), sql`${userId} = ANY(${decks.coOwners})`))
        : eq(decks.id, deckId);

      const deckRow = await db
        .select()
        .from(decks)
        .where(conditions)
        .limit(1);

      if (deckRow.length === 0) {
        return { success: true, data: null };
      }

      const deckDTO = await this.toDeckDTO(deckRow[0]);
      return { success: true, data: deckDTO };
    } catch (error) {
      console.error('[PostgresDeckService.findById] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find deck by ID',
      };
    }
  }

  async findByPublicId(
    publicId: string,
    userId?: string
  ): AsyncResult<DeckDTO | null> {
    try {
      const conditions = userId
        ? and(eq(decks.publicId, publicId), or(eq(decks.userId, userId), sql`${userId} = ANY(${decks.coOwners})`))
        : eq(decks.publicId, publicId);

      const deckRow = await db
        .select()
        .from(decks)
        .where(conditions)
        .limit(1);

      if (deckRow.length === 0) {
        return { success: true, data: null };
      }

      const deckDTO = await this.toDeckDTO(deckRow[0]);
      return { success: true, data: deckDTO };
    } catch (error) {
      console.error('[PostgresDeckService.findByPublicId] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find deck by publicId',
      };
    }
  }

  // ====================================
  // CRUD Operations
  // ====================================

  async createDeck(
    userId: string,
    data: CreateDeckDTO
  ): AsyncResult<DeckDTO> {
    try {
      // Generate unique slug
      const slugResult = await this.generateUniqueSlug(userId, data.name);
      if (!slugResult.success) {
        return { success: false, error: slugResult.error };
      }
      const deckSlug = data.slug || slugResult.data;

      // Create deck
      const deckId = nanoid(21);
      const publicId = nanoid(21);

      const newDeck = await db
        .insert(decks)
        .values({
          id: deckId,
          publicId,
          userId,
          name: data.name.trim(),
          slug: deckSlug,
          description: data.description?.trim() || '',
          format: data.format,
          heroName: data.heroName?.trim(),
          visibility: data.visibility || (data.isPublic ? 'public' : 'unlisted'),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Add hero printing if provided
      if (data.heroPrintingId) {
        const printing = await db
          .select()
          .from(printings)
          .leftJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
          .where(eq(printings.printingId, data.heroPrintingId))
          .limit(1);

        if (printing.length === 0) {
          return { success: false, error: 'Hero printing not found' };
        }

        if (!printing[0].cards?.types?.includes('hero')) {
          return { success: false, error: 'Selected printing is not a hero card' };
        }

        await db.insert(deckCards).values({
          id: nanoid(21),
          deckId,
          printingId: data.heroPrintingId,
          quantity: 1,
          category: 'hero',
          addedAt: new Date(),
        });

        // Backfill hero_name from the card if not provided at creation time
        if (!data.heroName && printing[0].cards?.name) {
          await db
            .update(decks)
            .set({ heroName: printing[0].cards.name })
            .where(eq(decks.id, deckId));
        }
      }

      // Handle copying from existing deck
      if (data.copyFromDeckId) {
        const sourceDeck = await db
          .select()
          .from(decks)
          .where(
            or(
              and(eq(decks.publicId, data.copyFromDeckId), eq(decks.userId, userId)),
              and(eq(decks.publicId, data.copyFromDeckId), sql`${decks.visibility} != 'private'`)
            )
          )
          .limit(1);

        if (sourceDeck.length === 0) {
          return { success: false, error: 'Source deck not found or not accessible' };
        }

        // Copy deck cards
        const sourceCards = await db
          .select()
          .from(deckCards)
          .where(eq(deckCards.deckId, sourceDeck[0].id));

        for (const card of sourceCards) {
          await db.insert(deckCards).values({
            id: nanoid(21),
            deckId,
            printingId: card.printingId,
            quantity: card.quantity,
            category: card.category,
            notes: card.notes,
            addedAt: new Date(),
          });
        }

        // Copy metadata (matchups live here; sideboard references are Talishar
        // card-ids that resolve against the copied card list, not printing ids,
        // so they remain valid on the new deck).
        if (sourceDeck[0].metadata) {
          await db
            .update(decks)
            .set({ metadata: sourceDeck[0].metadata, updatedAt: new Date() })
            .where(eq(decks.id, deckId));
          newDeck[0].metadata = sourceDeck[0].metadata;
        }
      }

      const deckDTO = await this.toDeckDTO(newDeck[0]);
      return { success: true, data: deckDTO };
    } catch (error) {
      console.error('[PostgresDeckService.createDeck] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create deck',
      };
    }
  }

  async createDeckWithCards(
    userId: string,
    data: CreateDeckDTO,
    printings: AddPrintingDTO[]
  ): AsyncResult<DeckDTO> {
    try {
      // First create the deck
      const createResult = await this.createDeck(userId, data);
      if (!createResult.success) {
        return createResult;
      }

      // Then add the printings
      if (printings.length > 0) {
        const bulkResult = await this.addPrintings(
          createResult.data.publicId,
          userId,
          printings
        );
        if (!bulkResult.success) {
          return { success: false, error: bulkResult.error };
        }
        return { success: true, data: bulkResult.data.deck };
      }

      return createResult;
    } catch (error) {
      console.error('[PostgresDeckService.createDeckWithCards] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create deck with cards',
      };
    }
  }

  async updateDeck(
    publicId: string,
    userId: string,
    updates: UpdateDeckDTO
  ): AsyncResult<DeckDTO> {
    try {
      // If slug is being changed, validate uniqueness
      if (updates.slug) {
        const existingDeck = await db
          .select({ id: decks.id })
          .from(decks)
          .where(
            and(
              eq(decks.userId, userId),
              eq(decks.slug, updates.slug),
              sql`${decks.publicId} != ${publicId}`
            )
          )
          .limit(1);

        if (existingDeck.length > 0) {
          return { success: false, error: 'A deck with this slug already exists' };
        }
      }

      const updateFields: any = { updatedAt: new Date() };
      if (updates.name !== undefined) updateFields.name = updates.name.trim();
      if (updates.description !== undefined) updateFields.description = updates.description.trim();
      if (updates.format !== undefined) updateFields.format = updates.format;
      if (updates.heroName !== undefined) updateFields.heroName = updates.heroName?.trim();
      if (updates.visibility !== undefined) updateFields.visibility = updates.visibility;
      else if (updates.isPublic !== undefined) updateFields.visibility = updates.isPublic ? 'public' : 'unlisted';
      if (updates.slug !== undefined) updateFields.slug = updates.slug;
      if (updates.metadata !== undefined) updateFields.metadata = updates.metadata;
      if (updates.metafyGuideId !== undefined) updateFields.metafyGuideId = updates.metafyGuideId;
      if (updates.availableOnTalishar !== undefined) updateFields.availableOnTalishar = Boolean(updates.availableOnTalishar);
      if (updates.eventName !== undefined) updateFields.eventName = updates.eventName;
      if (updates.eventDate !== undefined) updateFields.eventDate = updates.eventDate;
      if (updates.placing !== undefined) updateFields.placing = updates.placing;

      // Backfill hero_name from the hero printing when enabling Talishar and hero_name is null
      if (updates.availableOnTalishar === true && updates.heroName === undefined) {
        const [currentDeck] = await db
          .select({ id: decks.id, heroName: decks.heroName })
          .from(decks)
          .where(eq(decks.publicId, publicId))
          .limit(1);

        if (currentDeck && !currentDeck.heroName) {
          const [heroCard] = await db
            .select({ cardName: cards.name })
            .from(deckCards)
            .leftJoin(printings, eq(deckCards.printingId, printings.printingId))
            .leftJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
            .where(and(eq(deckCards.deckId, currentDeck.id), eq(deckCards.category, 'hero')))
            .limit(1);

          if (heroCard?.cardName) {
            updateFields.heroName = heroCard.cardName;
          }
        }
      }

      const updatedDeck = await db
        .update(decks)
        .set(updateFields)
        .where(and(eq(decks.publicId, publicId), or(eq(decks.userId, userId), sql`${userId} = ANY(${decks.coOwners})`)))
        .returning();

      if (updatedDeck.length === 0) {
        return { success: false, error: 'Deck not found or access denied' };
      }

      const deckDTO = await this.toDeckDTO(updatedDeck[0]);
      return { success: true, data: deckDTO };
    } catch (error) {
      console.error('[PostgresDeckService.updateDeck] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update deck',
      };
    }
  }

  async deleteDeck(
    publicId: string,
    userId: string
  ): AsyncResult<boolean> {
    try {
      const result = await db
        .delete(decks)
        .where(and(eq(decks.publicId, publicId), eq(decks.userId, userId)))
        .returning({ id: decks.id });

      if (result.length === 0) {
        return { success: false, error: 'Deck not found or access denied' };
      }

      return { success: true, data: true };
    } catch (error) {
      console.error('[PostgresDeckService.deleteDeck] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete deck',
      };
    }
  }

  // ====================================
  // List Operations
  // ====================================

  async listUserDecks(
    userId: string,
    filters?: DeckListFilters,
    pagination?: PaginationOptions
  ): AsyncResult<{ decks: DeckDTO[]; total: number }> {
    try {
      let conditions = [
        or(eq(decks.userId, userId), sql`${userId} = ANY(${decks.coOwners})`),
        ...(filters?.includeSystemDecks ? [] : [eq(decks.isSystemDeck, false)]),
      ];

      if (filters?.format) conditions.push(eq(decks.format, filters.format));
      if (filters?.visibility) conditions.push(eq(decks.visibility, filters.visibility));
      else if (filters?.isPublic !== undefined) conditions.push(eq(decks.visibility, filters.isPublic ? 'public' : 'private'));
      if (filters?.heroName) conditions.push(sql`lower(${decks.heroName}) = lower(${filters.heroName})`);
      if (filters?.search) {
        conditions.push(sql`${decks.name} ILIKE ${`%${filters.search}%`}`);
      }
      if (filters?.availableOnTalishar !== undefined) conditions.push(eq(decks.availableOnTalishar, filters.availableOnTalishar));

      const whereClause = and(...conditions);

      // Get total count
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(decks)
        .where(whereClause);

      // Get decks
      let query = db.select().from(decks).where(whereClause);

      if (pagination?.sort) {
        // Apply sorting based on pagination.sort object
        // For simplicity, default to updatedAt desc
        query = query.orderBy(desc(decks.updatedAt));
      } else {
        query = query.orderBy(desc(decks.updatedAt));
      }

      if (pagination?.skip) query = query.offset(pagination.skip);
      if (pagination?.limit) query = query.limit(pagination.limit);

      const deckRows = await query;

      // Batch-fetch all deck cards for all decks in a single query (avoids N+1)
      let deckDTOs: DeckDTO[] = [];
      if (deckRows.length > 0) {
        const deckIds = deckRows.map(r => r.id);
        const allDeckCards = await db
          .select({
            deckId: deckCards.deckId,
            id: deckCards.id,
            printingId: deckCards.printingId,
            quantity: deckCards.quantity,
            category: deckCards.category,
            notes: deckCards.notes,
            addedAt: deckCards.addedAt,
            cardName: cards.name,
            cardDisplayName: cards.displayName,
            cardUniqueId: cards.cardUniqueId,
            types: cards.types,
            classes: cards.classes,
            talents: cards.talents,
            keywords: cards.keywords,
            keywordsDisplay: cards.keywordsDisplay,
            pitch: cards.pitch,
            cost: cards.cost,
            defense: cards.defense,
            power: cards.power,
            text: cards.text,
            set: printings.set,
            edition: printings.edition,
            foiling: printings.foiling,
            rarity: printings.rarity,
            collectorNumber: printings.collectorNumber,
            imageUrl: printings.imageUrl,
            tcgMarket: printings.tcgMarket,
            tcgLow: printings.tcgLow,
            tcgMid: printings.tcgMid,
            tcgHigh: printings.tcgHigh,
            tcgplayerUrl: printings.tcgplayerUrl,
            otherFacePrintingId: printings.otherFacePrintingId,
            isFrontFace: printings.isFrontFace,
          })
          .from(deckCards)
          .leftJoin(printings, eq(deckCards.printingId, printings.printingId))
          .leftJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
          .where(inArray(deckCards.deckId, deckIds));

        // Batch-fetch other face images for DFC cards across all decks
        const otherFaceIds = [...new Set(
          allDeckCards.map(dc => dc.otherFacePrintingId).filter(Boolean) as string[]
        )];
        const otherFaceImageMap = new Map<string, string>();
        if (otherFaceIds.length > 0) {
          const otherFaceRows = await db
            .select({ printingId: printings.printingId, imageUrl: printings.imageUrl })
            .from(printings)
            .where(inArray(printings.printingId, otherFaceIds));
          for (const row of otherFaceRows) {
            if (row.imageUrl) otherFaceImageMap.set(row.printingId, row.imageUrl);
          }
        }

        // Group cards by deckId and build DTOs
        const cardsByDeckId = new Map<string, typeof allDeckCards>();
        for (const card of allDeckCards) {
          if (!cardsByDeckId.has(card.deckId)) cardsByDeckId.set(card.deckId, []);
          cardsByDeckId.get(card.deckId)!.push(card);
        }

        deckDTOs = deckRows.map(row =>
          this.buildDeckDTO(row, cardsByDeckId.get(row.id) ?? [], otherFaceImageMap)
        );
      }

      return {
        success: true,
        data: {
          decks: deckDTOs,
          total: count,
        },
      };
    } catch (error) {
      console.error('[PostgresDeckService.listUserDecks] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list decks',
      };
    }
  }

  async listUserDecksBasic(
    userId: string,
    filters?: { includeSystemDecks?: boolean }
  ): AsyncResult<DeckSummaryDTO[]> {
    try {
      const whereClause = and(
        or(eq(decks.userId, userId), sql`${userId} = ANY(${decks.coOwners})`),
        ...(filters?.includeSystemDecks ? [] : [eq(decks.isSystemDeck, false)])
      );

      const deckRows = await db
        .select()
        .from(decks)
        .where(whereClause)
        .orderBy(desc(decks.updatedAt));

      if (deckRows.length === 0) {
        return { success: true, data: [] };
      }

      const deckIds = deckRows.map(r => r.id);

      // Single aggregation query for all decks: per-category counts, value, unique card count
      const aggregates = await db
        .select({
          deckId: deckCards.deckId,
          totalCards: sql<number>`COALESCE(SUM(CASE WHEN ${deckCards.category} NOT IN ('hero','benched') THEN ${deckCards.quantity} ELSE 0 END), 0)::int`,
          estimatedValue: sql<number>`COALESCE(SUM(${deckCards.quantity} * COALESCE(${printings.tcgMarket}, 0)), 0)::real`,
          heroCount: sql<number>`COALESCE(SUM(CASE WHEN ${deckCards.category} = 'hero' THEN ${deckCards.quantity} ELSE 0 END), 0)::int`,
          equipmentCount: sql<number>`COALESCE(SUM(CASE WHEN ${deckCards.category} = 'equipment' THEN ${deckCards.quantity} ELSE 0 END), 0)::int`,
          maindeckCount: sql<number>`COALESCE(SUM(CASE WHEN ${deckCards.category} = 'maindeck' THEN ${deckCards.quantity} ELSE 0 END), 0)::int`,
          inventoryCount: sql<number>`COALESCE(SUM(CASE WHEN ${deckCards.category} = 'inventory' THEN ${deckCards.quantity} ELSE 0 END), 0)::int`,
          benchedCount: sql<number>`COALESCE(SUM(CASE WHEN ${deckCards.category} = 'benched' THEN ${deckCards.quantity} ELSE 0 END), 0)::int`,
          uniqueCardCount: sql<number>`COUNT(DISTINCT CASE WHEN ${deckCards.category} NOT IN ('hero','benched') THEN ${printings.cardUniqueId} END)::int`,
        })
        .from(deckCards)
        .leftJoin(printings, eq(deckCards.printingId, printings.printingId))
        .where(inArray(deckCards.deckId, deckIds))
        .groupBy(deckCards.deckId);

      const aggByDeckId = new Map(aggregates.map(a => [a.deckId, a]));

      // Single query for hero card images across all decks
      const heroCards = await db
        .select({
          deckId: deckCards.deckId,
          imageUrl: printings.imageUrl,
          displayName: cards.displayName,
          cardName: cards.name,
        })
        .from(deckCards)
        .leftJoin(printings, eq(deckCards.printingId, printings.printingId))
        .leftJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .where(and(
          inArray(deckCards.deckId, deckIds),
          eq(deckCards.category, 'hero')
        ));

      // Take first hero per deck
      const heroByDeckId = new Map<string, { imageUrl: string | null; displayName: string | null; cardName: string | null }>();
      for (const h of heroCards) {
        if (!heroByDeckId.has(h.deckId)) heroByDeckId.set(h.deckId, h);
      }

      const summaries: DeckSummaryDTO[] = deckRows.map(row => {
        const agg = aggByDeckId.get(row.id);
        const hero = heroByDeckId.get(row.id);
        return {
          ...this.toSummaryDTO(row, userId),
          description: row.description || undefined,
          metafyGuideId: row.metafyGuideId ?? null,
          coOwners: row.coOwners || [],
          createdAt: row.createdAt,
          totalCards: agg?.totalCards ?? 0,
          estimatedValue: agg?.estimatedValue ?? 0,
          heroCount: agg?.heroCount ?? 0,
          equipmentCount: agg?.equipmentCount ?? 0,
          maindeckCount: agg?.maindeckCount ?? 0,
          inventoryCount: agg?.inventoryCount ?? 0,
          benchedCount: agg?.benchedCount ?? 0,
          uniqueCardCount: agg?.uniqueCardCount ?? 0,
          heroImageUrl: hero?.imageUrl ?? undefined,
          heroDisplayName: hero?.displayName ?? hero?.cardName ?? undefined,
        };
      });

      return { success: true, data: summaries };
    } catch (error) {
      console.error('[PostgresDeckService.listUserDecksBasic] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list decks',
      };
    }
  }

  async countUserDecks(
    userId: string,
    filters?: DeckListFilters
  ): AsyncResult<number> {
    try {
      let conditions = [eq(decks.userId, userId)];

      if (filters?.format) conditions.push(eq(decks.format, filters.format));
      if (filters?.visibility) conditions.push(eq(decks.visibility, filters.visibility));

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(decks)
        .where(and(...conditions));

      return { success: true, data: count };
    } catch (error) {
      console.error('[PostgresDeckService.countUserDecks] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to count decks',
      };
    }
  }

  async listPublicDecks(
    filters?: PublicDeckFilters,
    pagination?: PaginationOptions
  ): AsyncResult<{ decks: PublicDeckSummaryDTO[]; total: number }> {
    try {
      let conditions: any[] = [eq(decks.visibility, 'public')];

      if (filters?.format) conditions.push(eq(decks.format, filters.format));
      if (filters?.heroName) conditions.push(sql`lower(${decks.heroName}) = lower(${filters.heroName})`);
      if (filters?.search) {
        conditions.push(sql`${decks.name} ILIKE ${`%${filters.search}%`}`);
      }
      if (filters?.username) {
        conditions.push(eq(users.username, filters.username));
      }
      if (filters?.featured !== undefined) {
        conditions.push(eq(decks.featured, filters.featured));
      }
      if (filters?.month !== undefined && filters?.year !== undefined) {
        const mm = String(filters.month).padStart(2, '0');
        const start = `${filters.year}-${mm}-01`;
        const nextMonth = filters.month === 12 ? 1 : filters.month + 1;
        const nextYear = filters.month === 12 ? filters.year + 1 : filters.year;
        const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
        conditions.push(sql`${decks.eventDate} >= ${start} AND ${decks.eventDate} < ${end}`);
      }
      if (filters?.eventName) {
        conditions.push(eq(decks.eventName, filters.eventName));
      }

      const whereClause = and(...conditions);
      const needsUserJoin = !!filters?.username;

      // Get total count
      const countQuery = db
        .select({ count: sql<number>`count(*)::int` })
        .from(decks);
      if (needsUserJoin) countQuery.leftJoin(users, eq(decks.userId, users.id));
      const [{ count }] = await countQuery.where(whereClause);

      // Get decks with creator info and card stats in a single query
      const limit = pagination?.limit || 20;
      const offset = pagination?.skip || 0;

      const rows = await db
        .select({
          id: decks.id,
          publicId: decks.publicId,
          name: decks.name,
          slug: decks.slug,
          description: decks.description,
          format: decks.format,
          heroName: decks.heroName,
          visibility: decks.visibility,
          featured: decks.featured,
          updatedAt: decks.updatedAt,
          eventName: decks.eventName,
          eventDate: decks.eventDate,
          placing: decks.placing,
          creatorUsername: users.username,
          creatorDisplayUsername: users.displayUsername,
          cardCount: sql<number>`COALESCE(SUM(CASE WHEN ${deckCards.category} != 'hero' THEN ${deckCards.quantity} ELSE 0 END), 0)::int`,
          totalValue: sql<number>`COALESCE(SUM(${deckCards.quantity} * ${printings.tcgMarket}), 0)::real`,
          heroPrintingId: sql<string>`MIN(CASE WHEN ${deckCards.category} = 'hero' THEN ${deckCards.printingId} END)`,
          matchupCount: sql<number>`COALESCE(jsonb_array_length(${decks.metadata}->'matchups'), 0)::int`,
        })
        .from(decks)
        .leftJoin(users, eq(decks.userId, users.id))
        .leftJoin(deckCards, eq(decks.id, deckCards.deckId))
        .leftJoin(printings, eq(deckCards.printingId, printings.printingId))
        .where(whereClause)
        .groupBy(decks.id, users.username, users.displayUsername)
        .having(
          sql`NOT (
            (${decks.format} = 'Classic Constructed' AND COALESCE(SUM(CASE WHEN ${deckCards.category} != 'hero' THEN ${deckCards.quantity} ELSE 0 END), 0) NOT BETWEEN 60 AND 80) OR
            (${decks.format} = 'Silver Age'           AND COALESCE(SUM(CASE WHEN ${deckCards.category} != 'hero' THEN ${deckCards.quantity} ELSE 0 END), 0) NOT BETWEEN 40 AND 55) OR
            (${decks.format} = 'Blitz'                AND COALESCE(SUM(CASE WHEN ${deckCards.category} != 'hero' THEN ${deckCards.quantity} ELSE 0 END), 0) NOT BETWEEN 40 AND 52)
          )`
        )
        .orderBy(desc(decks.updatedAt))
        .limit(limit)
        .offset(offset);

      const summaries: PublicDeckSummaryDTO[] = rows.map((row) => ({
        _id: row.id,
        publicId: row.publicId,
        name: row.name,
        slug: row.slug ?? undefined,
        description: row.description ?? undefined,
        format: row.format as any,
        heroName: row.heroName ?? undefined,
        visibility: 'public' as const,
        isPublic: true,
        featured: row.featured,
        totalCards: row.cardCount,
        estimatedValue: row.totalValue,
        updatedAt: row.updatedAt ?? undefined,
        eventName: row.eventName ?? null,
        eventDate: row.eventDate ?? null,
        placing: row.placing ?? null,
        creatorUsername: row.creatorUsername ?? undefined,
        creatorDisplayUsername: row.creatorDisplayUsername ?? undefined,
        heroPrintingId: row.heroPrintingId ?? undefined,
        matchupCount: row.matchupCount ?? 0,
      }));

      // Batch-fetch article references for these decks
      if (summaries.length > 0) {
        const deckPublicIds = summaries.map((d) => d.publicId);
        const articleRows = await db
          .select({
            publicId: articles.publicId,
            title: articles.title,
            sections: articles.sections,
          })
          .from(articles)
          .where(
            and(
              eq(articles.status, 'published'),
              sql`EXISTS (
                SELECT 1 FROM jsonb_array_elements(${articles.sections}::jsonb) AS s
                WHERE s->>'type' = 'decklist-block'
                AND s->>'deckId' IN (${sql.join(deckPublicIds.map(id => sql`${id}`), sql`, `)})
              )`
            )
          );

        // Build a map: deckPublicId -> [{publicId, title}]
        const articleMap = new Map<string, { publicId: string; title: string }[]>();
        for (const row of articleRows) {
          const secs = (row.sections as any[]) || [];
          for (const sec of secs) {
            if (sec.type === 'decklist-block' && sec.deckId && deckPublicIds.includes(sec.deckId)) {
              if (!articleMap.has(sec.deckId)) articleMap.set(sec.deckId, []);
              const refs = articleMap.get(sec.deckId)!;
              // Avoid duplicates (same article referencing same deck in multiple sections)
              if (!refs.some((r) => r.publicId === row.publicId)) {
                refs.push({ publicId: row.publicId, title: row.title });
              }
            }
          }
        }

        for (const summary of summaries) {
          const refs = articleMap.get(summary.publicId);
          if (refs && refs.length > 0) {
            summary.articleReferences = refs;
          }
        }
      }

      return {
        success: true,
        data: { decks: summaries, total: count },
      };
    } catch (error) {
      console.error('[PostgresDeckService.listPublicDecks] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list public decks',
      };
    }
  }

  async toggleFeatured(
    publicId: string,
    featured: boolean
  ): AsyncResult<boolean> {
    try {
      const result = await db
        .update(decks)
        .set({ featured, updatedAt: new Date() })
        .where(eq(decks.publicId, publicId))
        .returning({ id: decks.id });

      if (result.length === 0) {
        return { success: false, error: 'Deck not found' };
      }
      return { success: true, data: true };
    } catch (error) {
      console.error('[PostgresDeckService.toggleFeatured] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle featured',
      };
    }
  }

  async toggleSystemDeck(
    publicId: string,
    isSystemDeck: boolean
  ): AsyncResult<boolean> {
    try {
      const result = await db
        .update(decks)
        .set({ isSystemDeck, updatedAt: new Date() })
        .where(eq(decks.publicId, publicId))
        .returning({ id: decks.id });

      if (result.length === 0) {
        return { success: false, error: 'Deck not found' };
      }
      return { success: true, data: true };
    } catch (error) {
      console.error('[PostgresDeckService.toggleSystemDeck] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle system deck',
      };
    }
  }

  /**
   * Get distinct events for featured decks in a given month/year,
   * grouped by format with deck count.
   */
  async getEventSummaries(
    year: number,
    month: number
  ): AsyncResult<{ eventName: string; eventDate: string; format: string; count: number }[]> {
    try {
      const mm = String(month).padStart(2, '0');
      const start = `${year}-${mm}-01`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

      const rows = await db
        .select({
          eventName: decks.eventName,
          eventDate: decks.eventDate,
          format: decks.format,
          count: sql<number>`count(*)::int`,
        })
        .from(decks)
        .where(
          and(
            eq(decks.featured, true),
            eq(decks.visibility, 'public'),
            sql`${decks.eventDate} >= ${start} AND ${decks.eventDate} < ${end}`,
            sql`${decks.eventName} IS NOT NULL`
          )
        )
        .groupBy(decks.eventName, decks.eventDate, decks.format)
        .orderBy(decks.format, decks.eventDate);

      return {
        success: true,
        data: rows.map((r) => ({
          eventName: r.eventName!,
          eventDate: r.eventDate!,
          format: r.format!,
          count: r.count,
        })),
      };
    } catch (error) {
      console.error('[PostgresDeckService.getEventSummaries] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get event summaries',
      };
    }
  }

  // ====================================
  // Card Management
  // ====================================

  async addPrinting(
    publicId: string,
    userId: string,
    printing: AddPrintingDTO
  ): AsyncResult<AddPrintingResultDTO> {
    try {
      // Get deck
      const deck = await db
        .select()
        .from(decks)
        .where(and(eq(decks.publicId, publicId), or(eq(decks.userId, userId), sql`${userId} = ANY(${decks.coOwners})`)))
        .limit(1);

      if (deck.length === 0) {
        return { success: false, error: 'Deck not found or access denied' };
      }

      // Fetch printing details
      const printingData = await db
        .select()
        .from(printings)
        .leftJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .where(eq(printings.printingId, printing.printingId))
        .limit(1);

      if (printingData.length === 0) {
        return {
          success: true,
          data: {
            printingId: printing.printingId,
            success: false,
            error: `Printing ${printing.printingId} not found`,
          },
        };
      }

      const category = printing.category || 'maindeck';
      const quantity = printing.quantity || 1;

      // Check if this card already exists in the deck
      const existingCard = await db
        .select()
        .from(deckCards)
        .where(
          and(
            eq(deckCards.deckId, deck[0].id),
            eq(deckCards.printingId, printing.printingId),
            eq(deckCards.category, category)
          )
        )
        .limit(1);

      if (existingCard.length > 0) {
        // Update existing quantity
        await db
          .update(deckCards)
          .set({ quantity: sql`${deckCards.quantity} + ${quantity}` })
          .where(eq(deckCards.id, existingCard[0].id));
      } else {
        // Insert new card with quantity
        await db.insert(deckCards).values({
          id: nanoid(21),
          deckId: deck[0].id,
          printingId: printing.printingId,
          quantity: quantity,  // Store actual quantity, not 1!
          category,
          notes: printing.notes || '',
          addedAt: new Date(),
        });
      }

      // Update deck timestamp
      await db
        .update(decks)
        .set({ updatedAt: new Date() })
        .where(eq(decks.id, deck[0].id));

      return {
        success: true,
        data: {
          printingId: printing.printingId,
          success: true,
          action: 'added',
          cardName: printingData[0].cards?.displayName || printingData[0].cards?.name,
          quantity,
          category,
        },
      };
    } catch (error) {
      console.error('[PostgresDeckService.addPrinting] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add printing',
      };
    }
  }

  async addPrintings(
    publicId: string,
    userId: string,
    printingsToAdd: AddPrintingDTO[]  // Renamed to avoid shadowing schema import
  ): AsyncResult<BulkImportResultDTO> {
    try {
      // Get deck
      const deck = await db
        .select()
        .from(decks)
        .where(and(eq(decks.publicId, publicId), or(eq(decks.userId, userId), sql`${userId} = ANY(${decks.coOwners})`)))
        .limit(1);

      if (deck.length === 0) {
        return { success: false, error: 'Deck not found or access denied' };
      }

      // Pre-fetch all printings
      const uniquePrintingIds = [...new Set(printingsToAdd.map((p) => p.printingId))];
      const printingDocs = await db
        .select({
          printingId: printings.printingId,  // Now correctly refers to schema table
          name: cards.name,
          displayName: cards.displayName,
        })
        .from(printings)  // Now correctly refers to schema table
        .leftJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .where(inArray(printings.printingId, uniquePrintingIds));

      const printingMap = new Map(
        printingDocs.map((p) => [p.printingId, p])
      );

      const results: AddPrintingResultDTO[] = [];
      let totalCardsAdded = 0;

      for (const item of printingsToAdd) {
        const printingData = printingMap.get(item.printingId);
        if (!printingData) {
          results.push({
            printingId: item.printingId,
            success: false,
            error: `Printing ${item.printingId} not found`,
          });
          continue;
        }

        const category = item.category || 'maindeck';
        const quantity = item.quantity || 1;

        // Check if this card already exists in the deck
        const existingCard = await db
          .select()
          .from(deckCards)
          .where(
            and(
              eq(deckCards.deckId, deck[0].id),
              eq(deckCards.printingId, item.printingId),
              eq(deckCards.category, category)
            )
          )
          .limit(1);

        if (existingCard.length > 0) {
          // Update existing quantity
          await db
            .update(deckCards)
            .set({ quantity: sql`${deckCards.quantity} + ${quantity}` })
            .where(eq(deckCards.id, existingCard[0].id));
        } else {
          // Insert new card with quantity
          await db.insert(deckCards).values({
            id: nanoid(21),
            deckId: deck[0].id,
            printingId: item.printingId,
            quantity: quantity,  // Store actual quantity, not 1!
            category,
            notes: item.notes || '',
            addedAt: new Date(),
          });
        }

        totalCardsAdded += quantity;
        results.push({
          printingId: item.printingId,
          success: true,
          action: 'added',
          cardName: printingData.displayName || printingData.name,
          quantity,
          category,
        });
      }

      // Sync hero_name from the hero printing if it was just added and is currently null
      const heroAdded = results.find(r => r.success && r.category === 'hero');
      if (heroAdded && !deck[0].heroName) {
        const heroData = printingMap.get(heroAdded.printingId);
        if (heroData?.name) {
          await db
            .update(decks)
            .set({ heroName: heroData.name, updatedAt: new Date() })
            .where(eq(decks.id, deck[0].id));
        }
      } else if (totalCardsAdded > 0) {
        await db
          .update(decks)
          .set({ updatedAt: new Date() })
          .where(eq(decks.id, deck[0].id));
      }

      const updatedDeck = await this.toDeckDTO(deck[0]);

      return {
        success: true,
        data: {
          summary: {
            total: results.length,
            added: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            totalCardsAdded,
          },
          results,
          deck: updatedDeck,
        },
      };
    } catch (error) {
      console.error('[PostgresDeckService.addPrintings] Error:', error);
      console.error('[PostgresDeckService.addPrintings] Stack:', error instanceof Error ? error.stack : 'No stack');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add printings',
      };
    }
  }

  async removePrinting(
    publicId: string,
    userId: string,
    printingId: string,
    category: DeckCategory,
    quantity: number = 1
  ): AsyncResult<boolean> {
    try {
      // Get deck
      const deck = await db
        .select()
        .from(decks)
        .where(and(eq(decks.publicId, publicId), or(eq(decks.userId, userId), sql`${userId} = ANY(${decks.coOwners})`)))
        .limit(1);

      if (deck.length === 0) {
        return { success: false, error: 'Deck not found or access denied' };
      }

      // Find the card row in this category
      const card = await db
        .select()
        .from(deckCards)
        .where(
          and(
            eq(deckCards.deckId, deck[0].id),
            eq(deckCards.printingId, printingId),
            eq(deckCards.category, category)
          )
        )
        .limit(1);

      if (card.length === 0) {
        return { success: false, error: 'Printing not found in deck' };
      }

      const currentQuantity = card[0].quantity || 1;
      const newQuantity = currentQuantity - quantity;

      if (newQuantity <= 0) {
        // Remove the row entirely
        await db.delete(deckCards).where(eq(deckCards.id, card[0].id));
      } else {
        // Decrement quantity
        await db
          .update(deckCards)
          .set({ quantity: newQuantity })
          .where(eq(deckCards.id, card[0].id));
      }

      // Update deck timestamp
      await db
        .update(decks)
        .set({ updatedAt: new Date() })
        .where(eq(decks.id, deck[0].id));

      return { success: true, data: true };
    } catch (error) {
      console.error('[PostgresDeckService.removePrinting] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove printing',
      };
    }
  }

  async swapPrinting(
    publicId: string,
    userId: string,
    oldPrintingId: string,
    newPrintingId: string,
    category: DeckCategory
  ): AsyncResult<DeckDTO> {
    try {
      // Remove old, add new
      const removeResult = await this.removePrinting(publicId, userId, oldPrintingId, category);
      if (!removeResult.success) {
        return { success: false, error: removeResult.error };
      }

      const addResult = await this.addPrinting(publicId, userId, {
        printingId: newPrintingId,
        category,
      });
      if (!addResult.success) {
        return { success: false, error: addResult.error };
      }

      return await this.findByPublicId(publicId, userId);
    } catch (error) {
      console.error('[PostgresDeckService.swapPrinting] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to swap printing',
      };
    }
  }

  async updatePrintings(
    publicId: string,
    userId: string,
    updates: UpdatePrintingDTO[]
  ): AsyncResult<BatchUpdatePrintingsResultDTO> {
    // Simplified stub - can be enhanced later
    const results: UpdatePrintingResultDTO[] = updates.map((u) => ({
      printingId: u.printingId,
      success: false,
      error: 'Method not fully implemented yet',
    }));

    return {
      success: false,
      data: {
        summary: {
          total: updates.length,
          updated: 0,
          failed: updates.length,
          totalCardsUpdated: 0,
        },
        results,
        deck: {
          _id: '',
          name: '',
          updatedAt: new Date(),
        },
      },
    };
  }

  async bulkImport(
    publicId: string,
    userId: string,
    printings: AddPrintingDTO[]
  ): AsyncResult<BulkImportResultDTO> {
    // Reuse addPrintings
    return this.addPrintings(publicId, userId, printings);
  }

  async importAllocation(
    publicId: string,
    userId: string,
    allocation: AllocationDTO
  ): AsyncResult<DeckDTO> {
    try {
      // Flatten allocation into printings array
      const printings: AddPrintingDTO[] = [];

      const categories: (keyof AllocationDTO)[] = [
        'hero', 'equipment', 'maindeck', 'inventory', 'benched', 'tokens'
      ];

      for (const category of categories) {
        const items = allocation[category];
        if (items) {
          for (const item of items) {
            printings.push({
              ...item,
              category: category as DeckCategory,
            });
          }
        }
      }

      const result = await this.addPrintings(publicId, userId, printings);
      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true, data: result.data.deck };
    } catch (error) {
      console.error('[PostgresDeckService.importAllocation] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import allocation',
      };
    }
  }

  async getOwnershipStatus(
    userId: string,
    printingIds: string[]
  ): AsyncResult<OwnershipStatusDTO[]> {
    try {
      const [ownedMap, forTradeMap] = await Promise.all([
        sumOwnedByPrintingId(userId, printingIds),
        sumForTradeByPrintingId(userId, printingIds),
      ]);

      const statuses: OwnershipStatusDTO[] = printingIds.map((printingId) => ({
        printingId,
        owned: ownedMap[printingId] ?? 0,
        forTrade: forTradeMap[printingId] ?? 0,
        conditions: [],
        binderNames: [],
      }));

      return { success: true, data: statuses };
    } catch (error) {
      console.error('[PostgresDeckService.getOwnershipStatus] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get ownership status',
      };
    }
  }

  async getInventoryComparison(
    publicId: string,
    userId: string,
    options?: { binderMode?: 'all' | 'specific'; binderId?: string }
  ): AsyncResult<InventoryComparisonDTO> {
    try {
      // Find deck by internal id OR publicId (page passes deck._id which is internal id)
      const deckRow = await db
        .select({ id: decks.id })
        .from(decks)
        .where(or(eq(decks.id, publicId), eq(decks.publicId, publicId)))
        .limit(1);

      if (deckRow.length === 0) {
        return { success: false, error: 'Deck not found or access denied' };
      }

      const deckId = deckRow[0].id;

      // Get all deck cards with card display names and prices
      const deckCardRows = await db
        .select({
          printingId: deckCards.printingId,
          quantity: deckCards.quantity,
          cardName: sql<string>`COALESCE(${cards.displayName}, ${cards.name}, ${deckCards.printingId})`,
          tcgMarket: printings.tcgMarket,
        })
        .from(deckCards)
        .leftJoin(printings, eq(deckCards.printingId, printings.printingId))
        .leftJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .where(eq(deckCards.deckId, deckId));

      if (deckCardRows.length === 0) {
        return {
          success: true,
          data: {
            owned: [],
            missing: [],
            partial: [],
            summary: {
              totalNeeded: 0,
              totalOwned: 0,
              totalMissing: 0,
              completionPercentage: 100,
              estimatedMissingValue: 0,
            },
          },
        };
      }

      // Aggregate deck cards by printingId (sum quantities across categories)
      const deckPrintingMap = new Map<string, { cardName: string; needed: number; tcgMarket: number | null }>();
      for (const row of deckCardRows) {
        const existing = deckPrintingMap.get(row.printingId);
        if (existing) {
          existing.needed += row.quantity;
        } else {
          deckPrintingMap.set(row.printingId, {
            cardName: row.cardName,
            needed: row.quantity,
            tcgMarket: row.tcgMarket,
          });
        }
      }

      const printingIds = Array.from(deckPrintingMap.keys());

      // Build inventory query — JOIN with binders to ensure binder belongs to user
      // Note: PostgreSQL schema has no archived field; filtering by binders.userId = userId
      // covers all active binders (equivalent to "not archived")
      const invConditions = [
        eq(inventoryItems.userId, userId),
        inArray(inventoryItems.printingId, printingIds),
        ...(options?.binderMode === 'specific' && options.binderId
          ? [eq(inventoryItems.binderId, options.binderId)]
          : []),
      ];

      const inventoryRows = await db
        .select({
          printingId: inventoryItems.printingId,
          quantity: inventoryItems.quantity,
          forTrade: inventoryItems.forTrade,
          binderId: binders.id,
          binderName: binders.name,
          binderSlug: binders.slug,
        })
        .from(inventoryItems)
        .innerJoin(
          binders,
          and(
            eq(inventoryItems.binderId, binders.id),
            eq(binders.userId, userId)
          )
        )
        .where(and(...invConditions));

      // Aggregate inventory by printingId
      const inventoryMap = new Map<string, {
        owned: number;
        forTrade: boolean;
        binderNames: string[];
        binderSlugs: string[];
        binderIds: string[];
      }>();
      for (const row of inventoryRows) {
        const existing = inventoryMap.get(row.printingId);
        if (existing) {
          existing.owned += row.quantity;
          if (row.forTrade) existing.forTrade = true;
          if (!existing.binderIds.includes(row.binderId)) {
            existing.binderNames.push(row.binderName);
            existing.binderSlugs.push(row.binderSlug || '');
            existing.binderIds.push(row.binderId);
          }
        } else {
          inventoryMap.set(row.printingId, {
            owned: row.quantity,
            forTrade: row.forTrade ?? false,
            binderNames: [row.binderName],
            binderSlugs: [row.binderSlug || ''],
            binderIds: [row.binderId],
          });
        }
      }

      // Categorize each deck printing as owned / partial / missing
      const ownedItems: any[] = [];
      const missingItems: any[] = [];
      const partialItems: any[] = [];

      let totalNeeded = 0;
      let totalOwned = 0;
      let estimatedMissingValue = 0;

      for (const [printingId, { cardName, needed, tcgMarket }] of deckPrintingMap.entries()) {
        totalNeeded += needed;
        const inv = inventoryMap.get(printingId);
        const rawOwned = inv?.owned ?? 0;
        const effectiveOwned = Math.min(rawOwned, needed);
        totalOwned += effectiveOwned;

        const baseItem = {
          printingId,
          cardName,
          needed,
          owned: effectiveOwned,
          // Extra fields expected by the collection tab UI
          ownedQuantity: rawOwned,
          exactOwned: effectiveOwned,
          neededQuantity: needed,
          forTrade: inv?.forTrade ?? false,
          binderNames: inv?.binderNames ?? [],
          binderSlugs: inv?.binderSlugs ?? [],
          binderIds: inv?.binderIds ?? [],
          conditions: [],
          alternativeOwned: 0,
        };

        if (rawOwned >= needed) {
          ownedItems.push(baseItem);
        } else if (rawOwned > 0) {
          const shortage = needed - rawOwned;
          partialItems.push({ ...baseItem, shortage });
          estimatedMissingValue += shortage * (tcgMarket ?? 0);
        } else {
          missingItems.push({ ...baseItem, tcgMarket: tcgMarket ?? undefined });
          estimatedMissingValue += needed * (tcgMarket ?? 0);
        }
      }

      const completionPercentage = totalNeeded > 0
        ? Math.round((totalOwned / totalNeeded) * 100)
        : 100;

      return {
        success: true,
        data: {
          owned: ownedItems as InventoryComparisonDTO['owned'],
          missing: missingItems as InventoryComparisonDTO['missing'],
          partial: partialItems as InventoryComparisonDTO['partial'],
          summary: {
            totalNeeded,
            totalOwned,
            totalMissing: totalNeeded - totalOwned,
            completionPercentage,
            estimatedMissingValue,
          },
        },
      };
    } catch (error) {
      console.error('[PostgresDeckService.getInventoryComparison] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get inventory comparison',
      };
    }
  }

  async calculateStats(
    publicId: string
  ): AsyncResult<DeckStatsDTO> {
    try {
      const deck = await db
        .select()
        .from(decks)
        .where(eq(decks.publicId, publicId))
        .limit(1);

      if (deck.length === 0) {
        return { success: false, error: 'Deck not found' };
      }

      // Calculate stats using SQL aggregates (NOT cached!)
      const [stats] = await db
        .select({
          totalCards: sql<number>`COALESCE(SUM(${deckCards.quantity}), 0)::int`,
          uniqueCards: sql<number>`COUNT(DISTINCT ${deckCards.printingId})::int`,
          estimatedValue: sql<number>`COALESCE(SUM(${deckCards.quantity} * ${printings.tcgMarket}), 0)::real`,
          heroCount: sql<number>`COALESCE(SUM(CASE WHEN ${deckCards.category} = 'hero' THEN ${deckCards.quantity} ELSE 0 END), 0)::int`,
          equipmentCount: sql<number>`COALESCE(SUM(CASE WHEN ${deckCards.category} = 'equipment' THEN ${deckCards.quantity} ELSE 0 END), 0)::int`,
          maindeckCount: sql<number>`COALESCE(SUM(CASE WHEN ${deckCards.category} = 'maindeck' THEN ${deckCards.quantity} ELSE 0 END), 0)::int`,
          inventoryCount: sql<number>`COALESCE(SUM(CASE WHEN ${deckCards.category} = 'inventory' THEN ${deckCards.quantity} ELSE 0 END), 0)::int`,
          benchedCount: sql<number>`COALESCE(SUM(CASE WHEN ${deckCards.category} = 'benched' THEN ${deckCards.quantity} ELSE 0 END), 0)::int`,
          tokensCount: sql<number>`COALESCE(SUM(CASE WHEN ${deckCards.category} = 'tokens' THEN ${deckCards.quantity} ELSE 0 END), 0)::int`,
        })
        .from(deckCards)
        .leftJoin(printings, eq(deckCards.printingId, printings.printingId))
        .where(eq(deckCards.deckId, deck[0].id));

      return {
        success: true,
        data: {
          totalCards: stats.totalCards,
          uniqueCards: stats.uniqueCards,
          estimatedValue: stats.estimatedValue,
          categoryBreakdown: {
            hero: stats.heroCount,
            equipment: stats.equipmentCount,
            maindeck: stats.maindeckCount,
            inventory: stats.inventoryCount,
            benched: stats.benchedCount,
            tokens: stats.tokensCount,
          },
        },
      };
    } catch (error) {
      console.error('[PostgresDeckService.calculateStats] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate stats',
      };
    }
  }

  async validateFormat(
    publicId: string
  ): AsyncResult<{ isLegal: boolean; errors: string[] }> {
    try {
      const deckRows = await db
        .select()
        .from(decks)
        .where(eq(decks.publicId, publicId))
        .limit(1);

      if (deckRows.length === 0) {
        return { success: false, error: 'Deck not found' };
      }

      const deck = deckRows[0];
      const format = (deck.format ?? '').toLowerCase();
      const errors: string[] = [];

      // Fetch all deck cards with card details for validation
      const cardRows = await db
        .select({
          category: deckCards.category,
          quantity: deckCards.quantity,
          cardUniqueId: cards.cardUniqueId,
          pitch: cards.pitch,
          keywords: cards.keywords,
          types: cards.types,
          isHero: cards.isHero,
          rarity: printings.rarity,
          llRestricted: cards.llRestricted,
          llBanned: cards.llBanned,
        })
        .from(deckCards)
        .leftJoin(printings, eq(deckCards.printingId, printings.printingId))
        .leftJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
        .where(eq(deckCards.deckId, deck.id));

      // Ban sets from static source (lib/fab-banned-cards.ts)
      const ccBannedIds = getBannedCardIds('cc');
      const sageBannedIds = getBannedCardIds('silver age');

      // Separate hero from the rest — hero is not part of the card pool count
      const heroCards = cardRows.filter(r => r.category === 'hero');
      const poolCards = cardRows.filter(r => r.category !== 'hero');

      // Card pool = equipment + maindeck + inventory quantities
      const cardPoolCount = poolCards.reduce((sum, r) => sum + (r.quantity ?? 0), 0);
      const maindeckCount = poolCards
        .filter(r => r.category === 'maindeck')
        .reduce((sum, r) => sum + (r.quantity ?? 0), 0);

      // Hero validation helpers
      const heroCard = heroCards[0] ?? null;
      const heroTypes: string[] = heroCard?.types?.map((t: string) => t.toLowerCase()) ?? [];
      const isYoungHero = heroTypes.includes('young');

      // Copy-limit validation: uniqueness is (cardUniqueId, pitch)
      const copyCounts = new Map<string, number>();
      for (const row of poolCards) {
        const key = `${row.cardUniqueId}|${row.pitch ?? ''}`;
        copyCounts.set(key, (copyCounts.get(key) ?? 0) + (row.quantity ?? 0));
      }

      if (format === 'classic constructed' || format === 'cc') {
        // Non-young hero required
        if (heroCards.length === 0) {
          errors.push('Deck must contain a hero.');
        } else if (isYoungHero) {
          errors.push('Classic Constructed requires an adult (non-young) hero.');
        }
        // Card pool ≤ 80
        if (cardPoolCount > 80) {
          errors.push(`Card pool is ${cardPoolCount} (max 80 for Classic Constructed).`);
        }
        // Maindeck ≥ 60
        if (maindeckCount < 60) {
          errors.push(`Maindeck has ${maindeckCount} cards (minimum 60 for Classic Constructed).`);
        }
        // Copy limits + ban check
        for (const row of poolCards) {
          const keywordsLower: string[] = (row.keywords ?? []).map((k: string) => k.toLowerCase());
          if (keywordsLower.includes('unlimited')) continue;
          const maxCopies = keywordsLower.includes('legendary') ? 1 : 3;
          const key = `${row.cardUniqueId}|${row.pitch ?? ''}`;
          const count = copyCounts.get(key) ?? 0;
          if (count > maxCopies) {
            errors.push(`A card exceeds the ${maxCopies}-copy limit for Classic Constructed.`);
            copyCounts.delete(key); // report each card once
          }
          if (row.cardUniqueId && ccBannedIds.has(row.cardUniqueId)) {
            errors.push('Deck contains a card banned in Classic Constructed.');
          }
        }

      } else if (format === 'blitz') {
        // Young hero required
        if (heroCards.length === 0) {
          errors.push('Deck must contain a hero.');
        } else if (!isYoungHero) {
          errors.push('Blitz requires a young hero.');
        }
        // Card pool ≤ 52
        if (cardPoolCount > 52) {
          errors.push(`Card pool is ${cardPoolCount} (max 52 for Blitz).`);
        }
        // Maindeck = 40
        if (maindeckCount !== 40) {
          errors.push(`Maindeck must be exactly 40 cards for Blitz (currently ${maindeckCount}).`);
        }
        // Max 1 copy of each unique card (including equipment/weapons)
        for (const [key, count] of copyCounts.entries()) {
          if (count > 1) {
            errors.push(`A card has ${count} copies — Blitz allows max 1 copy of each unique card.`);
            copyCounts.delete(key);
          }
        }
        // Blitz has no current bans (as of Jan 2026)

      } else if (format === 'silver age') {
        // Young hero required
        if (heroCards.length === 0) {
          errors.push('Deck must contain a hero.');
        } else if (!isYoungHero) {
          errors.push('Silver Age requires a young hero.');
        }
        // Card pool ≤ 55
        if (cardPoolCount > 55) {
          errors.push(`Card pool is ${cardPoolCount} (max 55 for Silver Age).`);
        }
        // Maindeck = 40
        if (maindeckCount !== 40) {
          errors.push(`Maindeck must be exactly 40 cards for Silver Age (currently ${maindeckCount}).`);
        }
        // Max 2 copies, rarity check, ban check
        const silverAgeRarities = new Set(['common', 'rare', 'basic', 'token']);
        for (const row of poolCards) {
          const keywordsLower: string[] = (row.keywords ?? []).map((k: string) => k.toLowerCase());
          if (keywordsLower.includes('unlimited')) continue;
          const key = `${row.cardUniqueId}|${row.pitch ?? ''}`;
          const count = copyCounts.get(key) ?? 0;
          if (count > 2) {
            errors.push(`A card has ${count} copies — Silver Age allows max 2 copies.`);
            copyCounts.delete(key);
          }
          if (row.rarity && !silverAgeRarities.has(row.rarity.toLowerCase())) {
            errors.push(`Deck contains a non-Silver Age rarity card (${row.rarity}).`);
          }
          if (row.cardUniqueId && sageBannedIds.has(row.cardUniqueId)) {
            errors.push('Deck contains a card banned in Silver Age.');
          }
        }

      } else if (format === 'living legend' || format === 'll') {
        // Non-young hero required
        if (heroCards.length === 0) {
          errors.push('Deck must contain a hero.');
        } else if (isYoungHero) {
          errors.push('Living Legend requires an adult (non-young) hero.');
        }
        // Card pool ≤ 80
        if (cardPoolCount > 80) {
          errors.push(`Card pool is ${cardPoolCount} (max 80 for Living Legend).`);
        }
        // Maindeck ≥ 60
        if (maindeckCount < 60) {
          errors.push(`Maindeck has ${maindeckCount} cards (minimum 60 for Living Legend).`);
        }
        // Copy limits + ban/restricted check
        for (const row of poolCards) {
          const keywordsLower: string[] = (row.keywords ?? []).map((k: string) => k.toLowerCase());
          if (keywordsLower.includes('unlimited')) continue;
          const maxCopies = keywordsLower.includes('legendary') ? 1 : 3;
          const key = `${row.cardUniqueId}|${row.pitch ?? ''}`;
          const count = copyCounts.get(key) ?? 0;
          if (row.llRestricted && count > 1) {
            errors.push('A restricted card has more than 1 copy (Living Legend restricted list).');
            copyCounts.delete(key);
          } else if (count > maxCopies) {
            errors.push(`A card exceeds the ${maxCopies}-copy limit for Living Legend.`);
            copyCounts.delete(key);
          }
          // LL bans come from DB (no static list in fab-banned-cards.ts for LL yet)
          if (row.llBanned) {
            errors.push('Deck contains a card banned in Living Legend.');
          }
        }
      }

      return {
        success: true,
        data: {
          isLegal: errors.length === 0,
          errors,
        },
      };
    } catch (error) {
      console.error('[PostgresDeckService.validateFormat] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate format',
      };
    }
  }

  async updateCoOwners(
    publicId: string,
    ownerUserId: string,
    coOwnerIds: string[]
  ): AsyncResult<DeckDTO> {
    try {
      if (coOwnerIds.length > 20) {
        return { success: false, error: 'A deck can have at most 20 co-owners' };
      }

      const updated = await db
        .update(decks)
        .set({ coOwners: coOwnerIds, updatedAt: new Date() })
        .where(and(eq(decks.publicId, publicId), eq(decks.userId, ownerUserId)))
        .returning();

      if (updated.length === 0) {
        return { success: false, error: 'Deck not found or access denied' };
      }

      return { success: true, data: await this.toDeckDTO(updated[0]) };
    } catch (error) {
      console.error('[PostgresDeckService.updateCoOwners] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update co-owners',
      };
    }
  }
}

