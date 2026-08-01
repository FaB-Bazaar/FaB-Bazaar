/**
 * Unit tests for GET /api/users/[userId]/binders — hideValue privacy.
 *
 * This endpoint is public (anonymous, cached 5 min) so there is no viewer to
 * distinguish: when a binder has hideValue set, its value aggregates must be
 * stripped from the includeStats payload unconditionally. Owners see their
 * values through the authenticated /api/binders surfaces instead.
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
          'x-forwarded-for': '127.0.0.2',
        };
        return map[name.toLowerCase()] ?? null;
      },
    }),
}));

import { GET } from './route';
import { binderService } from '@/lib/services';

const mockGetWithStats = vi.mocked(binderService.getUserBindersWithStats);

const USER_ID = '46a05cc3-c38a-4dd6-aa58-7ced7b79708c';

const makeRequest = () =>
  new NextRequest(`https://fabbazaar.app/api/users/${USER_ID}/binders?includeStats=true`, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      referer: 'https://fabbazaar.app/profile/someone',
    },
  });

const binderWithStats = (overrides: Record<string, unknown> = {}) => ({
  _id: 'b1',
  userId: USER_ID,
  name: 'Showcase',
  isPublic: true,
  visibility: { level: 'public' },
  tags: [],
  updatedAt: new Date().toISOString(),
  stats: {
    totalQuantity: 12,
    quantityForTrade: 5,
    quantityNotForTrade: 7,
    totalValue: { tcg_market: 900, tcg_low: 800, tcg_mid: 850, tcg_high: 1000 },
    valueForTrade: { tcg_market: 400, tcg_low: 300, tcg_mid: 350, tcg_high: 450 },
    valueNotForTrade: { tcg_market: 500, tcg_low: 500, tcg_mid: 500, tcg_high: 550 },
    rarityCounts: { M: 12 },
    rarityCountsForTrade: {},
    rarityCountsNotForTrade: {},
    showcaseCards: [],
  },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/users/[userId]/binders — hideValue', () => {
  it('strips value fields from includeStats payload when hideValue is set', async () => {
    mockGetWithStats.mockResolvedValue({
      success: true,
      data: [binderWithStats({ hideValue: true })],
    } as any);

    const res = await GET(makeRequest(), { params: Promise.resolve({ userId: USER_ID }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    const binder = data.binders[0];
    expect(binder.totalValue).toBeUndefined();
    expect(binder.valueForTrade).toBeUndefined();
    expect(binder.valueNotForTrade).toBeUndefined();
    expect(binder.total_value).toBeUndefined();
    // Non-value stats survive
    expect(binder.totalQuantity).toBe(12);
    expect(binder.rarityCounts).toEqual({ M: 12 });
  });

  it('keeps value fields when hideValue is not set', async () => {
    mockGetWithStats.mockResolvedValue({
      success: true,
      data: [binderWithStats()],
    } as any);

    const res = await GET(makeRequest(), { params: Promise.resolve({ userId: USER_ID }) });
    const data = await res.json();

    const binder = data.binders[0];
    expect(binder.totalValue.tcg_low).toBe(800);
    expect(binder.total_value).toBe(800);
  });
});
