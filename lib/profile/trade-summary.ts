// lib/profile/trade-summary.ts
//
// Profile-level "for trade" totals, summed from the per-binder stats the
// profile page already loads. A binder that hides its value has no value
// fields: its cards still count, its value does not.

interface TradeBinder {
  quantityForTrade?: number;
  valueForTrade?: { tcg_low?: number };
}

export interface TradeSummary {
  cardsForTrade: number;
  /** tcg_low total, or null when no binder exposes a value. */
  valueForTrade: number | null;
}

export function summarizeTrade(binders: TradeBinder[]): TradeSummary {
  let cardsForTrade = 0;
  let value = 0;
  let anyValue = false;

  for (const binder of binders) {
    cardsForTrade += Number(binder.quantityForTrade) || 0;
    if (binder.valueForTrade) {
      anyValue = true;
      value += Number(binder.valueForTrade.tcg_low) || 0;
    }
  }

  return { cardsForTrade, valueForTrade: anyValue ? Math.round(value * 100) / 100 : null };
}
