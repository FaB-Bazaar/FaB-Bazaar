/**
 * Unit tests for decksClient.getPrintingPrices() — the Prices view's
 * "Compare printings" fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getPrintingPrices } from './decks-client';

const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('decksClient.getPrintingPrices', () => {
  it('GETs /api/decks/<id>/printing-prices and unwraps data', async () => {
    const byCard = { c1: { cheapest: { low: 1, url: 'https://tcg/1' }, s: { low: 1, url: 'https://tcg/1' } } };
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ success: true, data: { byCard } }) } as unknown as Response);
    const res = await getPrintingPrices('deck-1');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/decks/deck-1/printing-prices');
    expect(res).toEqual({ success: true, data: { byCard } });
  });
});
