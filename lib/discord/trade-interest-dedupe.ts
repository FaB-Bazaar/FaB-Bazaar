// In-memory dedupe window for trade-interest pings. Per-process, like the
// app's other in-memory rate limits — genuinely global only while the app
// runs a single nextjs container (see CLAUDE.md "Search rate limiting").

export const TRADE_INTEREST_DEDUPE_WINDOW_MS = 15 * 60 * 1000;

const PRUNE_THRESHOLD = 1000;

const lastNotifiedAt = new Map<string, number>();

/**
 * Returns true (and records the attempt) if a notification for this
 * requester+binder pair hasn't fired within the dedupe window.
 * Suppressed attempts do not extend the window.
 */
export function shouldNotifyTradeInterest(
  requesterId: string,
  binderId: string,
  now: number = Date.now()
): boolean {
  const key = `${requesterId}:${binderId}`;
  const previous = lastNotifiedAt.get(key);
  if (previous !== undefined && now - previous < TRADE_INTEREST_DEDUPE_WINDOW_MS) {
    return false;
  }

  if (lastNotifiedAt.size >= PRUNE_THRESHOLD) {
    for (const [k, t] of lastNotifiedAt) {
      if (now - t >= TRADE_INTEREST_DEDUPE_WINDOW_MS) lastNotifiedAt.delete(k);
    }
  }

  lastNotifiedAt.set(key, now);
  return true;
}

export function resetTradeInterestDedupe(): void {
  lastNotifiedAt.clear();
}
