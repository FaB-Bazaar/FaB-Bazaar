/**
 * Unit tests: who_has strips internal dc_/gh_ username prefixes in its
 * human-readable output, while keeping the raw username in structured data
 * (raw names are needed for profile URLs and follow-up tool calls) and
 * adding display_username alongside it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/mcp-fetch', () => ({
  getMcpApiBaseUrl: () => 'http://localhost:3000',
  mcpFetch: vi.fn(),
}))

import { whoHasTool } from './whoHas'
import { mcpFetch } from '@/lib/mcp-fetch'

const mockFetch = vi.mocked(mcpFetch)

const apiResponse = {
  success: true,
  search_mode: 'specific_printings',
  summary: { total_owners_found: 1, total_cards_found: 2, unique_printings_found: 1, total_value_found: 50 },
  metadata: { current_page: 1, total_pages: 1 },
  owners: [
    {
      username: 'dc_delzed',
      total_cards_found: 2,
      total_value: 50,
      binders: [
        {
          binder_name: 'Trades',
          total_cards_found: 2,
          total_value: 50,
          matching_cards: [
            { total_quantity: 2, display_name: 'Command and Conquer', set: 'hvy', foiling: 'r', tcg_low: 25 },
          ],
        },
      ],
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => apiResponse,
  } as any)
})

describe('who_has display names', () => {
  it('strips the dc_ prefix in the human-readable message', async () => {
    const res = await whoHasTool.handler({ printingIds: ['p1'] }, { mcpToken: 'tok' }, 'tok')

    expect(res.message).toContain('delzed')
    expect(res.message).not.toContain('dc_delzed')
  })

  it('keeps the raw username in structured owners and adds display_username', async () => {
    const res = await whoHasTool.handler({ printingIds: ['p1'] }, { mcpToken: 'tok' }, 'tok')

    expect(res.owners[0].username).toBe('dc_delzed')
    expect(res.owners[0].display_username).toBe('delzed')
  })
})
