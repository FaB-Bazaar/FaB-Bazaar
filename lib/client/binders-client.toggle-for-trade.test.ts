/**
 * Unit tests for bindersClient.toggleForTrade().
 *
 * Wraps POST /api/inventory/toggle-for-trade (marks every owned copy of a
 * printing for-trade / not-for-trade). The route's body is nonstandard:
 * `updatedCount` rides at the top level (no `data` key), so the client
 * repackages it. useDeckPage's playmat context menu is the consumer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toggleForTrade } from './binders-client';

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

describe('bindersClient.toggleForTrade', () => {
  it('POSTs the printingId + forTrade flag and unwraps updatedCount', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: true, updatedCount: 3, message: 'Updated 3 inventory items' }),
    );

    const result = await toggleForTrade('p1', true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/inventory/toggle-for-trade');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ printingId: 'p1', forTrade: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.updatedCount).toBe(3);
  });

  it('returns the API error on failure', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: false, error: 'Authentication required' }, false, 401),
    );

    const result = await toggleForTrade('p1', false);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Authentication required');
  });
});
