import { describe, it, expect } from 'vitest';
import { cardTextMatches } from './card-text-match';

describe('cardTextMatches (deck page "Card text" highlight)', () => {
  it('matches a word anywhere in the rules text, ignoring case', () => {
    expect(cardTextMatches('When this attacks, you may Discard a zombie.', 'discard')).toBe(true);
    expect(cardTextMatches('Go again', 'discard')).toBe(false);
  });

  it('matches a multi-word phrase', () => {
    expect(cardTextMatches('create a Corrupted Corpse in your banished zone', 'corrupted corpse')).toBe(true);
    expect(cardTextMatches("create a Gate to I'arathael token", 'gate')).toBe(true);
  });

  it('ignores markdown bold and extra whitespace in the text and the query', () => {
    expect(cardTextMatches('**Go  again**\nWhen this hits', 'go again')).toBe(true);
    expect(cardTextMatches('create a corrupted\ncorpse', '  corrupted   corpse ')).toBe(true);
  });

  it('matches nothing for an empty query or missing text', () => {
    expect(cardTextMatches('anything', '   ')).toBe(false);
    expect(cardTextMatches(null, 'discard')).toBe(false);
    expect(cardTextMatches(undefined, 'discard')).toBe(false);
  });
});
