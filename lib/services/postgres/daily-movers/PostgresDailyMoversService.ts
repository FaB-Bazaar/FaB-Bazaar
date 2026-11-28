/**
 * PostgreSQL implementation of IDailyMoversService.
 *
 * Joins daily_movers (populated by the pipeline) with the user's
 * inventory_items + printings + cards + binders + decks. Also exposes the
 * site-wide market view (no inventory join) for the two-tier /daily page.
 */

import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import {
  dailyMovers,
  inventoryItems,
  printings,
  cards,
  binders,
  decks,
  deckCards,
} from '@/lib/postgres/schema';
import type {
  IDailyMoversService,
  DailyMoverDTO,
  DeckMembershipDTO,
  MarketMoverDTO,
  MarketMoversDTO,
  MoversInCollectionDTO,
  SignalType,
} from '@/lib/services/contracts/IDailyMoversService';
import type { AsyncResult } from '@/lib/services/contracts/common';
import { steadyRiserNews, type SteadyRiserNews } from '@/lib/daily/steady-riser-news';

const EMPTY_GROUPS = (): Record<SignalType, never[]> => ({
  top_gainer: [],
  top_decliner: [],
  breakout: [],
  steady_riser: [],
});

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
        totalImpact: 0,
        dayImpact: 0,
        dayCount: 0,
        gainers: [],
        decliners: [],
        breakouts: [],
        steadyRisers: [],
      };
      if (!effectiveDate) return { success: true, data: empty };

      const rows = await db
        .selectDistinct({
          inventoryItemId: inventoryItems.id,
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

      // Decks context: the user's own (non-system) decks containing any mover
      // printing, once per (deck, printing) regardless of deck category.
      const moverPrintingIds = [...new Set(rows.map((r) => r.printingId))];
      const decksByPrinting = new Map<string, DeckMembershipDTO[]>();
      if (moverPrintingIds.length > 0) {
        const deckRows = await db
          .selectDistinct({
            printingId: deckCards.printingId,
            deckId: decks.id,
            publicId: decks.publicId,
            deckName: decks.name,
          })
          .from(deckCards)
          .innerJoin(decks, eq(decks.id, deckCards.deckId))
          .where(
            and(
              inArray(deckCards.printingId, moverPrintingIds),
              eq(decks.userId, userId),
              eq(decks.isSystemDeck, false),
            ),
          );
        for (const d of deckRows) {
          const list = decksByPrinting.get(d.printingId) ?? [];
          list.push({ deckId: d.deckId, publicId: d.publicId, deckName: d.deckName });
          decksByPrinting.set(d.printingId, list);
        }
      }

      const groups: Record<SignalType, DailyMoverDTO[]> = EMPTY_GROUPS();

      // A printing can appear under several signals (gainer AND breakout) —
      // the physical copies moved once, so totalImpact dedupes by inventory row.
      const impactByInventoryItem = new Map<string, number>();

      for (const r of rows) {
        const sig = r.signalType as SignalType;
        if (!groups[sig]) continue;
        const dollarChange = r.dollarChange !== null ? parseFloat(r.dollarChange) : null;
        const dollarImpact = dollarChange !== null ? dollarChange * r.quantity : null;
        if (dollarImpact !== null && !impactByInventoryItem.has(r.inventoryItemId)) {
          impactByInventoryItem.set(r.inventoryItemId, dollarImpact);
        }
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
          dollarChange,
          pctChange: r.pctChange !== null ? parseFloat(r.pctChange) : null,
          quantity: r.quantity,
          binderId: r.binderId,
          binderName: r.binderName,
          dollarImpact,
          decks: decksByPrinting.get(r.printingId) ?? [],
        });
      }

      // Largest movement in YOUR holdings first; pipeline rank breaks ties.
      for (const k of Object.keys(groups) as SignalType[]) {
        groups[k].sort((a, b) => {
          const ai = a.dollarImpact !== null ? Math.abs(a.dollarImpact) : -1;
          const bi = b.dollarImpact !== null ? Math.abs(b.dollarImpact) : -1;
          if (bi !== ai) return bi - ai;
          return (a.rankInSignal ?? 999) - (b.rankInSignal ?? 999);
        });
      }

      const totalImpact = [...impactByInventoryItem.values()].reduce((s, v) => s + v, 0);
      // Round away float-summation noise (values are dollars-and-cents).
      const totalImpactRounded = Math.round(totalImpact * 100) / 100;

      const totalCount =
        groups.top_gainer.length +
        groups.top_decliner.length +
        groups.breakout.length +
        groups.steady_riser.length;

      // Last night only (24-hour signals). A printing is a gainer or a
      // decliner, never both, so summing rows counts each holding once.
      const dayRows = [...groups.top_gainer, ...groups.top_decliner];
      const dayImpact = Math.round(dayRows.reduce((s, m) => s + (m.dollarImpact ?? 0), 0) * 100) / 100;
      const dayCount = new Set(dayRows.map((m) => m.printingId)).size;

      await this.attachSteadyRiserNews(effectiveDate, groups.steady_riser);

      return {
        success: true,
        data: {
          asOfDate: effectiveDate,
          totalCount,
          totalImpact: totalImpactRounded,
          dayImpact,
          dayCount,
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

  async getMarketMovers(asOfDate?: string): AsyncResult<MarketMoversDTO> {
    try {
      const effectiveDate = asOfDate ?? (await this.getLatestAsOfDate());
      const empty: MarketMoversDTO = {
        asOfDate: effectiveDate ?? '',
        totalCount: 0,
        gainers: [],
        decliners: [],
        breakouts: [],
        steadyRisers: [],
      };
      if (!effectiveDate) return { success: true, data: empty };

      const rows = await db
        .select({
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
        })
        .from(dailyMovers)
        .innerJoin(printings, eq(printings.printingId, dailyMovers.printingId))
        .innerJoin(cards, eq(cards.cardUniqueId, printings.cardUniqueId))
        .where(eq(dailyMovers.asOfDate, effectiveDate));

      const groups: Record<SignalType, MarketMoverDTO[]> = EMPTY_GROUPS();

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
        });
      }

      for (const k of Object.keys(groups) as SignalType[]) {
        groups[k].sort((a, b) => (a.rankInSignal ?? 999) - (b.rankInSignal ?? 999));
      }
      await this.attachSteadyRiserNews(effectiveDate, groups.steady_riser);

      return {
        success: true,
        data: {
          asOfDate: effectiveDate,
          totalCount: rows.length,
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

  /**
   * Marks each steady riser as news or a repeat (streak, flat-since) from the
   * last RUNS_BACK pipeline runs. Runs are distinct as_of_dates, so a night the
   * pipeline skipped doesn't break a streak. One query for the whole list.
   */
  private async attachSteadyRiserNews(
    effectiveDate: string,
    rows: Array<{ printingId: string; streakDays?: number; isNews?: boolean; flatSince?: string | null }>,
  ): Promise<void> {
    if (rows.length === 0) return;
    const RUNS_BACK = 40; // the signal's window is 30 days; a little margin
    const runRows = await db
      .selectDistinct({ d: dailyMovers.asOfDate })
      .from(dailyMovers)
      .where(sql`${dailyMovers.asOfDate} <= ${effectiveDate}`)
      .orderBy(sql`${dailyMovers.asOfDate} DESC`)
      .limit(RUNS_BACK);
    const runs = runRows.map((r) => String(r.d));
    const history = await db
      .select({ printingId: dailyMovers.printingId, asOfDate: dailyMovers.asOfDate, pAtSignal: dailyMovers.pAtSignal })
      .from(dailyMovers)
      .where(and(
        eq(dailyMovers.signalType, 'steady_riser'),
        inArray(dailyMovers.asOfDate, runs),
        inArray(dailyMovers.printingId, [...new Set(rows.map((r) => r.printingId))]),
      ));
    const news: Map<string, SteadyRiserNews> = steadyRiserNews(
      history.map((h) => ({ printingId: h.printingId, asOfDate: String(h.asOfDate), pAtSignal: parseFloat(h.pAtSignal) })),
      runs,
    );
    for (const r of rows) {
      const n = news.get(r.printingId);
      if (n) Object.assign(r, n);
    }
  }

  private async getLatestAsOfDate(): Promise<string | null> {
    const result = await db
      .select({ d: sql<string>`max(${dailyMovers.asOfDate})` })
      .from(dailyMovers);
    return result[0]?.d ?? null;
  }
}
