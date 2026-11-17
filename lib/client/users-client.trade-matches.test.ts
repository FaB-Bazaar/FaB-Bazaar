/**
 * Unit tests for usersClient.getTradeMatches() — /profile/[username]/trade.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTradeMatches } from './users-client';

function mockJsonResponse(body: any, ok = true, status = 200): Response {
  return { ok, status, statusText: ok ? 'OK' : 'Error', json: async () => body } as unknown as Response;
}
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('usersClient.getTradeMatches', () => {
  it('GETs the user trade-matches endpoint with the match mode', async () => {
    const data = { theyHaveYouWant: [], theyWantYouHave: [] };
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, data }));
    const result = await getTradeMatches('u 1', 'loose');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/users/u%201/trade-matches?match=loose');
    expect(result).toEqual({ success: true, data });
  });

  it('surfaces an API error as {success:false}', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ error: 'Sign in required' }, false, 401));
    expect((await getTradeMatches('u1', 'exact')).success).toBe(false);
  });
});
