/**
 * Unit tests for the create_event MCP handler (superadmin).
 *
 * Thin orchestrator over existing routes (which enforce permissions):
 *   GET  /api/locations?search=…        — find an existing venue/store
 *   POST /api/locations                 — create the venue when no match
 *   POST /api/stores/[id]/events        — create the event
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/mcp-fetch', () => ({
  getMcpApiBaseUrl: () => 'http://localhost:3000',
  mcpFetch: vi.fn(),
}))

import { createEventTool } from './createEvent'
import { mcpFetch } from '@/lib/mcp-fetch'

const mockFetch = vi.mocked(mcpFetch)

const ok = (data: any) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) })

const auth = { mcpToken: 'tok' }

const eventParams = {
  name: 'The Calling: Bologna',
  type: 'calling',
  format: 'Classic Constructed',
  startDate: '2026-09-12',
  endDate: '2026-09-14',
  registrationUrl: 'https://fabtcg.com/calling-bologna',
}

const venueParams = {
  venueName: 'BolognaFiere',
  venueAddressLine1: 'Piazza della Costituzione 6',
  venueCity: 'Bologna',
  venueCountry: 'IT',
}

const callsTo = (path: string) => mockFetch.mock.calls.filter(([url]) => String(url).includes(path))

const optsOf = (call: (typeof mockFetch.mock.calls)[number]) => call[1]!
const bodyOf = (call: (typeof mockFetch.mock.calls)[number]) => JSON.parse(String(optsOf(call).body))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createEventTool.handler', () => {
  it('creates the event directly when locationId is provided (no venue lookup)', async () => {
    mockFetch.mockResolvedValue(ok({ id: 'evt-1', name: 'The Calling: Bologna' }) as any)

    const res = await createEventTool.handler({ ...eventParams, locationId: 'loc-1' }, auth, 'tok')

    expect(res.success).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const call = mockFetch.mock.calls[0]
    expect(String(call[0])).toContain('/api/stores/loc-1/events')
    expect(optsOf(call).method).toBe('POST')
    expect(bodyOf(call)).toMatchObject({
      name: 'The Calling: Bologna',
      type: 'calling',
      format: 'Classic Constructed',
      registrationUrl: 'https://fabtcg.com/calling-bologna',
    })
  })

  it('reuses an existing venue matched by name and city instead of creating a duplicate', async () => {
    mockFetch
      .mockResolvedValueOnce(ok({
        locations: [
          { id: 'loc-other', name: 'BolognaFiere', addressCity: 'Milan' },
          { id: 'loc-match', name: 'bolognafiere', addressCity: 'Bologna' },
        ],
        total: 2,
      }) as any)
      .mockResolvedValueOnce(ok({ id: 'evt-1', name: 'The Calling: Bologna' }) as any)

    const res = await createEventTool.handler({ ...eventParams, ...venueParams }, auth, 'tok')

    expect(res.success).toBe(true)
    expect(callsTo('/api/locations?').length).toBe(1)
    // no POST /api/locations — venue reused
    expect(callsTo('/api/stores/loc-match/events').length).toBe(1)
  })

  it('creates the venue (category venue) when no existing location matches', async () => {
    mockFetch
      .mockResolvedValueOnce(ok({ locations: [], total: 0 }) as any)
      .mockResolvedValueOnce(ok({ id: 'loc-new', name: 'BolognaFiere' }) as any)
      .mockResolvedValueOnce(ok({ id: 'evt-1', name: 'The Calling: Bologna' }) as any)

    const res = await createEventTool.handler({ ...eventParams, ...venueParams }, auth, 'tok')

    expect(res.success).toBe(true)
    const createLocCall = mockFetch.mock.calls[1]
    expect(String(createLocCall[0])).toMatch(/\/api\/locations$/)
    expect(optsOf(createLocCall).method).toBe('POST')
    expect(bodyOf(createLocCall)).toMatchObject({
      category: 'venue',
      name: 'BolognaFiere',
      addressLine1: 'Piazza della Costituzione 6',
      addressCity: 'Bologna',
      addressCountry: 'IT',
    })
    expect(callsTo('/api/stores/loc-new/events').length).toBe(1)
  })

  it('defaults endDate to startDate for one-day events', async () => {
    mockFetch.mockResolvedValue(ok({ id: 'evt-1' }) as any)

    await createEventTool.handler(
      { name: 'Store Champ', startDate: '2026-08-01', locationId: 'loc-1' },
      auth, 'tok'
    )

    const body = bodyOf(mockFetch.mock.calls[0])
    expect(body.startDate).toBe('2026-08-01')
    expect(body.endDate).toBe('2026-08-01')
  })

  it('errors without fetching when neither locationId nor complete venue fields are given', async () => {
    const res = await createEventTool.handler({ ...eventParams, venueName: 'BolognaFiere' }, auth, 'tok')

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/venue/i)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('errors without fetching when endDate is before startDate', async () => {
    const res = await createEventTool.handler(
      { name: 'X', startDate: '2026-11-01', endDate: '2026-10-12', locationId: 'loc-1' },
      auth, 'tok'
    )

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/endDate/i)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('errors without fetching when name or startDate is missing', async () => {
    const res = await createEventTool.handler({ locationId: 'loc-1', name: 'X' }, auth, 'tok')

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/startDate/i)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('surfaces a permission error when the API returns 403', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403, text: async () => 'Forbidden' } as any)

    const res = await createEventTool.handler({ ...eventParams, locationId: 'loc-1' }, auth, 'tok')

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/denied|admin/i)
  })
})
