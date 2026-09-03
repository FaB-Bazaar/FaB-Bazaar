/**
 * Unit tests for wantsClient.sendWantsInterestNotification().
 *
 * Wraps POST /api/wants/user/[userId]/notify-interest — the "Notify"
 * button on a store page's Trade Opportunities tile ("they want — you
 * have"). Awaited (unlike the fire-and-forget notifyWantsInterest) so the
 * tile can say whether the ping fired or was suppressed by the dedupe.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendWantsInterestNotification } from './wants-client';

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
  cards: [{ name: 'Pounamu Amulet', quantity: 1, value: 8.88 }],
  totalValue: 8.88,
};

describe('wantsClient.sendWantsInterestNotification', () => {
  it('POSTs the cards to the wants notify-interest route and reports notified=true', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, data: { notified: true } }));

    const result = await sendWantsInterestNotification('user-2', payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/wants/user/user-2/notify-interest');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(payload);
    expect(result).toEqual({ notified: true });
  });

  it('reports notified=false when the server deduped the ping', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, data: { notified: false } }));

    await expect(sendWantsInterestNotification('user-2', payload)).resolves.toEqual({ notified: false });
  });

  it('throws with the server error message on a non-OK response', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ error: 'Unauthorized' }, false, 401));

    await expect(sendWantsInterestNotification('user-2', payload)).rejects.toThrow('Unauthorized');
  });
});
