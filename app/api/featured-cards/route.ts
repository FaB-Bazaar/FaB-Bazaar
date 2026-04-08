import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/lib/postgres/db';
import { siteSettings } from '@/lib/postgres/schema';
import { printingsService } from '@/lib/services';
import { getOrSet } from '@/lib/cache';
import { eq } from 'drizzle-orm';
import type { PrintingDTO } from '@/lib/services/contracts/IPrintingsService';
import { FEATURED_CARDS_KEY, FEATURED_CACHE_KEY, refreshFeaturedPrintingIds } from '@/lib/featured-cards-refresh';

const CACHE_KEY = FEATURED_CACHE_KEY;
const CACHE_TTL = 86400; // 24h — prices update once/day

interface FeaturedCard {
  printing_id: string;
  card_unique_id: string;
  name: string;
  collector_number?: string;
  set: string;
  foiling: string;
  rarity: string;
  is_extended_art: boolean;
  art_variations: string[];
  tcg_low?: number | null;
  tcg_market?: number | null;
  tcgplayer_url?: string | null;
  image_url?: string | null;
}

function toFeaturedCard(p: PrintingDTO): FeaturedCard {
  return {
    printing_id: p.printing_id,
    card_unique_id: p.card_unique_id,
    name: p.name,
    collector_number: p.collector_number,
    set: p.set,
    foiling: p.foiling,
    rarity: p.rarity,
    is_extended_art: p.is_extended_art ?? false,
    art_variations: p.art_variations ?? [],
    tcg_low: p.tcg_low,
    tcg_market: p.tcg_market,
    tcgplayer_url: p.tcgplayer_url ?? null,
    image_url: p.image_url ?? null,
  };
}

async function fetchFeaturedCards(): Promise<FeaturedCard[]> {
  const rows = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, FEATURED_CARDS_KEY))
    .limit(1);

  const printingIds: string[] =
    rows.length > 0 && Array.isArray(rows[0].value) ? (rows[0].value as string[]) : [];

  if (printingIds.length === 0) return [];

  const result = await printingsService.getPrintingsByIds(printingIds, { limit: 50 });
  if (!result.success) {
    console.error('[FeaturedCards] getPrintingsByIds failed:', result.error);
    return [];
  }

  return result.data.printings.map(toFeaturedCard);
}

export async function GET(_request: NextRequest) {
  try {
    // Check site_settings directly before trusting Redis.
    // A stale cached [] in Redis would otherwise prevent the bootstrap from ever running.
    const rows = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, FEATURED_CARDS_KEY))
      .limit(1);

    const hasStoredIds =
      rows.length > 0 &&
      Array.isArray(rows[0].value) &&
      (rows[0].value as string[]).length > 0;

    // When site_settings is empty, return [] immediately and kick off the
    // bootstrap after the response is sent so the page doesn't spin waiting.
    if (!hasStoredIds) {
      after(async () => {
        console.log('[FeaturedCards] site_settings empty — running bootstrap after response');
        try {
          await refreshFeaturedPrintingIds();
        } catch (err) {
          console.error('[FeaturedCards] Bootstrap failed:', err);
        }
      });
      return NextResponse.json(
        { success: true, cards: [] },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const cards = await getOrSet<FeaturedCard[]>(CACHE_KEY, fetchFeaturedCards, CACHE_TTL);

    return NextResponse.json(
      { success: true, cards },
      { headers: { 'Cache-Control': 'public, s-maxage=3600' } }
    );
  } catch (error) {
    console.error('[FeaturedCards] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch featured cards' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
