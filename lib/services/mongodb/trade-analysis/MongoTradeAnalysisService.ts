/**
 * MongoDB implementation of Trade Analysis Service
 *
 * Analyzes trade compatibility between two users in real-time.
 * Compares wants and inventory to calculate match rates and compatibility scores.
 */

import mongoose, { Document } from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import WantsItem from '@/models/WantsItem';
import type {
  ITradeAnalysisService,
  TradeAnalysisDTO,
  TradeAnalysisOptions,
  CardDetailDTO,
  MatchSummaryDTO,
  TradePotential,
  BalanceStatus,
} from '../../contracts/ITradeAnalysisService';
import type { AsyncResult } from '../../contracts/common';

// Expanded interface for InventoryItem to include all necessary fields
interface InventoryItem extends Document {
  _id: mongoose.Types.ObjectId;
  printingId?: string;
  card_unique_id?: string;
  quantity?: any;
  tcg_low?: any;
  tcg_mid?: any;
  tcg_high?: any;
  tcg_market?: any;
  forTrade?: boolean;
  binderId?: mongoose.Types.ObjectId;
  display_name?: string;
  name?: string;
  set?: string;
  foiling?: string;
  edition?: string;
  rarity?: string;
  image_url?: string;
}

export class MongoTradeAnalysisService implements ITradeAnalysisService {
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
  private toObjectId(userId: string): mongoose.Types.ObjectId {
    return new mongoose.Types.ObjectId(userId);
  }

  /**
   * Build inventory map keyed by printing ID or card unique ID
   */
  private buildInventoryMap(
    inventory: InventoryItem[],
    matchOnPrintingId: boolean
  ): Map<string, InventoryItem[]> {
    const map = new Map<string, InventoryItem[]>();
    inventory.forEach((item) => {
      const key = (matchOnPrintingId ? item.printingId : item.card_unique_id)?.toLowerCase();
      if (key) {
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
      }
    });
    return map;
  }

  /**
   * Calculate matches between wants and inventory
   */
  private calculateMatches(
    wants: any[],
    inventoryMap: Map<string, InventoryItem[]>,
    matchOnPrintingId: boolean,
    includeCards: boolean
  ): {
    count: number;
    totalQuantity: number;
    totalValue: number;
    details: CardDetailDTO[];
  } {
    let count = 0;
    let totalQuantity = 0;
    let totalValue = 0;
    const details: CardDetailDTO[] = [];

    for (const want of wants) {
      const lookupKey = matchOnPrintingId ? want.printingId : want.cardId;
      if (!lookupKey) continue;

      const matchingItems = inventoryMap.get(lookupKey.toLowerCase()) || [];

      if (matchingItems.length > 0) {
        let wantedQuantity = this.getNumber(want.quantity || 1);
        const availableQuantity = matchingItems.reduce(
          (sum, item) => sum + this.getNumber(item.quantity),
          0
        );

        if (Math.min(wantedQuantity, availableQuantity) > 0) {
          count++;

          matchingItems.sort((a, b) => this.getNumber(a.tcg_low) - this.getNumber(b.tcg_low));

          for (const item of matchingItems) {
            if (wantedQuantity <= 0) break;

            const itemAvailableQty = this.getNumber(item.quantity);
            const quantityToFulfillFromThisItem = Math.min(wantedQuantity, itemAvailableQty);

            totalQuantity += quantityToFulfillFromThisItem;
            const unitPrice = this.getNumber(item.tcg_low || 0);
            const valueForThisItem = unitPrice * quantityToFulfillFromThisItem;
            totalValue += valueForThisItem;

            if (includeCards) {
              details.push({
                inventoryId: item._id.toString(),
                name: item.display_name || item.name || '',
                printingId: item.printingId,
                set: item.set,
                foiling: item.foiling,
                edition: item.edition,
                rarity: item.rarity,
                quantity: quantityToFulfillFromThisItem,
                unitValue: unitPrice,
                totalValue: valueForThisItem,
                image_url: item.image_url,
                pricing: {
                  tcg_low: this.getNumber(item.tcg_low || 0),
                  tcg_mid: this.getNumber(item.tcg_mid || 0),
                  tcg_high: this.getNumber(item.tcg_high || 0),
                  tcg_market: this.getNumber(item.tcg_market || 0),
                },
              });
            }

            wantedQuantity -= quantityToFulfillFromThisItem;
          }
        }
      }
    }

    return { count, totalQuantity, totalValue, details };
  }

