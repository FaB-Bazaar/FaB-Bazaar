/**
 * Route unit tests for GET /api/binders/[binderId]/wanted — the binder page's
 * "Add my wants" button. The viewer comes from auth (never the query), the
 * binder must be viewable, and ?match=loose switches to any-printing matching.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  binderService: {
    getBinder: vi.fn(),
    getWantedItemsInBinder: vi.fn(),
  },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { GET } from './route';
import { binderService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockGetBinder = vi.mocked(binderService.getBinder);
const mockWanted = vi.mocked(binderService.getWantedItemsInBinder);
const mockAuth = vi.mocked(authenticateRequest);

const call = (query = '') =>
  GET(new NextRequest(`http://localhost/api/binders/b1/wanted${query}`), {
    params: Promise.resolve({ binderId: 'b1' }),
  });

const binder = (level: string, userId = 'owner') =>
  ({ success: true, data: { _id: 'b1', userId, visibility: { level } } }) as any;

beforeEach(() => {
  mockGetBinder.mockReset();
  mockWanted.mockReset();
  mockAuth.mockReset();
  mockAuth.mockResolvedValue({ success: true, userId: 'viewer' } as any);
  mockGetBinder.mockResolvedValue(binder('public'));
  mockWanted.mockResolvedValue({ success: true, data: [{ _id: 'i1', requestQuantity: 2 }] } as any);
});

describe('GET /api/binders/[binderId]/wanted', () => {
  it('401s when signed out', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'nope' } as any);
    expect((await call()).status).toBe(401);
    expect(mockWanted).not.toHaveBeenCalled();
  });

  it('matches exactly by default, for the authenticated viewer', async () => {
    const res = await call('?viewerId=someone-else');
    expect(res.status).toBe(200);
    expect(mockWanted).toHaveBeenCalledWith('b1', 'viewer', 'exact');
    expect((await res.json()).data).toEqual([{ _id: 'i1', requestQuantity: 2 }]);
  });

  it('uses loose matching when asked', async () => {
    await call('?match=loose');
    expect(mockWanted).toHaveBeenCalledWith('b1', 'viewer', 'loose');
  });

  it('403s on a private binder the viewer does not own', async () => {
    mockGetBinder.mockResolvedValue(binder('private'));
    expect((await call()).status).toBe(403);
    expect(mockWanted).not.toHaveBeenCalled();
  });

  it('404s when the binder does not exist', async () => {
    mockGetBinder.mockResolvedValue({ success: true, data: null } as any);
    expect((await call()).status).toBe(404);
  });
});
