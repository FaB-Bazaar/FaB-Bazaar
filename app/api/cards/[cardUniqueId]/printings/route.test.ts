/**
 * Unit tests for GET /api/cards/[cardUniqueId]/printings — printing drilldown.
 *
 * Used by the QuickAddCardDialog when a user clicks a card tile and opens
 * the printing picker. Lazy-loads the full PrintingDTO[] for one card.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  printingsService: { getPrintingsForCard: vi.fn() },
}));

import { GET } from './route';
import { printingsService } from '@/lib/services';

const mockFn = vi.mocked(printingsService.getPrintingsForCard);

const makeRequest = (cardId: string) => ({
  ctx: { params: Promise.resolve({ cardUniqueId: cardId }) },
  req: new Request(`http://localhost:3000/api/cards/${cardId}/printings`) as unknown as Parameters<typeof GET>[0],
});

beforeEach(() => vi.clearAllMocks());

describe('GET /api/cards/[cardUniqueId]/printings', () => {
  it('returns 200 with the printings array on success', async () => {
    mockFn.mockResolvedValue({
      success: true,
      data: { printings: [{ printing_id: 'p1' }, { printing_id: 'p2' }] as any, total: 2 },
    } as any);

    const { req, ctx } = makeRequest('cardX');
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      data: { printings: [{ printing_id: 'p1' }, { printing_id: 'p2' }] },
    });
  });

  it('passes cardUniqueId from the route params to the service', async () => {
    mockFn.mockResolvedValue({ success: true, data: { printings: [{ printing_id: 'p1' }], total: 1 } } as any);

    const { req, ctx } = makeRequest('abc123');
    await GET(req, ctx);
    expect(mockFn).toHaveBeenCalledWith('abc123');
  });

  it('returns 404 when the card has no printings (total = 0)', async () => {
    mockFn.mockResolvedValue({ success: true, data: { printings: [], total: 0 } } as any);

    const { req, ctx } = makeRequest('unknown');
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns 500 when the service fails', async () => {
    mockFn.mockResolvedValue({ success: false, error: 'DB down' } as any);

    const { req, ctx } = makeRequest('cardX');
    const res = await GET(req, ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('DB down');
  });
});
