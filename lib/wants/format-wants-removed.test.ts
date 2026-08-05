/**
 * Unit tests for formatWantsRemoved — the user-facing message shown after
 * adding cards to a binder auto-removes copies from the wants list.
 */

import { describe, it, expect } from 'vitest';
import { formatWantsRemoved } from './format-wants-removed';

describe('formatWantsRemoved', () => {
  it('returns null for undefined or empty input', () => {
    expect(formatWantsRemoved(undefined)).toBeNull();
    expect(formatWantsRemoved([])).toBeNull();
  });

  it('formats a single copy with singular wording', () => {
    expect(
      formatWantsRemoved([{ printingId: 'p1', quantityRemoved: 1, cardName: 'Cracked Bauble' }])
    ).toBe('1 copy of Cracked Bauble removed from your wants list.');
  });

  it('formats multiple copies with plural wording', () => {
    expect(
      formatWantsRemoved([{ printingId: 'p1', quantityRemoved: 2, cardName: 'Cracked Bauble' }])
    ).toBe('2 copies of Cracked Bauble removed from your wants list.');
  });

  it('joins two cards with "and"', () => {
    expect(
      formatWantsRemoved([
        { printingId: 'p1', quantityRemoved: 2, cardName: 'Cracked Bauble' },
        { printingId: 'p2', quantityRemoved: 1, cardName: 'Snatch' },
      ])
    ).toBe('2 copies of Cracked Bauble and 1 copy of Snatch removed from your wants list.');
  });

  it('joins three or more cards with commas and a final "and"', () => {
    expect(
      formatWantsRemoved([
        { printingId: 'p1', quantityRemoved: 2, cardName: 'A' },
        { printingId: 'p2', quantityRemoved: 1, cardName: 'B' },
        { printingId: 'p3', quantityRemoved: 3, cardName: 'C' },
      ])
    ).toBe('2 copies of A, 1 copy of B, and 3 copies of C removed from your wants list.');
  });
});
