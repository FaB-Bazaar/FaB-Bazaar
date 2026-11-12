import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  binderService: { getBinder: vi.fn(), getBinderCards: vi.fn() },
}));
vi.mock('@/lib/partner-api/auth', () => ({ authenticatePartner: vi.fn() }));

import { GET } from './route';
import { binderService } from '@/lib/services';
import { authenticatePartner } from '@/lib/partner-api/auth';
import { CALLER, ctx, get } from '../../../_test/helpers';

const mockAuth = vi.mocked(authenticatePartner);
const mockBinder = vi.mocked(binderService.getBinder);
const mockCards = vi.mocked(binderService.getBinderCards);

const card = {
  _id: 'i-1',
  printingId: 'p-1',
  card_unique_id: 'c-1',
  name: 'snatch',
  display_name: 'Snatch',
  pitch: 1,
  set: 'wtr',
  collector_number: 'WTR167',
  edition: 'u',
  foiling: 's',
  rarity: 'c',
  language: 'en',
  image_url: 'https://img.example/p-1',
  tcg_low: 0.5,
  quantity: 3,
  condition: 'NM',
  forTrade: true,
  userId: 'user-1',
};

describe('GET /api/partner/v1/binders/{binderId}/cards', () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockBinder.mockReset();
    mockCards.mockReset();
    mockAuth.mockResolvedValue(CALLER);
  });

  it("returns a page of the caller's binder", async () => {
    mockBinder.mockResolvedValue({ success: true, data: { _id: 'b-1', userId: 'user-1' } } as never);
    mockCards.mockResolvedValue({
      success: true,
      data: { cards: [card], pagination: { page: 2, limit: 50, total: 51, totalPages: 2 } },
    } as never);

    const response = await GET(get('/binders/b-1/cards?page=2&limit=50'), ctx({ binderId: 'b-1' }));

    expect(mockAuth).toHaveBeenCalledWith(expect.anything(), 'collection:read');
    expect(mockBinder).toHaveBeenCalledWith('b-1', 'user-1');
    expect(mockCards).toHaveBeenCalledWith('b-1', {}, { page: 2, limit: 50, sortBy: 'name' });
    const body = await response.json();
    expect(body.pagination).toEqual({ page: 2, limit: 50, total: 51, total_pages: 2 });
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      item_id: 'i-1',
      quantity: 3,
      for_trade: true,
      card: { printing_id: 'p-1', name: 'Snatch', price_usd: 0.5 },
    });
    expect(JSON.stringify(body)).not.toContain('user-1');
  });

  it('caps the page size', async () => {
    mockBinder.mockResolvedValue({ success: true, data: { _id: 'b-1', userId: 'user-1' } } as never);
    mockCards.mockResolvedValue({
      success: true,
      data: { cards: [], pagination: { page: 1, limit: 200, total: 0, totalPages: 0 } },
    } as never);

    await GET(get('/binders/b-1/cards?limit=5000'), ctx({ binderId: 'b-1' }));

    expect(mockCards).toHaveBeenCalledWith('b-1', {}, { page: 1, limit: 200, sortBy: 'name' });
  });

  it("answers 404 for someone else's binder, even a public one", async () => {
    mockBinder.mockResolvedValue({ success: true, data: { _id: 'b-2', userId: 'other' } } as never);

    const response = await GET(get('/binders/b-2/cards'), ctx({ binderId: 'b-2' }));

    expect(response.status).toBe(404);
    expect(mockCards).not.toHaveBeenCalled();
  });

  it('answers 404 when the binder does not exist or is private to someone else', async () => {
    mockBinder.mockResolvedValueOnce({ success: true, data: null } as never);
    expect((await GET(get('/binders/x/cards'), ctx({ binderId: 'x' }))).status).toBe(404);

    mockBinder.mockResolvedValueOnce({ success: false, error: 'Access denied: This binder is private' } as never);
    expect((await GET(get('/binders/y/cards'), ctx({ binderId: 'y' }))).status).toBe(404);
  });
});
