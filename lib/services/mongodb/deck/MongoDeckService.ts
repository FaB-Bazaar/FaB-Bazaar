/**
 * MongoDB implementation of IDeckService
 *
 * Provides deck operations with backwards compatibility for slug/ObjectId lookups.
 */

import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import type {
  IDeckService,
  DeckDTO,
  DeckSummaryDTO,
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
  DeckStatsDTO,
  OwnershipStatusDTO,
  InventoryComparisonDTO,
  AllocationDTO,
} from '../../contracts/IDeckService';
import type { AsyncResult, PaginationOptions } from '../../contracts/common';

export class MongoDeckService implements IDeckService {
  /**
   * Ensure database connection is established
   */
  private async ensureConnection() {
    await connectToDatabase();
  }

  /**
   * Get database instance
   */
  private async getDb() {
    const { db } = await connectToDatabase();
    return db;
  }

  /**
   * Convert Mongoose document to DeckDTO
   */
  private toDTO(deck: any): DeckDTO {
    return {
      _id: deck._id.toString(),
      publicId: deck.publicId,
      userId: deck.userId.toString(),
      name: deck.name,
      slug: deck.slug || '',
      description: deck.description,
      format: deck.format,
      heroName: deck.heroName,
      isPublic: deck.isPublic ?? false,
      fabraryUrl: deck.fabraryUrl,
      fabraryDeckId: deck.fabraryDeckId,
      hero: deck.hero || [],
      equipment: deck.equipment || [],
      maindeck: deck.maindeck || [],
      inventory: deck.inventory || [],
      maybeboard: deck.maybeboard || [],
      tokens: deck.tokens || [],
      totalCards: deck.totalCards,
      estimatedValue: deck.estimatedValue,
      heroCount: deck.heroCount,
      equipmentCount: deck.equipmentCount,
      maindeckCount: deck.maindeckCount,
      inventoryCount: deck.inventoryCount,
      maybeboardCount: deck.maybeboardCount,
      tokensCount: deck.tokensCount,
      cardPoolCount: deck.cardPoolCount,
      isFormatLegal: deck.isFormatLegal,
      formatErrors: deck.formatErrors,
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt,
      tags: deck.tags,
      metadata: deck.metadata,
    };
  }

  /**
   * Convert Mongoose document to DeckSummaryDTO
   */
  private toSummaryDTO(deck: any): DeckSummaryDTO {
    return {
      _id: deck._id.toString(),
      publicId: deck.publicId,
      name: deck.name,
      slug: deck.slug,
      format: deck.format,
      heroName: deck.heroName,
      isPublic: deck.isPublic ?? false,
      totalCards: deck.totalCards,
      estimatedValue: deck.estimatedValue,
      updatedAt: deck.updatedAt,
    };
  }

  /**
   * Calculate deck stats from category arrays
   */
  private calculateStatsFromDeck(deck: any): DeckStatsDTO {
    const allPrintings = [
      ...(deck.hero || []),
      ...(deck.equipment || []),
      ...(deck.maindeck || []),
      ...(deck.inventory || []),
      ...(deck.maybeboard || []),
      ...(deck.tokens || []),
    ];

    const uniqueCards = new Set(
      allPrintings.map((p: any) => p.printingDetails?.card_unique_id || p.printingId)
    ).size;

    const estimatedValue = allPrintings.reduce((total: number, p: any) => {
      return total + (p.printingDetails?.tcg_market || 0);
    }, 0);

    return {
      totalCards: allPrintings.length,
      uniqueCards,
      estimatedValue,
      categoryBreakdown: {
        hero: deck.hero?.length || 0,
        equipment: deck.equipment?.length || 0,
        maindeck: deck.maindeck?.length || 0,
        inventory: deck.inventory?.length || 0,
        maybeboard: deck.maybeboard?.length || 0,
        tokens: deck.tokens?.length || 0,
      },
    };
  }

  /**
   * Find deck with backwards compatibility (by slug or ObjectId)
   *
   * First attempts to find by slug, then falls back to finding by _id
   * if the identifier is a valid ObjectId.
   */
  async findBySlugOrId(
    identifier: string,
    userId: string
  ): AsyncResult<DeckDTO | null> {
    try {
      await this.ensureConnection();

      // Dynamic import to avoid circular dependencies
      const { Deck } = await import('@/models/Deck');

      const userObjectId = new mongoose.Types.ObjectId(userId);

      // First try to find by slug
      let deck = await Deck.findOne({ userId: userObjectId, slug: identifier });

      // If not found by slug and identifier is a valid ObjectId, try by _id
      if (!deck && mongoose.Types.ObjectId.isValid(identifier)) {
        deck = await Deck.findOne({
          userId: userObjectId,
          _id: new mongoose.Types.ObjectId(identifier),
        });
      }

      if (!deck) {
        return { success: true, data: null };
      }

      return { success: true, data: this.toDTO(deck) };
    } catch (error) {
      console.error('[MongoDeckService.findBySlugOrId] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find deck',
      };
    }
  }

