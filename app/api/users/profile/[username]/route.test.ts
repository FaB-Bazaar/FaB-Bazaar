/**
 * Unit tests for GET /api/users/profile/[username]
 *
 * The public profile response exposes only display-oriented fields:
 * discordUsername is public, the internal discordId is not, and the binder
 * count reflects public binders only.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  userService: {
    getUserProfileWithStats: vi.fn(),
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
import { userService } from '@/lib/services';

const mockGetProfile = vi.mocked(userService.getUserProfileWithStats);

const makeRequest = (username: string) =>
  new NextRequest(`https://fabbazaar.app/api/users/profile/${username}`, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      referer: 'https://fabbazaar.app/profile/someone',
    },
  });

describe('GET /api/users/profile/[username]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProfile.mockResolvedValue({
      success: true,
      data: {
        _id: 'user-123',
        username: 'someone',
        discordUsername: 'someone#0001',
        discordId: '123456789012345678',
        discordAvatar: 'avatar-hash',
        createdAt: new Date('2024-01-01'),
        binderStats: { public: 2, unlisted: 1, private: 3, total: 6 },
        wantsCount: 5,
      },
    } as any);
  });

  it('does not include discordId in the public profile response', async () => {
    // unique username per test to avoid the route's in-memory cache
    const res = await GET(makeRequest('priv-test-1'), {
      params: Promise.resolve({ username: 'priv-test-1' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.user.discordId).toBeUndefined();
    // display name stays public
    expect(body.user.discordUsername).toBe('someone#0001');
  });

  it('only counts public binders, never private/unlisted, in the public stats', async () => {
    const res = await GET(makeRequest('priv-test-2'), {
      params: Promise.resolve({ username: 'priv-test-2' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    // public:2 — must not leak the unlisted/private counts or the 6 total
    expect(body.stats.totalBinders).toBe(2);
  });
});
