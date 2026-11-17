/**
 * Trade matching shared by the binder "Add my wants" button, the profile
 * trade page and Discord /trade.
 *
 * - exact: a want matches only the same printing (set × edition × foiling × art).
 * - loose: a want matches any printing of the same card (card_unique_id, so
 *   pitch still has to match). Wanted quantities are summed per card.
 */
export type TradeMatchMode = 'exact' | 'loose';

export function parseTradeMatchMode(value: unknown): TradeMatchMode {
  return value === 'loose' ? 'loose' : 'exact';
}

export function wantKey(
  row: { printingId: string; cardUniqueId: string },
  mode: TradeMatchMode
): string {
  return mode === 'loose' ? row.cardUniqueId : row.printingId;
}

/**
 * Walk `rows` in order and take from each up to what is still wanted for its
 * key, so the total per key is min(wanted, available). Rows that end up with 0
 * are dropped. The caller's `wanted` map is not modified.
 */
export function allocateToWants<T>(
  rows: T[],
  wanted: Map<string, number>,
  keyOf: (row: T) => string,
  availableOf: (row: T) => number
): Array<{ row: T; quantity: number }> {
  const remaining = new Map(wanted);
  const out: Array<{ row: T; quantity: number }> = [];
  for (const row of rows) {
    const key = keyOf(row);
    const left = remaining.get(key) ?? 0;
    const take = Math.min(left, Math.max(0, availableOf(row)));
    if (take <= 0) continue;
    remaining.set(key, left - take);
    out.push({ row, quantity: take });
  }
  return out;
}
