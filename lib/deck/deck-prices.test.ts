import { describe, it, expect } from 'vitest';
import { deckPrices, sortPriceRows, cheapestByFinish, finishColumns, buyCell, type PricedDeck } from './deck-prices';

// A deck card in the shape the deck API returns (only the fields pricing reads).
const card = (name: string, qty: number, tcgLow: number | undefined, cuid = name, tcgMarket?: number) => ({
  printingId: `p-${name}`,
  quantity: qty,
  printingDetails: { display_name: name, card_unique_id: cuid, tcg_low: tcgLow, tcg_market: tcgMarket },
});

const deck = (over: Partial<PricedDeck> = {}): PricedDeck => ({
  hero: [card('Hero', 1, 2)],
  equipment: [card('Helm', 1, 10)],
  maindeck: [card('Strike', 3, 1.5), card('Snatch', 2, 20)],
  inventory: [card('Sink', 1, 0.5)],
  benched: [card('Maybe', 3, 100)],
  tokens: [],
  ...over,
});

describe('deckPrices', () => {
  it('totals the deck at tcg_low per zone, quantity included', () => {
    const p = deckPrices(deck());
    expect(p.zones).toEqual([
      { zone: 'hero', label: 'Hero', value: 2 },
      { zone: 'equipment', label: 'Equipment & weapons', value: 10 },
      { zone: 'maindeck', label: 'Main deck', value: 44.5 },
      { zone: 'inventory', label: 'Inventory', value: 0.5 },
    ]);
    expect(p.total).toBe(57);
  });

  it('keeps the bench out of the total and reports it on its own', () => {
    const p = deckPrices(deck());
    expect(p.benchValue).toBe(300);
    expect(p.total).toBe(57);
  });

  it('counts copies with no tcg_low as unpriced and never falls back to tcg_market', () => {
    const p = deckPrices(deck({ maindeck: [card('Odd', 2, undefined, 'Odd', 50)] }));
    expect(p.unpricedCopies).toBe(2);
    expect(p.zones.find((z) => z.zone === 'maindeck')!.value).toBe(0);
  });

  it('has one row per printing with each and line total', () => {
    const p = deckPrices(deck({ maindeck: [card('Snatch', 2, 20), card('Odd', 1, undefined)] }));
    expect(p.rows.map((r) => [r.name, r.qty, r.each, r.total])).toEqual([
      ['Hero', 1, 2, 2],
      ['Helm', 1, 10, 10],
      ['Snatch', 2, 20, 40],
      ['Odd', 1, null, 0],
      ['Sink', 1, 0.5, 0.5],
    ]);
  });

  it('merges a printing listed in several zones into one row (the table has no zone column)', () => {
    const p = deckPrices(deck({ maindeck: [card('Snatch', 2, 20)], inventory: [card('Snatch', 1, 20)] }));
    expect(p.rows.filter((r) => r.name === 'Snatch').map((r) => [r.qty, r.total])).toEqual([[3, 60]]);
    // Zone values on top still split it.
    expect(p.zones.find((z) => z.zone === 'inventory')!.value).toBe(20);
  });

  it("carries the printing's TCGplayer link for the Buy column", () => {
    const withUrl = { ...card('Snatch', 2, 20), printingDetails: { ...card('Snatch', 2, 20).printingDetails, tcgplayer_url: 'https://www.tcgplayer.com/product/1' } };
    const rows = deckPrices(deck({ maindeck: [withUrl] })).rows;
    expect(rows.find((r) => r.name === 'Snatch')!.tcgplayerUrl).toBe('https://www.tcgplayer.com/product/1');
    expect(rows.find((r) => r.name === 'Helm')!.tcgplayerUrl).toBeNull();
  });

  it('leaves own and buy unknown when ownership is unknown', () => {
    const r = deckPrices(deck()).rows[0];
    expect(r.owned).toBeNull();
    expect(r.buy).toBeNull();
  });

  it('spends owned copies on the pricier row first, so buy falls on the cheapest copies', () => {
    // Two printings of one card: a $10 foil and a $1 base.
    const foil = { ...card('Snatch', 2, 10, 'snatch'), printingId: 'p-snatch-foil' };
    const base = { ...card('Snatch', 1, 1, 'snatch'), printingId: 'p-snatch-base' };
    const p = deckPrices(deck({ maindeck: [foil, base] }), { owned: new Map([['snatch', { owned: 2 }]]) });
    const pricey = p.rows.find((r) => r.name === 'Snatch' && r.each === 10)!;
    const cheap = p.rows.find((r) => r.name === 'Snatch' && r.each === 1)!;
    expect([pricey.owned, pricey.buy]).toEqual([2, 0]);
    expect([cheap.owned, cheap.buy]).toEqual([0, 1]);
  });

  it('prices the shortage after the collection: any printing of a card counts as owned', () => {
    const owned = new Map([
      ['Snatch', { owned: 1, needed: 2, binderNames: [] }],
      ['Strike', { owned: 5, needed: 3, binderNames: [] }],
    ]);
    const p = deckPrices(deck(), { owned });
    // Missing: Hero 1×2, Helm 1×10, Snatch 1×20, Sink 1×0.5 (Strike covered, bench ignored).
    expect(p.toFinish).toEqual({ value: 32.5, missingCopies: 4 });
  });

  it('has no cost to finish when ownership is unknown', () => {
    expect(deckPrices(deck()).toFinish).toBeNull();
  });
});

