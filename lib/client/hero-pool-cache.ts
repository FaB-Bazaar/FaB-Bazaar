/**
 * hero-pool-cache.ts
 *
 * Lazy printing-drilldown cache for the deck-builder Add Card dialog
 * (hits /api/cards/[id]/printings when a grouped card row is selected),
 * plus the CardResult/PrintingResult shapes the dialog renders.
 *
 * The hero-pool preload machinery that used to live here (fetchHeroPool,
 * filterPoolByChip, …) was removed when QuickAddCardDialog moved to the
 * shared server-paginated search (2026-08) — legality now travels as
 * heroClasses/heroTalents/heroEssences filters on /api/printings/search.
 *
 * The cache lives outside React so it survives component unmounts and dialog
 * open/close cycles. Cleared only on full page navigation.
 */

import type { PrintingDTO } from "@/lib/services/contracts/IPrintingsService";

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
