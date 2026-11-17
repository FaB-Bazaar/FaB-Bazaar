/**
 * Unit tests for bindersClient.getWantedItems() — the binder page's "Add my wants".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getWantedItems } from './binders-client';

function mockJsonResponse(body: any, ok = true, status = 200): Response {
  return { ok, status, statusText: ok ? 'OK' : 'Error', json: async () => body } as unknown as Response;
}
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('bindersClient.getWantedItems', () => {
  it('GETs the wanted endpoint with the match mode and unwraps the items', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, data: [{ _id: 'i1', requestQuantity: 2 }] }));
    const result = await getWantedItems('b1', 'loose');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/binders/b1/wanted?match=loose');
    expect(result).toEqual({ success: true, data: [{ _id: 'i1', requestQuantity: 2 }] });
  });

  it('surfaces an API error as {success:false}', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ error: 'Sign in required' }, false, 401));
    const result = await getWantedItems('b1', 'exact');
    expect(result.success).toBe(false);
  });
});
