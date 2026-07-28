import { describe, it, expect } from 'vitest';
import {
  parseQuantity,
  rollupBuylist,
  type BuylistSectionData,
  type BuylistPriceMap,
  type BuylistOwnedMap,
} from './rollup';

// A buy list differs from a decklist in three ways this module has to model:
// quantities are RANGES ("2-3x"), cards nest into purchasable GROUPS ("3x Steel
// Soul Set"), and the whole point is money — so every total is a cost, priced
// off tcg_low per the project-wide pricing rule.

describe('parseQuantity', () => {
  it('reads a fixed quantity as a zero-width range', () => {
    expect(parseQuantity(3)).toEqual({ min: 3, max: 3 });
  });

  it('reads a numeric string as a fixed quantity', () => {
    expect(parseQuantity('3')).toEqual({ min: 3, max: 3 });
  });

  it('reads a hyphenated range', () => {
    expect(parseQuantity('2-3')).toEqual({ min: 2, max: 3 });
  });

  it('tolerates the trailing x authors actually type', () => {
    expect(parseQuantity('2-3x')).toEqual({ min: 2, max: 3 });
  });

  it('rejects a reversed range rather than silently inverting it', () => {
    expect(() => parseQuantity('3-2')).toThrow(/range/i);
  });

  it('rejects a non-numeric quantity', () => {
    expect(() => parseQuantity('a playset')).toThrow(/quantity/i);
  });
});

// ---------------------------------------------------------------------------

const STEEL_SOUL: BuylistSectionData = {
  tiers: [
    {
      label: 'The Core',
      groups: [
        {
          label: 'Steel Soul Set',
          cards: [
            { printingId: 'memory', qty: 3 },
            { printingId: 'processor', qty: 3 },
          ],
        },
      ],
    },
  ],
};

const PRICES: BuylistPriceMap = {
  memory: { tcg_low: 7.99, tcg_market: 9.5 },
  processor: { tcg_low: 8.18, tcg_market: 9.0 },
};

describe('rollupBuylist — pricing', () => {
  it('prices each card at tcg_low times its quantity', () => {
    const result = rollupBuylist(STEEL_SOUL, { prices: PRICES });
    const card = result.tiers[0].groups[0].cards[0];

    expect(card.unitPrice).toBe(7.99);
    expect(card.subtotal).toEqual({ min: 23.97, max: 23.97 });
  });

  it('falls back to tcg_market only when tcg_low is absent, and flags it', () => {
    const prices: BuylistPriceMap = {
      memory: { tcg_low: null, tcg_market: 9.5 },
      processor: { tcg_low: 8.18, tcg_market: 9.0 },
    };
    const result = rollupBuylist(STEEL_SOUL, { prices });
    const [memory, processor] = result.tiers[0].groups[0].cards;

    expect(memory.unitPrice).toBe(9.5);
    expect(memory.priceIsFallback).toBe(true);
    // Never the reverse: a present tcg_low always wins over tcg_market.
    expect(processor.unitPrice).toBe(8.18);
    expect(processor.priceIsFallback).toBe(false);
  });

  it('sums card subtotals into the group total', () => {
    const result = rollupBuylist(STEEL_SOUL, { prices: PRICES });

    // (7.99 + 8.18) * 3
    expect(result.tiers[0].groups[0].totals.cost).toEqual({ min: 48.51, max: 48.51 });
  });

  it('sums group totals into the tier total and grand total', () => {
    const section: BuylistSectionData = {
      tiers: [
        {
          label: 'The Core',
          groups: [
            { label: 'A', cards: [{ printingId: 'memory', qty: 1 }] },
            { label: 'B', cards: [{ printingId: 'processor', qty: 1 }] },
          ],
        },
      ],
    };
    const result = rollupBuylist(section, { prices: PRICES });

    expect(result.tiers[0].totals.cost).toEqual({ min: 16.17, max: 16.17 });
    expect(result.totals.cost).toEqual({ min: 16.17, max: 16.17 });
  });

  it('produces a cost range when a quantity is a range', () => {
    const section: BuylistSectionData = {
      tiers: [
        {
          label: 'Flex',
          groups: [{ label: 'Scrap', cards: [{ printingId: 'memory', qty: '2-3' }] }],
        },
      ],
    };
    const result = rollupBuylist(section, { prices: PRICES });

    expect(result.totals.cost).toEqual({ min: 15.98, max: 23.97 });
  });

  it('tracks unpriced cards instead of counting them as free', () => {
    const result = rollupBuylist(STEEL_SOUL, {
      prices: { memory: { tcg_low: 7.99, tcg_market: null } },
    });

    expect(result.totals.missingPrices).toEqual(['processor']);
    expect(result.totals.cost).toEqual({ min: 23.97, max: 23.97 });
  });
});

