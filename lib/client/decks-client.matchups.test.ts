/**
 * Unit tests for decksClient.getDeckMatchups().
 *
 * Pins the endpoint (`GET /api/decks/<id>/matchups`) and the {success,data}
 * unwrap — the Volzar chat "View matchups" panel consumes this.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDeckMatchups } from './decks-client';

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

describe('decksClient.getDeckMatchups', () => {
  it('GETs /api/decks/<id>/matchups and unwraps the matchups list', async () => {
    const matchup = {
      heroId: 'briar_warden_of_thorns',
      preferredTurnOrder: 'First',
      notes: 'Race her.',
      sideboard: { in: ['unmovable_blue'], out: ['sink_below_red'] },
    };
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: true, data: { matchups: [matchup] } }),
    );

    const result = await getDeckMatchups('abc123');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/decks/abc123/matchups');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.matchups).toEqual([matchup]);
  });

  it('returns the API error on failure', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: false, error: 'Deck not found' }, false, 404),
    );

    const result = await getDeckMatchups('missing');

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Deck not found');
  });
});
