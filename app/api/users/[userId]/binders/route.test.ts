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
});