  /**
   * Calculate compatibility score based on multiple metrics
   */
  private calculateCompatibilityScore(metrics: {
    youHaveRate: number;
    theyHaveRate: number;
    youHaveCount: number;
    theyHaveCount: number;
    totalMutualCards: number;
    valueBalance: number;
  }): number {
    const { youHaveRate, theyHaveRate, youHaveCount, theyHaveCount, totalMutualCards, valueBalance } =
      metrics;

    const mutualInterestScore = Math.min(40, totalMutualCards * 4);
    const balanceScore =
      youHaveCount > 0 && theyHaveCount > 0 ? 30 - Math.abs(youHaveRate - theyHaveRate) / 4 : 0;
    const rateScore = ((youHaveRate + theyHaveRate) / 2) * 0.2;
    const valueScore = valueBalance < 10 ? 10 : Math.max(0, 10 - valueBalance / 10);

    return Math.min(100, mutualInterestScore + balanceScore + rateScore + valueScore);
  }

  /**
   * Get trade potential from compatibility score
   */
  private getTradePotential(score: number): TradePotential {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Get balance status from value difference
   */
  private getBalanceStatus(valueDifference: number): BalanceStatus {
    if (Math.abs(valueDifference) < 5) return 'balanced';
    return valueDifference > 0 ? 'you_ahead' : 'they_ahead';
  }

  /**
   * Analyze trade compatibility between current user and target user
   */
  async analyzeTradeCompatibility(
    currentUserId: string,
    targetUserId: string,
    options: TradeAnalysisOptions = {}
  ): AsyncResult<TradeAnalysisDTO> {
    const { includeCards = false, format = 'full', matchOnPrintingId = true } = options;

    try {
      const db = await this.ensureConnection();

      const currentUserObjectId = this.toObjectId(currentUserId);
      const targetUserObjectId = this.toObjectId(targetUserId);

      const inventoryCollection = db.collection<InventoryItem>('inventory_items');
      const binderCollection = db.collection('binders');

      // Fetch wants items for both users in parallel
      const [targetWantsItems, currentUserWantsItems, currentUserAllowedBinderIds, targetUserAllowedBinderIds] =
        await Promise.all([
          WantsItem.find({
            userId: { $in: [this.toObjectId(targetUserId), targetUserObjectId] },
          }).lean(),
          WantsItem.find({
            userId: { $in: [this.toObjectId(currentUserId), currentUserObjectId] },
          }).lean(),
          binderCollection
            .find({
              $or: [{ userId: currentUserId }, { userId: currentUserObjectId }],
              'visibility.allowInMatching': true,
            })
            .project({ _id: 1 })
            .toArray(),
          binderCollection
            .find({
              $or: [{ userId: targetUserId }, { userId: targetUserObjectId }],
              'visibility.allowInMatching': true,
            })
            .project({ _id: 1 })
            .toArray(),
        ]);

      const currentUserBinderIds = currentUserAllowedBinderIds.map((b) => b._id);
      const targetUserBinderIds = targetUserAllowedBinderIds.map((b) => b._id);

      // Fetch all tradable inventory items from the allowed binders
      const [currentUserInventory, targetUserInventory] = await Promise.all([
        inventoryCollection.find({ forTrade: true, binderId: { $in: currentUserBinderIds } }).toArray(),
        inventoryCollection.find({ forTrade: true, binderId: { $in: targetUserBinderIds } }).toArray(),
      ]);

      const targetWantsCards = targetWantsItems;
      const currentUserWantsCards = currentUserWantsItems;

      const targetWantsTotalQuantity = targetWantsCards.reduce(
        (sum, card) => sum + this.getNumber(card.quantity || 1),
        0
      );
      const currentUserWantsTotalQuantity = currentUserWantsCards.reduce(
        (sum, card) => sum + this.getNumber(card.quantity || 1),
        0
      );

      const currentUserInventoryMap = this.buildInventoryMap(currentUserInventory, matchOnPrintingId);
      const targetUserInventoryMap = this.buildInventoryMap(targetUserInventory, matchOnPrintingId);

      const youHaveResult = this.calculateMatches(
        targetWantsCards,
        currentUserInventoryMap,
        matchOnPrintingId,
        includeCards
      );
      const theyHaveResult = this.calculateMatches(
        currentUserWantsCards,
        targetUserInventoryMap,
        matchOnPrintingId,
        includeCards
      );

      // Calculate overall match rates and scores
      const youHaveTheirWantsRate =
        targetWantsTotalQuantity > 0 ? (youHaveResult.totalQuantity / targetWantsTotalQuantity) * 100 : 0;
      const theyHaveYourWantsRate =
        currentUserWantsTotalQuantity > 0
          ? (theyHaveResult.totalQuantity / currentUserWantsTotalQuantity) * 100
          : 0;

      const compatibilityScore = this.calculateCompatibilityScore({
        youHaveRate: youHaveTheirWantsRate,
        theyHaveRate: theyHaveYourWantsRate,
        youHaveCount: youHaveResult.count,
        theyHaveCount: theyHaveResult.count,
        totalMutualCards: youHaveResult.count + theyHaveResult.count,
        valueBalance: Math.abs(youHaveResult.totalValue - theyHaveResult.totalValue),
      });

      const tradePotential = this.getTradePotential(compatibilityScore);
      const valueDifference = youHaveResult.totalValue - theyHaveResult.totalValue;
      const balanceStatus = this.getBalanceStatus(valueDifference);

      // Base response
      const baseResponse = {
        success: true as const,
        match_summary: {
          you_have_their_wants: {
            count: youHaveResult.count,
            total_quantity: youHaveResult.totalQuantity,
            total_value: Math.round(youHaveResult.totalValue * 100) / 100,
            rate: Math.round(youHaveTheirWantsRate * 10) / 10,
          },
          they_have_your_wants: {
            count: theyHaveResult.count,
            total_quantity: theyHaveResult.totalQuantity,
            total_value: Math.round(theyHaveResult.totalValue * 100) / 100,
            rate: Math.round(theyHaveYourWantsRate * 10) / 10,
          },
          compatibility_score: Math.round(compatibilityScore * 10) / 10,
        },
        trade_potential: tradePotential,
        quick_stats: {
          total_mutual_cards: youHaveResult.count + theyHaveResult.count,
          value_difference: Math.round(Math.abs(valueDifference) * 100) / 100,
          balance_status: balanceStatus,
          has_mutual_interest: youHaveResult.count > 0 && theyHaveResult.count > 0,
        },
      };

      // Format-specific responses
      if (format === 'quick') {
        return {
          success: true,
          data: {
            ...baseResponse,
            display: {
              compatibility_score: Math.round(compatibilityScore),
              trade_potential: tradePotential,
              mutual_cards: youHaveResult.count + theyHaveResult.count,
              value_difference: Math.round(Math.abs(valueDifference)),
            },
          },
        };
      }

      if (format === 'summary') {
        return {
          success: true,
          data: {
            ...baseResponse,
            ...(includeCards && {
              cards: {
                you_have_for_them: youHaveResult.details,
                they_have_for_you: theyHaveResult.details,
              },
            }),
          },
        };
      }

      // Full response
      return {
        success: true,
        data: {
          ...baseResponse,
          detailed_stats: {
            target_wants_total: targetWantsTotalQuantity,
            current_wants_total: currentUserWantsTotalQuantity,
            your_tradeable_cards: currentUserInventory.length,
            their_tradeable_cards: targetUserInventory.length,
          },
          ...(includeCards && {
            cards: {
              you_have_for_them: youHaveResult.details,
              they_have_for_you: theyHaveResult.details,
            },
          }),
        },
      };
    } catch (error) {
      console.error('[MongoTradeAnalysisService] analyzeTradeCompatibility error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze trade compatibility',
      };
    }
  }
}
