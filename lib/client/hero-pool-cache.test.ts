/**
 * Unit tests for the printing-drilldown client cache.
 * Mocks global fetch — does NOT hit the database or service layer.
 *
 * (The hero-pool preload tests that used to live here were removed with the
 * pool-browse machinery when QuickAddCardDialog moved to the shared
 * server-paginated search, 2026-08.)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPrintingsForCard, clearPrintingsCache } from './hero-pool-cache';

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
