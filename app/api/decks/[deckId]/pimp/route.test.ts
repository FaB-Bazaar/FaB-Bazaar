/**
 * Route unit tests for GET /api/decks/[deckId]/pimp — auth, deck resolution,
 * service wiring (distinct cardUniqueIds, English printings, owned counts),
 * and the response shape. Services mocked; the pimp engine runs for real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  deckService: { findByPublicId: vi.fn() },
  printingsService: { searchPrintings: vi.fn() },
  inventoryService: { getOwnedCountsByPrintingId: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { NextRequest } from 'next/server';
import { GET } from './route';
import { deckService, printingsService, inventoryService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockAuth = vi.mocked(authenticateRequest);
const mockFind = vi.mocked(deckService.findByPublicId);
const mockSearch = vi.mocked(printingsService.searchPrintings);
const mockOwned = vi.mocked(inventoryService.getOwnedCountsByPrintingId);

function printing(over: Record<string, unknown>) {
  return {
    printing_id: 'p1',
    card_unique_id: 'card-1',
    name: 'Shelter from the Storm',
    set: 'evo',
    collector_number: 'EVO123',
    edition: 'N',
    foiling: 'S',
    rarity: 'R',
    is_extended_art: false,
    art_variations: [],
    image_url: 'https://img/x',
    tcg_low: 1,
    tcgplayer_url: 'https://tcg/x',
    ...over,
  };
}

function deck(over: Record<string, unknown> = {}) {
  const dp = (printingId: string, cardUniqueId: string, name: string, quantity = 1) => ({
    printingId,
    quantity,
    printingDetails: { display_name: name, card_unique_id: cardUniqueId },
  });
  return {
    _id: 'id-1',
    publicId: 'deck-1',
    userId: 'owner-1',
    name: 'Test Deck',
    visibility: 'public',
    hero: [dp('h1', 'card-hero', 'Oldhim')],
    equipment: [dp('e1', 'card-eq', 'Tunic')],
    maindeck: [dp('m1', 'card-1', 'Shelter from the Storm', 2), dp('m2', 'card-1', 'Shelter from the Storm', 1)],
    inventory: [dp('i1', 'card-inv', 'Sink Below')],
    benched: [],
    ...over,
  };
}

const req = () => new NextRequest('http://localhost/api/decks/deck-1/pimp');
const params = { params: Promise.resolve({ deckId: 'deck-1' }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'user-1' } as any);
  mockFind.mockResolvedValue({ success: true, data: deck() } as any);
  mockSearch.mockResolvedValue({ success: true, data: { printings: [], total: 0, page: 1, pages: 1 } } as any);
  mockOwned.mockResolvedValue({ success: true, data: {} } as any);
});

describe('GET /api/decks/[deckId]/pimp', () => {
  it('401s when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'no' } as any);
    const res = await GET(req(), params);
    expect(res.status).toBe(401);
  });

  it('404s when the deck does not exist', async () => {
    mockFind.mockResolvedValue({ success: true, data: null } as any);
    const res = await GET(req(), params);
    expect(res.status).toBe(404);
  });

  it("404s a private deck the caller doesn't own (owner-scoped lookup missed)", async () => {
    mockFind
      .mockResolvedValueOnce({ success: true, data: null } as any)
      .mockResolvedValueOnce({ success: true, data: deck({ visibility: 'private' }) } as any);
    const res = await GET(req(), params);
    expect(res.status).toBe(404);
  });

  it('merges duplicate cards, requests English printings, and scopes owned counts to found printings', async () => {
    const rows = [
      printing({ printing_id: 'p-base', card_unique_id: 'card-1' }),
      printing({ printing_id: 'p-cf', card_unique_id: 'card-1', foiling: 'C', tcg_low: 50 }),
    ];
    mockSearch.mockResolvedValue({ success: true, data: { printings: rows, total: 2, page: 1, pages: 1 } } as any);
    mockOwned.mockResolvedValue({ success: true, data: { 'p-base': 3 } } as any);

    const res = await GET(req(), params);
    expect(res.status).toBe(200);
    const body = await res.json();

    // One search over the DISTINCT card ids from every deck category.
    expect(mockSearch).toHaveBeenCalledTimes(1);
    const [filters, options] = mockSearch.mock.calls[0];
    expect([...(filters as any).cardUniqueIds].sort()).toEqual(['card-1', 'card-eq', 'card-hero', 'card-inv']);
    expect((filters as any).languages).toEqual(['en']);
    expect((options as any).limit).toBeGreaterThanOrEqual(1000);

    expect(mockOwned).toHaveBeenCalledWith('user-1', ['p-base', 'p-cf']);

    expect(body.success).toBe(true);
    expect(body.data.deckName).toBe('Test Deck');
    expect(body.data.cards).toHaveLength(1);
    const card = body.data.cards[0];
    // The two maindeck rows of the same card merged: 2 + 1 copies.
    expect(card.quantity).toBe(3);
    expect(card.upgrades.map((u: any) => u.printingId)).toEqual(['p-cf']);
    expect(card.bestOwned.printingId).toBe('p-base');
    expect(body.data.topPickTotal).toBe(50);
  });

  it('500s when a downstream service fails', async () => {
    mockSearch.mockResolvedValue({ success: false, error: 'boom' } as any);
    const res = await GET(req(), params);
    expect(res.status).toBe(500);
  });
});
