/**
 * Unit tests for bindersClient.removeCopies() — /scan's "Undo" after adding a card. Pins the endpoint, the PUT
 * body ({ action: 'removeCopies', count }) and the {success,data} unwrap.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { removeCopies } from './binders-client';

function mockJsonResponse(body: any, ok = true, status = 200): Response {
  return { ok, status, statusText: ok ? 'OK' : 'Error', json: async () => body } as unknown as Response;
}
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('bindersClient.removeCopies', () => {
  it('PUTs the removeCopies action to the inventory item and unwraps what remains', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, data: { remaining: 1 } }));
    const result = await removeCopies('b1', 'c1', 2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/binders/b1/cards/c1');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ action: 'removeCopies', count: 2 });
    expect(result).toEqual({ success: true, data: { remaining: 1 } });
  });

  it('surfaces an API error as {success:false}', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ success: false, error: 'Card not found in this binder' }, false, 404));
    const result = await removeCopies('b1', 'c1', 1);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/not found/i);
  });
});
