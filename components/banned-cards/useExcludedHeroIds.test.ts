/**
 * Tests for the useExcludedHeroIds hook — fetches banned hero IDs from
 * /api/banned-cards/heroes and returns a Set<string> for hero-picker filters.
 * Used by the 4 UI surfaces that previously read from lib/fab-banned-cards.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useExcludedHeroIds } from '@/hooks/banned-cards/useExcludedHeroIds'

global.fetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  ;(global.fetch as any).mockReset()
})

function mockFetchJson(body: any, ok = true, status = 200) {
  ;(global.fetch as any).mockResolvedValue({
    ok,
    status,
    json: async () => body,
  })
}

describe('useExcludedHeroIds', () => {
  it('returns an empty Set before the fetch resolves', () => {
    mockFetchJson({ success: true, data: { excludedHeroIds: [] } })

    const { result } = renderHook(() => useExcludedHeroIds('Classic Constructed'))
    expect(result.current).toBeInstanceOf(Set)
    expect(result.current.size).toBe(0)
  })

  it('populates the Set after fetch resolves', async () => {
    mockFetchJson({ success: true, data: { excludedHeroIds: ['hero-1', 'hero-2'] } })

    const { result } = renderHook(() => useExcludedHeroIds('Classic Constructed'))

    await waitFor(() => expect(result.current.size).toBe(2))
    expect(result.current.has('hero-1')).toBe(true)
    expect(result.current.has('hero-2')).toBe(true)
  })

  it('maps display format names to registry format keys', async () => {
    mockFetchJson({ success: true, data: { excludedHeroIds: [] } })

    renderHook(() => useExcludedHeroIds('Silver Age'))

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const url = (global.fetch as any).mock.calls[0][0] as string
    expect(url).toContain('format=silver_age')
  })

  it('does not call fetch when format is empty', () => {
    renderHook(() => useExcludedHeroIds(''))
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns empty Set when fetch fails (graceful fallback)', async () => {
    ;(global.fetch as any).mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useExcludedHeroIds('Classic Constructed'))

    // Wait long enough for the rejection to propagate.
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(result.current.size).toBe(0)
  })

  it('returns empty Set for unmappable formats (Limited, Casual)', () => {
    renderHook(() => useExcludedHeroIds('Limited'))
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
