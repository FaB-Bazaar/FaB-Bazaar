/**
 * Unit tests for /api/feed — public read of a day's market feed, superadmin
 * write (replace a whole day). Muse calls POST with an OAuth bearer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  marketFeedService: {
    getDay: vi.fn(),
    listDates: vi.fn(),
    replaceDay: vi.fn(),
  },
  userService: {
    hasRole: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

import { GET, POST } from './route';
import { marketFeedService, userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { marketFeedToday } from '@/lib/market-feed/feed-date';

const mockGetDay = vi.mocked(marketFeedService.getDay);
const mockListDates = vi.mocked(marketFeedService.listDates);
const mockReplaceDay = vi.mocked(marketFeedService.replaceDay);
const mockHasRole = vi.mocked(userService.hasRole);
const mockAuth = vi.mocked(authenticateRequest);

const makeGet = (qs = '') => new NextRequest(`http://localhost/api/feed${qs}`);
const makePost = (body: unknown) =>
  new NextRequest('http://localhost/api/feed', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const listing = { side: 'selling', cardName: 'Sink Below', pitch: 1, price: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'admin-1' } as any);
  mockHasRole.mockResolvedValue({ success: true, data: true } as any);
  mockGetDay.mockResolvedValue({ success: true, data: { feedDate: '2026-09-24', listings: [] } });
  mockListDates.mockResolvedValue({ success: true, data: [{ feedDate: '2026-09-24', count: 3 }] });
  mockReplaceDay.mockResolvedValue({ success: true, data: { feedDate: '2026-09-24', count: 1, unmatched: [] } });
});

describe('GET /api/feed', () => {
  it('is public and returns the requested day plus the available dates', async () => {
    const res = await GET(makeGet('?date=2026-09-24'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.feedDate).toBe('2026-09-24');
    expect(json.data.dates).toEqual([{ feedDate: '2026-09-24', count: 3 }]);
    expect(mockGetDay).toHaveBeenCalledWith('2026-09-24');
    expect(mockAuth).not.toHaveBeenCalled();
  });

  it('defaults to today in US Eastern', async () => {
    await GET(makeGet());
    expect(mockGetDay).toHaveBeenCalledWith(marketFeedToday());
  });

  it('rejects a malformed date', async () => {
    const res = await GET(makeGet('?date=yesterday'));
    expect(res.status).toBe(400);
    expect(mockGetDay).not.toHaveBeenCalled();
  });
});

describe('POST /api/feed', () => {
  it('accepts OAuth bearers (Muse) and replaces the given day', async () => {
    const res = await POST(makePost({ feedDate: '2026-09-24', listings: [listing] }));
    expect(res.status).toBe(200);
    expect(mockAuth.mock.calls[0][2]).toEqual({ allowOAuth: true });
    expect(mockReplaceDay).toHaveBeenCalledWith({ feedDate: '2026-09-24', listings: [listing], createdBy: 'admin-1' });
    const json = await res.json();
    expect(json.data).toEqual({ feedDate: '2026-09-24', count: 1, unmatched: [] });
  });

  it('defaults feedDate to today in US Eastern', async () => {
    await POST(makePost({ listings: [listing] }));
    expect(mockReplaceDay.mock.calls[0][0].feedDate).toBe(marketFeedToday());
  });

  it('401s when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Authentication required' } as any);
    const res = await POST(makePost({ listings: [listing] }));
    expect(res.status).toBe(401);
    expect(mockReplaceDay).not.toHaveBeenCalled();
  });

  it('403s for signed-in non-superadmins', async () => {
    mockHasRole.mockResolvedValue({ success: true, data: false } as any);
    const res = await POST(makePost({ listings: [listing] }));
    expect(res.status).toBe(403);
    expect(mockReplaceDay).not.toHaveBeenCalled();
  });

  it('400s when listings is missing', async () => {
    const res = await POST(makePost({ feedDate: '2026-09-24' }));
    expect(res.status).toBe(400);
    expect(mockReplaceDay).not.toHaveBeenCalled();
  });

  it('passes service validation errors back as 400', async () => {
    mockReplaceDay.mockResolvedValue({ success: false, error: "listings[0].side must be 'selling' or 'buying'" });
    const res = await POST(makePost({ listings: [{ ...listing, side: 'trading' }] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/side/);
  });
});
