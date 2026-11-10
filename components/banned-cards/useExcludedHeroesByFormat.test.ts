/**
 * useExcludedHeroesByFormat — the create-deck dialog needs every format's hero
 * restrictions. One request for all of them (it used to be one per format).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useExcludedHeroesByFormat } from '@/hooks/banned-cards/useExcludedHeroes'

global.fetch = vi.fn()

beforeEach(() => {
  ;(global.fetch as any).mockReset()
})

const FORMATS = ['Classic Constructed', 'Silver Age', 'Blitz'] as const

describe('useExcludedHeroesByFormat', () => {
  it('makes one request for all formats and keys the maps by display name', async () => {
    ;(global.fetch as any).mockResolvedValue({
      json: async () => ({
        success: true,
        data: { byFormat: { classic_constructed: [], silver_age: [{ cardUniqueId: 'h1', status: 'benched' }], blitz: [{ cardUniqueId: 'h2', status: 'banned' }] } },
      }),
    })

    const { result } = renderHook(() => useExcludedHeroesByFormat(FORMATS))

    await waitFor(() => expect(result.current['Blitz'].get('h2')).toBe('banned'))
    expect(result.current['Silver Age'].get('h1')).toBe('benched')
    expect(result.current['Classic Constructed'].size).toBe(0)
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect((global.fetch as any).mock.calls[0][0]).toBe('/api/banned-cards/heroes?formats=classic_constructed,silver_age,blitz')
  })

  it('gives every format an empty map before the request resolves and when it fails', async () => {
    ;(global.fetch as any).mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useExcludedHeroesByFormat(FORMATS))
    expect(Object.keys(result.current)).toEqual([...FORMATS])
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    for (const f of FORMATS) expect(result.current[f].size).toBe(0)
  })
})
