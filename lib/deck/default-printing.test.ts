/**
 * pickDefaultPrinting — the printing preselected when a user taps a card in
 * the mobile deck-search drawer (and any other "just give me a sensible
 * default" surface). Cheapest ENGLISH printing first; foreign printings are
 * only defaulted when no English printing exists. Unpriced-only pools fall
 * back to the first printing.
 */

import { describe, it, expect } from 'vitest';
import { pickDefaultPrinting } from './default-printing';

const p = (over: Record<string, unknown>) => ({
  printing_id: 'x',
  language: 'en',
  tcgMarket: null,
  ...over,
});

describe('pickDefaultPrinting', () => {
  it('picks the cheapest English printing even when a foreign one is cheaper', () => {
    const printings = [
      p({ printing_id: 'ja-cheap', language: 'ja', tcgMarket: '0.50' }),
      p({ printing_id: 'en-mid', language: 'en', tcgMarket: '2.00' }),
      p({ printing_id: 'en-expensive', language: 'en', tcgMarket: '9.00' }),
    ];
    expect(pickDefaultPrinting(printings)?.printing_id).toBe('en-mid');
  });

  it('falls back to the cheapest foreign printing when no English printing exists', () => {
    const printings = [
      p({ printing_id: 'de-pricey', language: 'de', tcgMarket: '4.00' }),
      p({ printing_id: 'ja-cheap', language: 'ja', tcgMarket: '1.00' }),
    ];
    expect(pickDefaultPrinting(printings)?.printing_id).toBe('ja-cheap');
  });

  it('prefers an unpriced English printing over a priced foreign one', () => {
    const printings = [
      p({ printing_id: 'ja-priced', language: 'ja', tcgMarket: '1.00' }),
      p({ printing_id: 'en-unpriced', language: 'en', tcgMarket: null }),
    ];
    expect(pickDefaultPrinting(printings)?.printing_id).toBe('en-unpriced');
  });

  it('treats missing language as English (legacy rows predate the column)', () => {
    const printings = [
      p({ printing_id: 'ja', language: 'ja', tcgMarket: '0.10' }),
      p({ printing_id: 'legacy', language: undefined, tcgMarket: '5.00' }),
    ];
    expect(pickDefaultPrinting(printings)?.printing_id).toBe('legacy');
  });

  it('falls back to the first printing when nothing is priced', () => {
    const printings = [
      p({ printing_id: 'first', tcgMarket: null }),
      p({ printing_id: 'second', tcgMarket: undefined }),
    ];
    expect(pickDefaultPrinting(printings)?.printing_id).toBe('first');
  });

  it('returns null for an empty list', () => {
    expect(pickDefaultPrinting([])).toBeNull();
  });
});
