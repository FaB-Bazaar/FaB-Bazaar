/**
 * Buy-list rollup math.
 *
 * Kept as pure functions in lib/ (not inside the web component) because
 * web-components/** matches no vitest project glob — see vitest.config.ts.
 * The Lit element and the API route both call into here.
 *
 * A buy list is not a decklist: quantities are ranges ("2-3x"), cards nest into
 * purchasable groups ("3x Steel Soul Set"), and every total is money. Prices
 * come off tcg_low, falling back to tcg_market only when tcg_low is absent —
 * never the reverse (see the pricing rule in CLAUDE.md).
 */

export type QuantitySpec = number | string;

export interface QuantityRange {
  min: number;
  max: number;
}

/** Money is summed in cents and rounded once per step so 7.99 * 3 stays 23.97. */
function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseQuantity(spec: QuantitySpec): QuantityRange {
  if (typeof spec === 'number') {
    if (!Number.isInteger(spec) || spec < 0) {
      throw new Error(`Invalid quantity: ${spec} must be a non-negative integer`);
    }
    return { min: spec, max: spec };
  }

  // Authors type "3x" and "2-3x" — accept the trailing multiplier mark.
  const cleaned = String(spec).trim().replace(/[xX]$/, '').trim();

  const range = cleaned.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    if (min > max) {
      throw new Error(`Invalid quantity range "${spec}": ${min} exceeds ${max}`);
    }
    return { min, max };
  }

  if (/^\d+$/.test(cleaned)) {
    const n = Number(cleaned);
    return { min: n, max: n };
  }

  throw new Error(`Unparseable quantity "${spec}"`);
}

/** Render a range back to the "3x" / "2-3x" form authors wrote. */
export function formatQuantity(qty: QuantityRange): string {
  return qty.min === qty.max ? `${qty.min}x` : `${qty.min}-${qty.max}x`;
}

export interface BuylistCardData {
  printingId: string;
  qty: QuantitySpec;
  /** Free-text annotation shown under the card row. */
  note?: string;
}

export interface BuylistGroupData {
  label: string;
  /** Free-text annotation shown under the package header. */
  note?: string;
  cards: BuylistCardData[];
}

export interface BuylistTierData {
  label: string;
  /** Free-text annotation shown under the tier header. */
  note?: string;
  groups: BuylistGroupData[];
}

export interface BuylistSectionData {
  tiers: BuylistTierData[];
}

export interface BuylistPrice {
  tcg_low?: number | null;
  tcg_market?: number | null;
}

export type BuylistPriceMap = Record<string, BuylistPrice>;
export type BuylistOwnedMap = Record<string, number>;

export interface BuylistRollupInput {
  prices: BuylistPriceMap;
  owned?: BuylistOwnedMap;
}

export interface RolledCard {
  printingId: string;
  qty: QuantityRange;
  unitPrice: number | null;
  priceIsFallback: boolean;
  subtotal: QuantityRange;
  owned: number;
  needed: QuantityRange;
  note?: string;
}

export interface RollupTotals {
  cost: QuantityRange;
  needCost: QuantityRange;
  ownedCopies: number;
  wantedCopies: QuantityRange;
  missingPrices: string[];
}

export interface RolledGroup {
  label: string;
  note?: string;
  qtyLabel: string | null;
  cards: RolledCard[];
  totals: RollupTotals;
}

export interface RolledTier {
  label: string;
  note?: string;
  groups: RolledGroup[];
  totals: RollupTotals;
}

export interface BuylistRollup {
  tiers: RolledTier[];
  totals: RollupTotals;
}

function emptyTotals(): RollupTotals {
  return {
    cost: { min: 0, max: 0 },
    needCost: { min: 0, max: 0 },
    ownedCopies: 0,
    wantedCopies: { min: 0, max: 0 },
    missingPrices: [],
  };
}

function sumTotals(parts: RollupTotals[]): RollupTotals {
  const total = emptyTotals();
  for (const part of parts) {
    total.cost.min = money(total.cost.min + part.cost.min);
    total.cost.max = money(total.cost.max + part.cost.max);
    total.needCost.min = money(total.needCost.min + part.needCost.min);
    total.needCost.max = money(total.needCost.max + part.needCost.max);
    total.ownedCopies += part.ownedCopies;
    total.wantedCopies.min += part.wantedCopies.min;
    total.wantedCopies.max += part.wantedCopies.max;
    total.missingPrices.push(...part.missingPrices);
  }
  return total;
}

/** tcg_low is THE price; tcg_market is a labelled fallback, never a substitute. */
function resolvePrice(price: BuylistPrice | undefined): {
  unitPrice: number | null;
  priceIsFallback: boolean;
} {
  if (price?.tcg_low != null) return { unitPrice: price.tcg_low, priceIsFallback: false };
  if (price?.tcg_market != null) return { unitPrice: price.tcg_market, priceIsFallback: true };
  return { unitPrice: null, priceIsFallback: false };
}

function rollCard(
  card: BuylistCardData,
  input: BuylistRollupInput
): { card: RolledCard; totals: RollupTotals } {
  const qty = parseQuantity(card.qty);
  const { unitPrice, priceIsFallback } = resolvePrice(input.prices[card.printingId]);
  const owned = input.owned?.[card.printingId] ?? 0;

  const needed = {
    min: Math.max(0, qty.min - owned),
    max: Math.max(0, qty.max - owned),
  };

  const subtotal = unitPrice == null
    ? { min: 0, max: 0 }
    : { min: money(unitPrice * qty.min), max: money(unitPrice * qty.max) };

  const needCost = unitPrice == null
    ? { min: 0, max: 0 }
    : { min: money(unitPrice * needed.min), max: money(unitPrice * needed.max) };

  return {
    card: {
      printingId: card.printingId,
      qty,
      unitPrice,
      priceIsFallback,
      subtotal,
      owned,
      needed,
      note: card.note,
    },
    totals: {
      cost: subtotal,
      needCost,
      // Capped at what the list actually wants, so progress reads "4 / 12",
      // not "14 / 12" for someone sitting on spares.
      ownedCopies: Math.min(owned, qty.max),
      wantedCopies: qty,
      missingPrices: unitPrice == null ? [card.printingId] : [],
    },
  };
}

function rollGroup(group: BuylistGroupData, input: BuylistRollupInput): RolledGroup {
  const rolled = group.cards.map(card => rollCard(card, input));
  const cards = rolled.map(r => r.card);

  // A group header only shows a quantity when every member shares it —
  // otherwise "3x Mage Set" would lie about the 1x member.
  const first = cards[0]?.qty;
  const uniform =
    cards.length > 0 && cards.every(c => c.qty.min === first.min && c.qty.max === first.max);

  return {
    label: group.label,
    note: group.note,
    qtyLabel: uniform ? formatQuantity(first) : null,
    cards,
    totals: sumTotals(rolled.map(r => r.totals)),
  };
}

export function rollupBuylist(
  section: BuylistSectionData,
  input: BuylistRollupInput
): BuylistRollup {
  const tiers: RolledTier[] = (section.tiers ?? []).map(tier => {
    const groups = (tier.groups ?? []).map(group => rollGroup(group, input));
    return {
      label: tier.label,
      note: tier.note,
      groups,
      totals: sumTotals(groups.map(g => g.totals)),
    };
  });

  return { tiers, totals: sumTotals(tiers.map(t => t.totals)) };
}
