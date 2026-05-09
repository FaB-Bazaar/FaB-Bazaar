/**
 * Unit tests for GET /api/banned-cards/heroes — public read-only endpoint
 * that returns the active banned hero card_unique_ids for a format. Used by
 * client components (DeckMatchupsDialog, MatchupArena) to filter their hero
 * pickers without bundling the full ban list at build time.
 *
 * Service is mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/services', () => ({
  bannedCardsService: { listBannedHeroIds: vi.fn() },
}))
vi.mock('@/lib/redis', () => ({
  getRedisClient: () => null, // bypass cache in tests
}))

import { GET } from './route'
import { bannedCardsService } from '@/lib/services'

const mockListBannedHeroIds = vi.mocked(bannedCardsService.listBannedHeroIds)

const makeRequest = (qs = '') =>
  new NextRequest(`http://localhost/api/banned-cards/heroes${qs}`)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/banned-cards/heroes', () => {
  it('returns excludedHeroIds for a valid format', async () => {
    mockListBannedHeroIds.mockResolvedValue({
      success: true,
      data: ['hero-iyslander', 'hero-oldhim'],
    } as any)

    const res = await GET(makeRequest('?format=classic_constructed'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.excludedHeroIds).toEqual(['hero-iyslander', 'hero-oldhim'])
    expect(mockListBannedHeroIds).toHaveBeenCalledWith('classic_constructed')
  })

  it('400 when format query param missing', async () => {
    const res = await GET(makeRequest(''))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(mockListBannedHeroIds).not.toHaveBeenCalled()
  })

  it('400 when format is invalid', async () => {
    const res = await GET(makeRequest('?format=fake_format'))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(mockListBannedHeroIds).not.toHaveBeenCalled()
  })

  it('500 when service returns failure', async () => {
    mockListBannedHeroIds.mockResolvedValue({
      success: false,
      error: 'DB unreachable',
    } as any)

    const res = await GET(makeRequest('?format=silver_age'))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.error).toBe('DB unreachable')
  })

  it('returns empty array when no heroes are banned for the format', async () => {
    mockListBannedHeroIds.mockResolvedValue({ success: true, data: [] } as any)

    const res = await GET(makeRequest('?format=blitz'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.excludedHeroIds).toEqual([])
  })

  it('does not require authentication (public endpoint)', async () => {
    mockListBannedHeroIds.mockResolvedValue({ success: true, data: [] } as any)

    const res = await GET(makeRequest('?format=living_legend'))
    expect(res.status).toBe(200)
  })
})
