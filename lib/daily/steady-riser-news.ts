// Which steady risers are news today. The signal compares today's price with
// 30 days ago, so a card that jumped once and then sat still keeps qualifying
// for weeks — the page collapses those repeats instead of headlining them.
// Pure: the service feeds it the steady_riser history; see the test for cases.

export interface SteadyRiserHistoryRow {
  printingId: string;
  asOfDate: string;
  pAtSignal: number;
}

export interface SteadyRiserNews {
  /** Consecutive pipeline runs (newest back) the card has been a steady riser. */
  streakDays: number;
  /** New to the list this run, or its price moved since the previous run. */
  isNews: boolean;
  /** For a repeat: the earliest run of the current flat stretch. Null when news. */
  flatSince: string | null;
}

/** A price change under 1% between runs counts as flat (TCGplayer low jitter). */
const MOVED = 0.01;
const moved = (from: number, to: number) => from > 0 && Math.abs(to - from) / from >= MOVED;

/**
 * @param history steady_riser rows (any order) for the runs below
 * @param runs    distinct pipeline as_of_dates, newest first — runs[0] is today's
 */
export function steadyRiserNews(history: SteadyRiserHistoryRow[], runs: string[]): Map<string, SteadyRiserNews> {
  const price = new Map<string, number>(); // `${printingId}|${asOfDate}` → p_at_signal
  for (const r of history) price.set(`${r.printingId}|${r.asOfDate}`, r.pAtSignal);
  const at = (printingId: string, i: number) => (i < runs.length ? price.get(`${printingId}|${runs[i]}`) : undefined);

  const out = new Map<string, SteadyRiserNews>();
  if (runs.length === 0) return out;
  for (const r of history) {
    if (r.asOfDate !== runs[0] || out.has(r.printingId)) continue;
    const today = r.pAtSignal;

    let streakDays = 1;
    while (at(r.printingId, streakDays) !== undefined) streakDays++;

    const previous = at(r.printingId, 1);
    const isNews = previous === undefined || moved(previous, today);

    let flatSince: string | null = null;
    if (!isNews) {
      let i = 0;
      while (i + 1 < streakDays && !moved(at(r.printingId, i + 1)!, today)) i++;
      flatSince = runs[i];
    }
    out.set(r.printingId, { streakDays, isNews, flatSince });
  }
  return out;
}
