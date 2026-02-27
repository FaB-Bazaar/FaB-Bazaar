/**
 * MongoDB implementation of Featured Cards Service
 *
 * Generates and caches featured cards for the homepage.
 * Runs aggregation pipelines to find high-value tradeable cards.
 */

import connectToDatabase from '@/lib/mongodb';
import type {
  IFeaturedCardsService,
  FeaturedCardDTO,
  FeaturedCardsRefreshResultDTO,
  FeaturedCardsCacheDTO,
} from '../../contracts/IFeaturedCardsService';
import type { AsyncResult } from '../../contracts/common';

export class MongoFeaturedCardsService implements IFeaturedCardsService {
  /**
   * Ensures database connection before operations
   */
  private async ensureConnection() {
    const { db } = await connectToDatabase();
    if (!db) {
      throw new Error('Database connection not established');
    }
    return db;
  }

  /**
   * Set quotas for featured cards per set
   */
  private getSetQuotas(): { code: string; limit: number }[] {
    return [
      { code: 'sea', limit: 3 },
      { code: 'sup', limit: 4 },
      { code: 'hnt', limit: 3 },
      { code: 'wtr', limit: 3 },
      { code: 'arc', limit: 3 },
      { code: 'anq', limit: 4 },
      { code: 'pen', limit: 4 },
    ];
  }

  /**
   * Check if a set uses rarity-based filtering (instead of price-based)
   */
  private isRarityBasedSet(setCode: string): boolean {
    return ['anq', 'pen'].includes(setCode);
  }

  /**
   * Build aggregation pipeline for a set
   */
  private buildSetPipeline(setCode: string, limit: number): any[] {
    // Base match criteria (common to all sets)
    const baseMatch = {
      set: setCode,
      forTrade: true,
      printingId: { $exists: true, $ne: null },
      card_unique_id: { $exists: true, $ne: null },
      image_url: { $exists: true, $ne: null, $ne: '' },
      display_name: { $exists: true, $ne: null, $ne: '' },
      binderAllowWhoHas: true,
    };

    // Conditional filtering: rarity-based (anq, pen) vs price-based (others)
    const matchStage = this.isRarityBasedSet(setCode)
      ? { ...baseMatch, rarity: { $in: ['l', 'f', 'v'] } }
      : { ...baseMatch, tcg_market: { $gte: 15 } };

    return [
      {
        $match: matchStage,
      },
      // First, group by printingId to get stats per printing
      {
        $group: {
          _id: '$printingId',
          uniqueOwners: { $addToSet: '$userId' },
          card_unique_id: { $first: '$card_unique_id' },
          display_name: { $first: '$display_name' },
          set: { $first: '$set' },
          foiling: { $first: '$foiling' },
          rarity: { $first: '$rarity' },
          edition: { $first: '$edition' },
          tcg_market: { $max: '$tcg_market' },
          image_url: { $first: '$image_url' },
          totalQuantity: { $sum: '$quantity' },
        },
      },
      {
        $addFields: {
          uniqueOwnersCount: { $size: '$uniqueOwners' },
          featuredScore: {
            $multiply: ['$tcg_market', { $add: [{ $size: '$uniqueOwners' }, 1] }],
          },
        },
      },
      {
        $match: {
          uniqueOwnersCount: { $gte: 1 },
        },
      },
      // Sort by featured score to get best printings first
      { $sort: { featuredScore: -1 } },
      // Group by card_unique_id to ensure only ONE printing per card
      // This prevents duplicates like "Quickledge Flexors (Cold Foil)" and "Quickledge Flexors (Rainbow Foil)"
      {
        $group: {
          _id: '$card_unique_id',
          // Keep the printing with highest featuredScore (first in sorted order)
          printing_id: { $first: '$_id' },
          card_unique_id: { $first: '$card_unique_id' },
          name: { $first: '$display_name' },
          set: { $first: '$set' },
          foiling: { $first: '$foiling' },
          rarity: { $first: '$rarity' },
          edition: { $first: '$edition' },
          tcg_market: { $first: '$tcg_market' },
          image_url: { $first: '$image_url' },
          uniqueOwners: { $first: '$uniqueOwnersCount' },
          totalQuantity: { $first: '$totalQuantity' },
          featuredScore: { $first: '$featuredScore' },
        },
      },
      // Re-sort after grouping and limit to the requested number
      { $sort: { featuredScore: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          printing_id: 1,
          card_unique_id: 1,
          name: 1,
          set: 1,
          foiling: 1,
          rarity: 1,
          edition: 1,
          tcg_market: 1,
          image_url: 1,
          uniqueOwners: 1,
          totalQuantity: 1,
          featuredScore: 1,
        },
      },
    ];
  }

