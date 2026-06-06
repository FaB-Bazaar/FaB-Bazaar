/**
 * Unit tests for the manage_card_restriction MCP handler (superadmin).
 * Thin wrapper over POST /api/banned-cards — the route enforces the role.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/mcp-fetch', () => ({
  getMcpApiBaseUrl: () => 'http://localhost:3000',
  mcpFetch: vi.fn(),
}))

import { manageCardRestrictionTool } from './manageCardRestriction'
import { mcpFetch } from '@/lib/mcp-fetch'

const mockFetch = vi.mocked(mcpFetch)

const ok = (data: any) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('manageCardRestrictionTool.handler', () => {
  it('POSTs a benched restriction with its window to /api/banned-cards', async () => {
    mockFetch.mockResolvedValue(ok({ id: 'row-1', cardUniqueId: 'card-ira', restrictionType: 'benched' }) as any)

    const res = await manageCardRestrictionTool.handler({
      cardUniqueId: 'card-ira',
      format: 'silver_age',
      status: 'benched',
      dateInEffect: '2026-05-29T00:00:00.000Z',
      dateExpires: '2026-12-01T00:00:00.000Z',
      untilSet: 'Set 20',
      reason: 'community_vote',
    }, { mcpToken: 'tok' }, 'tok')

    expect(res.success).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/banned-cards')
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body)
    expect(body).toMatchObject({
      cardUniqueId: 'card-ira',
      format: 'silver_age',
      restrictionType: 'benched',
      statusActive: true,
      dateExpires: '2026-12-01T00:00:00.000Z',
      untilSet: 'Set 20',
      reason: 'community_vote',
    })
  })

  it('lifts a restriction by sending statusActive=false when active is false', async () => {
    mockFetch.mockResolvedValue(ok({ id: 'row-1', restrictionType: 'banned' }) as any)

    await manageCardRestrictionTool.handler(
      { cardUniqueId: 'c', format: 'classic_constructed', status: 'banned', active: false },
      { mcpToken: 'tok' }, 'tok',
    )

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.statusActive).toBe(false)
  })

  it('defaults status to banned and active to true', async () => {
    mockFetch.mockResolvedValue(ok({ id: 'row-1', restrictionType: 'banned' }) as any)

    await manageCardRestrictionTool.handler(
      { cardUniqueId: 'c', format: 'classic_constructed' }, { mcpToken: 'tok' }, 'tok',
    )

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.restrictionType).toBe('banned')
    expect(body.statusActive).toBe(true)
  })

  it('surfaces a 403 as a permission error and does not throw', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403, text: async () => 'forbidden' } as any)

    const res = await manageCardRestrictionTool.handler(
      { cardUniqueId: 'c', format: 'silver_age', status: 'banned' }, { mcpToken: 'tok' }, 'tok',
    )
    expect(res.success).toBe(false)
    expect((res as any).error).toMatch(/admin/i)
  })

  it('requires cardUniqueId and format', async () => {
    const res = await manageCardRestrictionTool.handler({ format: 'silver_age' }, { mcpToken: 'tok' }, 'tok')
    expect(res.success).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
