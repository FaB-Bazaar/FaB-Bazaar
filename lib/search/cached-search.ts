/**
 * Redis-cached card search, shared by POST /api/printings/search and the
 * nightly cache warm-up (POST /api/cron/warm-search-cache). Entries are keyed
 * by a hash of the { filters, options } body and live 24h, but are only served
 * while no price has changed since they were written (_priceVersion).
 */

import { createHash } from 'crypto';
import { printingsService } from '@/lib/services';
import type { PrintingsSearchFilters, PrintingsSearchOptions, PrintingsSearchResult } from '@/lib/services/contracts/IPrintingsService';
import { getRedisClient } from '@/lib/redis';
import { db } from '@/lib/postgres/db';
import { printings } from '@/lib/postgres/schema';
import { sql } from 'drizzle-orm';

function sortedKeys<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))
  ) as T;
}

// Bump when search RESULT SHAPE or ORDERING logic changes (not on data changes —
// those are handled by _priceVersion). Without this, a sort/logic change keeps
// serving stale cached results for up to the 24h TTL after deploy.
//   v2 — pitch tiebreak (red→yellow→blue) on name sorts
//   v3 — Marvels demoted globally (not just within their set) in the
//        canonical printing cascade
//   v4 — hero legality: non-hybrid multi-class cards need EVERY class
//        (Pirate Necromancer no longer in a Necromancer-only pool)
//   v6 — migration 0113 swapped DTD164 non-foil faces/images outside a
//        nightly run (cached bodies carry other_face_* / image_url)
//   v7 — rarity sort uses a rank (Promo → Fabled → Marvel → … → Token),
//        not the alphabetical rarity code
const SEARCH_CACHE_VERSION = 'v7';

function buildSearchCacheKey(filters: PrintingsSearchFilters, options: PrintingsSearchOptions): string {
  const hash = createHash('sha256')
    .update(JSON.stringify({ filters: sortedKeys(filters), options: sortedKeys(options) }))
    .digest('hex')
    .slice(0, 16);
  return `search:${SEARCH_CACHE_VERSION}:${hash}`;
}

export type CachedSearchResult =
  /** cached = served from Redis; stored = a miss whose result was written to Redis. */
  | { success: true; data: PrintingsSearchResult; cached: boolean; stored: boolean; cacheKey: string }
  | { success: false; error: string };

/**
 * Search through the cache. `filters` must already be normalized the way the
 * route does it (viewer/owner ids resolved from auth) — personalized searches
 * never touch Redis.
 */
export async function runCachedSearch(
  filters: PrintingsSearchFilters,
  options: PrintingsSearchOptions,
): Promise<CachedSearchResult> {
  // Fetch current price version (MAX price_updated_at) to detect stale cache
  let currentPriceVersion = 'unknown';
  try {
    const [{ maxTs }] = await db
      .select({ maxTs: sql<string>`MAX(price_updated_at)::text` })
      .from(printings);
    currentPriceVersion = maxTs ?? 'unknown';
  } catch (err) {
    console.error('[Printings Search] Price version query error:', err);
  }

  // Personalized searches (viewer id set) NEVER touch the cache: the cache
  // invalidates on price changes only, but the user's own votes change their
  // results instantly — a cached personal entry is stale the moment they vote.
  const personalized = Boolean(filters.facetTagsViewerId || filters.ownedByUserId);

  const cacheKey = buildSearchCacheKey(filters, options);
  const redis = personalized ? null : getRedisClient();

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached !== null) {
        const parsed = JSON.parse(cached);
        if (parsed._priceVersion === currentPriceVersion) {
          return { success: true, data: parsed, cached: true, stored: false, cacheKey }; // Fresh — use cache
        }
        // else: stale prices — fall through to DB query
      }
    } catch (err) {
      console.error('[Printings Search] Cache read error:', err);
    }
  }

  // Cache miss — query the database
  const result = await printingsService.searchPrintings(filters, options);
  if (!result.success) return { success: false, error: result.error };

  // Cache only non-empty results (empty results may be transient)
  let stored = false;
  if (redis && result.data.total > 0) {
    try {
      await redis.set(
        cacheKey,
        JSON.stringify({ ...result.data, _priceVersion: currentPriceVersion }),
        'EX',
        86400
      );
      stored = true;
    } catch (err) {
      console.error('[Printings Search] Cache write error:', err);
    }
  }

  return { success: true, data: result.data, cached: false, stored, cacheKey };
}
