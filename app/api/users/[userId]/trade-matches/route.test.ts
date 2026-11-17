/**
 * Route unit tests for GET /api/users/[userId]/trade-matches — the profile
 * trade page. The viewer is the authenticated caller; ?match=loose switches
 * to any-printing matching.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  inventoryService: { getUserTradeMatches: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { GET } from './route';
import { inventoryService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockMatches = vi.mocked(inventoryService.getUserTradeMatches);
const mockAuth = vi.mocked(authenticateRequest);

const call = (userId: string, query = '') =>
  GET(new NextRequest(`http://localhost/api/users/${userId}/trade-matches${query}`), {
    params: Promise.resolve({ userId }),
  });

const DATA = { theyHaveYouWant: [], theyWantYouHave: [] };

beforeEach(() => {
  mockMatches.mockReset();
  mockAuth.mockReset();
  mockAuth.mockResolvedValue({ success: true, userId: 'me' } as any);
  mockMatches.mockResolvedValue({ success: true, data: DATA });
});

describe('GET /api/users/[userId]/trade-matches', () => {
  it('401s when signed out', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'nope' } as any);
    expect((await call('them')).status).toBe(401);
    expect(mockMatches).not.toHaveBeenCalled();
  });

  it('400s when matching against yourself', async () => {
    expect((await call('me')).status).toBe(400);
    expect(mockMatches).not.toHaveBeenCalled();
  });

  it('matches exactly by default', async () => {
    const res = await call('them');
    expect(res.status).toBe(200);
    expect(mockMatches).toHaveBeenCalledWith('me', 'them', 'exact');
    expect(await res.json()).toEqual({ success: true, data: DATA });
  });

  it('uses loose matching when asked', async () => {
    await call('them', '?match=loose');
    expect(mockMatches).toHaveBeenCalledWith('me', 'them', 'loose');
  });

  it('500s when the service fails', async () => {
    mockMatches.mockResolvedValue({ success: false, error: 'db down' });
    expect((await call('them')).status).toBe(500);
  });
});