  /**
   * Find deck by slug only
   */
  async findBySlug(
    slug: string,
    userId: string
  ): AsyncResult<DeckDTO | null> {
    try {
      await this.ensureConnection();

      const { Deck } = await import('@/models/Deck');

      const userObjectId = new mongoose.Types.ObjectId(userId);
      const deck = await Deck.findOne({ userId: userObjectId, slug });

      if (!deck) {
        return { success: true, data: null };
      }

      return { success: true, data: this.toDTO(deck) };
    } catch (error) {
      console.error('[MongoDeckService.findBySlug] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find deck by slug',
      };
    }
  }

  /**
   * Find deck by ID only
   */
  async findById(
    deckId: string,
    userId?: string
  ): AsyncResult<DeckDTO | null> {
    try {
      await this.ensureConnection();

      const { Deck } = await import('@/models/Deck');

      if (!mongoose.Types.ObjectId.isValid(deckId)) {
        return { success: true, data: null };
      }

      const query: any = { _id: new mongoose.Types.ObjectId(deckId) };

      // If userId provided, add ownership check
      if (userId) {
        query.userId = new mongoose.Types.ObjectId(userId);
      }

      const deck = await Deck.findOne(query);

      if (!deck) {
        return { success: true, data: null };
      }

      return { success: true, data: this.toDTO(deck) };
    } catch (error) {
      console.error('[MongoDeckService.findById] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find deck by ID',
      };
    }
  }

  /**
   * Find deck by publicId
   *
   * The primary lookup method for external access. Uses the globally unique
   * publicId (nanoid) rather than MongoDB _id.
   */
  async findByPublicId(
    publicId: string,
    userId?: string
  ): AsyncResult<DeckDTO | null> {
    try {
      await this.ensureConnection();

      const { Deck } = await import('@/models/Deck');

      const query: any = { publicId };

      // If userId provided, add ownership check
      if (userId) {
        query.userId = new mongoose.Types.ObjectId(userId);
      }

      const deck = await Deck.findOne(query);

      if (!deck) {
        return { success: true, data: null };
      }

      return { success: true, data: this.toDTO(deck) };
    } catch (error) {
      console.error('[MongoDeckService.findByPublicId] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find deck by publicId',
      };
    }
  }

  // ====================================
  // CRUD Operations
  // ====================================

  /**
   * Create a new deck
   */
  async createDeck(
    userId: string,
    data: CreateDeckDTO
  ): AsyncResult<DeckDTO> {
    try {
      await this.ensureConnection();
      const db = await this.getDb();

      const { Deck } = await import('@/models/Deck');

      // Generate unique slug
      const slugResult = await this.generateUniqueSlug(userId, data.name);
      if (!slugResult.success) {
        return { success: false, error: slugResult.error };
      }
      const deckSlug = data.slug || slugResult.data;

      // Fetch hero printing if provided
      let heroPrintings: any[] = [];
      if (data.heroPrintingId) {
        const printingsCollection = db.collection('printings');
        const printing = await printingsCollection.findOne({
          printing_id: data.heroPrintingId,
        });

        if (!printing) {
          return { success: false, error: 'Hero printing not found' };
        }

        if (!printing.types?.includes('hero')) {
          return { success: false, error: 'Selected printing is not a hero card' };
        }

        heroPrintings = [{
          printingId: data.heroPrintingId,
          condition: 'NM',
          notes: '',
          addedAt: new Date(),
          printingDetails: printing,
        }];
      }

      // Handle copying from existing deck
      let copiedCards: any = {
        hero: heroPrintings,
        equipment: [],
        maindeck: [],
        inventory: [],
        maybeboard: [],
        tokens: [],
      };

      if (data.copyFromDeckId) {
        const sourceDeck = await Deck.findOne({
          $or: [
            { publicId: data.copyFromDeckId, userId: new mongoose.Types.ObjectId(userId) },
            { publicId: data.copyFromDeckId, isPublic: true },
          ],
        });

        if (!sourceDeck) {
          return { success: false, error: 'Source deck not found or not accessible' };
        }

        copiedCards = {
          hero: sourceDeck.hero || [],
          equipment: sourceDeck.equipment || [],
          maindeck: sourceDeck.maindeck || [],
          inventory: sourceDeck.inventory || [],
          maybeboard: sourceDeck.maybeboard || [],
          tokens: sourceDeck.tokens || [],
        };
      }

      // Extract Fabrary deck ID if URL provided
      let fabraryDeckId: string | undefined;
      if (data.fabraryUrl) {
        const match = data.fabraryUrl.match(/\/decks\/([A-Z0-9]+)/i);
        fabraryDeckId = match ? match[1] : undefined;
      }

      // Create new deck
      const newDeck = new Deck({
        userId: new mongoose.Types.ObjectId(userId),
        name: data.name.trim(),
        description: data.description?.trim() || '',
        format: data.format,
        heroName: data.heroName?.trim(),
        isPublic: Boolean(data.isPublic),
        slug: deckSlug,
        fabraryUrl: data.fabraryUrl?.trim(),
        fabraryDeckId,
        ...copiedCards,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await newDeck.save();

      return { success: true, data: this.toDTO(newDeck) };
    } catch (error) {
      console.error('[MongoDeckService.createDeck] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create deck',
      };
    }
  }

  /**
   * Create a deck with initial cards
   */
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
      console.error('[MongoDeckService.createDeckWithCards] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create deck with cards',
      };
    }
  }

