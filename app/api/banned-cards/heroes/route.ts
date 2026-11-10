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

type ExcludedHero = { cardUniqueId: string; status: string }

/** One format's excluded heroes: Redis (5 min) first, then the service. null = the read failed. */
async function heroesFor(format: BannedFormat): Promise<{ heroes: ExcludedHero[] } | { error: string }> {
  const redis = getRedisClient()
  if (redis) {
    try {
      const cached = await redis.get(cacheKey(format))
      if (cached) return { heroes: JSON.parse(cached) as ExcludedHero[] }
    } catch (err) {
      console.error('[banned-cards/heroes GET] cache read error:', err)
    }
  }

  const result = await bannedCardsService.listExcludedHeroes(format)
  if (!result.success) return { error: result.error }

  if (redis) {
    try {
      await redis.set(cacheKey(format), JSON.stringify(result.data), 'EX', CACHE_TTL_SECONDS)
    } catch (err) {
      console.error('[banned-cards/heroes GET] cache write error:', err)
    }
  }
  return { heroes: result.data }
}

/**
 * GET /api/banned-cards/heroes?format=classic_constructed
 * GET /api/banned-cards/heroes?formats=classic_constructed,blitz,…
 *
 * Public. Returns active banned hero card_unique_ids for the given format.
 * Used by client components (DeckMatchupsDialog, MatchupArena) to filter
 * their hero pickers from the registry instead of the legacy hardcoded
 * lib/fab-banned-cards.ts list. Cached 5 min in Redis.
 *
 * `formats` answers several formats in one request as
 * `data.byFormat[format]` (the create-deck dialog needs all of them).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const formats = searchParams.get('formats')
  if (formats) {
    const list = [...new Set(formats.split(',').map(f => f.trim()).filter(Boolean))]
    if (!list.every(isValidFormat)) {
      return NextResponse.json(
        { success: false, error: `Invalid format. Must be one of: ${BANNED_FORMATS.join(', ')}` },
        { status: 400 },
      )
    }
    const results = await Promise.all((list as BannedFormat[]).map(heroesFor))
    const failed = results.find((r): r is { error: string } => 'error' in r)
    if (failed) return NextResponse.json({ success: false, error: failed.error }, { status: 500 })
    const byFormat = Object.fromEntries(list.map((f, i) => [f, (results[i] as { heroes: ExcludedHero[] }).heroes]))
    return NextResponse.json({ success: true, data: { byFormat } })
  }

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

  const result = await heroesFor(format)
  if ('error' in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: { excludedHeroIds: result.heroes.map(h => h.cardUniqueId), excludedHeroes: result.heroes },
  })
}