describe('rollupBuylist — group quantity label', () => {
  it('derives a shared quantity onto the group header', () => {
    const result = rollupBuylist(STEEL_SOUL, { prices: PRICES });

    expect(result.tiers[0].groups[0].qtyLabel).toBe('3x');
  });

  it('omits the header quantity when members disagree', () => {
    const section: BuylistSectionData = {
      tiers: [
        {
          label: 'The Core',
          groups: [
            {
              label: 'Mixed',
              cards: [
                { printingId: 'memory', qty: 3 },
                { printingId: 'processor', qty: 1 },
              ],
            },
          ],
        },
      ],
    };
    const result = rollupBuylist(section, { prices: PRICES });

    expect(result.tiers[0].groups[0].qtyLabel).toBeNull();
  });

  it('renders a shared range as a range label', () => {
    const section: BuylistSectionData = {
      tiers: [
        {
          label: 'Flex',
          groups: [{ label: 'Mage Set', cards: [{ printingId: 'memory', qty: '1-2' }] }],
        },
      ],
    };
    const result = rollupBuylist(section, { prices: PRICES });

    expect(result.tiers[0].groups[0].qtyLabel).toBe('1-2x');
  });
});

describe('rollupBuylist — ownership', () => {
  const owned: BuylistOwnedMap = { memory: 2, processor: 0 };

  it('reports what the reader already owns per card', () => {
    const result = rollupBuylist(STEEL_SOUL, { prices: PRICES, owned });
    const [memory] = result.tiers[0].groups[0].cards;

    expect(memory.owned).toBe(2);
    expect(memory.needed).toEqual({ min: 1, max: 1 });
  });

  it('never reports a negative need when the reader owns extras', () => {
    const result = rollupBuylist(STEEL_SOUL, {
      prices: PRICES,
      owned: { memory: 10, processor: 0 },
    });
    const [memory] = result.tiers[0].groups[0].cards;

    expect(memory.needed).toEqual({ min: 0, max: 0 });
  });

  it('costs only the copies the reader still needs', () => {
    const result = rollupBuylist(STEEL_SOUL, { prices: PRICES, owned });

    // memory: 1 still needed * 7.99, processor: 3 * 8.18
    expect(result.totals.needCost).toEqual({ min: 32.53, max: 32.53 });
    // Full cost is unchanged by ownership.
    expect(result.totals.cost).toEqual({ min: 48.51, max: 48.51 });
  });

  it('reports group-level ownership progress as copies owned over copies wanted', () => {
    const result = rollupBuylist(STEEL_SOUL, { prices: PRICES, owned });
    const group = result.tiers[0].groups[0];

    expect(group.totals.ownedCopies).toBe(2);
    expect(group.totals.wantedCopies).toEqual({ min: 6, max: 6 });
  });

  it('treats an absent ownership map as owning nothing', () => {
    const result = rollupBuylist(STEEL_SOUL, { prices: PRICES });

    expect(result.tiers[0].groups[0].cards[0].owned).toBe(0);
    expect(result.totals.needCost).toEqual(result.totals.cost);
  });
});

// Authors annotate a buy list the way they'd talk about it — "you can't run more
// than 3 copies each due to the same-name rule". Those notes hang off a package
// or an individual card and have to survive the rollup.
describe('rollupBuylist — author notes', () => {
  it('carries a package note through to the rolled group', () => {
    const section: BuylistSectionData = {
      tiers: [
        {
          label: 'The Core',
          groups: [
            {
              label: 'Adaptive Bases',
              note: 'Only 3 copies each across colors.',
              cards: [{ printingId: 'memory', qty: 3 }],
            },
          ],
        },
      ],
    };
    const result = rollupBuylist(section, { prices: PRICES });

    expect(result.tiers[0].groups[0].note).toBe('Only 3 copies each across colors.');
  });

  it('carries a per-card note through to the rolled card', () => {
    const section: BuylistSectionData = {
      tiers: [
        {
          label: 'The Core',
          groups: [
            {
              label: 'Steel Soul Set',
              cards: [{ printingId: 'memory', qty: 3, note: 'The expensive one.' }],
            },
          ],
        },
      ],
    };
    const result = rollupBuylist(section, { prices: PRICES });

    expect(result.tiers[0].groups[0].cards[0].note).toBe('The expensive one.');
  });

  it('leaves note undefined when the author wrote none', () => {
    const result = rollupBuylist(STEEL_SOUL, { prices: PRICES });

    expect(result.tiers[0].groups[0].note).toBeUndefined();
    expect(result.tiers[0].groups[0].cards[0].note).toBeUndefined();
  });

  it('carries a tier note through', () => {
    const section: BuylistSectionData = {
      tiers: [
        {
          label: 'Flex & Tech',
          note: 'Swap these by matchup.',
          groups: [{ label: 'g', cards: [{ printingId: 'memory', qty: 1 }] }],
        },
      ],
    };
    const result = rollupBuylist(section, { prices: PRICES });

    expect(result.tiers[0].note).toBe('Swap these by matchup.');
  });
});
