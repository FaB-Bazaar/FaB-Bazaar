/**
 * GET /api/printings/browse
 *
 * Bulk endpoint for client-side card browsing. Returns all printings with only
 * the fields needed for filtering and display (~30 fields vs 100+ from /search).
 *
 * Estimated payload: ~10–15 MB uncompressed → ~800 KB–1.2 MB gzipped.
 * Redis-cached for 1 hour; HTTP Cache-Control allows CDN + browser caching.
 *
 * Used by: lib/client/browse-cache.ts (module-level singleton on /search page)
 */

import { NextResponse } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { printings, cards } from '@/lib/postgres/schema';
import { getRedisClient } from '@/lib/redis';

const CACHE_KEY = 'browse:all_printings:v1';
const CACHE_TTL_SECONDS = 3600; // 1 hour

export async function GET() {
  // ── Try Redis first ─────────────────────────────────────────────────────────
  const redis = getRedisClient();
  if (redis) {
    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        return new NextResponse(cached, {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
            'X-Cache': 'HIT',
          },
        });
      }
    } catch (err) {
      console.error('[Browse] Redis read error:', err);
    }
  }

  // ── DB query — slim projection, cards JOIN printings ─────────────────────────
  try {
    const rows = await db
      .select({
        // Identity
        printing_id:    printings.printingId,
        card_unique_id: printings.cardUniqueId,

        // Display (cards table)
        display_name:      cards.displayName,
        type_text_display: cards.typeTextDisplay,
        color:             cards.color,

        // Filtering — game stats (cards table)
        types:    cards.types,
        pitch:    cards.pitch,
        power:    cards.power,
        cost:     cards.cost,
        defense:  cards.defense,
        keywords: cards.keywords,

        // Filtering — class boolean flags (cards table)
        is_generic:      cards.isGeneric,
        is_guardian:     cards.isGuardian,
        is_warrior:      cards.isWarrior,
        is_ninja:        cards.isNinja,
        is_wizard:       cards.isWizard,
        is_brute:        cards.isBrute,
        is_ranger:       cards.isRanger,
        is_runeblade:    cards.isRuneblade,
        is_necromancer:  cards.isNecromancer,
        is_mechanologist:cards.isMechanologist,

        // Printing display (printings table)
        image_url:       printings.imageUrl,
        printing_card_id:printings.collectorNumber,   // collector number for checklist
        set:             printings.set,
        edition:         printings.edition,
        foiling:         printings.foiling,
        rarity:          printings.rarity,

        // Price (printings table)
        tcg_low:        printings.tcgLow,
        tcg_market:     printings.tcgMarket,
        tcgplayer_url:  printings.tcgplayerUrl,
      })
      .from(printings)
      .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
      .orderBy(asc(cards.displayName), asc(printings.set));

    const body = JSON.stringify({ success: true, data: { printings: rows } });

    // ── Cache in Redis ──────────────────────────────────────────────────────────
    if (redis) {
      try {
        await redis.set(CACHE_KEY, body, 'EX', CACHE_TTL_SECONDS);
      } catch (err) {
        console.error('[Browse] Redis write error:', err);
      }
    }

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'X-Cache': 'MISS',
      },
    });
  } catch (err) {
    console.error('[Browse] DB query error:', err);
    return NextResponse.json({ success: false, error: 'Failed to load card data' }, { status: 500 });
  }
}
