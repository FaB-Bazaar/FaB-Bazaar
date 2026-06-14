/**
 * Unit tests for decksClient.duplicateDeck().
 *
 * Regression guard: this method historically targeted `/api/decks/<id>/duplicate`,
 * a route that does not exist — every Copy click on a deck tile 404'd. The real
 * route is `/api/decks/<id>/copy`. These tests pin the correct endpoint + method
 * and the {success,data} unwrap.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { duplicateDeck, copyDeck } from './decks-client';

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

describe('decksClient.duplicateDeck', () => {
  it('POSTs to the real /api/decks/<id>/copy endpoint (not /duplicate)', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: true, data: { publicId: 'new', name: 'Copy of X' } }),
    );

    await duplicateDeck('abc123');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/decks/abc123/copy');
    expect(init?.method).toBe('POST');
  });

  it('unwraps {success,data} on success', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: true, data: { publicId: 'new', name: 'Copy of X' } }),
    );

    const result = await duplicateDeck('abc123');

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('Copy of X');
  });
});

describe('decksClient.copyDeck', () => {
  it('includes language in the POST body when given', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: true, data: { publicId: 'new', name: 'Copy of X' } }),
    );

    await copyDeck('abc123', 'Copy of X', 'fr');

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ name: 'Copy of X', language: 'fr' });
  });

  it('omits language from the body for a verbatim copy', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: true, data: { publicId: 'new', name: 'Copy of X' } }),
    );

    await copyDeck('abc123', 'Copy of X');

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ name: 'Copy of X' });
  });
});
