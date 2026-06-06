import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth/multi-auth'
import { bannedCardsService, userService } from '@/lib/services'
import {
  BANNED_FORMATS,
  type BannedFormat,
  type RestrictionType,
} from '@/lib/services/contracts/IBannedCardsService'
import { getRedisClient } from '@/lib/redis'

/**
 * Per (format, restrictionType), the upstream FaB-cube JSON URL. Add entries
 * here as new ban/restricted lists get published.
 */
const FAB_CUBE_URLS: Partial<Record<BannedFormat, Partial<Record<RestrictionType, string>>>> = {
  silver_age: {
    banned: 'https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/refs/heads/develop/json/english/banned-silver-age.json',
  },
  classic_constructed: {
    banned: 'https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/refs/heads/develop/json/english/banned-cc.json',
  },
  living_legend: {
    banned: 'https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/refs/heads/develop/json/english/banned-ll.json',
    restricted: 'https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/refs/heads/develop/json/english/restricted-ll.json',
  },
}

function isValidFormat(f: string): f is BannedFormat {
  return (BANNED_FORMATS as readonly string[]).includes(f)
}

/**
 * POST /api/banned-cards/sync
 * Superadmin only. Body: { format, restrictionType? }
 *   restrictionType defaults to 'banned'. Pass 'restricted' to sync the LL
 *   restricted-1-per-deck list.
 * Fetches the FaB-cube JSON, diffs against local rows, upserts.
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

  const { format } = body
  const restrictionType: RestrictionType = body.restrictionType === 'restricted' ? 'restricted' : 'banned'

  if (!isValidFormat(format)) {
    return NextResponse.json({ success: false, error: `Invalid format. Must be one of: ${BANNED_FORMATS.join(', ')}` }, { status: 400 })
  }

  const url = FAB_CUBE_URLS[format]?.[restrictionType]
  if (!url) {
    return NextResponse.json(
      { success: false, error: `No upstream source configured for ${format} / ${restrictionType}` },
      { status: 400 },
    )
  }

  let upstream: unknown
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return NextResponse.json({ success: false, error: `Upstream returned HTTP ${res.status}` }, { status: 502 })
    }
    upstream = await res.json()
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch upstream' },
      { status: 502 },
    )
  }

  if (!Array.isArray(upstream)) {
    return NextResponse.json({ success: false, error: 'Upstream payload is not an array' }, { status: 502 })
  }

  const result = await bannedCardsService.syncFromUpstream(format, restrictionType, upstream as any[])
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 })
  }

  // Invalidate cache for this format (covers both restriction types)
  const redis = getRedisClient()
  if (redis) {
    try { await redis.del(`banned-cards:${format}`) } catch { /* best-effort */ }
  }

  return NextResponse.json({ success: true, data: result.data })
}
