/**
 * Unit tests for GET /api/daily.
 *
 * Service is mocked. Verifies session auth + shape.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  dailyMoversService: { getMoversInUserCollection: vi.fn(), getMarketMovers: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateSession: vi.fn(),
}));

import { GET } from './route';
import { dailyMoversService } from '@/lib/services';
import { authenticateSession } from '@/lib/auth/multi-auth';

const mockGetMovers = vi.mocked(dailyMoversService.getMoversInUserCollection);
const mockGetMarket = vi.mocked(dailyMoversService.getMarketMovers);
const mockAuth = vi.mocked(authenticateSession);

const makeRequest = (qs = '') => new NextRequest(`http://localhost/api/daily${qs}`);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/daily', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Not authenticated' } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(mockGetMovers).not.toHaveBeenCalled();
  });

  it('returns movers payload for authenticated user', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'user-abc' } as any);
    mockGetMovers.mockResolvedValue({
      success: true,
      data: {
        asOfDate: '2026-05-08',
        totalCount: 1,
        gainers: [{
          printingId: 'p1', signalType: 'top_gainer', rankInSignal: 1,
          displayName: 'Foo', set: 'mst', edition: 'n', foiling: 's', rarity: 'm',
          imageUrl: null, tcgplayerUrl: null,
          pAtSignal: 12.5, refPrice: 10, dollarChange: 2.5, pctChange: 25,
          quantity: 1, binderId: 'b1', binderName: 'My Binder', decks: [],
        }],
        decliners: [],
        breakouts: [],
        steadyRisers: [],
      },
    } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.totalCount).toBe(1);
    expect(body.data.gainers).toHaveLength(1);
    expect(body.data.gainers[0].displayName).toBe('Foo');
    expect(mockGetMovers).toHaveBeenCalledWith('user-abc', undefined);
  });

  it('passes ?asOf= query param to the service', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'user-abc' } as any);
    mockGetMovers.mockResolvedValue({
      success: true,
      data: { asOfDate: '2026-05-01', totalCount: 0, gainers: [], decliners: [], breakouts: [], steadyRisers: [] },
    } as any);

    await GET(makeRequest('?asOf=2026-05-01'));

    expect(mockGetMovers).toHaveBeenCalledWith('user-abc', '2026-05-01');
  });

  it('returns 500 when the service errors', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'user-abc' } as any);
    mockGetMovers.mockResolvedValue({ success: false, error: 'boom' } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe('boom');
  });
});

describe('GET /api/daily?scope=market', () => {
  it('returns the market view WITHOUT requiring auth', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Not authenticated' } as any);
    mockGetMarket.mockResolvedValue({
      success: true,
      data: {
        asOfDate: '2026-05-08', totalCount: 1,
        gainers: [{
          printingId: 'p1', signalType: 'top_gainer', rankInSignal: 1,
          displayName: 'Foo', set: 'mst', edition: 'n', foiling: 's', rarity: 'm',
          imageUrl: null, tcgplayerUrl: null,
          pAtSignal: 12.5, refPrice: 10, dollarChange: 2.5, pctChange: 25,
        }],
        decliners: [], breakouts: [], steadyRisers: [],
      },
    } as any);

    const res = await GET(makeRequest('?scope=market'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.gainers[0].displayName).toBe('Foo');
    expect(mockGetMarket).toHaveBeenCalledWith(undefined);
    expect(mockGetMovers).not.toHaveBeenCalled();
  });

  it('passes ?asOf= through to the market service', async () => {
    mockGetMarket.mockResolvedValue({
      success: true,
      data: { asOfDate: '2026-05-01', totalCount: 0, gainers: [], decliners: [], breakouts: [], steadyRisers: [] },
    } as any);

    await GET(makeRequest('?scope=market&asOf=2026-05-01'));

    expect(mockGetMarket).toHaveBeenCalledWith('2026-05-01');
  });
});
