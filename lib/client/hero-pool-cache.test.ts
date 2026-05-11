/**
 * Unit tests for the hero-pool client cache.
 * Mocks global fetch — does NOT hit the database or service layer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchHeroPool,
  preloadHeroPool,
  getCachedHeroPool,
  clearHeroPoolCache,
} from './hero-pool-cache';

const mockResponse = (cards: any[]) =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true, data: cards }),
  } as Response);

const SAMPLE = [{ cardUniqueId: 'c1', name: 'Snatch' } as any];

beforeEach(() => {
  clearHeroPoolCache();
  vi.stubGlobal('fetch', vi.fn(() => mockResponse(SAMPLE)));
});

describe('fetchHeroPool', () => {
  it('fetches from the by-hero endpoint with CSV query params', async () => {
    await fetchHeroPool({ heroClasses: ['assassin'], heroTalents: ['light', 'earth'], format: 'cc' });

    expect(fetch).toHaveBeenCalledTimes(1);
    const url = (fetch as any).mock.calls[0][0] as string;
    expect(url).toContain('/api/cards/by-hero');
    expect(url).toContain('heroClasses=assassin');
    expect(url).toContain('heroTalents=light%2Cearth');
    expect(url).toContain('format=cc');
  });

  it('caches the result — second call does NOT hit the network', async () => {
    await fetchHeroPool({ heroClasses: ['assassin'], format: 'cc' });
    await fetchHeroPool({ heroClasses: ['assassin'], format: 'cc' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('uses different cache keys for different filters', async () => {
    await fetchHeroPool({ heroClasses: ['assassin'], format: 'cc' });
    await fetchHeroPool({ heroClasses: ['guardian'], format: 'cc' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('cache key is order-insensitive for arrays', async () => {
    await fetchHeroPool({ heroClasses: ['guardian', 'brute'], format: 'cc' });
    await fetchHeroPool({ heroClasses: ['brute', 'guardian'], format: 'cc' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('dedupes concurrent in-flight calls (single fetch for two simultaneous callers)', async () => {
    const a = fetchHeroPool({ heroClasses: ['assassin'], format: 'cc' });
    const b = fetchHeroPool({ heroClasses: ['assassin'], format: 'cc' });
    const [resA, resB] = await Promise.all([a, b]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(resA).toBe(resB);
  });

  it('does not cache failed responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: false, error: 'oops' }),
        } as Response)
        .mockResolvedValueOnce(mockResponse(SAMPLE).then((r) => r))
    );

    await expect(fetchHeroPool({ heroClasses: ['assassin'] })).rejects.toThrow();
    // Second call should re-fetch (no cached error)
    const result = await fetchHeroPool({ heroClasses: ['assassin'] });
    expect(result).toEqual(SAMPLE);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('getCachedHeroPool', () => {
  it('returns undefined when not cached', () => {
    expect(getCachedHeroPool({ heroClasses: ['assassin'] })).toBeUndefined();
  });

  it('returns the cached value after a fetch', async () => {
    await fetchHeroPool({ heroClasses: ['assassin'] });
    expect(getCachedHeroPool({ heroClasses: ['assassin'] })).toEqual(SAMPLE);
  });
});

describe('preloadHeroPool', () => {
  it('fires the fetch fire-and-forget (returns void synchronously)', () => {
    const result = preloadHeroPool({ heroClasses: ['assassin'] });
    expect(result).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not throw if the request fails', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down')))
    );
    expect(() => preloadHeroPool({ heroClasses: ['assassin'] })).not.toThrow();
  });
});
