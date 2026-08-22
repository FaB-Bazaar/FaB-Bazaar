/**
 * Unit tests for bindersClient.getBindersByCard() — which of the user's
 * binders hold any printing of a card (card-details lightbox). Pins the
 * endpoint, POST body, and the {success,data} unwrap.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBindersByCard } from './binders-client';

function mockJsonResponse(body: any, ok = true, status = 200): Response {
  return { ok, status, statusText: ok ? 'OK' : 'Error', json: async () => body } as unknown as Response;
}

const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('bindersClient.getBindersByCard', () => {
  it('POSTs cardUniqueIds to /api/inventory/binders-by-card and unwraps data', async () => {
    const payload = { c1: [{ binderId: 'b1', name: 'Main', slug: 'main', quantity: 2 }] };
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, data: payload }));
    const result = await getBindersByCard(['c1']);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/inventory/binders-by-card');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ cardUniqueIds: ['c1'] });
    expect(result).toEqual({ success: true, data: payload });
  });

  it('surfaces an API error as {success:false}', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ error: 'Unauthorized' }, false, 401));
    const result = await getBindersByCard(['c1']);
    expect(result.success).toBe(false);
  });
});