describe('sortPriceRows', () => {
  const rows = deckPrices(deck({ maindeck: [card('Snatch', 2, 20), card('Odd', 1, undefined)] })).rows;

  it('defaults to the priciest line first', () => {
    expect(sortPriceRows(rows, null).map((r) => r.name)).toEqual(['Snatch', 'Helm', 'Hero', 'Sink', 'Odd']);
  });

  it('sorts by a column either way, unpriced rows last', () => {
    expect(sortPriceRows(rows, { key: 'each', dir: 'asc' }).map((r) => r.name)).toEqual(['Sink', 'Hero', 'Helm', 'Snatch', 'Odd']);
    expect(sortPriceRows(rows, { key: 'name', dir: 'desc' }).map((r) => r.name)[0]).toBe('Snatch');
  });
});

describe('cheapestByFinish', () => {
  it('keeps the cheapest promo (rarity p) of any finish in its own promo column', () => {
    const by = cheapestByFinish([
      { card_unique_id: 'a', foiling: 's', tcg_low: 1, rarity: 'c' },
      { card_unique_id: 'a', foiling: 'r', tcg_low: 9, rarity: 'p' },
      { card_unique_id: 'a', foiling: 'c', tcg_low: 30, rarity: 'P' },
    ]);
    expect(by.a).toEqual({ cheapest: 1, s: 1, r: 9, c: 30, promo: 9 });
  });

  it('reads the foiling code case-insensitively', () => {
    expect(cheapestByFinish([{ card_unique_id: 'a', foiling: 'R', tcg_low: 3.5 }])).toEqual({ a: { cheapest: 3.5, r: 3.5 } });
  });

  it('keeps the cheapest priced printing per card per finish, plus the cheapest overall', () => {
    const by = cheapestByFinish([
      { card_unique_id: 'a', foiling: 's', tcg_low: 1.5 },
      { card_unique_id: 'a', foiling: 's', tcg_low: 0.9 },
      { card_unique_id: 'a', foiling: 'r', tcg_low: 4 },
      { card_unique_id: 'a', foiling: 'c', tcg_low: null },
      { card_unique_id: 'b', foiling: 'c', tcg_low: 30 },
    ]);
    expect(by).toEqual({
      a: { cheapest: 0.9, s: 0.9, r: 4 },
      b: { cheapest: 30, c: 30 },
    });
  });
});

