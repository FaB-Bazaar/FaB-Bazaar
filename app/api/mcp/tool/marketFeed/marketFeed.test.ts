/**
 * Unit tests for the superadmin market-feed MCP tools.
 *
 * Thin wrappers over /api/feed (the route enforces superadmin on POST):
 *   submit_market_feed → POST /api/feed   (replaces the whole day)
 *   get_market_feed    → GET  /api/feed?date=…  (read before re-submitting,
 *                        so a re-scan can merge instead of dropping entries)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/mcp-fetch', () => ({
  getMcpApiBaseUrl: () => 'http://localhost:3000',
  mcpFetch: vi.fn(),
}))

import { submitMarketFeedTool, getMarketFeedTool } from './marketFeed'
import { mcpFetch } from '@/lib/mcp-fetch'

const mockFetch = vi.mocked(mcpFetch)
const ok = (data: any) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) })
const auth = { mcpToken: 'tok' }
const listing = { side: 'selling', cardName: 'Sink Below', pitch: 1, price: 1.5 }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('submitMarketFeedTool schema', () => {
  it('accepts a post link per listing', () => {
    expect(submitMarketFeedTool.parameters.properties.listings.items.properties).toHaveProperty('postUrl')
  })

  it('accepts trade wants (no price) and variants', () => {
    const item = submitMarketFeedTool.parameters.properties.listings.items as any
    expect(item.properties.side.enum).toEqual(['selling', 'buying', 'trade'])
    expect(item.properties).toHaveProperty('variant')
    expect(item.required).toEqual(['side', 'cardName'])
  })

  it('explains how to send a "willing to trade for" list', () => {
    expect(submitMarketFeedTool.description).toMatch(/trade/i)
    expect(submitMarketFeedTool.description).toMatch(/Marvel/)
  })
})

describe('submitMarketFeedTool.handler', () => {
  it('POSTs the day to /api/feed with the caller bearer', async () => {
    mockFetch.mockResolvedValue(ok({ feedDate: '2026-09-24', count: 1, unmatched: [] }) as any)

    const res = await submitMarketFeedTool.handler({ feedDate: '2026-09-24', listings: [listing] }, auth, 'tok')

    expect(res.success).toBe(true)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(String(url)).toBe('http://localhost:3000/api/feed')
    expect(opts!.method).toBe('POST')
    expect((opts!.headers as any).Authorization).toBe('Bearer tok')
    expect(JSON.parse(String(opts!.body))).toEqual({ feedDate: '2026-09-24', listings: [listing] })
    expect(res.message).toMatch(/1 listing/)
  })

  it('names unmatched cards in the message so the client can fix them', async () => {
    mockFetch.mockResolvedValue(ok({ feedDate: '2026-09-24', count: 2, unmatched: ['Sink Below'], looseMatches: [], suggestions: [] }) as any)
    const res = await submitMarketFeedTool.handler({ listings: [listing, listing] }, auth, 'tok')
    expect(res.message).toContain('Sink Below')
  })

  it('reports loose matches so a wrong guess can be spotted', async () => {
    mockFetch.mockResolvedValue(ok({
      feedDate: '2026-09-24', count: 1, unmatched: [], suggestions: [],
      looseMatches: [{ cardName: 'Become the Shadowlord', matchedName: 'Become the Shadow Lord' }],
    }) as any)
    const res = await submitMarketFeedTool.handler({ listings: [listing] }, auth, 'tok')
    expect(res.message).toContain('"Become the Shadowlord" → Become the Shadow Lord')
  })

  it('lists suggestions for unmatched names, with collector numbers, so the client can fix and resubmit', async () => {
    mockFetch.mockResolvedValue(ok({
      feedDate: '2026-09-24', count: 1, unmatched: ['Command'], looseMatches: [],
      suggestions: [{ cardName: 'Command', candidates: [
        { name: 'Command and Conquer', pitch: 1, collectorNumbers: ['ARC159'] },
        { name: 'Command the Currents', pitch: null, collectorNumbers: [] },
      ] }],
    }) as any)
    const res = await submitMarketFeedTool.handler({ listings: [listing] }, auth, 'tok')
    expect(res.message).toContain('"Command" — did you mean: Command and Conquer (red, ARC159), Command the Currents?')
    expect(res.message).toMatch(/resubmit/i)
  })

  it('omits feedDate when not given (server defaults to today, US Eastern)', async () => {
    mockFetch.mockResolvedValue(ok({ feedDate: '2026-09-24', count: 1, unmatched: [] }) as any)
    await submitMarketFeedTool.handler({ listings: [listing] }, auth, 'tok')
    expect(JSON.parse(String(mockFetch.mock.calls[0][1]!.body))).toEqual({ listings: [listing] })
  })

  it('refuses without listings (no request)', async () => {
    const res = await submitMarketFeedTool.handler({ feedDate: '2026-09-24' }, auth, 'tok')
    expect(res.success).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('maps 403 to a superadmin message', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403, text: async () => 'Forbidden' } as any)
    const res = await submitMarketFeedTool.handler({ listings: [listing] }, auth, 'tok')
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Super Admin/)
  })

  it('surfaces the route validation error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400, text: async () => '{"error":"listings[0].price must be a positive number"}' } as any)
    const res = await submitMarketFeedTool.handler({ listings: [{ ...listing, price: 0 }] }, auth, 'tok')
    expect(res.error).toContain('price must be a positive number')
  })
})

describe('getMarketFeedTool.handler', () => {
  it('GETs the requested day and returns the listings', async () => {
    const day = { feedDate: '2026-09-24', listings: [{ id: 'l1', ...listing }], dates: [] }
    mockFetch.mockResolvedValue(ok(day) as any)

    const res = await getMarketFeedTool.handler({ feedDate: '2026-09-24' }, auth, 'tok')

    expect(String(mockFetch.mock.calls[0][0])).toBe('http://localhost:3000/api/feed?date=2026-09-24')
    expect(res.success).toBe(true)
    expect(res.data.listings).toHaveLength(1)
  })

  it('puts the listings in the message in submit-ready shape (clients only show the model the text)', async () => {
    const stored = {
      id: 'l1', side: 'selling', cardName: 'x', cardUniqueId: 'cu-1', displayName: 'Potion of Strength',
      pitch: 3, collectorNumber: 'WTR171', foiling: 'r', condition: null, price: 25, currency: 'USD',
      groupName: 'FaB UK', postUrl: 'https://www.facebook.com/groups/1/posts/2/', variant: 'Marvel', tcgLow: 0.17, imageUrl: 'img',
    }
    mockFetch.mockResolvedValue(ok({ feedDate: '2026-09-24', listings: [stored], dates: [] }) as any)

    const res = await getMarketFeedTool.handler({ feedDate: '2026-09-24' }, auth, 'tok')

    const json = res.message!.slice(res.message!.indexOf('['))
    expect(JSON.parse(json)).toEqual([
      { side: 'selling', cardName: 'x', pitch: 3, collectorNumber: 'WTR171', foiling: 'r', price: 25, currency: 'USD', groupName: 'FaB UK', postUrl: 'https://www.facebook.com/groups/1/posts/2/', variant: 'Marvel' },
    ])
  })

  it('tells the client how many stored listings are missing their post link', async () => {
    const withLink = { id: 'a', side: 'selling', cardName: 'A', price: 1, currency: 'USD', postUrl: 'https://www.facebook.com/groups/1/posts/2/' }
    const noLink = { id: 'b', side: 'buying', cardName: 'B', price: 1, currency: 'USD', postUrl: null }
    mockFetch.mockResolvedValue(ok({ feedDate: '2026-09-24', listings: [withLink, noLink, { ...noLink, id: 'c' }], dates: [] }) as any)

    const res = await getMarketFeedTool.handler({ feedDate: '2026-09-24' }, auth, 'tok')

    expect(res.message).toMatch(/2 listing\(s\) have no postUrl/)
  })

  it('stays quiet about links when every listing has one', async () => {
    const withLink = { id: 'a', side: 'selling', cardName: 'A', price: 1, currency: 'USD', postUrl: 'https://www.facebook.com/groups/1/posts/2/' }
    mockFetch.mockResolvedValue(ok({ feedDate: '2026-09-24', listings: [withLink], dates: [] }) as any)
    const res = await getMarketFeedTool.handler({}, auth, 'tok')
    expect(res.message).not.toMatch(/no postUrl/)
  })

  it('defaults to today (no date param)', async () => {
    mockFetch.mockResolvedValue(ok({ feedDate: '2026-09-24', listings: [], dates: [] }) as any)
    await getMarketFeedTool.handler({}, auth, 'tok')
    expect(String(mockFetch.mock.calls[0][0])).toBe('http://localhost:3000/api/feed')
  })
})
