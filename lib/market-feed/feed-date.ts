/** Timezone that decides which day a market feed submission belongs to. */
export const MARKET_FEED_TIMEZONE = 'America/New_York';

/** Today's date (YYYY-MM-DD) in US Eastern time. */
export function marketFeedToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MARKET_FEED_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
