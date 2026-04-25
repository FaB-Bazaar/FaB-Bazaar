export interface Swaps {
  in: string[];
  out: string[];
}

/**
 * Compute the net swap delta needed to transition the deck composition from
 * the "core" sideboard plan to the hero-specific plan.
 *
 * Each plan is expressed as `(in, out)` arrays of card identifiers, both relative
 * to the base decklist. A card appearing N times in `in` means +N copies; N times
 * in `out` means −N copies.
 *
 * The returned delta is what a player would physically swap when moving from
 * a deck already sideboarded for `core` into one sideboarded for `hero`.
 */
export function computeMatchupDelta(core: Swaps, hero: Swaps): Swaps {
  const net = new Map<string, number>();
  for (const id of hero.in) net.set(id, (net.get(id) ?? 0) + 1);
  for (const id of hero.out) net.set(id, (net.get(id) ?? 0) - 1);
  for (const id of core.in) net.set(id, (net.get(id) ?? 0) - 1);
  for (const id of core.out) net.set(id, (net.get(id) ?? 0) + 1);

  const inList: string[] = [];
  const outList: string[] = [];
  for (const [id, n] of net) {
    if (n > 0) for (let i = 0; i < n; i++) inList.push(id);
    else if (n < 0) for (let i = 0; i < -n; i++) outList.push(id);
  }
  return { in: inList, out: outList };
}
