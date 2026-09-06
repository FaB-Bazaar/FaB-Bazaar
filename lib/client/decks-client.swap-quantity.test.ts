/**
 * decksClient.swapPrinting — the optional copy count must ride in the body so
 * the deck lightbox can move 1, 2 or all copies to another printing; omitting
 * it must leave the body unchanged for existing single-copy callers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { swapPrinting } from './decks-client';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ success: true, data: {} }) } as unknown as Response);
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('decksClient.swapPrinting quantity', () => {
  it('posts quantity when given', async () => {
    await swapPrinting('pub-1', 'old', 'new', 'maindeck', 3);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/decks/pub-1/printings/swap');
    expect(JSON.parse(init.body)).toEqual({ oldPrintingId: 'old', newPrintingId: 'new', category: 'maindeck', quantity: 3 });
  });

  it('omits quantity from the body when not given', async () => {
    await swapPrinting('pub-1', 'old', 'new', 'maindeck');
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ oldPrintingId: 'old', newPrintingId: 'new', category: 'maindeck' });
  });
});
