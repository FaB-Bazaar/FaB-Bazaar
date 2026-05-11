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
  fetchPrintingsForCard,
  clearPrintingsCache,
  filterPoolByChip,
  toCardResult,
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

// ─── Printing drilldown ──────────────────────────────────────────────────

const SAMPLE_PRINTINGS = [
  { printing_id: 'p1', image_url: 'a.png' },
  { printing_id: 'p2', image_url: 'b.png' },
];

const mockPrintingsResponse = (printings: any[]) =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true, data: { printings } }),
  } as Response);

describe('fetchPrintingsForCard', () => {
  beforeEach(() => {
    clearPrintingsCache();
    vi.stubGlobal('fetch', vi.fn(() => mockPrintingsResponse(SAMPLE_PRINTINGS)));
  });

  it('fetches from /api/cards/[cardUniqueId]/printings', async () => {
    await fetchPrintingsForCard('cardA');
    expect(fetch).toHaveBeenCalledTimes(1);
    const url = (fetch as any).mock.calls[0][0] as string;
    expect(url).toBe('/api/cards/cardA/printings');
  });

  it('returns the printings array on success', async () => {
    const result = await fetchPrintingsForCard('cardA');
    expect(result).toEqual(SAMPLE_PRINTINGS);
  });

  it('caches by cardUniqueId — second call does NOT hit the network', async () => {
    await fetchPrintingsForCard('cardA');
    await fetchPrintingsForCard('cardA');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('different cardUniqueIds use different cache keys', async () => {
    await fetchPrintingsForCard('cardA');
    await fetchPrintingsForCard('cardB');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('dedupes concurrent in-flight calls', async () => {
    const a = fetchPrintingsForCard('cardA');
    const b = fetchPrintingsForCard('cardA');
    const [r1, r2] = await Promise.all([a, b]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(r1).toBe(r2);
  });

  it('does not cache failed responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({ success: false, error: 'not found' }) } as Response)
        .mockResolvedValueOnce(mockPrintingsResponse(SAMPLE_PRINTINGS).then((r) => r))
    );

    await expect(fetchPrintingsForCard('cardA')).rejects.toThrow();
    const result = await fetchPrintingsForCard('cardA');
    expect(result).toEqual(SAMPLE_PRINTINGS);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

// ─── Chip filter ─────────────────────────────────────────────────────────

const card = (overrides: Record<string, unknown> = {}) => ({
  cardUniqueId: 'c1',
  name: 'X',
  types: ['action'] as string[],
  pitch: null as number | null,
  cost: null as number | null,
  defense: null as number | null,
  power: null as number | null,
  keywords: [] as string[],
  color: '',
  representativePrintingId: 'p1',
  representativeImageUrl: 'img',
  printingsCount: 1,
  ...overrides,
});

describe('filterPoolByChip', () => {
  it('attack chip → cards whose types include "attack"', () => {
    const pool = [
      card({ cardUniqueId: 'a', types: ['action', 'attack'] }),
      card({ cardUniqueId: 'b', types: ['action'] }),
      card({ cardUniqueId: 'c', types: ['attack-reaction'] }),
    ];
    const out = filterPoolByChip(pool, 'attack');
    expect(out.map((c) => c.cardUniqueId)).toEqual(['a']);
  });

  it('non-attack-action chip → action cards WITHOUT attack', () => {
    const pool = [
      card({ cardUniqueId: 'a', types: ['action', 'attack'] }),
      card({ cardUniqueId: 'b', types: ['action'] }),
      card({ cardUniqueId: 'c', types: ['action', 'arcane'] }),
    ];
    const out = filterPoolByChip(pool, 'non-attack-action');
    expect(out.map((c) => c.cardUniqueId).sort()).toEqual(['b', 'c']);
  });

  it('instant chip → cards whose types include "instant"', () => {
    const pool = [
      card({ cardUniqueId: 'a', types: ['instant'] }),
      card({ cardUniqueId: 'b', types: ['action'] }),
    ];
    expect(filterPoolByChip(pool, 'instant').map((c) => c.cardUniqueId)).toEqual(['a']);
  });

  it('defense-reaction chip → cards whose types include "defense reaction"', () => {
    const pool = [
      card({ cardUniqueId: 'a', types: ['defense reaction'] }),
      card({ cardUniqueId: 'b', types: ['action'] }),
    ];
    expect(filterPoolByChip(pool, 'defense-reaction').map((c) => c.cardUniqueId)).toEqual(['a']);
  });

  it('attack-reaction chip → cards whose types include "attack reaction"', () => {
    const pool = [card({ cardUniqueId: 'a', types: ['attack reaction'] }), card({ cardUniqueId: 'b', types: ['action'] })];
    expect(filterPoolByChip(pool, 'attack-reaction').map((c) => c.cardUniqueId)).toEqual(['a']);
  });

  it('equipment chip → cards whose types include "equipment"', () => {
    const pool = [card({ cardUniqueId: 'a', types: ['equipment'] }), card({ cardUniqueId: 'b', types: ['action'] })];
    expect(filterPoolByChip(pool, 'equipment').map((c) => c.cardUniqueId)).toEqual(['a']);
  });

  it('weapon chip → cards whose types include "weapon"', () => {
    const pool = [card({ cardUniqueId: 'a', types: ['weapon'] }), card({ cardUniqueId: 'b', types: ['action'] })];
    expect(filterPoolByChip(pool, 'weapon').map((c) => c.cardUniqueId)).toEqual(['a']);
  });

  it('item chip → cards whose types include "item"', () => {
    const pool = [card({ cardUniqueId: 'a', types: ['item'] }), card({ cardUniqueId: 'b', types: ['action'] })];
    expect(filterPoolByChip(pool, 'item').map((c) => c.cardUniqueId)).toEqual(['a']);
  });

  it('ally chip → cards whose types include "ally"', () => {
    const pool = [card({ cardUniqueId: 'a', types: ['ally'] }), card({ cardUniqueId: 'b', types: ['action'] })];
    expect(filterPoolByChip(pool, 'ally').map((c) => c.cardUniqueId)).toEqual(['a']);
  });

  it('returns empty array for unknown chip value', () => {
    const pool = [card({ types: ['action'] })];
    expect(filterPoolByChip(pool, '__unknown__')).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(filterPoolByChip([], 'attack')).toEqual([]);
  });
});

// ─── Adapter to CardResult shape ─────────────────────────────────────────

describe('toCardResult', () => {
  it('maps the slim CardSummary to the CardResult shape', () => {
    const summary = card({
      cardUniqueId: 'X',
      types: ['action', 'attack'],
    });
    const result = toCardResult(summary);
    expect(result.unique_id).toBe('X');
    expect(result.name).toBe('X');
    expect(result.types).toEqual(['action', 'attack']);
    expect(result.pitch).toBe(null);
  });

  it('synthesizes a single-printing array from the representative fields', () => {
    const summary = card({
      cardUniqueId: 'X',
      representativePrintingId: 'pZ',
      representativeImageUrl: 'imgZ',
    });
    const result = toCardResult(summary);
    expect(result.printings).toHaveLength(1);
    expect(result.printings[0].printing_id).toBe('pZ');
    expect(result.printings[0].image_url).toBe('imgZ');
  });

  it('preserves the actual printingsCount in a __printingsCount marker (so the dialog can show "Np")', () => {
    const summary = card({ cardUniqueId: 'X', printingsCount: 12 });
    const result = toCardResult(summary);
    // dialog renders card.printings.length — synthesized array has 1 entry but
    // the "true" count needs to be available for the "Np" badge. We expose it
    // as a non-array field on the result.
    expect((result as any).__printingsCount).toBe(12);
  });
});

