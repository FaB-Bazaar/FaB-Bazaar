/**
 * Unit tests for the store/location MCP handlers:
 *   list_stores  — GET  /api/locations (public browse, filterable)
 *   get_store    — GET  /api/locations/[id]
 *   create_store — POST /api/locations (superadmin; route enforces role)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/mcp-fetch', () => ({
  getMcpApiBaseUrl: () => 'http://localhost:3000',
  mcpFetch: vi.fn(),
}))

import { listStoresTool, getStoreTool, createStoreTool } from './stores'
import { mcpFetch } from '@/lib/mcp-fetch'

const mockFetch = vi.mocked(mcpFetch)

const ok = (data: any) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) })

const auth = { mcpToken: 'tok' }

const urlOf = (i = 0) => String(mockFetch.mock.calls[i][0])
const bodyOf = (i = 0) => JSON.parse(String(mockFetch.mock.calls[i][1]!.body))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listStoresTool.handler', () => {
  it('browses locations with the provided filters', async () => {
    mockFetch.mockResolvedValue(ok({ locations: [{ id: 'l1', name: 'Game Store', addressCity: 'Austin' }], total: 1 }) as any)

    const res = await listStoresTool.handler(
      { search: 'game', country: 'US', state: 'TX', category: 'store', limit: 5 },
      auth, 'tok'
    )

    expect(res.success).toBe(true)
    const url = urlOf()
    expect(url).toContain('/api/locations?')
    expect(url).toContain('search=game')
    expect(url).toContain('country=US')
    expect(url).toContain('state=TX')
    expect(url).toContain('category=store')
    expect(url).toContain('limit=5')
    expect(res.data.total).toBe(1)
  })

  it('omits filters that are not provided', async () => {
    mockFetch.mockResolvedValue(ok({ locations: [], total: 0 }) as any)

    await listStoresTool.handler({}, auth, 'tok')

    const url = urlOf()
    expect(url).not.toContain('search=')
    expect(url).not.toContain('country=')
  })

  it('returns an error when the API fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' } as any)

    const res = await listStoresTool.handler({}, auth, 'tok')

    expect(res.success).toBe(false)
  })
})

describe('getStoreTool.handler', () => {
  it('fetches a location by id', async () => {
    mockFetch.mockResolvedValue(ok({ id: 'loc-1', name: 'Game Store', addressCity: 'Austin' }) as any)

    const res = await getStoreTool.handler({ locationId: 'loc-1' }, auth, 'tok')

    expect(res.success).toBe(true)
    expect(urlOf()).toContain('/api/locations/loc-1')
    expect(res.data.name).toBe('Game Store')
  })

  it('errors without fetching when locationId is missing', async () => {
    const res = await getStoreTool.handler({}, auth, 'tok')

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/locationId/i)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('reports not-found cleanly on 404', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, text: async () => 'Not found' } as any)

    const res = await getStoreTool.handler({ locationId: 'nope' }, auth, 'tok')

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/not found/i)
  })
})

describe('createStoreTool.handler', () => {
  const valid = {
    name: 'New Game Store',
    addressLine1: '1 Main St',
    addressCity: 'Austin',
    addressState: 'TX',
    addressCountry: 'US',
    contactWebsite: 'https://store.example',
  }

  it('POSTs the location with category defaulting to store', async () => {
    mockFetch.mockResolvedValue(ok({ id: 'loc-new', name: 'New Game Store' }) as any)

    const res = await createStoreTool.handler(valid, auth, 'tok')

    expect(res.success).toBe(true)
    expect(urlOf()).toMatch(/\/api\/locations$/)
    expect(bodyOf()).toMatchObject({
      category: 'store',
      name: 'New Game Store',
      addressLine1: '1 Main St',
      addressCity: 'Austin',
      addressState: 'TX',
      addressCountry: 'US',
      contactWebsite: 'https://store.example',
    })
  })

  it('accepts an explicit venue category', async () => {
    mockFetch.mockResolvedValue(ok({ id: 'loc-new' }) as any)

    await createStoreTool.handler({ ...valid, category: 'venue' }, auth, 'tok')

    expect(bodyOf().category).toBe('venue')
  })

  it('errors without fetching when required address fields are missing', async () => {
    const res = await createStoreTool.handler({ name: 'X', addressCity: 'Austin' }, auth, 'tok')

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/address/i)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('surfaces a permission error when the API returns 403', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403, text: async () => 'Forbidden' } as any)

    const res = await createStoreTool.handler(valid, auth, 'tok')

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/denied|admin/i)
  })
})
