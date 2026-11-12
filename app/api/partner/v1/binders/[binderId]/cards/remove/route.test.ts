import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({ binderService: { getBinder: vi.fn(), removeCopies: vi.fn() } }));
vi.mock('@/lib/partner-api/auth', () => ({ authenticatePartner: vi.fn() }));

import { POST } from './route';
import { binderService } from '@/lib/services';
import { authenticatePartner } from '@/lib/partner-api/auth';
import { CALLER, DENIED, ctx, post } from '../../../../_test/helpers';

const mockAuth = vi.mocked(authenticatePartner);
const mockBinder = vi.mocked(binderService.getBinder);
const mockRemove = vi.mocked(binderService.removeCopies);

const call = (body: unknown) => POST(post('/binders/b-1/cards/remove', body), ctx({ binderId: 'b-1' }));

describe('POST /api/partner/v1/binders/{binderId}/cards/remove', () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockBinder.mockReset();
    mockRemove.mockReset();
    mockAuth.mockResolvedValue(CALLER);
    mockBinder.mockResolvedValue({ success: true, data: { _id: 'b-1', userId: 'user-1' } } as never);
  });

  it('takes the asked number of copies off each item and reports what is left', async () => {
    mockRemove
      .mockResolvedValueOnce({ success: true, data: { remaining: 2 } })
      .mockResolvedValueOnce({ success: true, data: { remaining: 0 } });

    const response = await call({ items: [{ item_id: 'i-1', quantity: 1 }, { item_id: 'i-2' }] });

    expect(mockAuth).toHaveBeenCalledWith(expect.anything(), 'collection:write');
    expect(mockRemove).toHaveBeenNthCalledWith(1, 'b-1', 'i-1', 'user-1', 1);
    // quantity defaults to one copy, never "all"
    expect(mockRemove).toHaveBeenNthCalledWith(2, 'b-1', 'i-2', 'user-1', 1);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        removed: 2,
        failed: 0,
        results: [
          { item_id: 'i-1', removed: true, remaining: 2 },
          { item_id: 'i-2', removed: true, remaining: 0 },
        ],
      },
    });
  });

  it('reports an item that is not in the binder without failing the rest', async () => {
    mockRemove
      .mockResolvedValueOnce({ success: false, error: 'Card not found in this binder' })
      .mockResolvedValueOnce({ success: true, data: { remaining: 4 } });

    const body = await (await call({ items: [{ item_id: 'ghost' }, { item_id: 'i-2', quantity: 3 }] })).json();

    expect(body.data).toEqual({
      removed: 1,
      failed: 1,
      results: [
        { item_id: 'ghost', removed: false, reason: 'not_found' },
        { item_id: 'i-2', removed: true, remaining: 4 },
      ],
    });
  });

  it("answers 404 for a binder that is not the caller's, removing nothing", async () => {
    mockBinder.mockResolvedValue({ success: true, data: { _id: 'b-1', userId: 'other' } } as never);

    const response = await call({ items: [{ item_id: 'i-1' }] });

    expect(response.status).toBe(404);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('answers 400 for a bad body, removing nothing', async () => {
    for (const body of [
      '{oops',
      {},
      { items: [] },
      { items: [{ quantity: 1 }] },
      { items: [{ item_id: 'i-1', quantity: 0 }] },
      { items: [{ item_id: 'i-1', quantity: 1.5 }] },
      { items: [{ item_id: 'i-1', quantity: 'all' }] },
      { items: Array.from({ length: 501 }, () => ({ item_id: 'i-1' })) },
    ]) {
      expect((await call(body)).status, JSON.stringify(body).slice(0, 40)).toBe(400);
    }
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('refuses a token without collection:write', async () => {
    mockAuth.mockResolvedValue(DENIED);

    expect((await call({ items: [{ item_id: 'i-1' }] })).status).toBe(403);
    expect(mockBinder).not.toHaveBeenCalled();
  });
});
