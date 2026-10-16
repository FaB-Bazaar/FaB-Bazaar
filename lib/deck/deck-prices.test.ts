import { describe, it, expect } from 'vitest';
import { deckPrices, type PricedDeck } from './deck-prices';

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

  it('lists the most expensive cards by line total, merged across zones', () => {
    const p = deckPrices(deck({ inventory: [card('Snatch', 1, 20)] }), { top: 2 });
    expect(p.topCards).toEqual([
      { name: 'Snatch', quantity: 3, each: 20, total: 60 },
      { name: 'Helm', quantity: 1, each: 10, total: 10 },
    ]);
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
