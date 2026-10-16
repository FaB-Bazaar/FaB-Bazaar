/**
 * Route unit tests for GET /api/decks/[deckId]/printing-prices — the Prices
 * view's "Compare printings" data: cheapest English tcg_low per card per finish.
 * Services mocked; cheapestByFinish runs for real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  deckService: { findByPublicId: vi.fn() },
  printingsService: { searchPrintings: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { NextRequest } from 'next/server';
import { GET } from './route';
import { deckService, printingsService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockAuth = vi.mocked(authenticateRequest);
const mockFind = vi.mocked(deckService.findByPublicId);
const mockSearch = vi.mocked(printingsService.searchPrintings);

const dp = (printingId: string, cardUniqueId: string, quantity = 1) => ({
  printingId, quantity, printingDetails: { card_unique_id: cardUniqueId },
});
const deck = (over: Record<string, unknown> = {}) => ({
  publicId: 'deck-1',
  visibility: 'public',
  hero: [dp('h1', 'card-hero')],
  equipment: [],
  maindeck: [dp('m1', 'card-1', 2), dp('m2', 'card-1', 1)],
  inventory: [dp('i1', 'card-inv')],
  benched: [dp('b1', 'card-bench')],
  tokens: [],
  ...over,
});

const req = () => new NextRequest('http://localhost/api/decks/deck-1/printing-prices');
const params = { params: Promise.resolve({ deckId: 'deck-1' }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'user-1' } as any);
  mockFind.mockResolvedValue({ success: true, data: deck() } as any);
  mockSearch.mockResolvedValue({ success: true, data: { printings: [], total: 0, page: 1, pages: 1 } } as any);
});

describe('GET /api/decks/[deckId]/printing-prices', () => {
  it('serves a public deck to a signed-out viewer', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'no' } as any);
    const res = await GET(req(), params);
    expect(res.status).toBe(200);
    expect(mockFind).toHaveBeenCalledWith('deck-1');
  });

  it('404s when the deck does not exist', async () => {
    mockFind.mockResolvedValue({ success: true, data: null } as any);
    expect((await GET(req(), params)).status).toBe(404);
  });

  it("404s a private deck the caller doesn't own", async () => {
    mockFind
      .mockResolvedValueOnce({ success: true, data: null } as any)
      .mockResolvedValueOnce({ success: true, data: deck({ visibility: 'private' }) } as any);
    expect((await GET(req(), params)).status).toBe(404);
  });

  it('serves the owner their own private deck', async () => {
    mockFind.mockResolvedValue({ success: true, data: deck({ visibility: 'private' }) } as any);
    expect((await GET(req(), params)).status).toBe(200);
    expect(mockFind).toHaveBeenCalledWith('deck-1', 'user-1');
  });

  it("searches the deck's distinct cards in English and returns the cheapest price per finish", async () => {
    mockSearch.mockResolvedValue({
      success: true,
      data: {
        printings: [
          { card_unique_id: 'card-1', foiling: 's', tcg_low: 2 },
          { card_unique_id: 'card-1', foiling: 'r', tcg_low: 9 },
          { card_unique_id: 'card-inv', foiling: 'c', tcg_low: 40 },
        ],
        total: 3, page: 1, pages: 1,
      },
    } as any);

    const res = await GET(req(), params);
    const body = await res.json();

    const [filters, options] = mockSearch.mock.calls[0];
    expect([...(filters as any).cardUniqueIds].sort()).toEqual(['card-1', 'card-hero', 'card-inv']);
    expect((filters as any).languages).toEqual(['en']);
    expect((options as any).limit).toBeGreaterThanOrEqual(1000);
    expect(body).toEqual({
      success: true,
      data: { byCard: { 'card-1': { cheapest: 2, s: 2, r: 9 }, 'card-inv': { cheapest: 40, c: 40 } } },
    });
  });
});
