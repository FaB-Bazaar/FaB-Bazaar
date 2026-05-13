/**
 * hero-pool-cache.ts
 *
 * Module-level cache for the entire legal card pool of a hero+format combination,
 * fetched from /api/cards/by-hero as slim CardSummaryDTO[] (one row per unique
 * card). Replaces the per-type printings preload — instead of 8-10 parallel
 * fetches × ~25 MB each, this is one fetch of ~300 KB.
 *
 * Also exposes:
 *   - filterPoolByChip(cards, chipValue) — pure filter for type-chip clicks
 *   - toCardResult(summary)              — adapter to the legacy CardResult
 *                                          shape consumed by QuickAddCardDialog
 *   - fetchPrintingsForCard(cardId)      — lazy drilldown for the printing
 *                                          picker (hits /api/cards/[id]/printings)
 *
 * The cache lives outside React so it survives component unmounts and dialog
 * open/close cycles. Cleared only on full page navigation.
 */

import type { CardSummaryDTO, HeroPoolFilters, PrintingDTO } from "@/lib/services/contracts/IPrintingsService";

/**
 * The shape QuickAddCardDialog renders. One row per unique card. The
 * `printings` array holds the variants for the printing picker drilldown.
 */
export interface PrintingResult {
  printing_id: string;
  image_url?: string;
  set?: string;
  collector_number?: string;
  edition?: string;
  foiling?: string;
  rarity?: string;
  is_extended_art?: boolean;
  tcg_low?: number | null;
  tcg_market?: number | null;
  card_unique_id?: string;
  cardId?: string;
  display_name?: string;
  name?: string;
  types?: string[];
  pitch?: number | null;
  [key: string]: unknown;
}

export interface CardResult {
  unique_id: string;
  name: string;
  types: string[];
  pitch: number | null;
  printings: PrintingResult[];
}

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

// ─── Printing drilldown ──────────────────────────────────────────────────

const printingsCache = new Map<string, PrintingDTO[]>();
const printingsInflight = new Map<string, Promise<PrintingDTO[]>>();

export async function fetchPrintingsForCard(cardUniqueId: string): Promise<PrintingDTO[]> {
  const cached = printingsCache.get(cardUniqueId);
  if (cached) return cached;
  if (printingsInflight.has(cardUniqueId)) return printingsInflight.get(cardUniqueId)!;

  const promise = fetch(`/api/cards/${cardUniqueId}/printings`)
    .then((r) => r.json())
    .then((data: { success: boolean; data?: { printings: PrintingDTO[] }; error?: string }) => {
      if (!data.success || !data.data) {
        throw new Error(data.error || "Failed to fetch printings");
      }
      printingsCache.set(cardUniqueId, data.data.printings);
      return data.data.printings;
    })
    .finally(() => printingsInflight.delete(cardUniqueId));

  printingsInflight.set(cardUniqueId, promise);
  return promise;
}

export function clearPrintingsCache(): void {
  printingsCache.clear();
  printingsInflight.clear();
}

// ─── Chip filter ─────────────────────────────────────────────────────────

// Maps chip values (from lib/search/card-filter-chips.ts:TYPE_CHIPS) to a
// type-string the card's `types` array must include. Special case
// 'non-attack-action' handled below.
const CHIP_TYPE: Record<string, string> = {
  attack: "attack",
  item: "item",
  "attack-reaction": "attack reaction",
  "defense-reaction": "defense reaction",
  instant: "instant",
  equipment: "equipment",
  weapon: "weapon",
  gem: "gem",
  ally: "ally",
  evo: "evo",
  generic: "generic",
};

export function filterPoolByChip(pool: CardSummaryDTO[], chipValue: string): CardSummaryDTO[] {
  if (chipValue === "non-attack-action") {
    return pool.filter((c) => c.types.includes("action") && !c.types.includes("attack"));
  }
  const targetType = CHIP_TYPE[chipValue];
  if (targetType) {
    return pool.filter((c) => c.types.includes(targetType));
  }
  // Class/talent chip values aren't in CHIP_TYPE — the Add Card dialog reuses
  // the same state slot for type chips and the hero's class/talent chips.
  // Match against c.classes or c.talents (FaB vocabularies don't overlap, so
  // we don't need to disambiguate which kind the chip is).
  return pool.filter((c) => c.classes.includes(chipValue) || c.talents.includes(chipValue));
}

/**
 * Replaces probeAvailableTypes from the legacy card-pool-cache. Derives the
 * set of chip values that have at least one matching card from a pool we
 * already have in memory — no network calls.
 */
export function getAvailableChipsFromPool(
  pool: CardSummaryDTO[],
  chipValues: string[]
): Set<string> {
  const available = new Set<string>();
  for (const chipValue of chipValues) {
    if (filterPoolByChip(pool, chipValue).length > 0) {
      available.add(chipValue);
    }
  }
  return available;
}

// ─── Adapter to legacy CardResult shape ──────────────────────────────────

export function toCardResult(summary: CardSummaryDTO): CardResult & { __printingsCount?: number } {
  const representative: PrintingResult = {
    printing_id: summary.representativePrintingId,
    image_url: summary.representativeImageUrl ?? undefined,
  };

  return {
    unique_id: summary.cardUniqueId,
    name: summary.name,
    types: summary.types,
    pitch: summary.pitch,
    printings: [representative],
    // Synthesized — true total count of printings for the "Np" badge in the
    // dialog's card tile. Dialog reads this via `card.__printingsCount ?? card.printings.length`.
    __printingsCount: summary.printingsCount,
  };
}
