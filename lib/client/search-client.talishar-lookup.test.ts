/**
 * Unit tests for searchClient.lookupByTalisharIds() — the batch card lookup
 * behind the URL deck-import preview. Pins the endpoint, the POST body shape
 * ({ ids, details }), and the {success,data} unwrap keyed by input id.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lookupByTalisharIds } from './search-client';

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

describe('searchClient.lookupByTalisharIds', () => {
  it('POSTs ids and the details flag to /api/cards/by-talishar-id', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, data: {} }));

    await lookupByTalisharIds(['comet_storm__shock_red'], { details: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/cards/by-talishar-id');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ ids: ['comet_storm__shock_red'], details: true });
  });

  it('returns the lookup map keyed by input id', async () => {
    const card = { displayName: 'Comet Storm // Shock', pitch: 1, printingId: 'p1', imageUrl: null };
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: true, data: { comet_storm__shock_red: card } }),
    );

    const result = await lookupByTalisharIds(['comet_storm__shock_red']);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data['comet_storm__shock_red'].displayName).toBe('Comet Storm // Shock');
    }
  });

  it('surfaces API errors as { success: false }', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ success: false, error: 'boom' }, false, 500));

    const result = await lookupByTalisharIds(['x']);
    expect(result.success).toBe(false);
  });
});
