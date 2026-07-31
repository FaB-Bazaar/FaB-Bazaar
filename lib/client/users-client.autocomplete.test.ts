/**
 * Unit tests for usersClient.autocompleteUsers().
 *
 * The route (`GET /api/users/autocomplete`) is one of the nonstandard bodies:
 * it returns `{ success, users }` with the list at the TOP LEVEL (no `data`
 * key), so the client must repackage rather than use handleResponse.
 * DeckSettings' co-owner picker is the consumer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { autocompleteUsers } from './users-client';

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

describe('usersClient.autocompleteUsers', () => {
  it('GETs with encoded query + deckId and unwraps the top-level users list', async () => {
    const users = [{ id: 'u1', username: 'mistercakes', avatar: null }];
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, users }));

    const result = await autocompleteUsers('mister cakes', 'deck123');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/users/autocomplete?q=mister%20cakes&deckId=deck123');
    expect(init.credentials).toBe('include');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(users);
  });

  it('returns the API error on failure', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: false, error: 'Forbidden' }, false, 403),
    );

    const result = await autocompleteUsers('x', 'deck123');

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Forbidden');
  });
});
