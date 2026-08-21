/**
 * Daily Movers Service contract.
 *
 * Reads the daily_movers analytical results table (populated by the
 * Python pipeline's compute_movers step — see pipeline/scripts/) and joins
 * to the user's inventory + cards/printings + binders + decks for app
 * consumption.
 *
 * The service is read-only — daily_movers is never written from app code.
 */

import type { AsyncResult } from './common';

export type SignalType = 'top_gainer' | 'top_decliner' | 'breakout' | 'steady_riser';

export interface DeckMembershipDTO {
  deckId: string;
  publicId: string;
  deckName: string;
}

export interface DailyMoverDTO {
  printingId: string;
  signalType: SignalType;
  rankInSignal: number | null;

  // Card / printing display
  displayName: string;
  set: string;
  edition: string;
  foiling: string;
  rarity: string;
  imageUrl: string | null;
  tcgplayerUrl: string | null;

  // Price movement
  pAtSignal: number;
  refPrice: number | null;
  dollarChange: number | null;
  pctChange: number | null;

  // Inventory context
  quantity: number;
  binderId: string;
  binderName: string;

  // Dollar impact on the user's holdings: dollarChange × quantity.
  // Null when the pipeline produced no dollarChange for the signal.
  dollarImpact: number | null;

  // The user's own (non-system) decks containing this printing (any category)
  decks: DeckMembershipDTO[];
}

/** A mover without inventory context — the site-wide market view. */
export type MarketMoverDTO = Omit<
  DailyMoverDTO,
  'quantity' | 'binderId' | 'binderName' | 'dollarImpact' | 'decks'
>;

export interface MoversInCollectionDTO {
  asOfDate: string;        // ISO date 'YYYY-MM-DD'
  totalCount: number;
  // Net movement across the user's holdings: Σ dollarChange × quantity over
  // distinct inventory rows (a printing appearing in two signals counts once).
  totalImpact: number;
  gainers: DailyMoverDTO[];
  decliners: DailyMoverDTO[];
  breakouts: DailyMoverDTO[];
  steadyRisers: DailyMoverDTO[];
}

export interface MarketMoversDTO {
  asOfDate: string;        // ISO date 'YYYY-MM-DD'
  totalCount: number;
  gainers: MarketMoverDTO[];
  decliners: MarketMoverDTO[];
  breakouts: MarketMoverDTO[];
  steadyRisers: MarketMoverDTO[];
}

export interface IDailyMoversService {
  /**
   * Returns all daily movers that intersect with the user's inventory_items,
   * for a given snapshot date (defaults to latest available).
   *
   * Sections are ordered by absolute dollarImpact (largest holdings movement
   * first), falling back to pipeline rank. Empty groups are returned as empty
   * arrays — never null.
   */
  getMoversInUserCollection(
    userId: string,
    asOfDate?: string,
  ): AsyncResult<MoversInCollectionDTO>;

  /**
   * Returns ALL daily movers for a given snapshot date (defaults to latest
   * available), regardless of ownership — the site-wide market view.
   * Sections are ordered by pipeline rank.
   */
  getMarketMovers(asOfDate?: string): AsyncResult<MarketMoversDTO>;
}
