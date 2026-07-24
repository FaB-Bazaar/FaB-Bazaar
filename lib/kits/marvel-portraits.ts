// lib/kits/marvel-portraits.ts
//
// Resolves Marvel (cold foil) portrait art for the Starter Kits pages.
// URLs must be read from the printing row's image_url — image ids are derived
// from printing characteristics, and the old printing_id-keyed Cloudflare
// images were deleted, so a URL constructed from a printing_id 404s.

import { HERO_MARVEL_PRINTING_IDS } from '@/lib/fab-constants/heroes';
import type { IPrintingsService } from '@/lib/services/contracts/IPrintingsService';

/**
 * Look up the live image_url for each hero's Marvel printing.
 * Heroes without a Marvel printing, or whose printing has no image, are
 * omitted — callers keep whatever fallback art they already resolved.
 */
export async function resolveMarvelPortraitUrls(
  heroNames: string[],
  printingsService: Pick<IPrintingsService, 'getPrintingsByIds'>
): Promise<Map<string, string>> {
  const printingIdToHero = new Map<string, string>();
  for (const heroName of heroNames) {
    const printingId = HERO_MARVEL_PRINTING_IDS[heroName.toLowerCase()];
    if (printingId) printingIdToHero.set(printingId, heroName);
  }

  const urls = new Map<string, string>();
  if (printingIdToHero.size === 0) return urls;

  // Explicit limit: the search default (50) would silently truncate a large roster.
  const result = await printingsService.getPrintingsByIds(
    Array.from(printingIdToHero.keys()),
    { limit: printingIdToHero.size }
  );
  if (!result.success) return urls;

  for (const printing of result.data.printings) {
    const heroName = printingIdToHero.get(printing.printing_id);
    if (heroName && printing.image_url) urls.set(heroName, printing.image_url);
  }
  return urls;
}
