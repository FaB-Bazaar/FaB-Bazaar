// lib/browse/bulk-search-fallback.test.ts
import { describe, it, expect } from 'vitest';
import {
  buildColorFallbackRetries,
  mergeColorFallbackResults,
} from './bulk-search-fallback';
import type { ParsedCard } from './parsers/bulk-input-parser';

const parsed = (over: Partial<ParsedCard>): ParsedCard => ({
  name: '',
  quantity: 1,
  color: '',
  isPartialMatch: false,
  set: '',
  foiling: '',
  edition: '',
  ...over,
});

describe('buildColorFallbackRetries', () => {
  it('queues a no-color retry for an empty result that has a fallbackName', () => {
    const parsedCards = [parsed({ name: 'deep', color: 'blue', fallbackName: 'deep blue' })];
    const results = [{ index: 0, printings: [] }];

    const retries = buildColorFallbackRetries(parsedCards, results);

    expect(retries).toHaveLength(1);
    expect(retries[0].index).toBe(0);
    expect(retries[0].card.name).toBe('deep blue');
    expect(retries[0].card.color).toBeUndefined();
    expect(retries[0].card.exact).toBe(true);
  });

  it('does not retry an empty result that has no fallbackName', () => {
    const parsedCards = [parsed({ name: 'nonexistent card' })];
    const results = [{ index: 0, printings: [] }];

    expect(buildColorFallbackRetries(parsedCards, results)).toHaveLength(0);
  });

  it('does not retry a result that already returned printings', () => {
    const parsedCards = [parsed({ name: 'deep', color: 'blue', fallbackName: 'deep blue' })];
    const results = [{ index: 0, printings: [{ printing_id: 'x' } as any] }];

    expect(buildColorFallbackRetries(parsedCards, results)).toHaveLength(0);
  });

  it('preserves the partial-match flag on the retry', () => {
    const parsedCards = [parsed({ name: 'deep', color: 'blue', fallbackName: 'deep blue', isPartialMatch: true })];
    const results = [{ index: 0, printings: [] }];

    const [retry] = buildColorFallbackRetries(parsedCards, results);
    expect(retry.card.isPartialMatch).toBe(true);
    expect(retry.card.exact).toBe(false);
  });

  it('only queues the empty fallback cards out of a mixed batch', () => {
    const parsedCards = [
      parsed({ name: 'command and conquer' }),                                  // found, no fallback
      parsed({ name: 'deep', color: 'blue', fallbackName: 'deep blue' }),       // empty, fallback
      parsed({ name: 'wax on', color: 'red', fallbackName: 'wax on red' }),     // found despite fallback
    ];
    const results = [
      { index: 0, printings: [{ printing_id: 'a' } as any] },
      { index: 1, printings: [] },
      { index: 2, printings: [{ printing_id: 'c' } as any] },
    ];

    const retries = buildColorFallbackRetries(parsedCards, results);
    expect(retries).toHaveLength(1);
    expect(retries[0].index).toBe(1);
    expect(retries[0].card.name).toBe('deep blue');
  });
});

describe('mergeColorFallbackResults', () => {
  it('fills empty printings from the retry results, keyed by original index', () => {
    const results = [
      { index: 0, printings: [{ printing_id: 'a' } as any] },
      { index: 1, printings: [] },
    ];
    const retries = [{ index: 1, card: { name: 'deep blue' } }];
    // Second bulk search returns results indexed by retry-batch position (0-based)
    const retryResults = [{ index: 0, printings: [{ printing_id: 'deepblue-1' } as any] }];

    const merged = mergeColorFallbackResults(results, retries, retryResults);

    expect(merged[0].printings).toHaveLength(1);     // untouched
    expect(merged[1].printings).toHaveLength(1);     // filled from retry
    expect(merged[1].printings[0].printing_id).toBe('deepblue-1');
  });

  it('does not overwrite a result that already had printings', () => {
    const results = [{ index: 0, printings: [{ printing_id: 'original' } as any] }];
    const retries = [{ index: 0, card: { name: 'whatever' } }];
    const retryResults = [{ index: 0, printings: [{ printing_id: 'should-not-win' } as any] }];

    const merged = mergeColorFallbackResults(results, retries, retryResults);
    expect(merged[0].printings[0].printing_id).toBe('original');
  });

  it('leaves results unchanged when the retry also found nothing', () => {
    const results = [{ index: 1, printings: [] }];
    const retries = [{ index: 1, card: { name: 'deep blue' } }];
    const retryResults = [{ index: 0, printings: [] }];

    const merged = mergeColorFallbackResults(results, retries, retryResults);
    expect(merged[0].printings).toHaveLength(0);
  });
});
