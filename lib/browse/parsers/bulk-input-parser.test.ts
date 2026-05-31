// lib/browse/parsers/bulk-input-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseBulkInput } from './bulk-input-parser';

describe('parseBulkInput — cardlist loose color handling', () => {
  it('strips a trailing color word but records the full name as fallbackName', () => {
    // "Deep Blue" is Generic Equipment (no pitch). The loose suffix parser will
    // read "Blue" as a pitch color, so we must remember the full name to retry.
    const [card] = parseBulkInput('Deep Blue', 'cardlist');

    expect(card.name).toBe('deep');
    expect(card.color).toBe('blue');
    expect(card.fallbackName).toBe('deep blue');
  });

  it('strips a leading color word but records the full name as fallbackName', () => {
    const [card] = parseBulkInput('Blue Lightning', 'cardlist');

    expect(card.name).toBe('lightning');
    expect(card.color).toBe('blue');
    expect(card.fallbackName).toBe('blue lightning');
  });

  it('does not set fallbackName when no loose color was stripped', () => {
    const [card] = parseBulkInput('Command and Conquer', 'cardlist');

    expect(card.name).toBe('command and conquer');
    expect(card.color).toBe('');
    expect(card.fallbackName).toBeUndefined();
  });

  it('does not set fallbackName when color comes from explicit parenthesis syntax', () => {
    // Explicit "(blue)" is authoritative — the user meant the blue pitch.
    const [card] = parseBulkInput('Sink Below (blue)', 'cardlist');

    expect(card.name).toBe('sink below');
    expect(card.color).toBe('blue');
    expect(card.fallbackName).toBeUndefined();
  });

  it('preserves the partial-match wildcard while recording fallbackName', () => {
    const [card] = parseBulkInput('*Deep Blue', 'cardlist');

    expect(card.name).toBe('deep');
    expect(card.color).toBe('blue');
    expect(card.isPartialMatch).toBe(true);
    expect(card.fallbackName).toBe('deep blue');
  });
});
