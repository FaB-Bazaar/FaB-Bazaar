/**
 * Unit tests for the list_card_restrictions MCP handler.
 * Reads GET /api/banned-cards?format=... (public).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/mcp-fetch', () => ({
  getMcpApiBaseUrl: () => 'http://localhost:3000',
  mcpFetch: vi.fn(),
}))

import { listCardRestrictionsTool } from './listCardRestrictions'
import { mcpFetch } from '@/lib/mcp-fetch'

const mockFetch = vi.mocked(mcpFetch)

const ok = (data: any) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listCardRestrictionsTool.handler', () => {
  it('GETs entries for a format and returns them', async () => {
    mockFetch.mockResolvedValue(ok([
      { cardUniqueId: 'a', restrictionType: 'banned' },
      { cardUniqueId: 'b', restrictionType: 'living_legend' },
    ]) as any)

    const res = await listCardRestrictionsTool.handler({ format: 'classic_constructed' }, {}, 'tok')

    expect(res.success).toBe(true)
    expect((res as any).data).toHaveLength(2)
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/banned-cards?format=classic_constructed')
  })

  it('passes includeInactive=true through to the query', async () => {
    mockFetch.mockResolvedValue(ok([]) as any)
    await listCardRestrictionsTool.handler({ format: 'silver_age', includeInactive: true }, {}, 'tok')
    expect(mockFetch.mock.calls[0][0]).toContain('includeInactive=true')
  })

  it('requires a format', async () => {
    const res = await listCardRestrictionsTool.handler({}, {}, 'tok')
    expect(res.success).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
