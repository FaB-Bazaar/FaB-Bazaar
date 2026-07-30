/**
 * Server-side buy-list pricing assembly, shared by /api/buylist/rollup and the
 * article pages that pre-roll a buy list at render time (SSR/ISR).
 *
 * Unlike rollup.ts this file touches the service layer, so it must never be
 * imported by the web component bundle.
 */

import { printingsService } from '@/lib/services';
import type { BuylistPriceMap } from '@/lib/buylist/rollup';

/** Display metadata the component needs per printing (mirrors the API shape). */
export interface BuylistCardMeta {
  printing_id: string;
  card_unique_id: string | null;
  name: string;
  collector_number: string | null;
  set: string;
  foiling: string;
  image_url: string | null;
  tcgplayer_url: string | null;
  tcg_low: number | null;
  tcg_market: number | null;
}

export interface BuylistPricingData {
  prices: BuylistPriceMap;
  cards: Record<string, BuylistCardMeta>;
  /** For resolving per-card ownership; only the API route uses this. */
  cardUniqueIdByPrinting: Record<string, string>;
}

/** Every distinct printingId referenced by a tiers structure, order-stable. */
export function collectBuylistPrintingIds(tiers: unknown): string[] {
  if (!Array.isArray(tiers)) return [];
  return [
    ...new Set(
      tiers.flatMap((tier: any) =>
        (tier?.groups ?? []).flatMap((group: any) =>
          (group?.cards ?? []).map((card: any) => card?.printingId).filter(Boolean)
        )
      )
    ),
  ] as string[];
}

export async function loadBuylistPricing(
  printingIds: string[]
): Promise<{ success: true; data: BuylistPricingData } | { success: false; error: string }> {
  const printingsResult = await printingsService.getPrintingsByIds(printingIds);
  if (!printingsResult.success) {
    return { success: false, error: printingsResult.error };
  }

  const printings = printingsResult.data?.printings ?? [];

  const prices: BuylistPriceMap = {};
  const cards: Record<string, BuylistCardMeta> = {};
  const cardUniqueIdByPrinting: Record<string, string> = {};

  for (const p of printings) {
    prices[p.printing_id] = { tcg_low: p.tcg_low, tcg_market: p.tcg_market };
    if (p.card_unique_id) cardUniqueIdByPrinting[p.printing_id] = p.card_unique_id;
    cards[p.printing_id] = {
      printing_id: p.printing_id,
      card_unique_id: p.card_unique_id,
      name: p.name,
      collector_number: p.collector_number,
      set: p.set,
      foiling: p.foiling,
      // Always the stored CDN url — ids derive from printing characteristics,
      // so a url built from printing_id would 404.
      image_url: p.image_url,
      tcgplayer_url: p.tcgplayer_url ?? null,
      tcg_low: p.tcg_low,
      tcg_market: p.tcg_market,
    };
  }

  return { success: true, data: { prices, cards, cardUniqueIdByPrinting } };
}
