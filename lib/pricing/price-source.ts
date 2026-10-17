/**
 * Which market a viewer's prices come from: TCGplayer $ (default) or Cardmarket €
 * (users.cardmarket_prices, migration 0126). One source per screen — a price,
 * total, sort or "cheapest" never mixes the two, and never falls back across them.
 */
export type PriceSource = 'tcgplayer' | 'cardmarket';

export interface PricedCard {
  tcg_low?: number | null;
  cardmarket_price?: number | null;
}

/** THE price of a card for this viewer: tcg_low, or the Cardmarket price (trend, else low). */
export function cardPrice(card: PricedCard, source: PriceSource): number | undefined {
  const price = source === 'cardmarket' ? card.cardmarket_price : card.tcg_low;
  return typeof price === 'number' ? price : undefined;
}

const FORMATTERS: Record<PriceSource, Intl.NumberFormat> = {
  tcgplayer: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
  cardmarket: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }),
};

export function formatPrice(amount: number, source: PriceSource): string {
  return FORMATTERS[source].format(amount);
}

const PRICE_SORTS: Record<PriceSource, { desc: string; asc: string }> = {
  tcgplayer: { desc: 'tcg-low-desc', asc: 'tcg-low-asc' },
  cardmarket: { desc: 'cardmarket-desc', asc: 'cardmarket-asc' },
};

/** A "price" sort follows the viewer's source (same direction); other sorts are untouched. */
export function sortForSource(sortBy: string, source: PriceSource): string {
  for (const sorts of Object.values(PRICE_SORTS)) {
    if (sortBy === sorts.desc) return PRICE_SORTS[source].desc;
    if (sortBy === sorts.asc) return PRICE_SORTS[source].asc;
  }
  return sortBy;
}

/** A binder's total for this viewer: the TCG Low total or the € total. */
export function binderValue(
  totalValue: { tcg_low?: number; cardmarket?: number } | undefined,
  source: PriceSource,
): number {
  return (source === 'cardmarket' ? totalValue?.cardmarket : totalValue?.tcg_low) || 0;
}
