import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  deckService: { findPartnerTalisharDeck: vi.fn(), saveDeckMatchup: vi.fn(), deleteDeckMatchup: vi.fn() },
}));
vi.mock('@/lib/partner-api/auth', () => ({ authenticatePartner: vi.fn() }));

import { PUT, DELETE } from './route';
import { deckService } from '@/lib/services';
import { authenticatePartner } from '@/lib/partner-api/auth';
import { CALLER, DENIED, ctx } from '../../../../../_test/helpers';

const mockAuth = vi.mocked(authenticatePartner);
const mockFind = vi.mocked(deckService.findPartnerTalisharDeck);
const mockSave = vi.mocked(deckService.saveDeckMatchup);
const mockDelete = vi.mocked(deckService.deleteDeckMatchup);

const card = (name: string, quantity: number, pitch?: number) => ({ printingId: `p-${name}`, quantity, printingDetails: { name, pitch } });
// The list Talishar plays — what the plan is checked against.
const DECK = {
  publicId: 'pub-1', name: 'Kano', format: 'Blitz',
  hero: [], equipment: [], maindeck: [card('blazing aether', 2, 1)], inventory: [card('sink below', 1, 1)], metadata: {},
} as any;

const HERO = 'briar_warden_of_thorns';
const params = (heroId = HERO) => ctx({ deckId: 'pub-1', heroId });
const request = (method: string, body?: unknown) => new NextRequest(`http://localhost/api/partner/v1/play/decks/pub-1/matchups/${HERO}`, {
  method,
  headers: { 'content-type': 'application/json' },
  body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
});
const PLAN = { preferred_turn_order: 'First', notes: 'race them', sideboard: { in: ['sink_below_red'], out: ['blazing_aether_red'] } };

describe('PUT /api/partner/v1/play/decks/{deckId}/matchups/{heroId}', () => {
  beforeEach(() => {
    for (const m of [mockAuth, mockFind, mockSave, mockDelete]) m.mockReset();
    mockAuth.mockResolvedValue(CALLER);
    mockFind.mockResolvedValue({ success: true, data: DECK });
    mockSave.mockImplementation(async (_d, _u, matchup) => ({ success: true, data: { matchup, created: true } }));
  });

  it('saves a plan for the hero against the list being played', async () => {
    const response = await PUT(request('PUT', PLAN), params());

    expect(mockAuth).toHaveBeenCalledWith(expect.anything(), 'decks:write');
    expect(mockFind).toHaveBeenCalledWith('pub-1', 'user-1', 'client-1');
    expect(mockSave).toHaveBeenCalledWith('pub-1', 'user-1', {
      heroId: HERO, preferredTurnOrder: 'First', notes: 'race them', sideboard: { in: ['sink_below_red'], out: ['blazing_aether_red'] },
    });
    expect(response.status).toBe(201);
    expect((await response.json()).data).toEqual({ hero_id: HERO, ...PLAN });
  });

  it('answers 200 when it replaced an existing plan, and fills optional fields', async () => {
    mockSave.mockImplementation(async (_d, _u, matchup) => ({ success: true, data: { matchup, created: false } }));
    const response = await PUT(request('PUT', { sideboard: { in: [], out: [] } }), params());
    expect(response.status).toBe(200);
    expect(mockSave.mock.calls[0][2]).toEqual({ heroId: HERO, preferredTurnOrder: null, notes: null, sideboard: { in: [], out: [] } });
  });

  it('rejects a card id the deck does not hold, instead of dropping it', async () => {
    const response = await PUT(request('PUT', { sideboard: { in: ['sink_below_blue'], out: ['blazing_aether_red', 'blazing_aether_red', 'blazing_aether_red'] } }), params());
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('invalid_matchup');
    expect(body.error.details.errors).toEqual([
      "Card 'sink_below_blue' - need 1 copies in sideboard, only 0 available",
      "Card 'blazing_aether_red' - need 3 copies in main deck, only 2 available",
    ]);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('rejects an unknown hero', async () => {
    const response = await PUT(request('PUT', PLAN), params('not_a_hero'));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('invalid_matchup');
  });

  it('rejects a malformed body', async () => {
    for (const body of ['not json', {}, { sideboard: { in: 'x', out: [] } }, { sideboard: { in: [1], out: [] } }, { ...PLAN, notes: 5 }]) {
      const response = await PUT(request('PUT', body), params());
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe('invalid_request');
    }
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('answers 404 for a deck not sent to this app', async () => {
    mockFind.mockResolvedValue({ success: true, data: null });
    expect((await PUT(request('PUT', PLAN), params())).status).toBe(404);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('refuses a token without decks:write', async () => {
    mockAuth.mockResolvedValue(DENIED);
    expect((await PUT(request('PUT', PLAN), params())).status).toBe(403);
    expect(mockFind).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/partner/v1/play/decks/{deckId}/matchups/{heroId}', () => {
  beforeEach(() => {
    for (const m of [mockAuth, mockFind, mockSave, mockDelete]) m.mockReset();
    mockAuth.mockResolvedValue(CALLER);
    mockFind.mockResolvedValue({ success: true, data: DECK });
  });

  it("removes the hero's plan", async () => {
    mockDelete.mockResolvedValue({ success: true, data: { deleted: true } });
    const response = await DELETE(request('DELETE'), params());
    expect(mockAuth).toHaveBeenCalledWith(expect.anything(), 'decks:write');
    expect(mockDelete).toHaveBeenCalledWith('pub-1', 'user-1', HERO);
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ deleted: true });
  });

  it('answers 404 when there was no plan for that hero', async () => {
    mockDelete.mockResolvedValue({ success: true, data: { deleted: false } });
    expect((await DELETE(request('DELETE'), params())).status).toBe(404);
  });

  it('answers 404 for a deck not sent to this app', async () => {
    mockFind.mockResolvedValue({ success: true, data: null });
    expect((await DELETE(request('DELETE'), params())).status).toBe(404);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