  /**
   * Update deck metadata
   */
  async updateDeck(
    publicId: string,
    userId: string,
    updates: UpdateDeckDTO
  ): AsyncResult<DeckDTO> {
    try {
      await this.ensureConnection();

      const { Deck } = await import('@/models/Deck');

      // If slug is being changed, validate uniqueness
      if (updates.slug) {
        const existingDeck = await Deck.findOne({
          userId: new mongoose.Types.ObjectId(userId),
          slug: updates.slug,
          publicId: { $ne: publicId },
        });
        if (existingDeck) {
          return { success: false, error: 'A deck with this slug already exists' };
        }
      }

      // Extract Fabrary deck ID if URL provided
      let fabraryDeckId: string | undefined;
      if (updates.fabraryUrl) {
        const match = updates.fabraryUrl.match(/\/decks\/([A-Z0-9]+)/i);
        fabraryDeckId = match ? match[1] : undefined;
      }

      const updateFields: any = { updatedAt: new Date() };
      if (updates.name !== undefined) updateFields.name = updates.name.trim();
      if (updates.description !== undefined) updateFields.description = updates.description.trim();
      if (updates.format !== undefined) updateFields.format = updates.format;
      if (updates.heroName !== undefined) updateFields.heroName = updates.heroName?.trim();
      if (updates.isPublic !== undefined) updateFields.isPublic = Boolean(updates.isPublic);
      if (updates.fabraryUrl !== undefined) {
        updateFields.fabraryUrl = updates.fabraryUrl?.trim();
        updateFields.fabraryDeckId = fabraryDeckId;
      }
      if (updates.slug !== undefined) updateFields.slug = updates.slug;
      if (updates.metadata !== undefined) updateFields.metadata = updates.metadata;

      const deck = await Deck.findOneAndUpdate(
        { publicId, userId: new mongoose.Types.ObjectId(userId) },
        { $set: updateFields },
        { new: true }
      );

      if (!deck) {
        return { success: false, error: 'Deck not found or access denied' };
      }

      return { success: true, data: this.toDTO(deck) };
    } catch (error) {
      console.error('[MongoDeckService.updateDeck] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update deck',
      };
    }
  }

  /**
   * Delete a deck
   */
  async deleteDeck(
    publicId: string,
    userId: string
  ): AsyncResult<boolean> {
    try {
      await this.ensureConnection();

      const { Deck } = await import('@/models/Deck');

      const result = await Deck.deleteOne({
        publicId,
        userId: new mongoose.Types.ObjectId(userId),
      });

      if (result.deletedCount === 0) {
        return { success: false, error: 'Deck not found or access denied' };
      }

      return { success: true, data: true };
    } catch (error) {
      console.error('[MongoDeckService.deleteDeck] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete deck',
      };
    }
  }

  // ====================================
  // List Operations
  // ====================================

