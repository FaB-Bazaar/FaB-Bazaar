import { describe, it, expect } from 'vitest';
import { deckPrices, sortPriceRows, type PricedDeck } from './deck-prices';

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

  it('has one row per card per counted zone with each and line total', () => {
    const p = deckPrices(deck({ maindeck: [card('Snatch', 2, 20), card('Odd', 1, undefined)] }));
    expect(p.rows.map((r) => [r.name, r.zone, r.qty, r.each, r.total])).toEqual([
      ['Hero', 'hero', 1, 2, 2],
      ['Helm', 'equipment', 1, 10, 10],
      ['Snatch', 'maindeck', 2, 20, 40],
      ['Odd', 'maindeck', 1, null, 0],
      ['Sink', 'inventory', 1, 0.5, 0.5],
    ]);
  });

  it('leaves own and buy unknown when ownership is unknown', () => {
    const r = deckPrices(deck()).rows[0];
    expect(r.owned).toBeNull();
    expect(r.buy).toBeNull();
  });

  it('spends owned copies on the pricier row first, so buy falls on the cheapest copies', () => {
    const p = deckPrices(
      deck({ maindeck: [card('Snatch', 2, 10, 'snatch')], inventory: [card('Snatch', 1, 1, 'snatch')] }),
      { owned: new Map([['snatch', { owned: 2 }]]) },
    );
    const main = p.rows.find((r) => r.zone === 'maindeck')!;
    const inv = p.rows.find((r) => r.zone === 'inventory')!;
    expect([main.owned, main.buy]).toEqual([2, 0]);
    expect([inv.owned, inv.buy]).toEqual([0, 1]);
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
