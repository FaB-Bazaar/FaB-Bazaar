/**
 * PostgreSQL implementation of IDailyMoversService.
 *
 * Joins daily_movers (populated by the pipeline) with the user's
 * inventory_items + printings + cards + binders. Decks-containing-this-
 * printing context will be added in a subsequent iteration.
 */

import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import {
  dailyMovers,
  inventoryItems,
  printings,
  cards,
  binders,
} from '@/lib/postgres/schema';
import type {
  IDailyMoversService,
  DailyMoverDTO,
  MoversInCollectionDTO,
  SignalType,
} from '@/lib/services/contracts/IDailyMoversService';
import type { AsyncResult } from '@/lib/services/contracts/common';

export class PostgresDailyMoversService implements IDailyMoversService {
  async getMoversInUserCollection(
    userId: string,
    asOfDate?: string,
  ): AsyncResult<MoversInCollectionDTO> {
    try {
      const effectiveDate = asOfDate ?? (await this.getLatestAsOfDate());
      const empty: MoversInCollectionDTO = {
        asOfDate: effectiveDate ?? '',
        totalCount: 0,
        gainers: [],
        decliners: [],
        breakouts: [],
        steadyRisers: [],
      };
      if (!effectiveDate) return { success: true, data: empty };

      const rows = await db
        .selectDistinct({
          printingId: dailyMovers.printingId,
          signalType: dailyMovers.signalType,
          rankInSignal: dailyMovers.rankInSignal,
          pAtSignal: dailyMovers.pAtSignal,
          refPrice: dailyMovers.refPrice,
          dollarChange: dailyMovers.dollarChange,
          pctChange: dailyMovers.pctChange,
          displayName: cards.displayName,
          set: printings.set,
          edition: printings.edition,
          foiling: printings.foiling,
          rarity: printings.rarity,
          imageUrl: printings.imageUrl,
          tcgplayerUrl: printings.tcgplayerUrl,
          quantity: inventoryItems.quantity,
          binderId: binders.id,
          binderName: binders.name,
        })
        .from(dailyMovers)
        .innerJoin(inventoryItems, eq(inventoryItems.printingId, dailyMovers.printingId))
        .innerJoin(printings, eq(printings.printingId, dailyMovers.printingId))
        .innerJoin(cards, eq(cards.cardUniqueId, printings.cardUniqueId))
        .innerJoin(binders, eq(binders.id, inventoryItems.binderId))
        .where(
          and(
            eq(dailyMovers.asOfDate, effectiveDate),
            eq(inventoryItems.userId, userId),
          ),
        );

      const groups: Record<SignalType, DailyMoverDTO[]> = {
        top_gainer: [],
        top_decliner: [],
        breakout: [],
        steady_riser: [],
      };

      for (const r of rows) {
        const sig = r.signalType as SignalType;
        if (!groups[sig]) continue;
        groups[sig].push({
          printingId: r.printingId,
          signalType: sig,
          rankInSignal: r.rankInSignal,
          displayName: r.displayName,
          set: r.set,
          edition: r.edition,
          foiling: r.foiling,
          rarity: r.rarity,
          imageUrl: r.imageUrl,
          tcgplayerUrl: r.tcgplayerUrl,
          pAtSignal: parseFloat(r.pAtSignal),
          refPrice: r.refPrice !== null ? parseFloat(r.refPrice) : null,
          dollarChange: r.dollarChange !== null ? parseFloat(r.dollarChange) : null,
          pctChange: r.pctChange !== null ? parseFloat(r.pctChange) : null,
          quantity: r.quantity,
          binderId: r.binderId,
          binderName: r.binderName,
          decks: [],
        });
      }

      for (const k of Object.keys(groups) as SignalType[]) {
        groups[k].sort((a, b) => (a.rankInSignal ?? 999) - (b.rankInSignal ?? 999));
      }

      const totalCount =
        groups.top_gainer.length +
        groups.top_decliner.length +
        groups.breakout.length +
        groups.steady_riser.length;

      return {
        success: true,
        data: {
          asOfDate: effectiveDate,
          totalCount,
          gainers: groups.top_gainer,
          decliners: groups.top_decliner,
          breakouts: groups.breakout,
          steadyRisers: groups.steady_riser,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async getLatestAsOfDate(): Promise<string | null> {
    const result = await db
      .select({ d: sql<string>`max(${dailyMovers.asOfDate})` })
      .from(dailyMovers);
    return result[0]?.d ?? null;
  }
}
