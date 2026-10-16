/**
 * The deck page's Prices view: what the deck is worth and what it would cost
 * to finish, as one row per card per zone plus a summary. Pure — the page
 * already holds the deck and the viewer's card-level ownership
 * (useDeckEditor's cardOwnershipMap).
 *
 * `tcg_low` is THE price (see the root CLAUDE.md): a copy without one is
 * reported as unpriced and counted as $0, never filled in from tcg_market.
 * The bench is a maybe-pile, not part of the deck, so it stays out of every
 * total and the rows, and is reported on its own.
 */

interface PricedCard {
  printingId?: string;
  quantity?: number;
  printingDetails?: {
    name?: string;
    display_name?: string;
    card_unique_id?: string;
    tcg_low?: number | null;
    pitch?: number | null;
    image_url?: string | null;
    tcgplayer_url?: string | null;
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

export interface PriceRow {
  key: string;
  printingId?: string;
  cardUniqueId?: string;
  name: string;
  pitch: number | null;
  imageUrl: string | null;
  tcgplayerUrl: string | null;
  qty: number;
  /** tcg_low per copy; null = unpriced. */
  each: number | null;
  total: number;
  /** Copies of this row covered by the collection (any printing); null = ownership unknown. */
  owned: number | null;
  /** What the uncovered copies cost; null = ownership unknown. */
  buy: number | null;
}

export interface DeckPrices {
  /** Zones with cards in them, in deck order. */
  zones: Array<{ zone: PriceZone; label: string; value: number }>;
  total: number;
  benchValue: number;
  unpricedCopies: number;
  rows: PriceRow[];
  /** null when the viewer's ownership isn't known (signed out / still loading). */
  toFinish: { value: number; missingCopies: number } | null;
}

const priceOf = (c: PricedCard) => c.printingDetails?.tcg_low ?? null;
const qtyOf = (c: PricedCard) => c.quantity ?? 1;
const cents = (n: number) => Math.round(n * 100) / 100;

export function deckPrices(
  deck: PricedDeck,
  /** owned: card_unique_id → copies owned in any printing (the page's cardOwnershipMap). */
  opts: { owned?: ReadonlyMap<string, { owned: number }> | null } = {},
): DeckPrices {
  // One row per printing: the same printing in several zones (main deck +
  // inventory) merges, since the table shows no zone.
  const byPrinting = new Map<string, PriceRow>();
  for (const [zone] of ZONES) {
    (deck[zone] ?? []).forEach((c, i) => {
      const key = c.printingId ?? `${zone}|${i}`;
      const existing = byPrinting.get(key);
      if (existing) {
        existing.qty += qtyOf(c);
        existing.total = cents((existing.each ?? 0) * existing.qty);
        return;
      }
      const d = c.printingDetails ?? {};
      const each = priceOf(c);
      byPrinting.set(key, {
        key,
        printingId: c.printingId,
        cardUniqueId: d.card_unique_id,
        name: d.display_name ?? d.name ?? 'Unknown card',
        pitch: d.pitch ?? null,
        imageUrl: d.image_url ?? null,
        tcgplayerUrl: d.tcgplayer_url ?? null,
        qty: qtyOf(c),
        each,
        total: cents((each ?? 0) * qtyOf(c)),
        owned: null,
        buy: null,
      });
    });
  }
  const rows = [...byPrinting.values()];
  if (opts.owned) allocateOwned(rows, opts.owned);

  const zones = ZONES
    .filter(([zone]) => (deck[zone] ?? []).length > 0)
    .map(([zone, label]) => ({ zone, label, value: cents((deck[zone] ?? []).reduce((s, c) => s + (priceOf(c) ?? 0) * qtyOf(c), 0)) }));

  return {
    zones,
    total: cents(zones.reduce((s, z) => s + z.value, 0)),
    benchValue: cents((deck.benched ?? []).reduce((s, c) => s + (priceOf(c) ?? 0) * qtyOf(c), 0)),
    unpricedCopies: rows.filter((r) => r.each == null).reduce((s, r) => s + r.qty, 0),
    rows,
    toFinish: opts.owned
      ? {
          value: cents(rows.reduce((s, r) => s + (r.buy ?? 0), 0)),
          missingCopies: rows.reduce((s, r) => s + (r.qty - (r.owned ?? 0)), 0),
        }
      : null,
  };
}

/** What a row's Buy cell says: the missing copies' cost, Owned (every copy in
 *  the collection), No price (copies missing, no tcg_low), or unknown ownership. */
export type BuyCell = { kind: 'buy'; amount: number } | { kind: 'owned' } | { kind: 'noPrice' } | { kind: 'unknown' };

export function buyCell(r: PriceRow): BuyCell {
  if (r.owned == null) return { kind: 'unknown' };
  if (r.owned >= r.qty) return { kind: 'owned' };
  if (r.each == null) return { kind: 'noPrice' };
  return { kind: 'buy', amount: r.buy ?? 0 };
}

/** A card's owned copies cover its pricier rows first, so what's left to buy
 *  is the cheapest copies — and the buy column sums to the cost to finish. */
function allocateOwned(rows: PriceRow[], owned: ReadonlyMap<string, { owned: number }>) {
  const byCard = new Map<string, PriceRow[]>();
  for (const r of rows) {
    const id = r.cardUniqueId;
    if (!id) { r.owned = 0; r.buy = r.total; continue; }
    byCard.set(id, [...(byCard.get(id) ?? []), r]);
  }
  for (const [id, cardRows] of byCard) {
    let left = owned.get(id)?.owned ?? 0;
    for (const r of [...cardRows].sort((a, b) => (b.each ?? 0) - (a.each ?? 0))) {
      r.owned = Math.min(r.qty, left);
      left -= r.owned;
      r.buy = cents((r.qty - r.owned) * (r.each ?? 0));
    }
  }
}

export type PriceSortKey = 'name' | 'qty' | 'each' | 'total' | 'owned' | 'buy' | `finish:${Finish}`;
export type PriceSort = { key: PriceSortKey; dir: 'asc' | 'desc' } | null;

type FinishCells = ReadonlyMap<string, Record<Finish, number | null>>;

const sortValue = (r: PriceRow, key: PriceSortKey, cells?: FinishCells): number | string | null =>
  key.startsWith('finish:') ? cells?.get(r.key)?.[key.slice('finish:'.length) as Finish] ?? null
  : key === 'name' ? r.name.toLowerCase()
  : r[key as Exclude<PriceSortKey, `finish:${Finish}`>];

/** Default: priciest line first. Nulls (unpriced / unknown / not in that
 *  finish) always sort last. `cells` (from finishColumns) backs the finish keys. */
export function sortPriceRows(rows: PriceRow[], sort: PriceSort, cells?: FinishCells): PriceRow[] {
  const { key, dir } = sort ?? { key: 'total' as const, dir: 'desc' as const };
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = sortValue(a, key, cells);
    const vb = sortValue(b, key, cells);
    if (va == null || vb == null) return va == null && vb == null ? 0 : va == null ? 1 : -1;
    if (va < vb) return -sign;
    if (va > vb) return sign;
    return a.name.localeCompare(b.name);
  });
}

