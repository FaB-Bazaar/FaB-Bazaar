import { describe, it, expect } from 'vitest';
import { deckSizeLabel } from './deck-size-label';

describe('deckSizeLabel', () => {
  it('adds the total when the deck has an inventory', () => {
    expect(deckSizeLabel(69, 8)).toBe('69 cards + 8 inventory (77 total)');
  });

  it('shows just the deck size when there is no inventory', () => {
    expect(deckSizeLabel(60, 0)).toBe('60 cards');
  });
});
