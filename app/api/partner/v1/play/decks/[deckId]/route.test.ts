import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  deckService: { findPartnerTalisharDeck: vi.fn() },
  printingsService: { searchPrintings: vi.fn() },
}));
vi.mock('@/lib/partner-api/auth', () => ({ authenticatePartner: vi.fn() }));

import { GET } from './route';
import { deckService } from '@/lib/services';
import { authenticatePartner } from '@/lib/partner-api/auth';
import { CALLER, DENIED, ctx, get } from '../../../_test/helpers';

const mockAuth = vi.mocked(authenticatePartner);
const mockFind = vi.mocked(deckService.findPartnerTalisharDeck);

const card = (name: string, quantity: number, pitch?: number) => ({ printingId: `p-${name}`, quantity, printingDetails: { name, pitch, collector_number: 'DTD001', image_url: 'https://img/1' } });
const DECK = {
  publicId: 'pub-1', name: 'Aether Kano', format: 'Blitz', heroName: null,
  hero: [], equipment: [], maindeck: [card('blazing aether', 2, 1)], inventory: [card('sink below', 1, 1)],
  metadata: { matchups: [{ heroId: 'briar', preferredTurnOrder: 'First', notes: null, sideboard: { in: ['sink_below_red'], out: ['blazing_aether_red'] } }] },
} as any;

describe('GET /api/partner/v1/play/decks/{deckId}', () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockFind.mockReset();
    mockAuth.mockResolvedValue(CALLER);
    mockFind.mockResolvedValue({ success: true, data: DECK });
  });

  it('serves the deck as Talishar imports it, for a deck sent to this app', async () => {
    const response = await GET(get('/play/decks/pub-1'), ctx({ deckId: 'pub-1' }));

    expect(mockAuth).toHaveBeenCalledWith(expect.anything(), 'decks:read');
    expect(mockFind).toHaveBeenCalledWith('pub-1', 'user-1', 'client-1');
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Aether Kano');
    expect(body.data.format).toBe('blitz');
    expect(body.data.cards).toEqual([
      { identifier: 'blazing_aether_red', total: 2 },
      { identifier: 'sink_below_red', total: 0, sideboardTotal: 1 },
    ]);
    expect(body.data.matchups[0]).toMatchObject({ heroId: 'briar', sideboard: { in: ['sink_below_red'], out: ['blazing_aether_red'] } });
    expect(body.data).not.toHaveProperty('art');
  });

  it("applies a matchup's swaps and adds art when asked", async () => {
    const response = await GET(get('/play/decks/pub-1?matchup=briar&include_art=1'), ctx({ deckId: 'pub-1' }));
    const body = await response.json();
    expect(body.data.cards).toContainEqual({ identifier: 'blazing_aether_red', total: 1, sideboardTotal: 1 });
    expect(body.data.art).toEqual({ DTD001: 'https://img/1' });
  });

  it('answers 404 for a deck not sent to this app (or not the caller\'s)', async () => {
    mockFind.mockResolvedValue({ success: true, data: null });
    const response = await GET(get('/play/decks/nope'), ctx({ deckId: 'nope' }));
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe('not_found');
  });

  it('refuses a token without decks:read', async () => {
    mockAuth.mockResolvedValue(DENIED);
    expect((await GET(get('/play/decks/pub-1'), ctx({ deckId: 'pub-1' }))).status).toBe(403);
    expect(mockFind).not.toHaveBeenCalled();
  });
});
