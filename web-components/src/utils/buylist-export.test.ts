/**
 * Buy-list export builders — pure text formatting over the rolled-up data the
 * component already holds, so a reader can take the list to TCGplayer's Mass
 * Entry page or paste it anywhere as plain text.
 */

import { describe, it, expect } from 'vitest';
import { buildMassEntryText, buildPlainTextExport } from './buylist-export';

const CARDS = {
  'p-memory': { name: 'Evo Steel Soul Memory', collector_number: 'EVO026' },
  'p-dissolver': { name: 'Adaptive Dissolver', collector_number: 'EVO410' },
  'p-mage': { name: 'Evo Mage Base', collector_number: 'EVO030' },
};

const qty = (min: number, max: number) => ({ min, max });

const ROLLUP = {
  tiers: [
    {
      label: 'The Core',
      groups: [
        {
          label: 'Steel Soul Set',
          qtyLabel: '3x',
          cards: [
            {
              printingId: 'p-memory',
              qty: qty(3, 3),
              unitPrice: 7.99,
              priceIsFallback: false,
              subtotal: qty(23.97, 23.97),
              owned: 3,
              needed: qty(0, 0),
            },
            {
              printingId: 'p-dissolver',
              qty: qty(3, 3),
              unitPrice: 28.25,
              priceIsFallback: false,
              subtotal: qty(84.75, 84.75),
              owned: 1,
              needed: qty(2, 2),
            },
          ],
          totals: {
            cost: qty(108.72, 108.72),
            needCost: qty(56.5, 56.5),
            ownedCopies: 4,
            wantedCopies: qty(6, 6),
            missingPrices: [],
          },
        },
      ],
      totals: {
        cost: qty(108.72, 108.72),
        needCost: qty(56.5, 56.5),
        ownedCopies: 4,
        wantedCopies: qty(6, 6),
        missingPrices: [],
      },
    },
    {
      label: 'Flex & Tech',
      groups: [
        {
          label: 'Mage Set',
          qtyLabel: '1-2x',
          cards: [
            {
              printingId: 'p-mage',
              qty: qty(1, 2),
              unitPrice: null,
              priceIsFallback: false,
              subtotal: qty(0, 0),
              owned: 0,
              needed: qty(1, 2),
            },
          ],
          totals: {
            cost: qty(0, 0),
            needCost: qty(0, 0),
            ownedCopies: 0,
            wantedCopies: qty(1, 2),
            missingPrices: ['p-mage'],
          },
        },
      ],
      totals: {
        cost: qty(0, 0),
        needCost: qty(0, 0),
        ownedCopies: 0,
        wantedCopies: qty(1, 2),
        missingPrices: ['p-mage'],
      },
    },
  ],
  totals: {
    cost: qty(108.72, 108.72),
    needCost: qty(56.5, 56.5),
    ownedCopies: 4,
    wantedCopies: qty(7, 8),
    missingPrices: ['p-mage'],
  },
};

describe('buildMassEntryText', () => {
  it('emits one "<qty> <name>" line per card using the max of a range', () => {
    const text = buildMassEntryText(ROLLUP as any, CARDS as any);

    expect(text.split('\n')).toEqual([
      '3 Evo Steel Soul Memory',
      '3 Adaptive Dissolver',
      '2 Evo Mage Base',
    ]);
  });

  it('restricts to still-needed copies when asked, dropping fully-owned rows', () => {
    const text = buildMassEntryText(ROLLUP as any, CARDS as any, { onlyNeeded: true });

    // memory fully owned → gone; dissolver needs 2 of 3; mage needs up to 2.
    expect(text.split('\n')).toEqual(['2 Adaptive Dissolver', '2 Evo Mage Base']);
  });

  it('falls back to the printing id when the card metadata is missing', () => {
    const text = buildMassEntryText(ROLLUP as any, {} as any);

    expect(text).toContain('3 p-memory');
  });
});

describe('buildPlainTextExport', () => {
  it('renders heading, tier and group structure with quantities, ids and prices', () => {
    const text = buildPlainTextExport('Teklovossen Buy List', ROLLUP as any, CARDS as any);

    expect(text).toContain('Teklovossen Buy List ($108.72)');
    expect(text).toContain('The Core ($108.72)');
    expect(text).toContain('Steel Soul Set');
    expect(text).toContain('3x Evo Steel Soul Memory (EVO026) — $23.97');
    expect(text).toContain('Flex & Tech');
    // A range renders as a range; a missing price is called out, not zeroed.
    expect(text).toContain('1-2x Evo Mage Base (EVO030) — no price');
  });

  it('renders range totals as ranges', () => {
    const rangeRollup = {
      ...ROLLUP,
      totals: { ...ROLLUP.totals, cost: qty(198.99, 203.64) },
    };
    const text = buildPlainTextExport('List', rangeRollup as any, CARDS as any);

    expect(text).toContain('List ($198.99 – $203.64)');
  });
});
