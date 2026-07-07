/**
 * Route unit tests for GET /api/curated-lists/heroes — the hero picker feed
 * for the Volzar "Hero kit" instant action (public read: published kit data
 * only, same visibility as the /kits pages).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  curatedListService: { getHeroSummaries: vi.fn() },
}));

// Import AFTER mocks (vi.mock is hoisted)
import { GET } from './route';
import { curatedListService } from '@/lib/services';

const mockGetHeroSummaries = vi.mocked(curatedListService.getHeroSummaries);

function request(qs = ''): Request {
  return new Request(`http://localhost:3000/api/curated-lists/heroes${qs}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/curated-lists/heroes', () => {
  it('returns hero summaries for the requested format', async () => {
    mockGetHeroSummaries.mockResolvedValue({
      success: true,
      data: [{ heroName: 'pleiades, superstar', kitCount: 9, totalTcgLow: 123.45 }],
    });

    const res = await GET(request('?format=Classic%20Constructed') as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data[0].heroName).toBe('pleiades, superstar');
    expect(mockGetHeroSummaries).toHaveBeenCalledWith('Classic Constructed');
  });

  it('defaults to Classic Constructed when no format is given', async () => {
    mockGetHeroSummaries.mockResolvedValue({ success: true, data: [] });
    await GET(request() as any);
    expect(mockGetHeroSummaries).toHaveBeenCalledWith('Classic Constructed');
  });

  it('500s when the service fails', async () => {
    mockGetHeroSummaries.mockResolvedValue({ success: false, error: 'db down' });
    const res = await GET(request() as any);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});
