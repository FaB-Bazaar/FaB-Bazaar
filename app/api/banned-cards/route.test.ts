/**
 * Unit tests for POST /api/banned-cards — superadmin upsert of a registry entry.
 * Must pass the full taxonomy through to the service: restrictionType (banned /
 * restricted / benched / living_legend) and the benching window
 * (dateExpires / untilSet / reason). Service + auth mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/services', () => ({
  bannedCardsService: { upsert: vi.fn() },
  userService: { hasRole: vi.fn() },
}))
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }))
vi.mock('@/lib/redis', () => ({ getRedisClient: () => null }))

import { POST } from './route'
import { bannedCardsService, userService } from '@/lib/services'
import { authenticateRequest } from '@/lib/auth/multi-auth'

const mockUpsert = vi.mocked(bannedCardsService.upsert)
const mockHasRole = vi.mocked(userService.hasRole)
const mockAuth = vi.mocked(authenticateRequest)

const post = (body: any) =>
  POST(new NextRequest('http://localhost/api/banned-cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ success: true, userId: 'admin-1' } as any)
  mockHasRole.mockResolvedValue({ success: true, data: true } as any)
  mockUpsert.mockResolvedValue({ success: true, data: { id: 'row-1' } } as any)
})

describe('POST /api/banned-cards', () => {
  it('passes restrictionType and benching window through to the service', async () => {
    const res = await post({
      cardUniqueId: 'card-ira',
      format: 'silver_age',
      restrictionType: 'benched',
      dateInEffect: '2026-05-29T00:00:00.000Z',
      dateExpires: '2026-12-01T00:00:00.000Z',
      untilSet: 'Set 20',
      reason: 'community_vote',
    })

    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      cardUniqueId: 'card-ira',
      format: 'silver_age',
      restrictionType: 'benched',
      dateExpires: '2026-12-01T00:00:00.000Z',
      untilSet: 'Set 20',
      reason: 'community_vote',
    }))
  })

  it('defaults to a plain ban when restrictionType is omitted', async () => {
    await post({ cardUniqueId: 'card-x', format: 'classic_constructed' })
    const arg = mockUpsert.mock.calls[0][0]
    expect(arg.restrictionType ?? 'banned').toBe('banned')
  })

  it('403 when the caller is not a superadmin', async () => {
    mockHasRole.mockResolvedValue({ success: true, data: false } as any)
    const res = await post({ cardUniqueId: 'c', format: 'silver_age' })
    expect(res.status).toBe(403)
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('400 on an invalid restrictionType', async () => {
    const res = await post({ cardUniqueId: 'c', format: 'silver_age', restrictionType: 'bogus' })
    expect(res.status).toBe(400)
    expect(mockUpsert).not.toHaveBeenCalled()
  })
})
