// app/api/cards/[cardUniqueId]/decks-to-beat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { deckService } from '@/lib/services';
import { getRedisClient } from '@/lib/redis';

// Decks to Beat change only when a curator adds/features one, so a short TTL
// is enough freshness without explicit invalidation.
const CACHE_TTL_SECONDS = 600;
const cacheKey = (cardUniqueId: string) => `card-decks-to-beat:v1:${cardUniqueId}`;
// card_unique_id is a nanoid; anything else would only pollute the cache.
const CARD_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * GET /api/cards/[cardUniqueId]/decks-to-beat
 *
 * Public. Decks to Beat (featured + public) that play any printing of the
 * card, plus per-format Decks-to-Beat totals. Lazy-fetched by the
 * card-details lightbox "Decks to Beat" button — never on lightbox open.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cardUniqueId: string }> }
) {
  try {
    const { cardUniqueId } = await params;
    if (!CARD_ID_RE.test(cardUniqueId)) {
      return NextResponse.json({ error: 'Invalid card id' }, { status: 400 });
    }

    const redis = getRedisClient();
    if (redis) {
      try {
        const cached = await redis.get(cacheKey(cardUniqueId));
        if (cached) return NextResponse.json({ success: true, data: JSON.parse(cached) });
      } catch (err) {
        console.error('[decks-to-beat GET] cache read error:', err);
      }
    }

    const result = await deckService.getCardDecksToBeat(cardUniqueId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    if (redis) {
      try {
        await redis.set(cacheKey(cardUniqueId), JSON.stringify(result.data), 'EX', CACHE_TTL_SECONDS);
      } catch (err) {
        console.error('[decks-to-beat GET] cache write error:', err);
      }
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error fetching card Decks to Beat:', error);
    return NextResponse.json({ error: 'Failed to fetch Decks to Beat' }, { status: 500 });
  }
}