  /**
   * Enrich card with TCGplayer URL and extended art flag
   */
  private async enrichCard(db: any, card: any): Promise<FeaturedCardDTO> {
    const coreData = await db
      .collection('printings_core')
      .findOne({ printing_id: card.printing_id }, { projection: { tcgplayer_url: 1, is_extended_art: 1 } });

    return {
      ...card,
      tcgplayer_url: coreData?.tcgplayer_url || null,
      is_extended_art: coreData?.is_extended_art || false,
    };
  }

  /**
   * Update system_info with refresh stats
   */
  private async updateSystemInfo(
    db: any,
    stats: {
      cardsRefreshed: number;
      setsProcessed: number;
      processingTimeSeconds: number;
      error?: string;
    }
  ): Promise<void> {
    const systemInfoUpdate = {
      _id: 'featured_cards_system',
      lastRefresh: new Date(),
      stats: {
        ...stats,
        nextScheduledRefresh: stats.error ? undefined : new Date(Date.now() + 12 * 60 * 60 * 1000),
      },
      updatedAt: new Date(),
    };

    await db.collection('system_info').replaceOne({ _id: 'featured_cards_system' }, systemInfoUpdate, {
      upsert: true,
    });
  }

  /**
   * Refresh featured cards cache
   */
  async refreshFeaturedCards(): AsyncResult<FeaturedCardsRefreshResultDTO> {
    const startTime = Date.now();

    try {
      const db = await this.ensureConnection();
      const now = new Date();

      console.log('[FeaturedCardsService] Starting featured cards refresh...');

      const setQuotas = this.getSetQuotas();
      const allFeaturedCards: any[] = [];

      // Process each set
      for (const { code, limit } of setQuotas) {
        const pipeline = this.buildSetPipeline(code, limit);

        const setResults = await db.collection('inventory_items').aggregate(pipeline).toArray();

        // Enrich with tcgplayer_url and is_extended_art from printings_core
        const enrichedResults = await Promise.all(
          setResults.map((card) => this.enrichCard(db, card))
        );

        console.log(
          `[FeaturedCardsService] Found ${setResults.length} cards from ${code}, enriched with TCGplayer data`
        );
        allFeaturedCards.push(...enrichedResults);
      }

      // Filter out cards without required fields
      const featuredCards = allFeaturedCards.filter(
        (card) => card.image_url && card.printing_id && card.card_unique_id
      );

      const processingTimeSeconds = (Date.now() - startTime) / 1000;

      console.log(`[FeaturedCardsService] Total featured cards: ${featuredCards.length}`);

      // Update featured cards cache
      await db.collection('featured_cards').replaceOne(
        { _id: 'homepage_featured' },
        {
          _id: 'homepage_featured',
          cards: featuredCards,
          lastUpdated: now,
          nextUpdate: new Date(now.getTime() + 12 * 60 * 60 * 1000),
        },
        { upsert: true }
      );

      // Update system_info collection with stats
      await this.updateSystemInfo(db, {
        cardsRefreshed: featuredCards.length,
        setsProcessed: setQuotas.length,
        processingTimeSeconds,
      });

      console.log('[FeaturedCardsService] Featured cards refresh completed:', {
        cardsRefreshed: featuredCards.length,
        processingTimeSeconds: processingTimeSeconds.toFixed(2),
      });

      return {
        success: true,
        data: {
          cardsRefreshed: featuredCards.length,
          setsProcessed: setQuotas.length,
          processingTimeSeconds: processingTimeSeconds.toFixed(2),
          timestamp: now.toISOString(),
        },
      };
    } catch (error) {
      console.error('[FeaturedCardsService] refreshFeaturedCards error:', error);

      // Update system_info with error status
      try {
        const db = await this.ensureConnection();
        await this.updateSystemInfo(db, {
          cardsRefreshed: 0,
          setsProcessed: 0,
          processingTimeSeconds: (Date.now() - startTime) / 1000,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } catch (systemInfoError) {
        console.error('[FeaturedCardsService] Failed to update system_info on error:', systemInfoError);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh featured cards',
      };
    }
  }

  /**
   * Get current featured cards from cache
   */
  async getFeaturedCards(): AsyncResult<FeaturedCardsCacheDTO | null> {
    try {
      const db = await this.ensureConnection();

      const cache = await db.collection('featured_cards').findOne({ _id: 'homepage_featured' });

      if (!cache) {
        return {
          success: true,
          data: null,
        };
      }

      return {
        success: true,
        data: {
          _id: cache._id,
          cards: cache.cards || [],
          lastUpdated: cache.lastUpdated,
          nextUpdate: cache.nextUpdate,
        },
      };
    } catch (error) {
      console.error('[FeaturedCardsService] getFeaturedCards error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get featured cards',
      };
    }
  }
}
