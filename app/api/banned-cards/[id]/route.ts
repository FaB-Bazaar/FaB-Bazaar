import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth/multi-auth'
import { bannedCardsService, userService } from '@/lib/services'
import { getRedisClient } from '@/lib/redis'

async function requireSuperAdmin(request: NextRequest, body: unknown) {
  const authResult = await authenticateRequest(request, body ?? {})
  if (!authResult.success) {
    return { ok: false as const, status: 401, error: authResult.error || 'Authentication required' }
  }
  const roleCheck = await userService.hasRole(authResult.userId!, 'isSuperAdmin')
  const isSuperAdmin = !!(roleCheck.success && roleCheck.data)
  if (!isSuperAdmin) {
    return { ok: false as const, status: 403, error: 'Super Admin role required' }
  }
  return { ok: true as const }
}

async function invalidateAllFormats() {
  const redis = getRedisClient()
  if (!redis) return
  try {
    const keys = await redis.keys('banned-cards:*')
    if (keys.length > 0) await redis.del(...keys)
  } catch { /* best-effort */ }
}

/**
 * PATCH /api/banned-cards/[id]
 * Superadmin only. Body: { statusActive: boolean }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ success: false, error: 'Invalid body' }, { status: 400 })
  }

  const gate = await requireSuperAdmin(request, body)
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status })

  if (typeof body.statusActive !== 'boolean') {
    return NextResponse.json({ success: false, error: 'statusActive (boolean) is required' }, { status: 400 })
  }

  const result = await bannedCardsService.setActive(id, body.statusActive)
  if (!result.success) {
    const status = result.error === 'Banned card not found' ? 404 : 500
    return NextResponse.json({ success: false, error: result.error }, { status })
  }

  await invalidateAllFormats()
  return NextResponse.json({ success: true, data: result.data })
}

/**
 * DELETE /api/banned-cards/[id]
 * Superadmin only. Hard-delete. Prefer PATCH with statusActive=false for history.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const gate = await requireSuperAdmin(request, null)
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status })

  const result = await bannedCardsService.deleteById(id)
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 })
  }

  await invalidateAllFormats()
  return NextResponse.json({ success: true })
}
