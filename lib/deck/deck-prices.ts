/**
 * The deck page's Prices panel: what the deck is worth and what it would cost
 * to finish. Pure — the page already holds the deck and the viewer's
 * card-level ownership (useDeckEditor's cardOwnershipMap).
 *
 * `tcg_low` is THE price (see the root CLAUDE.md): a copy without one is
 * reported as unpriced and counted as $0, never filled in from tcg_market.
 * The bench is a maybe-pile, not part of the deck, so it stays out of every
 * total and is reported on its own.
 */

interface PricedCard {
  quantity?: number;
  printingDetails?: {
    name?: string;
    display_name?: string;
    card_unique_id?: string;
    tcg_low?: number | null;
  };
}

export interface PricedDeck {
  hero?: PricedCard[];
  equipment?: PricedCard[];
  maindeck?: PricedCard[];
  inventory?: PricedCard[];
  benched?: PricedCard[];
  tokens?: PricedCard[];
}

const ZONES = [
  ['hero', 'Hero'],
  ['equipment', 'Equipment & weapons'],
  ['maindeck', 'Main deck'],
  ['inventory', 'Inventory'],
  ['tokens', 'Tokens'],
] as const;

export type PriceZone = (typeof ZONES)[number][0];

export interface DeckPrices {
  /** Zones with cards in them, in deck order. */
  zones: Array<{ zone: PriceZone; label: string; value: number }>;
  total: number;
  benchValue: number;
  unpricedCopies: number;
  topCards: Array<{ name: string; quantity: number; each: number; total: number }>;
  /** null when the viewer's ownership isn't known (signed out / still loading). */
  toFinish: { value: number; missingCopies: number } | null;
}

const priceOf = (c: PricedCard) => c.printingDetails?.tcg_low ?? null;
const qtyOf = (c: PricedCard) => c.quantity ?? 1;
const cents = (n: number) => Math.round(n * 100) / 100;

export function deckPrices(
  deck: PricedDeck,
  /** owned: card_unique_id → copies owned in any printing (the page's cardOwnershipMap). */
  opts: { owned?: ReadonlyMap<string, { owned: number }> | null; top?: number } = {},
): DeckPrices {
  const zones: DeckPrices['zones'] = [];
  let unpricedCopies = 0;
  const counted: PricedCard[] = [];

  for (const [zone, label] of ZONES) {
    const cards = deck[zone] ?? [];
    if (!cards.length) continue;
    let value = 0;
    for (const c of cards) {
      const price = priceOf(c);
      if (price == null) unpricedCopies += qtyOf(c);
      else value += price * qtyOf(c);
      counted.push(c);
    }
    zones.push({ zone, label, value: cents(value) });
  }

  const benchValue = cents((deck.benched ?? []).reduce((s, c) => s + (priceOf(c) ?? 0) * qtyOf(c), 0));

  // Same card at the same price merges across zones (Snatch in deck + inventory).
  const lines = new Map<string, DeckPrices['topCards'][number]>();
  for (const c of counted) {
    const each = priceOf(c);
    if (each == null) continue;
    const name = c.printingDetails?.display_name ?? c.printingDetails?.name ?? 'Unknown card';
    const key = `${c.printingDetails?.card_unique_id ?? name}|${each}`;
    const line = lines.get(key) ?? { name, quantity: 0, each, total: 0 };
    line.quantity += qtyOf(c);
    line.total = cents(line.each * line.quantity);
    lines.set(key, line);
  }
  const topCards = [...lines.values()].sort((a, b) => b.total - a.total).slice(0, opts.top ?? 5);

  return {
    zones,
    total: cents(zones.reduce((s, z) => s + z.value, 0)),
    benchValue,
    unpricedCopies,
    topCards,
    toFinish: opts.owned ? costToFinish(counted, opts.owned) : null,
  };
}

/** Copies still missing per card (any printing owned counts), priced at the
 *  cheapest of the deck's own printings of that card. */
function costToFinish(cards: PricedCard[], owned: ReadonlyMap<string, { owned: number }>) {
  const byCard = new Map<string, { needed: number; price: number | null }>();
  for (const c of cards) {
    const id = c.printingDetails?.card_unique_id;
    if (!id) continue;
    const entry = byCard.get(id) ?? { needed: 0, price: null };
    entry.needed += qtyOf(c);
    const p = priceOf(c);
    if (p != null && (entry.price == null || p < entry.price)) entry.price = p;
    byCard.set(id, entry);
  }
  let value = 0;
  let missingCopies = 0;
  for (const [id, { needed, price }] of byCard) {
    const short = Math.max(0, needed - (owned.get(id)?.owned ?? 0));
    missingCopies += short;
    value += short * (price ?? 0);
  }
  return { value: cents(value), missingCopies };
}