  /**
   * List user's decks with optional filters and pagination
   */
  async listUserDecks(
    userId: string,
    filters?: DeckListFilters,
    pagination?: PaginationOptions
  ): AsyncResult<{ decks: DeckDTO[]; total: number }> {
    try {
      await this.ensureConnection();

      const { Deck } = await import('@/models/Deck');

      const query: any = { userId: new mongoose.Types.ObjectId(userId) };

      if (filters?.format) query.format = filters.format;
      if (filters?.isPublic !== undefined) query.isPublic = filters.isPublic;
      if (filters?.heroName) query.heroName = filters.heroName;
      if (filters?.search) {
        query.name = { $regex: filters.search, $options: 'i' };
      }

      const total = await Deck.countDocuments(query);

      let deckQuery = Deck.find(query);

      if (pagination?.sort) {
        deckQuery = deckQuery.sort(pagination.sort);
      } else {
        deckQuery = deckQuery.sort({ updatedAt: -1 });
      }

      if (pagination?.skip) deckQuery = deckQuery.skip(pagination.skip);
      if (pagination?.limit) deckQuery = deckQuery.limit(pagination.limit);

      const decks = await deckQuery.exec();

      return {
        success: true,
        data: {
          decks: decks.map((deck: any) => this.toDTO(deck)),
          total,
        },
      };
    } catch (error) {
      console.error('[MongoDeckService.listUserDecks] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list decks',
      };
    }
  }

  /**
   * List user's decks in lightweight format
   */
  async listUserDecksBasic(
    userId: string
  ): AsyncResult<DeckSummaryDTO[]> {
    try {
      await this.ensureConnection();

      const { Deck } = await import('@/models/Deck');

      const decks = await Deck.find({ userId: new mongoose.Types.ObjectId(userId) })
        .select('_id publicId name slug format heroName isPublic totalCards estimatedValue updatedAt')
        .sort({ updatedAt: -1 })
        .lean();

      return {
        success: true,
        data: decks.map((deck: any) => this.toSummaryDTO(deck)),
      };
    } catch (error) {
      console.error('[MongoDeckService.listUserDecksBasic] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list decks',
      };
    }
  }

  /**
   * Count user's decks with optional filters
   */
  async countUserDecks(
    userId: string,
    filters?: DeckListFilters
  ): AsyncResult<number> {
    try {
      await this.ensureConnection();

      const { Deck } = await import('@/models/Deck');

      const query: any = { userId: new mongoose.Types.ObjectId(userId) };

      if (filters?.format) query.format = filters.format;
      if (filters?.isPublic !== undefined) query.isPublic = filters.isPublic;

      const count = await Deck.countDocuments(query);

      return { success: true, data: count };
    } catch (error) {
      console.error('[MongoDeckService.countUserDecks] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to count decks',
      };
    }
  }

  // ====================================
  // Card Management
  // ====================================

