import { sql } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { siteSettings } from '@/lib/postgres/schema';
import { invalidate } from '@/lib/cache';

export const FEATURED_CARDS_KEY = 'featured_printing_ids';
export const FEATURED_CACHE_KEY = 'featured_cards';

const RARITY_QUOTAS = [
  { rarity: 'm', limit: 8 },  // majestic
  { rarity: 'l', limit: 6 },  // legendary
  { rarity: 'f', limit: 6 },  // fabled
];

const MIN_TCG_LOW = 20;

/**
 * Picks the top N tradeable cards for a given rarity by tcg_low price,
 * deduped by card_unique_id (highest-priced printing wins per card).
 */
async function fetchFeaturedByRarity(rarity: string, limit: number): Promise<string[]> {
  const rows = await db.execute(sql`
    SELECT printing_id FROM (
      SELECT DISTINCT ON (p.card_unique_id)
        p.printing_id,
        p.tcg_low
      FROM inventory_items i
      JOIN printings p ON i.printing_id = p.printing_id
      JOIN binders b ON i.binder_id = b.id
      WHERE i.for_trade = true
        AND b.allow_who_has = true
        AND p.image_url IS NOT NULL
        AND p.rarity = ${rarity}
        AND p.tcg_low >= ${MIN_TCG_LOW}
      ORDER BY p.card_unique_id, p.tcg_low DESC
    ) deduped
    ORDER BY tcg_low DESC
    LIMIT ${limit}
  `);

  return rows.rows.map((r: Record<string, unknown>) => r.printing_id as string);
}

/**
 * Queries the inventory for featured card printing IDs across rarity tiers,
 * saves the result to site_settings, and invalidates the Redis cache.
 * Only writes to site_settings when results are found.
 * Returns the list of printing IDs that were saved.
 */
export async function refreshFeaturedPrintingIds(): Promise<string[]> {
  const results = await Promise.all(
    RARITY_QUOTAS.map(({ rarity, limit }) => fetchFeaturedByRarity(rarity, limit))
  );

  const printingIds = results.flat();

  if (printingIds.length > 0) {
    await db
      .insert(siteSettings)
      .values({ key: FEATURED_CARDS_KEY, value: printingIds })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: printingIds, updatedAt: new Date() },
      });

    await invalidate(FEATURED_CACHE_KEY);
  }

  return printingIds;
}
