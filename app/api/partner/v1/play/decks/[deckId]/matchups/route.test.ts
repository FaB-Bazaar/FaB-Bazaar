import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({ deckService: { findPartnerTalisharDeck: vi.fn() } }));
vi.mock('@/lib/partner-api/auth', () => ({ authenticatePartner: vi.fn() }));

import { GET } from './route';
import { deckService } from '@/lib/services';
import { authenticatePartner } from '@/lib/partner-api/auth';
import { CALLER, ctx, get } from '../../../../_test/helpers';

const mockAuth = vi.mocked(authenticatePartner);
const mockFind = vi.mocked(deckService.findPartnerTalisharDeck);

describe('GET /api/partner/v1/play/decks/{deckId}/matchups', () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockFind.mockReset();
    mockAuth.mockResolvedValue(CALLER);
  });

  it("lists the deck's matchup plans", async () => {
    mockFind.mockResolvedValue({
      success: true,
      data: { metadata: { matchups: [
        { heroId: 'briar', preferredTurnOrder: 'Second', notes: 'slow down', sideboard: { in: ['a'], out: ['b'] } },
        { heroId: 'broken' },
      ] } } as any,
    });

    const response = await GET(get('/play/decks/pub-1/matchups'), ctx({ deckId: 'pub-1' }));

    expect(mockAuth).toHaveBeenCalledWith(expect.anything(), 'decks:read');
    expect(mockFind).toHaveBeenCalledWith('pub-1', 'user-1', 'client-1');
    expect((await response.json()).data).toEqual([
      { hero_id: 'briar', preferred_turn_order: 'Second', notes: 'slow down', sideboard: { in: ['a'], out: ['b'] } },
    ]);
  });

  it('answers 404 for a deck not sent to this app', async () => {
    mockFind.mockResolvedValue({ success: true, data: null });
    expect((await GET(get('/play/decks/x/matchups'), ctx({ deckId: 'x' }))).status).toBe(404);
  });
});
