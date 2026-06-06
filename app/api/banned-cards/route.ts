import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth/multi-auth'
import { bannedCardsService, userService } from '@/lib/services'
import { BANNED_FORMATS, RESTRICTION_TYPES, type BannedFormat, type RestrictionType } from '@/lib/services/contracts/IBannedCardsService'
import { getRedisClient } from '@/lib/redis'

const CACHE_TTL_SECONDS = 300 // 5 minutes
const cacheKey = (format: BannedFormat) => `banned-cards:${format}`

function isValidFormat(f: string): f is BannedFormat {
  return (BANNED_FORMATS as readonly string[]).includes(f)
}

/**
 * GET /api/banned-cards?format=silver_age
 * Public. Returns active banned entries for the given format. Cached 5 min in Redis.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format')
  const includeInactive = searchParams.get('includeInactive') === 'true'

  if (!format) {
    return NextResponse.json({ success: false, error: 'format query parameter is required' }, { status: 400 })
  }
  if (!isValidFormat(format)) {
    return NextResponse.json({ success: false, error: `Invalid format. Must be one of: ${BANNED_FORMATS.join(', ')}` }, { status: 400 })
  }

  // includeInactive bypasses cache (admin-leaning use)
  if (!includeInactive) {
    const redis = getRedisClient()
    if (redis) {
      try {
        const cached = await redis.get(cacheKey(format))
        if (cached) {
          return NextResponse.json({ success: true, data: JSON.parse(cached) })
        }
      } catch (err) {
        console.error('[banned-cards GET] cache read error:', err)
      }
    }
  }

  const result = await bannedCardsService.listByFormat(format, { includeInactive })
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 })
  }

  if (!includeInactive) {
    const redis = getRedisClient()
    if (redis) {
      try {
        await redis.set(cacheKey(format), JSON.stringify(result.data), 'EX', CACHE_TTL_SECONDS)
      } catch (err) {
        console.error('[banned-cards GET] cache write error:', err)
      }
    }
  }

  return NextResponse.json({ success: true, data: result.data })
}

/**
 * POST /api/banned-cards
 * Superadmin only. Upsert a single banned-card entry.
 * Body: { cardUniqueId, format, statusActive?, dateAnnounced?, dateInEffect?, legalityArticle?, sourceUniqueId? }
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ success: false, error: 'Invalid body' }, { status: 400 })
  }

  const authResult = await authenticateRequest(request, body, { allowOAuth: true })
  if (!authResult.success) {
    return NextResponse.json({ success: false, error: authResult.error || 'Authentication required' }, { status: 401 })
  }

  const adminCheck = await userService.hasRole(authResult.userId!, 'isSuperAdmin')
  const isSuperAdmin = !!(adminCheck.success && adminCheck.data)
  if (!isSuperAdmin) {
    return NextResponse.json({ success: false, error: 'Super Admin role required' }, { status: 403 })
  }

  const { cardUniqueId, format } = body
  if (typeof cardUniqueId !== 'string' || !cardUniqueId) {
    return NextResponse.json({ success: false, error: 'cardUniqueId is required' }, { status: 400 })
  }
  if (!isValidFormat(format)) {
    return NextResponse.json({ success: false, error: `Invalid format. Must be one of: ${BANNED_FORMATS.join(', ')}` }, { status: 400 })
  }
  const restrictionType: RestrictionType | undefined = body.restrictionType
  if (restrictionType !== undefined && !(RESTRICTION_TYPES as readonly string[]).includes(restrictionType)) {
    return NextResponse.json({ success: false, error: `Invalid restrictionType. Must be one of: ${RESTRICTION_TYPES.join(', ')}` }, { status: 400 })
  }

  const result = await bannedCardsService.upsert({
    cardUniqueId,
    format,
    restrictionType,
    sourceUniqueId: body.sourceUniqueId ?? null,
    statusActive: body.statusActive,
    dateAnnounced: body.dateAnnounced ?? null,
    dateInEffect: body.dateInEffect ?? null,
    dateExpires: body.dateExpires ?? null,
    untilSet: body.untilSet ?? null,
    reason: body.reason ?? null,
    legalityArticle: body.legalityArticle ?? null,
  })
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 })
  }

  // Invalidate cache for this format
  const redis = getRedisClient()
  if (redis) {
    try { await redis.del(cacheKey(format)) } catch { /* best-effort */ }
  }

  return NextResponse.json({ success: true, data: result.data })
}
