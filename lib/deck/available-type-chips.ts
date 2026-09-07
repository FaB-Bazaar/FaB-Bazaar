/**
 * Type chips for the Add Card dialog, narrowed to the types that actually
 * occur in the hero's legal pool — a Malice deck has no Arrow/Dragon/Figment
 * cards, so those chips would only ever produce an empty result.
 *
 * The pool comes from /api/cards/by-hero (one slim row per card, with its
 * types). Pure — the dialog feeds the type set to buildFilterFacets via
 * `typeChips`; /opt keeps the full TYPE_CHIPS list.
 */

import { TYPE_CHIPS, type ChipDef } from '@/lib/search/card-filter-chips';

/** Lower-cased union of every pool card's types. */
export function poolTypeSet(cards: ReadonlyArray<{ types?: ReadonlyArray<string> | null }>): Set<string> {
  const out = new Set<string>();
  for (const c of cards) for (const t of c.types ?? []) out.add(t.toLowerCase());
  return out;
}

/**
 * `null` = pool not loaded (or no hero): show every chip rather than flashing
 * an empty facet. A loaded pool filters chips by `apiType` membership, keeping
 * TYPE_CHIPS order.
 */
export function availableTypeChips(poolTypes: ReadonlySet<string> | null, chips: readonly ChipDef[] = TYPE_CHIPS): ChipDef[] {
  if (poolTypes === null) return [...chips];
  return chips.filter((c) => poolTypes.has(c.apiType.toLowerCase()));
}
