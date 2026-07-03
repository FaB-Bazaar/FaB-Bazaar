// app/api/decks/featured-latest-month/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  deckService: { getLatestFeaturedMonth: vi.fn() },
}));

import { GET } from './route';
import { deckService } from '@/lib/services';

const mockGet = vi.mocked(deckService.getLatestFeaturedMonth);
const req = (qs = '') => new NextRequest(`http://localhost:3000/api/decks/featured-latest-month${qs}`);

describe('GET /api/decks/featured-latest-month', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the latest featured month', async () => {
    mockGet.mockResolvedValue({ success: true, data: { year: 2026, month: 6 } } as any);
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, data: { year: 2026, month: 6 } });
    expect(mockGet).toHaveBeenCalledWith(undefined); // no format param
  });

  it('passes the format through when provided', async () => {
    mockGet.mockResolvedValue({ success: true, data: { year: 2026, month: 5 } } as any);
    await GET(req('?format=Silver Age'));
    expect(mockGet).toHaveBeenCalledWith('Silver Age');
  });

  it('returns null data when nothing is featured', async () => {
    mockGet.mockResolvedValue({ success: true, data: null } as any);
    const res = await GET(req());
    const body = await res.json();
    expect(body).toEqual({ success: true, data: null });
  });

  it('surfaces a service failure as 500', async () => {
    mockGet.mockResolvedValue({ success: false, error: 'boom' } as any);
    const res = await GET(req());
    expect(res.status).toBe(500);
  });
});
