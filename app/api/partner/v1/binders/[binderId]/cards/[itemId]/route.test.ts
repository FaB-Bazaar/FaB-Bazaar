import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({ binderService: { getBinder: vi.fn(), getBinderCard: vi.fn(), updateBinderCard: vi.fn() } }));
vi.mock('@/lib/partner-api/auth', () => ({ authenticatePartner: vi.fn() }));

import { PATCH } from './route';
import { binderService } from '@/lib/services';
import { authenticatePartner } from '@/lib/partner-api/auth';
import { CALLER, ctx } from '../../../../_test/helpers';

const mockAuth = vi.mocked(authenticatePartner);
const mockBinder = vi.mocked(binderService.getBinder);
const mockCard = vi.mocked(binderService.getBinderCard);
const mockUpdate = vi.mocked(binderService.updateBinderCard);

const item = { _id: 'i-1', printingId: 'p-1', name: 'snatch', quantity: 4, condition: 'NM', forTrade: true, tcg_low: 1 };

function call(body: unknown) {
  const request = new NextRequest('http://localhost/api/partner/v1/binders/b-1/cards/i-1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return PATCH(request, ctx({ binderId: 'b-1', itemId: 'i-1' }));
}

describe('PATCH /api/partner/v1/binders/{binderId}/cards/{itemId}', () => {
  beforeEach(() => {
    for (const m of [mockAuth, mockBinder, mockCard, mockUpdate]) m.mockReset();
    mockAuth.mockResolvedValue(CALLER);
    mockBinder.mockResolvedValue({ success: true, data: { _id: 'b-1', userId: 'user-1' } } as never);
    mockCard.mockResolvedValue({ success: true, data: item } as never);
    mockUpdate.mockResolvedValue({ success: true, data: item } as never);
  });

  it('changes quantity and the for-trade flag, returning the item', async () => {
    const response = await call({ quantity: 4, for_trade: true });

    expect(mockAuth).toHaveBeenCalledWith(expect.anything(), 'collection:write');
    expect(mockUpdate).toHaveBeenCalledWith('b-1', 'i-1', 'user-1', { quantity: 4, forTrade: true });
    expect((await response.json()).data).toMatchObject({
      item_id: 'i-1',
      quantity: 4,
      for_trade: true,
      card: { printing_id: 'p-1', price_usd: 1 },
    });
  });

  it('only sends the fields that were given', async () => {
    await call({ for_trade: false });

    expect(mockUpdate).toHaveBeenCalledWith('b-1', 'i-1', 'user-1', { forTrade: false });
  });

  it('ignores fields a partner may not set', async () => {
    await call({ quantity: 2, notes: 'x', userId: 'other', binderId: 'b-9', printingId: 'p-9' });

    expect(mockUpdate).toHaveBeenCalledWith('b-1', 'i-1', 'user-1', { quantity: 2 });
  });

  it('answers 400 for nothing to change or a bad value', async () => {
    for (const body of ['{oops', {}, { notes: 'x' }, { quantity: 0 }, { quantity: -1 }, { quantity: 1.5 }, { quantity: 1000 }, { for_trade: 'yes' }]) {
      expect((await call(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("answers 404 for someone else's binder or an item that is not in it", async () => {
    mockBinder.mockResolvedValueOnce({ success: true, data: { _id: 'b-1', userId: 'other' } } as never);
    expect((await call({ quantity: 2 })).status).toBe(404);

    mockCard.mockResolvedValueOnce({ success: true, data: null } as never);
    expect((await call({ quantity: 2 })).status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
