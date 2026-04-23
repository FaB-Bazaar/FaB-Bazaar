import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth/multi-auth'
import { bannedCardsService, userService } from '@/lib/services'
import { BANNED_FORMATS, type BannedFormat } from '@/lib/services/contracts/IBannedCardsService'
import { getRedisClient } from '@/lib/redis'

const FAB_CUBE_URL: Partial<Record<BannedFormat, string>> = {
  silver_age: 'https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/refs/heads/develop/json/english/banned-silver-age.json',
  classic_constructed: 'https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/refs/heads/develop/json/english/banned-cc.json',
  // Living Legend / Blitz don't have separate upstream lists maintained by the-fab-cube today.
  // Add more entries here if/when they publish them.
}

function isValidFormat(f: string): f is BannedFormat {
  return (BANNED_FORMATS as readonly string[]).includes(f)
}

/**
 * POST /api/banned-cards/sync
 * Superadmin only. Body: { format }
 * Fetches the FaB-cube JSON for the format, diffs against local rows, upserts.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ success: false, error: 'Invalid body' }, { status: 400 })
  }

  const authResult = await authenticateRequest(request, body)
  if (!authResult.success) {
    return NextResponse.json({ success: false, error: authResult.error || 'Authentication required' }, { status: 401 })
  }

  const adminCheck = await userService.hasRole(authResult.userId!, 'isSuperAdmin')
  const isSuperAdmin = !!(adminCheck.success && adminCheck.data)
  if (!isSuperAdmin) {
    return NextResponse.json({ success: false, error: 'Super Admin role required' }, { status: 403 })
  }

  const { format } = body
  if (!isValidFormat(format)) {
    return NextResponse.json({ success: false, error: `Invalid format. Must be one of: ${BANNED_FORMATS.join(', ')}` }, { status: 400 })
  }

  const url = FAB_CUBE_URL[format]
  if (!url) {
    return NextResponse.json({ success: false, error: `No upstream source configured for format "${format}"` }, { status: 400 })
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

  const result = await bannedCardsService.syncFromUpstream(format, upstream as any[])
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 })
  }

  // Invalidate cache for this format
  const redis = getRedisClient()
  if (redis) {
    try { await redis.del(`banned-cards:${format}`) } catch { /* best-effort */ }
  }

  return NextResponse.json({ success: true, data: result.data })
}