describe('finishColumns', () => {
  const p = deckPrices(deck({ equipment: [], hero: [], inventory: [], maindeck: [card('Strike', 3, 1.5, 'a'), card('Snatch', 2, 20, 'b')] }));
  const by = { a: { cheapest: 0.9, s: 0.9, r: 4 }, b: { cheapest: 15, c: 15 } };

  it('prices each row in each finish as a line total, null where the card has no such printing', () => {
    const { cells } = finishColumns(p.rows, by);
    expect(cells.get(p.rows[0].key)).toEqual({ cheapest: 2.7, s: 2.7, r: 12, c: null, g: null, promo: null });
    expect(cells.get(p.rows[1].key)).toEqual({ cheapest: 30, s: null, r: null, c: 30, g: null, promo: null });
  });

  it('totals each finish and counts the copies it could not price', () => {
    const { totals, finishes } = finishColumns(p.rows, by);
    expect(finishes).toEqual(['cheapest', 's', 'r', 'c']);
    expect(totals.cheapest).toEqual({ value: 32.7, missingCopies: 0 });
    expect(totals.r).toEqual({ value: 12, missingCopies: 2 });
  });
});

describe('sortPriceRows by a finish column', () => {
  const p = deckPrices(deck({ equipment: [], hero: [], inventory: [], maindeck: [card('Strike', 3, 1.5, 'a'), card('Snatch', 2, 20, 'b'), card('Odd', 1, 5, 'c')] }));
  const { cells } = finishColumns(p.rows, { a: { cheapest: 0.9, r: 4 }, b: { cheapest: 15, r: 2 }, c: { cheapest: 1 } });

  it('orders by the line total in that finish, cards without it last', () => {
    expect(sortPriceRows(p.rows, { key: 'finish:r', dir: 'desc' }, cells).map((r) => r.name)).toEqual(['Strike', 'Snatch', 'Odd']);
    expect(sortPriceRows(p.rows, { key: 'finish:r', dir: 'asc' }, cells).map((r) => r.name)).toEqual(['Snatch', 'Strike', 'Odd']);
  });
});

describe('buyCell', () => {
  const rowFor = (c: ReturnType<typeof card>, owned: number) =>
    deckPrices(deck({ hero: [], equipment: [], inventory: [], maindeck: [c] }), { owned: new Map([[c.printingDetails.card_unique_id, { owned }]]) }).rows[0];

  it('shows what the missing copies cost', () => {
    expect(buyCell(rowFor(card('Snatch', 3, 2), 1))).toEqual({ kind: 'buy', amount: 4 });
  });

  it('says Owned when every copy is in the collection, priced or not', () => {
    expect(buyCell(rowFor(card('Snatch', 3, 2), 3))).toEqual({ kind: 'owned' });
    expect(buyCell(rowFor(card('Odd', 1, undefined), 1))).toEqual({ kind: 'owned' });
  });

  it('says No price when copies are missing but the card has no tcg_low', () => {
    expect(buyCell(rowFor(card('Odd', 2, undefined), 0))).toEqual({ kind: 'noPrice' });
  });

  it('is unknown when ownership is unknown', () => {
    expect(buyCell(deckPrices(deck()).rows[0])).toEqual({ kind: 'unknown' });
  });
});

describe('printing columns (set, collector number, rarity)', () => {
  const print = (name: string, set: string, collector: string, rarity: string, low = 1) => {
    const c = card(name, 1, low);
    return { ...c, printingDetails: { ...c.printingDetails, set, collector_number: collector, rarity } };
  };
  const rows = deckPrices({
    maindeck: [print('Snatch', 'wtr', 'WTR163', 'c'), print('Pummel', 'wtr', 'WTR043', 'm'), print('Gold', 'fab', 'FAB001', 'p'), print('Odd', 'zzz', 'ZZZ001', 'q')],
  }).rows;

  it('carries the printing\'s set, collector number and rarity', () => {
    expect(rows.find((r) => r.name === 'Pummel')).toMatchObject({ set: 'wtr', collectorNumber: 'WTR043', rarity: 'm' });
  });

  it('sorts rarity rarest first (the site\'s rarity order), unknown codes last', () => {
    expect(sortPriceRows(rows, { key: 'rarity', dir: 'asc' }).map((r) => r.name)).toEqual(['Gold', 'Pummel', 'Snatch', 'Odd']);
  });

  it('sorts by collector number', () => {
    expect(sortPriceRows(rows, { key: 'collector', dir: 'asc' }).map((r) => r.collectorNumber)).toEqual(['FAB001', 'WTR043', 'WTR163', 'ZZZ001']);
  });
});
