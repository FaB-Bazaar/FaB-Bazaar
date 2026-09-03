/**
 * Unit tests for bindersClient.sendTradeInterestNotification().
 *
 * Wraps POST /api/binders/[binderId]/notify-trade — the explicit
 * "Notify on Discord" button in the non-owner trade sidebar. Unlike the
 * fire-and-forget notifyTradeInterest() (piggybacks on clipboard copy),
 * this one is awaited so the UI can say whether the ping fired or was
 * suppressed by the 15-minute dedupe window.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendTradeInterestNotification } from './binders-client';

function mockJsonResponse(body: any, ok = true, status = 200): Response {
  return { ok, status, statusText: ok ? 'OK' : 'Error', json: async () => body } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const payload = {
  cards: [{ name: 'Dig Up Dinner', quantity: 3, value: 0.38 }],
  totalValue: 1.14,
};

describe('bindersClient.sendTradeInterestNotification', () => {
  it('POSTs the cards to the binder notify-trade route and reports notified=true', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, data: { notified: true } }));

    const result = await sendTradeInterestNotification('binder-1', payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/binders/binder-1/notify-trade');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(payload);
    expect(result).toEqual({ notified: true });
  });

  it('reports notified=false when the server deduped the ping', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, data: { notified: false } }));

    const result = await sendTradeInterestNotification('binder-1', payload);

    expect(result).toEqual({ notified: false });
  });

  it('throws with the server error message on a non-OK response', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ error: 'Binder not found' }, false, 404));

    await expect(sendTradeInterestNotification('missing', payload)).rejects.toThrow('Binder not found');
  });
});
