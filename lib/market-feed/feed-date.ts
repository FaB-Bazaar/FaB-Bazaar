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

/**
 * Which day the feed page shows. An explicit ?date is always honoured; the
 * default (today) falls back to the newest earlier day with listings, so the
 * page isn't empty before that day's feed is posted. `fellBackFrom` is the
 * empty day that was skipped (null when no fallback happened).
 */
export function resolveFeedDay({
  requested,
  today,
  datesWithListings,
}: {
  requested?: string;
  today: string;
  /** YYYY-MM-DD days that have listings, any order. */
  datesWithListings: string[];
}): { feedDate: string; fellBackFrom: string | null } {
  if (requested) return { feedDate: requested, fellBackFrom: null };
  if (datesWithListings.includes(today)) return { feedDate: today, fellBackFrom: null };
  const latest = datesWithListings.filter((d) => d < today).sort().pop();
  return latest ? { feedDate: latest, fellBackFrom: today } : { feedDate: today, fellBackFrom: null };
}
