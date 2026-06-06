/**
 * Unit tests for GET /api/banned-cards/heroes — public read-only endpoint that
 * returns heroes excluded/flagged in a format, both as a flat id list (for the
 * matchup-picker hook) and with per-hero status (for the create-deck badge).
 *
 * Service is mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/services', () => ({
  bannedCardsService: { listExcludedHeroes: vi.fn() },
}))
vi.mock('@/lib/redis', () => ({
  getRedisClient: () => null, // bypass cache in tests
}))

import { GET } from './route'
import { bannedCardsService } from '@/lib/services'

const mockListExcludedHeroes = vi.mocked(bannedCardsService.listExcludedHeroes)

const makeRequest = (qs = '') =>
  new NextRequest(`http://localhost/api/banned-cards/heroes${qs}`)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/banned-cards/heroes', () => {
  it('returns excludedHeroIds and status-rich excludedHeroes for a valid format', async () => {
    mockListExcludedHeroes.mockResolvedValue({
      success: true,
      data: [
        { cardUniqueId: 'hero-oldhim', status: 'living_legend' },
        { cardUniqueId: 'hero-ira', status: 'benched' },
      ],
    } as any)

    const res = await GET(makeRequest('?format=classic_constructed'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.excludedHeroIds).toEqual(['hero-oldhim', 'hero-ira'])
    expect(body.data.excludedHeroes).toEqual([
      { cardUniqueId: 'hero-oldhim', status: 'living_legend' },
      { cardUniqueId: 'hero-ira', status: 'benched' },
    ])
    expect(mockListExcludedHeroes).toHaveBeenCalledWith('classic_constructed')
  })

  it('400 when format query param missing', async () => {
    const res = await GET(makeRequest(''))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(mockListExcludedHeroes).not.toHaveBeenCalled()
  })

  it('400 when format is invalid', async () => {
    const res = await GET(makeRequest('?format=fake_format'))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(mockListExcludedHeroes).not.toHaveBeenCalled()
  })

  it('500 when service returns failure', async () => {
    mockListExcludedHeroes.mockResolvedValue({ success: false, error: 'DB unreachable' } as any)

    const res = await GET(makeRequest('?format=silver_age'))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.error).toBe('DB unreachable')
  })

  it('returns empty arrays when no heroes are excluded for the format', async () => {
    mockListExcludedHeroes.mockResolvedValue({ success: true, data: [] } as any)

    const res = await GET(makeRequest('?format=blitz'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.excludedHeroIds).toEqual([])
    expect(body.data.excludedHeroes).toEqual([])
  })

  it('does not require authentication (public endpoint)', async () => {
    mockListExcludedHeroes.mockResolvedValue({ success: true, data: [] } as any)

    const res = await GET(makeRequest('?format=living_legend'))
    expect(res.status).toBe(200)
  })
})
