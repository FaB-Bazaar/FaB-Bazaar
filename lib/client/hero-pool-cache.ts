/**
 * hero-pool-cache.ts
 *
 * Module-level cache for the entire legal card pool of a hero+format combination,
 * fetched from /api/cards/by-hero as slim CardSummaryDTO[] (one row per unique
 * card). Replaces the per-type printings preload — instead of 8-10 parallel
 * fetches × ~25 MB each, this is one fetch of ~300 KB.
 *
 * The cache lives outside React so it survives component unmounts and dialog
 * open/close cycles. Cleared only on full page navigation.
 */

import type { CardSummaryDTO, HeroPoolFilters } from "@/lib/services/contracts/IPrintingsService";

type PoolKey = string;

const cache = new Map<PoolKey, CardSummaryDTO[]>();
const inflight = new Map<PoolKey, Promise<CardSummaryDTO[]>>();

function makeKey(f: HeroPoolFilters): PoolKey {
  // Sort arrays so cache key is order-insensitive
  return JSON.stringify({
    heroClasses: [...(f.heroClasses ?? [])].sort(),
    heroTalents: [...(f.heroTalents ?? [])].sort(),
    heroEssences: [...(f.heroEssences ?? [])].sort(),
    format: f.format ?? "",
  });
}

function buildQuery(f: HeroPoolFilters): string {
  const params = new URLSearchParams();
  if (f.heroClasses?.length) params.set("heroClasses", f.heroClasses.join(","));
  if (f.heroTalents?.length) params.set("heroTalents", f.heroTalents.join(","));
  if (f.heroEssences?.length) params.set("heroEssences", f.heroEssences.join(","));
  if (f.format) params.set("format", f.format);
  return params.toString();
}

export async function fetchHeroPool(filters: HeroPoolFilters): Promise<CardSummaryDTO[]> {
  const key = makeKey(filters);
  const cached = cache.get(key);
  if (cached) return cached;
  if (inflight.has(key)) return inflight.get(key)!;

  const promise = fetch(`/api/cards/by-hero?${buildQuery(filters)}`)
    .then((r) => r.json())
    .then((data: { success: boolean; data?: CardSummaryDTO[]; error?: string }) => {
      if (!data.success || !data.data) {
        throw new Error(data.error || "Failed to fetch hero pool");
      }
      cache.set(key, data.data);
      return data.data;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return promise;
}

/**
 * Fire-and-forget preload — call on deck load to warm the cache before
 * the user opens the QuickAdd dialog. Errors are swallowed.
 */
export function preloadHeroPool(filters: HeroPoolFilters): void {
  fetchHeroPool(filters).catch(() => {});
}

export function getCachedHeroPool(filters: HeroPoolFilters): CardSummaryDTO[] | undefined {
  return cache.get(makeKey(filters));
}

export function clearHeroPoolCache(): void {
  cache.clear();
  inflight.clear();
}