// ── Compare printings ───────────────────────────────────────────────────────
// What each card would cost in each finish (cheapest English printing of it,
// tcg_low), so the deck's value can be read as "all non-foil", "all rainbow"…

export const FINISHES = ['cheapest', 's', 'r', 'c', 'g', 'promo'] as const;
export type Finish = (typeof FINISHES)[number];
export const FINISH_LABEL: Record<Finish, string> = { cheapest: 'Cheapest', s: 'Non-foil', r: 'Rainbow', c: 'Cold', g: 'Gold', promo: 'Promo' };

/** card_unique_id → cheapest tcg_low per finish (foiling code), overall, and
 *  promo (rarity p, any finish — a card can have several). Unpriced printings are ignored. */
export type FinishPrices = Record<string, Partial<Record<Finish, number>>>;

export function cheapestByFinish(
  printings: Array<{ card_unique_id: string; foiling: string | null; tcg_low: number | null; rarity?: string | null }>,
): FinishPrices {
  const out: FinishPrices = {};
  for (const p of printings) {
    if (p.tcg_low == null || p.tcg_low <= 0) continue;
    const card = (out[p.card_unique_id] ??= {});
    const promo = p.rarity?.toLowerCase() === 'p' ? 'promo' : null;
    for (const f of ['cheapest', p.foiling?.toLowerCase(), promo] as const) {
      if (!f || !(FINISHES as readonly string[]).includes(f)) continue;
      const key = f as Finish;
      if (card[key] == null || p.tcg_low < card[key]!) card[key] = p.tcg_low;
    }
  }
  return out;
}

/** Per-row line totals in every finish (null = no priced printing in it), the
 *  finishes any card has, and each finish's deck total + copies it couldn't price. */
export function finishColumns(rows: PriceRow[], byCard: FinishPrices) {
  const cells = new Map<string, Record<Finish, number | null>>();
  const totals = Object.fromEntries(FINISHES.map((f) => [f, { value: 0, missingCopies: 0 }])) as Record<Finish, { value: number; missingCopies: number }>;
  const present = new Set<Finish>();
  for (const r of rows) {
    const prices = (r.cardUniqueId && byCard[r.cardUniqueId]) || {};
    const cell = {} as Record<Finish, number | null>;
    for (const f of FINISHES) {
      const each = prices[f];
      cell[f] = each == null ? null : cents(each * r.qty);
      if (each == null) totals[f].missingCopies += r.qty;
      else { totals[f].value = cents(totals[f].value + cell[f]!); present.add(f); }
    }
    cells.set(r.key, cell);
  }
  return { cells, totals, finishes: FINISHES.filter((f) => present.has(f)) };
}
