/**
 * Unit tests for GET /api/cards/by-hero — public hero-pool endpoint.
 *
 * Returns slim CardSummaryDTO[] for the hero's legal card pool — one row per
 * unique card with a representative printing. Used by the deck editor to ship
 * the full pool in a single ~300 KB fetch instead of preloading per-type.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  printingsService: { searchCardsForHero: vi.fn() },
}));

import { GET } from './route';
import { printingsService } from '@/lib/services';

const mockFn = vi.mocked(printingsService.searchCardsForHero);

const makeRequest = (qs: string) =>
  new Request(`http://localhost:3000/api/cards/by-hero${qs}`) as unknown as Parameters<typeof GET>[0];

beforeEach(() => vi.clearAllMocks());

describe('GET /api/cards/by-hero', () => {
  it('returns 200 with the card list on success', async () => {
    mockFn.mockResolvedValue({ success: true, data: [{ cardUniqueId: 'c1' } as any] } as any);

    const res = await GET(makeRequest('?heroClasses=guardian&format=cc'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, data: [{ cardUniqueId: 'c1' }] });
  });

  it('returns 500 when the service errors', async () => {
    mockFn.mockResolvedValue({ success: false, error: 'DB down' } as any);

    const res = await GET(makeRequest('?heroClasses=guardian'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('DB down');
  });

  it('parses heroClasses CSV into an array', async () => {
    mockFn.mockResolvedValue({ success: true, data: [] } as any);

    await GET(makeRequest('?heroClasses=guardian,brute'));
    expect(mockFn).toHaveBeenCalledWith(expect.objectContaining({
      heroClasses: ['guardian', 'brute'],
    }));
  });

  it('parses heroTalents and heroEssences CSV into arrays', async () => {
    mockFn.mockResolvedValue({ success: true, data: [] } as any);

    await GET(makeRequest('?heroClasses=guardian&heroTalents=light,earth&heroEssences=lightning'));
    expect(mockFn).toHaveBeenCalledWith(expect.objectContaining({
      heroTalents: ['light', 'earth'],
      heroEssences: ['lightning'],
    }));
  });

  it('passes format param through unchanged', async () => {
    mockFn.mockResolvedValue({ success: true, data: [] } as any);

    await GET(makeRequest('?heroClasses=guardian&format=cc'));
    expect(mockFn).toHaveBeenCalledWith(expect.objectContaining({ format: 'cc' }));
  });

  it('passes no array fields when query params are absent', async () => {
    mockFn.mockResolvedValue({ success: true, data: [] } as any);

    await GET(makeRequest(''));
    const call = mockFn.mock.calls[0]?.[0];
    expect(call?.heroClasses).toBeUndefined();
    expect(call?.heroTalents).toBeUndefined();
    expect(call?.heroEssences).toBeUndefined();
    expect(call?.format).toBeUndefined();
  });

  it('trims and filters empty entries from CSV params (defensive)', async () => {
    mockFn.mockResolvedValue({ success: true, data: [] } as any);

    await GET(makeRequest('?heroClasses=guardian,,%20brute%20,'));
    expect(mockFn).toHaveBeenCalledWith(expect.objectContaining({
      heroClasses: ['guardian', 'brute'],
    }));
  });
});
