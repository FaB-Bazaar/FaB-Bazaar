/**
 * Unit tests for decksClient matchup-write, co-owner, and ownership-status
 * methods — the endpoints DeckMatchupsDialog, DeckSettings, and the deck
 * search dialogs currently hit with raw fetch().
 *
 * Matchup create/update both send `{ matchup }` as the body (POST to the
 * collection for new, PUT to /matchups/<heroId> for existing) — that split is
 * what saveDeckMatchup encapsulates.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  saveDeckMatchup,
  deleteDeckMatchup,
  getDeckCoOwners,
  updateDeckCoOwners,
  getOwnershipStatus,
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

const matchup = {
  heroId: 'briar_warden_of_thorns',
  preferredTurnOrder: 'First',
  notes: 'Race her.',
  sideboard: { in: [], out: [] },
} as any;

describe('decksClient.saveDeckMatchup', () => {
  it('POSTs to the collection when creating (no existingHeroId)', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: true, data: { matchups: [matchup] } }),
    );

    const result = await saveDeckMatchup('abc123', matchup);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/decks/abc123/matchups');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body)).toEqual({ matchup });
    expect(result.success).toBe(true);
  });

  it('PUTs to /matchups/<heroId> when updating an existing entry', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: true, data: { matchups: [matchup] } }),
    );

    const result = await saveDeckMatchup('abc123', matchup, 'briar_warden_of_thorns');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/decks/abc123/matchups/briar_warden_of_thorns');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ matchup });
    expect(result.success).toBe(true);
  });
});

describe('decksClient.deleteDeckMatchup', () => {
  it('DELETEs /matchups/<heroId> with credentials', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: true, data: { matchups: [] } }),
    );

    const result = await deleteDeckMatchup('abc123', 'briar_warden_of_thorns');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/decks/abc123/matchups/briar_warden_of_thorns');
    expect(init.method).toBe('DELETE');
    expect(init.credentials).toBe('include');
    expect(result.success).toBe(true);
  });
});

describe('decksClient.getDeckCoOwners', () => {
  it('GETs the co-owner list with credentials', async () => {
    const coOwners = [{ id: 'u1', username: 'mistercakes', avatar: null }];
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, data: coOwners }));

    const result = await getDeckCoOwners('abc123');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/decks/abc123/co-owners');
    expect(init.credentials).toBe('include');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(coOwners);
  });
});

describe('decksClient.updateDeckCoOwners', () => {
  it('PUTs the userIds array', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, data: [] }));

    const result = await updateDeckCoOwners('abc123', ['u1', 'u2']);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/decks/abc123/co-owners');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ userIds: ['u1', 'u2'] });
    expect(result.success).toBe(true);
  });
});

describe('decksClient.getOwnershipStatus', () => {
  it('POSTs the printingIds batch and unwraps the top-level ownership map', async () => {
    // The route is nonstandard: `ownership`/`summary` ride at the TOP LEVEL
    // of the body (no `data` key).
    const ownership = { p1: { owned: 2 } };
    const summary = { totalCardsOwned: 2 };
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: true, ownership, summary }),
    );

    const result = await getOwnershipStatus(['p1', 'p2']);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/decks/ownership-status');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ printingIds: ['p1', 'p2'] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ownership).toEqual(ownership);
      expect(result.data.summary).toEqual(summary);
      // the raw body must not leak through
      expect(result.data).not.toHaveProperty('success');
    }
  });

  it('returns the API error on auth failure', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: false, error: 'Authentication required' }, false, 401),
    );

    const result = await getOwnershipStatus(['p1']);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Authentication required');
  });
});
