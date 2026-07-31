/**
 * Unit tests for heroesClient — wrappers for the two hero lookup routes the
 * deck surfaces (MatchupArena, CreateDeckDialog, presenter) hit with raw
 * fetch().
 *
 * `/api/heroes` uses the standard { success, data } body; `/api/hero-printings`
 * is nonstandard — `heroes`/`count` ride at the top level — so
 * getHeroPrintings repackages instead of using handleResponse.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getHeroes, getHeroPrintings } from './heroes-client';

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

describe('heroesClient.getHeroes', () => {
  it('GETs /api/heroes without params when no format given', async () => {
    const rows = [{ heroName: 'Oldhim, Grandfather of Eternity' }];
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, data: rows }));

    const result = await getHeroes();

    expect(fetchMock.mock.calls[0][0]).toBe('/api/heroes');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(rows);
  });

  it('passes the format code as a query param', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, data: [] }));

    await getHeroes('cc');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/heroes?format=cc');
  });

  it('surfaces the API error body', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({ error: 'Invalid format: xx' }, false, 400),
    );

    const result = await getHeroes('xx');

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Invalid format: xx');
  });
});

describe('heroesClient.getHeroPrintings', () => {
  it('GETs with format and unwraps the top-level heroes list', async () => {
    const heroes = [{ name: 'Briar', image_url: 'https://x/briar.png' }];
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: true, heroes, count: 1 }),
    );

    const result = await getHeroPrintings('young');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/hero-printings?format=young');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.heroes).toEqual(heroes);
      expect(result.data.count).toBe(1);
    }
  });

  it('returns an error result on a non-OK response', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse(null, false, 500));

    const result = await getHeroPrintings('adult');

    expect(result.success).toBe(false);
  });
});
