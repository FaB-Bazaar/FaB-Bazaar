/**
 * MongoDB implementation of Trade Matching Service
 *
 * Retrieves pre-calculated trade matches from the trade_matches collection
 * and enriches them with inventory item details.
 */

import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import type {
  ITradeMatchingService,
  TradeOpportunitiesDTO,
  TradePartnerDTO,
  CardMatchDTO,
} from '../../contracts/ITradeMatchingService';
import type { AsyncResult } from '../../contracts/common';

export class MongoTradeMatchingService implements ITradeMatchingService {
  /**
   * Ensures database connection before operations
   */
  private async ensureConnection(): Promise<mongoose.Connection['db']> {
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    return db;
  }

  /**
   * Helper function to safely extract numbers from MongoDB's various number formats
   */
  private getNumber(value: any): number {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'object' && value !== null) {
      if ('$numberDouble' in value) return parseFloat(value.$numberDouble);
      if ('$numberInt' in value) return parseInt(value.$numberInt, 10);
      if ('$numberLong' in value) return parseInt(value.$numberLong, 10);
    }
    return 0;
  }

  /**
   * Convert user ID to ObjectId
   */
  private toObjectId(userId: string | mongoose.Types.ObjectId): mongoose.Types.ObjectId {
    if (typeof userId === 'string') {
      return new mongoose.Types.ObjectId(userId);
    }
    return userId;
  }

  /**
   * Enrich card match with inventory item data
   */
  private enrichCardMatch(card: any, inventoryItem: any | null): CardMatchDTO {
    return {
      card_unique_id: card.card_unique_id,
      card_name: card.card_name,
      wanted_printing_id: card.wanted_printing_id,
      inventory_item_id: card.inventory_item_id?.toString(),
      owned_printing_id: card.owned_printing_id,
      owned_printing_name: card.owned_printing_name,
      quantity: this.getNumber(card.quantity),
      condition: card.condition,
      language: card.language,
      // Add denormalized fields from inventory_items
      ...(inventoryItem && {
        image_url: inventoryItem.image_url,
        display_name: inventoryItem.display_name,
        set: inventoryItem.set,
        edition: inventoryItem.edition,
        foiling: inventoryItem.foiling,
        rarity: inventoryItem.rarity,
        type_text: inventoryItem.type_text,
        tcg_low: this.getNumber(inventoryItem.tcg_low),
        tcg_mid: this.getNumber(inventoryItem.tcg_mid),
        tcg_high: this.getNumber(inventoryItem.tcg_high),
        tcg_market: this.getNumber(inventoryItem.tcg_market),
        tcgplayer_url: inventoryItem.tcgplayer_url,
        binder_name: inventoryItem.binderName,
        binder_slug: inventoryItem.binderSlug,
        binder_id: inventoryItem.binderId?.toString(),
        printing_card_id: inventoryItem.collector_number,
        forTrade: inventoryItem.forTrade || false,
      }),
    };
  }

  /**
   * Get trade opportunities for a specific user
   */
  async getTradeOpportunities(
    userId: string | mongoose.Types.ObjectId
  ): AsyncResult<TradeOpportunitiesDTO | null> {
    try {
      const db = await this.ensureConnection();
      const userObjectId = this.toObjectId(userId);

      // Query the trade_matches collection for this user
      const tradeMatchesCollection = db.collection('trade_matches');
      const tradeMatch = await tradeMatchesCollection.findOne({
        wanter_user_id: userObjectId,
      });

      // If no trade matches found, return null
      if (!tradeMatch) {
        return {
          success: true,
          data: null,
        };
      }

      const allPartners = tradeMatch.trade_partners || [];

      // Collect all inventory_item_ids from all partners
      const inventoryItemIds: mongoose.Types.ObjectId[] = [];
      allPartners.forEach((partner: any) => {
        (partner.card_matches || []).forEach((card: any) => {
          if (card.inventory_item_id) {
            try {
              inventoryItemIds.push(new mongoose.Types.ObjectId(card.inventory_item_id));
            } catch (e) {
              // Skip invalid ObjectIds
            }
          }
        });
      });

      // Fetch all inventory items in one query
      const inventoryItemsCollection = db.collection('inventory_items');
      const inventoryItems = await inventoryItemsCollection
        .find({
          _id: { $in: inventoryItemIds },
        })
        .toArray();

      // Create a map for quick lookup: inventory_item_id -> inventory_item
      const inventoryItemMap = new Map();
      inventoryItems.forEach((item: any) => {
        inventoryItemMap.set(item._id.toString(), item);
      });

      // Enrich card_matches with inventory item data
      const enrichedPartners: TradePartnerDTO[] = allPartners.map((partner: any) => {
        const enrichedCardMatches = (partner.card_matches || []).map((card: any) => {
          const inventoryItemId = card.inventory_item_id?.toString();
          const inventoryItem = inventoryItemId ? inventoryItemMap.get(inventoryItemId) : null;
          return this.enrichCardMatch(card, inventoryItem);
        });

        const enrichedExactMatches = (partner.exact_printing_matches || []).map((card: any) => {
          const inventoryItemId = card.inventory_item_id?.toString();
          const inventoryItem = inventoryItemId ? inventoryItemMap.get(inventoryItemId) : null;
          return this.enrichCardMatch(card, inventoryItem);
        });

        return {
          owner_user_id: partner.owner_user_id?.toString(),
          owner_username: partner.owner_username,
          card_matches: enrichedCardMatches,
          exact_printing_matches: enrichedExactMatches,
        };
      });

      const result: TradeOpportunitiesDTO = {
        id: tradeMatch._id.toString(),
        wanter_user_id: tradeMatch.wanter_user_id.toString(),
        wanter_username: tradeMatch.wanter_username,
        wantslist_id: tradeMatch.wantslist_id?.toString(),
        analyzed_at: tradeMatch.analyzed_at,
        total_partners: this.getNumber(tradeMatch.total_partners),
        total_card_matches: this.getNumber(tradeMatch.total_card_matches),
        total_exact_matches: this.getNumber(tradeMatch.total_exact_matches),
        trade_partners: enrichedPartners,
      };

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('[MongoTradeMatchingService] getTradeOpportunities error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch trade opportunities',
      };
    }
  }
}
