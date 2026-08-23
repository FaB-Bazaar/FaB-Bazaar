// lib/deck/decks-to-beat-default-month.ts
// Which month the Decks to Beat page opens on when the URL has no ?date=.
//
// Rule: the CURRENT calendar month, unless it has no featured decks in ANY
// format — only then revert to the latest month that does. `latest` must be
// the cross-format latest featured month (deckService.getLatestFeaturedMonth()
// with no format), NOT the active tab's: a format tab that hasn't been
// populated yet is not a reason to leave the current month.

export interface YearMonth {
  year: number;
  month: number; // 1-12
}

export function resolveDecksToBeatDefaultMonth(
  latest: YearMonth | null | undefined,
  now: YearMonth
): YearMonth {
  if (!latest) return now;
  const latestKey = latest.year * 12 + latest.month;
  const nowKey = now.year * 12 + now.month;
  // latest === now → current month has decks; latest > now → future-dated
  // data oddity, never jump forward. Only a strictly earlier month reverts.
  return latestKey < nowKey ? latest : now;
}
