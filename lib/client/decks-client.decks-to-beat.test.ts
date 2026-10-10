/**
 * decksClient.getCardDecksToBeat — the lightbox "Decks to Beat" button's
 * on-click fetch. Successful answers are memoised per card for the session so
 * reopening the panel (or stepping back to a card with ←/→) never refetches;
 * failures are not memoised so a retry can succeed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCardDecksToBeat, clearCardDecksToBeatCache } from './decks-client';

const DATA = { decks: [], totalsByFormat: { 'Classic Constructed': 256 } };
const ok = () => ({ ok: true, status: 200, statusText: 'OK', json: async () => ({ success: true, data: DATA }) } as unknown as Response);
const fail = () => ({ ok: false, status: 500, statusText: 'Error', json: async () => ({ error: 'boom' }) } as unknown as Response);

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  clearCardDecksToBeatCache();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('decksClient.getCardDecksToBeat', () => {
  it('GETs the card\'s decks-to-beat route', async () => {
    fetchMock.mockResolvedValue(ok());
    const res = await getCardDecksToBeat('card-1');
    expect(fetchMock).toHaveBeenCalledWith('/api/cards/card-1/decks-to-beat');
    expect(res).toEqual({ success: true, data: DATA });
  });

  it('serves a repeat call for the same card from memory', async () => {
    fetchMock.mockResolvedValue(ok());
    await getCardDecksToBeat('card-1');
    const again = await getCardDecksToBeat('card-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(again).toEqual({ success: true, data: DATA });
  });

  it('shares one in-flight request between concurrent calls for the same card', async () => {
    fetchMock.mockResolvedValue(ok());
    const [a, b] = await Promise.all([getCardDecksToBeat('card-1'), getCardDecksToBeat('card-1')]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it('does not memoise a failure', async () => {
    fetchMock.mockResolvedValueOnce(fail()).mockResolvedValueOnce(ok());
    const first = await getCardDecksToBeat('card-1');
    const second = await getCardDecksToBeat('card-1');
    expect(first.success).toBe(false);
    expect(second.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
