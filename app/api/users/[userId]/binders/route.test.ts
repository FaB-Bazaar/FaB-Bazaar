/**
 * Unit tests for GET /api/users/[userId]/binders
 *
 * Regression: the route used to reject any userId that wasn't a 24-char hex
 * MongoDB ObjectId, leftover from the pre-Postgres era. ~35% of users have
 * UUID ids and would get a 400 "Invalid user ID format".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  binderService: {
    getUserBindersWithStats: vi.fn(),
    listBinders: vi.fn(),
  },
}));

vi.mock('next/headers', () => ({
  headers: () =>
    Promise.resolve({
      get: (name: string) => {
        const map: Record<string, string> = {
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          referer: 'https://fabbazaar.app/profile/someone',
          'x-forwarded-for': '127.0.0.1',
        };
        return map[name.toLowerCase()] ?? null;
      },
    }),
}));

import { GET } from './route';
import { binderService } from '@/lib/services';

const mockGetWithStats = vi.mocked(binderService.getUserBindersWithStats);
const mockListBinders = vi.mocked(binderService.listBinders);

const makeRequest = (userId: string, query = 'includeStats=true&includeShowcase=true') =>
  new NextRequest(`https://fabbazaar.app/api/users/${userId}/binders?${query}`, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      referer: 'https://fabbazaar.app/profile/someone',
    },
  });

describe('GET /api/users/[userId]/binders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWithStats.mockResolvedValue({ success: true, data: [] } as any);
    mockListBinders.mockResolvedValue({ success: true, data: [] } as any);
  });

  it('accepts a UUID userId (post-migration users)', async () => {
    const uuid = '46a05cc3-c38a-4dd6-aa58-7ced7b79708c';
    const res = await GET(makeRequest(uuid), { params: Promise.resolve({ userId: uuid }) });

    expect(res.status).toBe(200);
    expect(mockGetWithStats).toHaveBeenCalledWith(uuid);
  });

  it('accepts a legacy 24-hex userId (pre-migration users)', async () => {
    const objectId = '68056532ccbe5f869784823a';
    const res = await GET(makeRequest(objectId), { params: Promise.resolve({ userId: objectId }) });

    expect(res.status).toBe(200);
    expect(mockGetWithStats).toHaveBeenCalledWith(objectId);
  });
  describe('payload size (the profile page is the only consumer)', () => {
    const uuid = '46a05cc3-c38a-4dd6-aa58-7ced7b79708c';
    const price = { tcg_market: 4, tcg_low: 3, tcg_mid: 5, tcg_high: 9 };
    const bigBinder = {
      _id: 'b1',
      name: 'Big',
      isPublic: true,
      visibility: { level: 'public', allowInSearch: true, allowWhoHas: true, allowWebhooks: true },
      updatedAt: new Date('2026-01-01'),
      stats: {
        totalQuantity: 5000,
        quantityForTrade: 4000,
        quantityNotForTrade: 1000,
        totalValue: price,
        valueForTrade: price,
        valueNotForTrade: price,
        rarityCounts: { m: 5000 },
        rarityCountsForTrade: { m: 4000 },
        rarityCountsNotForTrade: { m: 1000 },
      },
      showcaseCards: Array.from({ length: 10 }, (_, i) => ({
        printingId: `p${i}`,
        image_url: `https://img/${i}`,
        tcg_low: 100 - i,
        rarity: 'm',
      })),
    };

    const getBinder = async () => {
      mockGetWithStats.mockResolvedValue({ success: true, data: [bigBinder] } as any);
      const res = await GET(makeRequest(uuid), { params: Promise.resolve({ userId: uuid }) });
      return (await res.json()).binders[0];
    };

    it('sends only the 6 showcase cards a tile shows, most valuable first', async () => {
      const binder = await getBinder();
      expect(binder.showcaseCards.map((c: any) => c.printingId)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5']);
    });

    it('sends only the visibility level, not the per-feature permission flags', async () => {
      const binder = await getBinder();
      expect(binder.visibility).toEqual({ level: 'public' });
    });

    it('sends values as tcg_low only', async () => {
      const binder = await getBinder();
      expect(binder.totalValue).toEqual({ tcg_low: 3 });
      expect(binder.valueForTrade).toEqual({ tcg_low: 3 });
      expect(binder.valueNotForTrade).toEqual({ tcg_low: 3 });
    });

    it('keeps the stats the tile renders', async () => {
      const binder = await getBinder();
      expect(binder.totalQuantity).toBe(5000);
      expect(binder.quantityForTrade).toBe(4000);
      expect(binder.rarityCountsForTrade).toEqual({ m: 4000 });
      expect(binder.rarityCountsNotForTrade).toEqual({ m: 1000 });
    });
  });
});
