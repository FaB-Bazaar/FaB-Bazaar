/**
 * Unit tests for the deck versions client calls (the rail deck page's
 * Versions view).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDeckVersion, getDeckVersionDeck, listDeckVersions, saveDeckVersion, setTalisharVersion } from './decks-client';

const fetchMock = vi.fn();
const ok = (body: unknown, status = 200) => ({ ok: true, status, statusText: 'OK', json: async () => body }) as unknown as Response;
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); });

const VERSION = { versionNumber: 1, label: null, createdAt: '2026-11-26T12:00:00.000Z', counts: { hero: 1, equipment: 5, maindeck: 60, inventory: 14, benched: 0, tokens: 0 } };

describe('decksClient deck versions', () => {
  it('listDeckVersions GETs /api/decks/<id>/versions', async () => {
    fetchMock.mockResolvedValue(ok({ success: true, data: { versions: [VERSION] } }));
    const res = await listDeckVersions('deck-1');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/decks/deck-1/versions');
    expect(res).toEqual({ success: true, data: { versions: [VERSION] } });
  });

  it('saveDeckVersion POSTs the note as JSON', async () => {
    fetchMock.mockResolvedValue(ok({ success: true, data: { version: VERSION, created: true } }, 201));
    const res = await saveDeckVersion('deck-1', 'Before the Calling');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/decks/deck-1/versions');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ label: 'Before the Calling' });
    expect(res).toEqual({ success: true, data: { version: VERSION, created: true } });
  });

  it('getDeckVersion GETs /api/decks/<id>/versions/<number>', async () => {
    const full = { ...VERSION, snapshot: { name: 'Deck', format: 'Blitz', heroName: null, cards: [] } };
    fetchMock.mockResolvedValue(ok({ success: true, data: { version: full } }));
    const res = await getDeckVersion('deck-1', 3);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/decks/deck-1/versions/3');
    expect(res).toEqual({ success: true, data: { version: full } });
  });

  it('getDeckVersionDeck GETs /api/decks/<id>/versions/<number>/deck', async () => {
    const deck = { publicId: 'deck-1', maindeck: [{ printingId: 'p', quantity: 3 }] };
    fetchMock.mockResolvedValue(ok({ success: true, data: { deck } }));
    const res = await getDeckVersionDeck('deck-1', 3);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/decks/deck-1/versions/3/deck');
    expect(res).toEqual({ success: true, data: { deck } });
  });

  it('setTalisharVersion PUTs the version number (or null) to /api/decks/<id>/talishar-version', async () => {
    fetchMock.mockResolvedValue(ok({ success: true, data: { talisharVersion: 2 } }));
    const res = await setTalisharVersion('deck-1', 2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/decks/deck-1/talishar-version');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ versionNumber: 2 });
    expect(res).toEqual({ success: true, data: { talisharVersion: 2 } });

    fetchMock.mockResolvedValue(ok({ success: true, data: { talisharVersion: null } }));
    await setTalisharVersion('deck-1', null);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ versionNumber: null });
  });
});
