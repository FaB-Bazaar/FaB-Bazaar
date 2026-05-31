// lib/browse/bulk-search-fallback.ts
//
// Color-fallback retry for the bulk-import search.
//
// The cardlist parser treats a leading/trailing "red|yellow|blue" word as a
// pitch-color specifier. That's wrong for cards whose name simply contains a
// color word ("Deep Blue" is pitchless equipment), where the phantom color
// filter excludes the only matching printings. When such a card returns zero
// printings, we retry by its full name with no color filter.

import type { ParsedCard } from './parsers/bulk-input-parser';
import type { BulkSearchCard, BulkSearchResult } from '@/lib/client/search-client';

export interface ColorFallbackRetry {
  /** Index into the original parsedCards / results array. */
  index: number;
  /** Search descriptor using the full name, with the color filter dropped. */
  card: BulkSearchCard;
}

/**
 * Determine which cards need a no-color retry: results that came back empty for
 * a parsed card carrying a `fallbackName` (i.e. a loose color word was stripped).
 */
export function buildColorFallbackRetries(
  parsedCards: ParsedCard[],
  results: BulkSearchResult[],
): ColorFallbackRetry[] {
  const retries: ColorFallbackRetry[] = [];

  results.forEach(result => {
    if (result.printings.length > 0) return;
    const card = parsedCards[result.index];
    if (!card?.fallbackName) return;

    retries.push({
      index: result.index,
      card: {
        name: card.fallbackName,
        exact: !card.isPartialMatch,
        isPartialMatch: card.isPartialMatch,
        // No color — that filter is what excluded the card. Keep any explicit
        // set/edition/foiling constraints the user typed.
        foiling: card.foiling || undefined,
        set: card.set || undefined,
        edition: card.edition || undefined,
      },
    });
  });

  return retries;
}

/**
 * Merge the retry batch's results back into the first-round results.
 *
 * `retryResults` is indexed by retry-batch position (the bulk-search route emits
 * `index === input position`), so `retries[retryResult.index]` recovers the
 * original card index. Only still-empty results are filled.
 */
export function mergeColorFallbackResults(
  results: BulkSearchResult[],
  retries: ColorFallbackRetry[],
  retryResults: BulkSearchResult[],
): BulkSearchResult[] {
  const merged = results.map(r => ({ ...r }));
  const byOriginalIndex = new Map(merged.map(r => [r.index, r]));

  retryResults.forEach(retryResult => {
    const retry = retries[retryResult.index];
    if (!retry) return;
    const target = byOriginalIndex.get(retry.index);
    if (target && target.printings.length === 0 && retryResult.printings.length > 0) {
      target.printings = retryResult.printings;
    }
  });

  return merged;
}
