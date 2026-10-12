import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// PUT { action: 'removeCopies', count } — /scan's "Undo" after adding a card: takes back exactly those copies.
vi.mock('@/lib/services', () => ({ binderService: { removeCopies: vi.fn(), updateBinderCard: vi.fn(), swapCardPrinting: vi.fn() } }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));
vi.mock('@/auth', () => ({ auth: vi.fn() }));

import { PUT } from './route';
import { binderService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockRemove = vi.mocked(binderService.removeCopies);
const mockUpdate = vi.mocked(binderService.updateBinderCard);
const mockAuth = vi.mocked(authenticateRequest);
const put = (body: unknown) => PUT(
  new NextRequest('http://localhost/api/binders/b1/cards/c1', { method: 'PUT', body: JSON.stringify(body) }),
  { params: Promise.resolve({ binderId: 'b1', cardId: 'c1' }) },
);

beforeEach(() => {
  mockRemove.mockReset(); mockUpdate.mockReset(); mockAuth.mockReset();
  mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
});

describe('PUT /api/binders/[binderId]/cards/[cardId] — removeCopies', () => {
  it('takes back the copies for the signed-in owner and returns what remains', async () => {
    mockRemove.mockResolvedValue({ success: true, data: { remaining: 2 } });
    const res = await put({ action: 'removeCopies', count: 1 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { remaining: 2 } });
    expect(mockRemove).toHaveBeenCalledWith('b1', 'c1', 'u1', 1);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('400s a missing or invalid count without touching the binder', async () => {
    for (const count of [undefined, 0, -1, 1.5, '2']) {
      const res = await put({ action: 'removeCopies', count });
      expect(res.status).toBe(400);
    }
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('401s when not signed in', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Authentication required' } as any);
    expect((await put({ action: 'removeCopies', count: 1 })).status).toBe(401);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('404s when the item is gone or the binder is not theirs', async () => {
    mockRemove.mockResolvedValue({ success: false, error: 'Card not found in this binder' });
    expect((await put({ action: 'removeCopies', count: 1 })).status).toBe(404);
    mockRemove.mockResolvedValue({ success: false, error: 'Binder not found or access denied' });
    expect((await put({ action: 'removeCopies', count: 1 })).status).toBe(404);
  });
});
