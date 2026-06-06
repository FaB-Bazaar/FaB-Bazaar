import { NextRequest, NextResponse } from 'next/server'
import { bannedCardsService } from '@/lib/services'
import { BANNED_FORMATS, type BannedFormat } from '@/lib/services/contracts/IBannedCardsService'
import { getRedisClient } from '@/lib/redis'

const CACHE_TTL_SECONDS = 300 // 5 minutes
// v2: cached value is now ExcludedHero[] ({cardUniqueId,status}), not string[].
const cacheKey = (format: BannedFormat) => `banned-cards:heroes:v2:${format}`

function isValidFormat(f: string): f is BannedFormat {
  return (BANNED_FORMATS as readonly string[]).includes(f)
}

/**
 * GET /api/banned-cards/heroes?format=classic_constructed
 *
 * Public. Returns active banned hero card_unique_ids for the given format.
 * Used by client components (DeckMatchupsDialog, MatchupArena) to filter
 * their hero pickers from the registry instead of the legacy hardcoded
 * lib/fab-banned-cards.ts list. Cached 5 min in Redis.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format')

  if (!format) {
    return NextResponse.json(
      { success: false, error: 'format query parameter is required' },
      { status: 400 },
    )
  }
  if (!isValidFormat(format)) {
    return NextResponse.json(
      { success: false, error: `Invalid format. Must be one of: ${BANNED_FORMATS.join(', ')}` },
      { status: 400 },
    )
  }

  const redis = getRedisClient()
  if (redis) {
    try {
      const cached = await redis.get(cacheKey(format))
      if (cached) {
        const heroes = JSON.parse(cached) as Array<{ cardUniqueId: string; status: string }>
        return NextResponse.json({
          success: true,
          data: { excludedHeroIds: heroes.map(h => h.cardUniqueId), excludedHeroes: heroes },
        })
      }
    } catch (err) {
      console.error('[banned-cards/heroes GET] cache read error:', err)
    }
  }

  const result = await bannedCardsService.listExcludedHeroes(format)
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 })
  }

  if (redis) {
    try {
      await redis.set(cacheKey(format), JSON.stringify(result.data), 'EX', CACHE_TTL_SECONDS)
    } catch (err) {
      console.error('[banned-cards/heroes GET] cache write error:', err)
    }
  }

  return NextResponse.json({
    success: true,
    data: { excludedHeroIds: result.data.map(h => h.cardUniqueId), excludedHeroes: result.data },
  })
}
