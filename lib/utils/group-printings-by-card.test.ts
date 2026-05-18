import { describe, test, expect } from 'vitest';
import { groupPrintingsByCard } from './group-printings-by-card';

describe('groupPrintingsByCard', () => {
  test('groups printings sharing the same card_unique_id into one card entry', () => {
    const input = [
      { printing_id: 'p1', card_unique_id: 'CARD_A', set: 'wtr', foiling: 's', language: 'en' },
      { printing_id: 'p2', card_unique_id: 'CARD_A', set: 'wtr', foiling: 'r', language: 'en' },
      { printing_id: 'p3', card_unique_id: 'CARD_B', set: 'mst', foiling: 's', language: 'en' },
    ];
    const result = groupPrintingsByCard(input);
    expect(result.map((g) => g.card_unique_id)).toEqual(['CARD_A', 'CARD_B']);
    expect(result[0].allPrintings).toHaveLength(2);
    expect(result[0].count).toBe(2);
    expect(result[1].allPrintings).toHaveLength(1);
    expect(result[1].count).toBe(1);
  });

  test('canonical printing is English when both EN and non-EN exist', () => {
    const input = [
      { printing_id: 'fr-1', card_unique_id: 'CARD_A', set: 'wtr', foiling: 's', language: 'fr' },
      { printing_id: 'ja-1', card_unique_id: 'CARD_A', set: 'wtr', foiling: 's', language: 'ja' },
      { printing_id: 'en-1', card_unique_id: 'CARD_A', set: 'wtr', foiling: 's', language: 'en' },
    ];
    const result = groupPrintingsByCard(input);
    expect(result).toHaveLength(1);
    expect(result[0].canonicalPrinting.printing_id).toBe('en-1');
  });

  test('canonical picks earliest-released set (uses sortPrintingsBySetAndFoiling order)', () => {
    // WTR is earlier than MST in the display order
    const input = [
      { printing_id: 'mst-1', card_unique_id: 'CARD_A', set: 'mst', foiling: 's', language: 'en' },
      { printing_id: 'wtr-1', card_unique_id: 'CARD_A', set: 'wtr', foiling: 's', language: 'en' },
    ];
    const result = groupPrintingsByCard(input);
    expect(result[0].canonicalPrinting.printing_id).toBe('wtr-1');
  });

  test('canonical picks Standard non-foil over Cold Foil within the same set', () => {
    // sortPrintingsBySetAndFoiling priority: standard=1, rainbow=2, cold=3, gold=4.
    // Standard wins — it's the most accessible/common printing, ideal as the
    // default tile.
    const input = [
      { printing_id: 'cold-1', card_unique_id: 'CARD_A', set: 'wtr', foiling: 'c', language: 'en' },
      { printing_id: 'std-1', card_unique_id: 'CARD_A', set: 'wtr', foiling: 's', language: 'en' },
    ];
    const result = groupPrintingsByCard(input);
    expect(result[0].canonicalPrinting.printing_id).toBe('std-1');
  });

  test('preserves original card_unique_id appearance order in result', () => {
    // Group order = first-seen card_unique_id in the input
    const input = [
      { printing_id: 'b-1', card_unique_id: 'CARD_B', set: 'wtr', foiling: 's', language: 'en' },
      { printing_id: 'a-1', card_unique_id: 'CARD_A', set: 'wtr', foiling: 's', language: 'en' },
      { printing_id: 'a-2', card_unique_id: 'CARD_A', set: 'wtr', foiling: 's', language: 'en' },
      { printing_id: 'b-2', card_unique_id: 'CARD_B', set: 'wtr', foiling: 's', language: 'en' },
    ];
    const result = groupPrintingsByCard(input);
    expect(result.map((g) => g.card_unique_id)).toEqual(['CARD_B', 'CARD_A']);
  });

  test('returns empty array for empty input', () => {
    expect(groupPrintingsByCard([])).toEqual([]);
  });

  test('handles missing language (treats as English)', () => {
    const input = [
      { printing_id: 'no-lang', card_unique_id: 'CARD_A', set: 'wtr', foiling: 's' },
      { printing_id: 'fr-1', card_unique_id: 'CARD_A', set: 'wtr', foiling: 's', language: 'fr' },
    ];
    const result = groupPrintingsByCard(input);
    expect(result[0].canonicalPrinting.printing_id).toBe('no-lang');
  });

  test('does not mutate input array', () => {
    const input = [
      { printing_id: 'p1', card_unique_id: 'CARD_A', set: 'wtr', foiling: 's', language: 'en' },
      { printing_id: 'p2', card_unique_id: 'CARD_A', set: 'wtr', foiling: 'r', language: 'en' },
    ];
    const originalOrder = input.map((p) => p.printing_id);
    groupPrintingsByCard(input);
    expect(input.map((p) => p.printing_id)).toEqual(originalOrder);
  });
});