  /**
   * Add a printing to a deck with equipment conflict handling
   */
  async addPrinting(
    publicId: string,
    userId: string,
    printing: AddPrintingDTO
  ): AsyncResult<AddPrintingResultDTO> {
    try {
      await this.ensureConnection();
      const db = await this.getDb();

      const { Deck } = await import('@/models/Deck');

      const deck = await Deck.findOne({
        publicId,
        userId: new mongoose.Types.ObjectId(userId),
      });

      if (!deck) {
        return { success: false, error: 'Deck not found or access denied' };
      }

      // Fetch printing details
      const printingsCollection = db.collection('printings');
      const printingDoc = await printingsCollection.findOne({
        printing_id: printing.printingId,
      });

      if (!printingDoc) {
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
      const movedToInventory: string[] = [];

      // Handle equipment conflict logic
      if (category === 'equipment') {
        const types = printingDoc.types || [];
        const subtypes = printingDoc.subtypes || [];
        const isWeapon = types.includes('weapon');
        const isOffHand = types.includes('off-hand');
        const is2H = types.includes('2h') || subtypes.includes('2h');
        const is1H = types.includes('1h') || subtypes.includes('1h') || (isWeapon && !is2H);
        const isHead = types.includes('head');
        const isChest = types.includes('chest');
        const isArms = types.includes('arms');
        const isLegs = types.includes('legs');

        // Ensure inventory exists
        if (!deck.inventory) deck.inventory = [];

        // Check for armor slot conflicts
        if (isHead || isChest || isArms || isLegs) {
          const slotType = isHead ? 'head' : isChest ? 'chest' : isArms ? 'arms' : 'legs';
          const existingInSlot = deck.equipment.filter((item: any) => {
            const itemTypes = item.printingDetails?.types || [];
            return itemTypes.includes(slotType);
          });

          for (const item of existingInSlot) {
            const index = deck.equipment.findIndex((e: any) =>
              e.printingId === item.printingId &&
              e.addedAt?.getTime() === item.addedAt?.getTime()
            );
            if (index !== -1) {
              const [removed] = deck.equipment.splice(index, 1);
              deck.inventory.push(removed);
              movedToInventory.push(removed.printingDetails?.display_name || removed.printingDetails?.name || removed.printingId);
            }
          }
        }

        // Check for weapon conflicts
        if (isWeapon || isOffHand) {
          const equipmentWeapons = deck.equipment.filter((item: any) => {
            const itemTypes = item.printingDetails?.types || [];
            return itemTypes.includes('weapon');
          });

          const weaponsToMove: any[] = [];

          if (is2H && equipmentWeapons.length > 0) {
            weaponsToMove.push(...equipmentWeapons);
          } else if (is1H || isOffHand) {
            const twoHandedWeapons = equipmentWeapons.filter((item: any) => {
              const itemTypes = item.printingDetails?.types || [];
              const itemSubtypes = item.printingDetails?.subtypes || [];
              return itemTypes.includes('2h') || itemSubtypes.includes('2h');
            });
            weaponsToMove.push(...twoHandedWeapons);
          }

          for (const weapon of weaponsToMove) {
            const index = deck.equipment.findIndex((item: any) =>
              item.printingId === weapon.printingId &&
              item.addedAt?.getTime() === weapon.addedAt?.getTime()
            );
            if (index !== -1) {
              const [removed] = deck.equipment.splice(index, 1);
              deck.inventory.push(removed);
              movedToInventory.push(removed.printingDetails?.display_name || removed.printingDetails?.name || removed.printingId);
            }
          }
        }
      }

      // Add the new printing(s)
      for (let i = 0; i < quantity; i++) {
        const newPrinting = {
          printingId: printing.printingId,
          condition: printing.condition || 'NM',
          notes: printing.notes || '',
          addedAt: new Date(),
          printingDetails: printingDoc,
        };

        if (!deck[category]) deck[category] = [];
        deck[category].push(newPrinting);
      }

      deck.updatedAt = new Date();
      await deck.save();

      return {
        success: true,
        data: {
          printingId: printing.printingId,
          success: true,
          action: 'added',
          cardName: printingDoc.display_name || printingDoc.name,
          quantity,
          category,
          movedToInventory: movedToInventory.length > 0 ? movedToInventory : undefined,
        },
      };
    } catch (error) {
      console.error('[MongoDeckService.addPrinting] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add printing',
      };
    }
  }

  /**
   * Add multiple printings to a deck
   */
  async addPrintings(
    publicId: string,
    userId: string,
    printings: AddPrintingDTO[]
  ): AsyncResult<BulkImportResultDTO> {
    try {
      await this.ensureConnection();
      const db = await this.getDb();

      const { Deck } = await import('@/models/Deck');

      const deck = await Deck.findOne({
        publicId,
        userId: new mongoose.Types.ObjectId(userId),
      });

      if (!deck) {
        return { success: false, error: 'Deck not found or access denied' };
      }

      // Pre-fetch all printings
      const uniquePrintingIds = [...new Set(printings.map((p) => p.printingId))];
      const printingsCollection = db.collection('printings');
      const printingDocs = await printingsCollection
        .find({ printing_id: { $in: uniquePrintingIds } })
        .toArray();
      const printingMap = new Map(printingDocs.map((p: any) => [p.printing_id, p]));

      const results: AddPrintingResultDTO[] = [];
      let totalCardsAdded = 0;

      for (const item of printings) {
        const printingDoc = printingMap.get(item.printingId);
        if (!printingDoc) {
          results.push({
            printingId: item.printingId,
            success: false,
            error: `Printing ${item.printingId} not found`,
          });
          continue;
        }

        const category = item.category || 'maindeck';
        const quantity = item.quantity || 1;

        // Add the printing(s) - simplified version without equipment conflict handling for bulk
        for (let i = 0; i < quantity; i++) {
          const newPrinting = {
            printingId: item.printingId,
            condition: item.condition || 'NM',
            notes: item.notes || '',
            addedAt: new Date(),
            printingDetails: printingDoc,
          };

          if (!deck[category]) deck[category] = [];
          deck[category].push(newPrinting);
        }

        totalCardsAdded += quantity;
        results.push({
          printingId: item.printingId,
          success: true,
          action: 'added',
          cardName: printingDoc.display_name || printingDoc.name,
          quantity,
          category,
        });
      }

      if (totalCardsAdded > 0) {
        deck.updatedAt = new Date();
        await deck.save();
      }

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
          deck: this.toDTO(deck),
        },
      };
    } catch (error) {
      console.error('[MongoDeckService.addPrintings] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add printings',
      };
    }
  }

  /**
   * Remove a printing from a deck
   */
  async removePrinting(
    publicId: string,
    userId: string,
    printingId: string,
    category: DeckCategory
  ): AsyncResult<boolean> {
    try {
      await this.ensureConnection();

      const { Deck } = await import('@/models/Deck');

      const deck = await Deck.findOne({
        publicId,
        userId: new mongoose.Types.ObjectId(userId),
      });

      if (!deck) {
        return { success: false, error: 'Deck not found or access denied' };
      }

      const categoryArray = deck[category] as any[];
      if (!categoryArray) {
        return { success: false, error: `Category ${category} not found` };
      }

      const index = categoryArray.findIndex((p: any) => p.printingId === printingId);
      if (index === -1) {
        return { success: false, error: 'Printing not found in deck' };
      }

      categoryArray.splice(index, 1);
      deck.updatedAt = new Date();
      await deck.save();

      return { success: true, data: true };
    } catch (error) {
      console.error('[MongoDeckService.removePrinting] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove printing',
      };
    }
  }

  /**
   * Swap a printing in a deck with a different printing
   */
  async swapPrinting(
    publicId: string,
    userId: string,
    oldPrintingId: string,
    newPrintingId: string,
    category: DeckCategory
  ): AsyncResult<DeckDTO> {
    try {
      await this.ensureConnection();
      const db = await this.getDb();

      const { Deck } = await import('@/models/Deck');

      const deck = await Deck.findOne({
        publicId,
        userId: new mongoose.Types.ObjectId(userId),
      });

      if (!deck) {
        return { success: false, error: 'Deck not found or access denied' };
      }

      // Fetch new printing details
      const printingsCollection = db.collection('printings');
      const newPrintingDoc = await printingsCollection.findOne({
        printing_id: newPrintingId,
      });

      if (!newPrintingDoc) {
        return { success: false, error: 'New printing not found' };
      }

      const categoryArray = deck[category] as any[];
      if (!categoryArray) {
        return { success: false, error: `Category ${category} not found` };
      }

      const index = categoryArray.findIndex((p: any) => p.printingId === oldPrintingId);
      if (index === -1) {
        return { success: false, error: 'Original printing not found in deck' };
      }

      // Swap the printing
      categoryArray[index] = {
        printingId: newPrintingId,
        condition: categoryArray[index].condition || 'NM',
        notes: categoryArray[index].notes || '',
        addedAt: new Date(),
        printingDetails: newPrintingDoc,
      };

      deck.updatedAt = new Date();
      await deck.save();

      return { success: true, data: this.toDTO(deck) };
    } catch (error) {
      console.error('[MongoDeckService.swapPrinting] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to swap printing',
      };
    }
  }

  /**
   * Batch update printing properties (category, condition, notes)
   */
  async updatePrintings(
    publicId: string,
    userId: string,
    updates: UpdatePrintingDTO[]
  ): AsyncResult<BatchUpdatePrintingsResultDTO> {
    try {
      await this.ensureConnection();

      const { Deck } = await import('@/models/Deck');

      const deck = await Deck.findOne({
        publicId,
        userId: new mongoose.Types.ObjectId(userId),
      });

      if (!deck) {
        return { success: false, error: 'Deck not found or access denied' };
      }

      // Initialize printings array if it doesn't exist
      if (!deck.printings) {
        deck.printings = [];
      }

      const results: UpdatePrintingResultDTO[] = [];
      let totalCardsUpdated = 0;

      // Process each update
      for (const item of updates) {
        if (!item.printingId || !item.updates || typeof item.updates !== 'object') {
          results.push({
            printingId: item.printingId,
            success: false,
            error: 'Missing printingId or updates object',
          });
          continue;
        }

        const { printingId, updates: updateData } = item;

        // Validate category if provided
        const validCategories = ['hero', 'equipment', 'main', 'sideboard'];
        if (updateData.category && !validCategories.includes(updateData.category)) {
          results.push({
            printingId,
            success: false,
            error: 'Invalid category. Must be: hero, equipment, main, or sideboard',
          });
          continue;
        }

        // Find matching cards to update
        const matchingCards = deck.printings.filter((card: any) => card.printingId === printingId);

        if (matchingCards.length === 0) {
          results.push({
            printingId,
            success: false,
            error: 'No matching cards found to update',
          });
          continue;
        }

        // Update all matching cards
        let updated = 0;
        matchingCards.forEach((card: any) => {
          if (updateData.category !== undefined) card.category = updateData.category;
          if (updateData.condition !== undefined) card.condition = updateData.condition;
          if (updateData.notes !== undefined) card.notes = updateData.notes;
          card.updatedAt = new Date();
          updated++;
        });

        totalCardsUpdated += updated;

        const cardName =
          matchingCards[0]?.printingDetails?.display_name ||
          matchingCards[0]?.printingDetails?.name ||
          'Unknown Card';

        results.push({
          printingId,
          success: true,
          action: 'updated',
          cardName,
          quantity: updated,
          updates: updateData,
        });
      }

      // Save deck if any cards were updated
      if (totalCardsUpdated > 0) {
        deck.updatedAt = new Date();
        await deck.save();
      }

      const summary = {
        total: results.length,
        updated: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        totalCardsUpdated,
      };

      return {
        success: summary.failed === 0,
        data: {
          summary,
          results,
          deck: {
            _id: deck._id.toString(),
            name: deck.name,
            updatedAt: deck.updatedAt,
          },
        },
      };
    } catch (error) {
      console.error('[MongoDeckService.updatePrintings] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update printings',
      };
    }
  }

  // ====================================
  // Bulk Operations
  // ====================================

  /**
   * Bulk import printings to a deck
   */
  async bulkImport(
    publicId: string,
    userId: string,
    printings: AddPrintingDTO[]
  ): AsyncResult<BulkImportResultDTO> {
    // Reuse addPrintings which handles bulk operations
    return this.addPrintings(publicId, userId, printings);
  }

  /**
   * Import an allocation structure to a deck
   */
  async importAllocation(
    publicId: string,
    userId: string,
    allocation: AllocationDTO
  ): AsyncResult<DeckDTO> {
    try {
      // Flatten allocation into printings array
      const printings: AddPrintingDTO[] = [];

      const categories: (keyof AllocationDTO)[] = [
        'hero', 'equipment', 'maindeck', 'inventory', 'maybeboard', 'tokens'
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
      console.error('[MongoDeckService.importAllocation] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import allocation',
      };
    }
  }

  // ====================================
  // Analysis & Comparison
  // ====================================

  /**
   * Get ownership status for a list of printings
   */
  async getOwnershipStatus(
    userId: string,
    printingIds: string[]
  ): AsyncResult<OwnershipStatusDTO[]> {
    try {
      const db = await this.getDb();

      const inventoryCollection = db.collection('inventory_items');

      const pipeline = [
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            printingId: { $in: printingIds },
            quantity: { $gt: 0 },
          },
        },
        {
          $lookup: {
            from: 'binders',
            localField: 'binderId',
            foreignField: '_id',
            as: 'binder',
          },
        },
        {
          $unwind: { path: '$binder', preserveNullAndEmptyArrays: true },
        },
        {
          $match: {
            'binder.isArchived': { $ne: true },
          },
        },
        {
          $group: {
            _id: '$printingId',
            owned: { $sum: '$quantity' },
            forTrade: {
              $sum: {
                $cond: [{ $eq: ['$forTrade', true] }, '$quantity', 0],
              },
            },
            conditions: { $addToSet: '$condition' },
            binderNames: { $addToSet: '$binder.name' },
          },
        },
      ];

      const results = await inventoryCollection.aggregate(pipeline).toArray();

      // Create a map of results
      const resultMap = new Map(results.map((r: any) => [r._id, r]));

      // Return status for each requested printingId
      const statuses: OwnershipStatusDTO[] = printingIds.map((printingId) => {
        const result = resultMap.get(printingId);
        return {
          printingId,
          owned: result?.owned || 0,
          forTrade: result?.forTrade || 0,
          conditions: result?.conditions?.filter(Boolean) || [],
          binderNames: result?.binderNames?.filter(Boolean) || [],
        };
      });

      return { success: true, data: statuses };
    } catch (error) {
      console.error('[MongoDeckService.getOwnershipStatus] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get ownership status',
      };
    }
  }

  /**
   * Compare a deck against user's inventory
   */
  async getInventoryComparison(
    publicId: string,
    userId: string,
    options?: { binderMode?: 'all' | 'specific'; binderId?: string }
  ): AsyncResult<InventoryComparisonDTO> {
    try {
      await this.ensureConnection();
      const db = await this.getDb();

      const { Deck } = await import('@/models/Deck');

      // Try finding by publicId first (primary identifier)
      let deck = await Deck.findOne({ publicId });

      // If not found and identifier is a valid ObjectId, try finding by _id
      if (!deck && mongoose.Types.ObjectId.isValid(publicId)) {
        deck = await Deck.findOne({ _id: new mongoose.Types.ObjectId(publicId) });
      }

      if (!deck) {
        return { success: false, error: 'Deck not found' };
      }

      // Get all printings from deck (excluding inventory/maybeboard/tokens)
      const deckPrintings = [
        ...(deck.hero || []),
        ...(deck.equipment || []),
        ...(deck.maindeck || []),
      ];

      // Count needed by printingId
      const neededMap = new Map<string, { count: number; cardName: string; tcgMarket?: number }>();
      for (const p of deckPrintings) {
        const existing = neededMap.get(p.printingId);
        if (existing) {
          existing.count++;
        } else {
          neededMap.set(p.printingId, {
            count: 1,
            cardName: p.printingDetails?.display_name || p.printingDetails?.name || p.printingId,
            tcgMarket: p.printingDetails?.tcg_market,
          });
        }
      }

      // Get ownership status
      const printingIds = [...neededMap.keys()];
      const ownershipResult = await this.getOwnershipStatus(userId, printingIds);
      if (!ownershipResult.success) {
        return { success: false, error: ownershipResult.error };
      }

      const ownershipMap = new Map(
        ownershipResult.data.map((o) => [o.printingId, o])
      );

      // Build comparison arrays
      const owned: InventoryComparisonDTO['owned'] = [];
      const missing: InventoryComparisonDTO['missing'] = [];
      const partial: InventoryComparisonDTO['partial'] = [];

      let totalNeeded = 0;
      let totalOwned = 0;
      let totalMissing = 0;
      let estimatedMissingValue = 0;

      for (const [printingId, needed] of neededMap) {
        const ownership = ownershipMap.get(printingId);
        const ownedCount = ownership?.owned || 0;

        totalNeeded += needed.count;

        if (ownedCount >= needed.count) {
          // Fully owned
          totalOwned += needed.count;
          owned.push({
            printingId,
            cardName: needed.cardName,
            needed: needed.count,
            owned: ownedCount,
            conditions: ownership?.conditions || [],
            binderNames: ownership?.binderNames || [],
          });
        } else if (ownedCount > 0) {
          // Partially owned
          totalOwned += ownedCount;
          const shortage = needed.count - ownedCount;
          totalMissing += shortage;
          estimatedMissingValue += (needed.tcgMarket || 0) * shortage;
          partial.push({
            printingId,
            cardName: needed.cardName,
            needed: needed.count,
            owned: ownedCount,
            shortage,
          });
        } else {
          // Not owned
          totalMissing += needed.count;
          estimatedMissingValue += (needed.tcgMarket || 0) * needed.count;
          missing.push({
            printingId,
            cardName: needed.cardName,
            needed: needed.count,
            tcgMarket: needed.tcgMarket,
          });
        }
      }

      const completionPercentage = totalNeeded > 0
        ? Math.round((totalOwned / totalNeeded) * 100)
        : 100;

      return {
        success: true,
        data: {
          owned,
          missing,
          partial,
          summary: {
            totalNeeded,
            totalOwned,
            totalMissing,
            completionPercentage,
            estimatedMissingValue,
          },
        },
      };
    } catch (error) {
      console.error('[MongoDeckService.getInventoryComparison] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to compare inventory',
      };
    }
  }

  /**
   * Calculate deck statistics
   */
  async calculateStats(
    publicId: string
  ): AsyncResult<DeckStatsDTO> {
    try {
      await this.ensureConnection();

      const { Deck } = await import('@/models/Deck');

      const deck = await Deck.findOne({ publicId });
      if (!deck) {
        return { success: false, error: 'Deck not found' };
      }

      return { success: true, data: this.calculateStatsFromDeck(deck) };
    } catch (error) {
      console.error('[MongoDeckService.calculateStats] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate stats',
      };
    }
  }

  // ====================================
  // Utilities
  // ====================================

  /**
   * Generate a unique slug for a deck
   */
  async generateUniqueSlug(
    userId: string,
    baseName: string
  ): AsyncResult<string> {
    try {
      await this.ensureConnection();

      const { Deck } = await import('@/models/Deck');

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
        const existingDeck = await Deck.findOne({
          userId: new mongoose.Types.ObjectId(userId),
          slug,
        });

        if (!existingDeck) {
          break;
        }

        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      return { success: true, data: slug };
    } catch (error) {
      console.error('[MongoDeckService.generateUniqueSlug] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate slug',
      };
    }
  }

  /**
   * Validate a deck against its format rules
   */
  async validateFormat(
    publicId: string
  ): AsyncResult<{ isLegal: boolean; errors: string[] }> {
    try {
      await this.ensureConnection();

      const { Deck } = await import('@/models/Deck');

      const deck = await Deck.findOne({ publicId });
      if (!deck) {
        return { success: false, error: 'Deck not found' };
      }

      const result = await deck.validateFormat();

      return { success: true, data: result };
    } catch (error) {
      console.error('[MongoDeckService.validateFormat] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate format',
      };
    }
  }
}
