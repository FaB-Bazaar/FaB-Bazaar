/**
 * Unit tests for decksClient deck-notes and game-results methods.
 *
 * Pins the endpoints and response unwrapping for the sub-resources the deck
 * page tabs consume (DeckNotesTab, DeckResultsTab, GameDeepDive, MatchupArena).
 * The results list is the one non-standard shape in the deck API — `total`
 * rides at the TOP LEVEL of the body, not inside `data` — so getDeckResults
 * must repackage `{ data, total }` into `{ games, total }` rather than relying
 * on handleResponse (which would silently drop `total`).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getDeckNotes,
  saveDeckNotes,
  getDeckResults,
  getDeckResult,
  getDeckResultRaw,
  deleteDeckResult,
} from './decks-client';

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

describe('decksClient.getDeckNotes', () => {
  it('GETs /api/decks/<id>/notes and unwraps the three note maps', async () => {
    const payload = {
      notes: '# Gameplan',
      cardNotes: { abc: 'pitch this' },
      matchupNotes: { briar: 'race her' },
    };
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, data: payload }));

    const result = await getDeckNotes('abc123');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/decks/abc123/notes');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(payload);
  });
});

describe('decksClient.saveDeckNotes', () => {
  it('PUTs a partial update as JSON', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: true, data: { notes: 'x', cardNotes: {}, matchupNotes: {} } }),
    );

    const result = await saveDeckNotes('abc123', { notes: 'x' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/decks/abc123/notes');
    expect(init.method).toBe('PUT');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ notes: 'x' });
    expect(result.success).toBe(true);
  });

  it('returns the API validation error on failure', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: false, error: 'notes must be a string' }, false, 400),
    );

    const result = await saveDeckNotes('abc123', { notes: 'x' });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('notes must be a string');
  });
});

describe('decksClient.getDeckResults', () => {
  it('GETs with limit/offset and preserves the top-level total', async () => {
    const games = [{ id: 'g1' }, { id: 'g2' }];
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: true, data: games, total: 42 }),
    );

    const result = await getDeckResults('abc123', { limit: 20, offset: 10 });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/decks/abc123/results?limit=20&offset=10');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.games).toEqual(games);
      expect(result.data.total).toBe(42);
    }
  });

  it('omits query params when no options are given', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, data: [], total: 0 }));

    await getDeckResults('abc123');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/decks/abc123/results');
  });
});

describe('decksClient.getDeckResult', () => {
  it('GETs the result detail by id', async () => {
    const detail = { id: 'g1', turns: [] };
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, data: detail }));

    const result = await getDeckResult('abc123', 'g1');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/decks/abc123/results/g1');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(detail);
  });
});

describe('decksClient.getDeckResultRaw', () => {
  it('GETs the raw log and tolerates a null payload', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, data: null }));

    const result = await getDeckResultRaw('abc123', 'g1');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/decks/abc123/results/g1/raw');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });
});

describe('decksClient.deleteDeckResult', () => {
  it('DELETEs the result and reports success for a data-less body', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true }));

    const result = await deleteDeckResult('abc123', 'g1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/decks/abc123/results/g1');
    expect(init.method).toBe('DELETE');
    expect(result.success).toBe(true);
  });

  it('surfaces the API error when deletion is rejected', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: false, error: 'Unauthorized' }, false, 403),
    );

    const result = await deleteDeckResult('abc123', 'g1');

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Unauthorized');
  });
});
