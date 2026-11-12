import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  deckService: { findByPublicId: vi.fn(), removePrinting: vi.fn(), updateDeck: vi.fn() },
}));
vi.mock('@/lib/validation/matchup-validation', () => ({ sanitizeAllMatchups: vi.fn() }));
vi.mock('@/lib/partner-api/auth', () => ({ authenticatePartner: vi.fn() }));

import { POST } from './route';
import { deckService } from '@/lib/services';
import { sanitizeAllMatchups } from '@/lib/validation/matchup-validation';
import { authenticatePartner } from '@/lib/partner-api/auth';
import { CALLER, ctx, post } from '../../../../_test/helpers';

const mockAuth = vi.mocked(authenticatePartner);
const mockFind = vi.mocked(deckService.findByPublicId);
const mockRemove = vi.mocked(deckService.removePrinting);
const mockUpdate = vi.mocked(deckService.updateDeck);
const mockSanitize = vi.mocked(sanitizeAllMatchups);

const call = (body: unknown) => POST(post('/decks/pub-1/cards/remove', body), ctx({ deckId: 'pub-1' }));
const deck = (metadata?: unknown) => ({ success: true, data: { publicId: 'pub-1', userId: 'user-1', metadata } }) as never;

describe('POST /api/partner/v1/decks/{deckId}/cards/remove', () => {
  beforeEach(() => {
    for (const m of [mockAuth, mockFind, mockRemove, mockUpdate, mockSanitize]) m.mockReset();
    mockAuth.mockResolvedValue(CALLER);
    mockFind.mockResolvedValue(deck());
    mockRemove.mockResolvedValue({ success: true, data: true });
  });

  it('removes the asked copies from the named zone, defaulting to one copy from the main deck', async () => {
    const response = await call({
      cards: [{ printing_id: 'p-1' }, { printing_id: 'p-2', zone: 'sideboard', quantity: 2 }],
    });

    expect(mockAuth).toHaveBeenCalledWith(expect.anything(), 'decks:write');
    expect(mockRemove).toHaveBeenNthCalledWith(1, 'pub-1', 'user-1', 'p-1', 'maindeck', 1);
    expect(mockRemove).toHaveBeenNthCalledWith(2, 'pub-1', 'user-1', 'p-2', 'inventory', 2);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        removed: 2,
        failed: 0,
        results: [
          { printing_id: 'p-1', removed: true, zone: 'maindeck', quantity: 1 },
          { printing_id: 'p-2', removed: true, zone: 'inventory', quantity: 2 },
        ],
      },
    });
  });

  it('reports a card that is not in that zone, and an unknown zone, per card', async () => {
    mockRemove.mockResolvedValueOnce({ success: false, error: 'Printing not found in deck' });

    const body = await (await call({ cards: [{ printing_id: 'p-1' }, { printing_id: 'p-2', zone: 'graveyard' }] })).json();

    expect(body.data.results).toEqual([
      { printing_id: 'p-1', removed: false, reason: 'not_found' },
      expect.objectContaining({ printing_id: 'p-2', removed: false, reason: 'invalid_zone' }),
    ]);
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it('drops matchup plans entries that point at cards no longer in the deck, as the app does', async () => {
    const metadata = { note: 'keep me', matchups: [{ heroId: 'kano', in: ['gone_red'], out: [] }] };
    mockFind.mockResolvedValue(deck(metadata));
    mockSanitize.mockReturnValue({ matchups: [{ heroId: 'kano', in: [], out: [] }] as never, changed: true });

    await call({ cards: [{ printing_id: 'p-1' }] });

    expect(mockUpdate).toHaveBeenCalledWith('pub-1', 'user-1', {
      metadata: { note: 'keep me', matchups: [{ heroId: 'kano', in: [], out: [] }] },
    });
  });

  it('leaves the deck metadata alone when no matchup plan changed', async () => {
    mockFind.mockResolvedValue(deck({ matchups: [{ heroId: 'kano', in: [], out: [] }] }));
    mockSanitize.mockReturnValue({ matchups: [] as never, changed: false });

    await call({ cards: [{ printing_id: 'p-1' }] });

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("answers 404 for a deck that is not the caller's and 400 for a bad body, removing nothing", async () => {
    expect((await call({ cards: [] })).status).toBe(400);
    expect((await call({ cards: [{ printing_id: 'p-1', quantity: 0 }] })).status).toBe(400);

    mockFind.mockResolvedValue({ success: true, data: null } as never);
    expect((await call({ cards: [{ printing_id: 'p-1' }] })).status).toBe(404);
    expect(mockRemove).not.toHaveBeenCalled();
  });
});
