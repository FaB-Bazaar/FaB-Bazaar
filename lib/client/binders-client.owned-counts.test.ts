/**
 * Unit tests for bindersClient.getOwnedCountsByCard() — card-level ownership
 * (any printing variant counts) behind the /browse URL prefill. Pins the
 * endpoint, POST body, credentials, and the {success,data} unwrap.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getOwnedCountsByCard } from './binders-client';

function mockJsonResponse(body: any, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('bindersClient.getOwnedCountsByCard', () => {
  it('POSTs cardUniqueIds to /api/inventory/owned-counts', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, data: {} }));

    await getOwnedCountsByCard(['card-1', 'card-2']);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/inventory/owned-counts');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ cardUniqueIds: ['card-1', 'card-2'] });
  });

  it('returns the owned map keyed by cardUniqueId', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, data: { 'card-1': 3 } }));

    const result = await getOwnedCountsByCard(['card-1']);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data['card-1']).toBe(3);
  });

  it('surfaces a 401 as { success: false }', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ error: 'Unauthorized' }, false, 401));

    const result = await getOwnedCountsByCard(['card-1']);
    expect(result.success).toBe(false);
  });
});
