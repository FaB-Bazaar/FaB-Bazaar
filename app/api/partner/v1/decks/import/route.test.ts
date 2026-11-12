import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  deckService: {},
  printingsService: {},
  bannedCardsService: {},
}));
vi.mock('@/lib/deck/import-fabrary', () => ({ importFabraryDeck: vi.fn() }));
vi.mock('@/lib/partner-api/auth', () => ({ authenticatePartner: vi.fn() }));

import { POST } from './route';
import { importFabraryDeck } from '@/lib/deck/import-fabrary';
import { authenticatePartner } from '@/lib/partner-api/auth';
import { CALLER, ctx, post } from '../../_test/helpers';

const mockAuth = vi.mocked(authenticatePartner);
const mockImport = vi.mocked(importFabraryDeck);

describe('POST /api/partner/v1/decks/import', () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockImport.mockReset();
    mockAuth.mockResolvedValue(CALLER);
  });

  it('creates a deck for the caller from a decklist and reports what did not resolve', async () => {
    mockImport.mockResolvedValue({
      success: true,
      data: {
        publicId: 'pub-7',
        deckName: 'Kano',
        format: 'Blitz',
        hero: { name: 'Kano', printingId: 'p-hero' },
        summary: { cardsRequested: 40, cardsResolved: 39, cardsAdded: 39, failed: 0 },
        unresolved: ['Mystery Card (red)'],
      },
    });

    const response = await POST(post('/decks/import', { text: 'Name: Kano\n...' }), ctx({}));

    expect(mockAuth).toHaveBeenCalledWith(expect.anything(), 'decks:write');
    expect(mockImport).toHaveBeenCalledWith({ userId: 'user-1', text: 'Name: Kano\n...' }, expect.any(Object));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        deck: { id: 'pub-7', name: 'Kano', format: 'Blitz', hero: 'Kano' },
        cards_requested: 40,
        cards_added: 39,
        unresolved: ['Mystery Card (red)'],
      },
    });
  });

  it('answers 400 with the reason when the list cannot be read', async () => {
    mockImport.mockResolvedValue({ success: false, error: 'Could not find a "Hero:" line in the list.' });

    const response = await POST(post('/decks/import', { text: 'garbage' }), ctx({}));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toEqual({
      code: 'invalid_decklist',
      message: 'Could not find a "Hero:" line in the list.',
    });
  });

  it('answers 400 when there is no text', async () => {
    expect((await POST(post('/decks/import', {}), ctx({}))).status).toBe(400);
    expect((await POST(post('/decks/import', '{oops'), ctx({}))).status).toBe(400);
    expect(mockImport).not.toHaveBeenCalled();
  });
});
