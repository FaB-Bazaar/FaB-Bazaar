import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({ deckService: { findByPublicId: vi.fn(), addPrinting: vi.fn() } }));
vi.mock('@/lib/partner-api/auth', () => ({ authenticatePartner: vi.fn() }));

import { POST } from './route';
import { deckService } from '@/lib/services';
import { authenticatePartner } from '@/lib/partner-api/auth';
import { CALLER, DENIED, ctx, post } from '../../../_test/helpers';

const mockAuth = vi.mocked(authenticatePartner);
const mockFind = vi.mocked(deckService.findByPublicId);
const mockAdd = vi.mocked(deckService.addPrinting);

const call = (body: unknown) => POST(post('/decks/pub-1/cards', body), ctx({ deckId: 'pub-1' }));

describe('POST /api/partner/v1/decks/{deckId}/cards', () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockFind.mockReset();
    mockAdd.mockReset();
    mockAuth.mockResolvedValue(CALLER);
    mockFind.mockResolvedValue({ success: true, data: { publicId: 'pub-1', userId: 'user-1' } } as never);
  });

  it('adds each card, letting the deck pick the zone when none is given', async () => {
    mockAdd
      .mockResolvedValueOnce({
        success: true,
        data: { printingId: 'p-1', success: true, cardName: 'Snatch', quantity: 3, category: 'maindeck' },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { printingId: 'p-2', success: true, cardName: 'Sink Below', quantity: 1, category: 'inventory' },
      });

    const response = await call({
      cards: [{ printing_id: 'p-1', quantity: 3 }, { printing_id: 'p-2', zone: 'sideboard' }],
    });

    expect(mockAuth).toHaveBeenCalledWith(expect.anything(), 'decks:write');
    expect(mockFind).toHaveBeenCalledWith('pub-1', 'user-1');
    expect(mockAdd).toHaveBeenNthCalledWith(1, 'pub-1', 'user-1', { printingId: 'p-1', quantity: 3, category: undefined });
    // "sideboard" is the inventory zone
    expect(mockAdd).toHaveBeenNthCalledWith(2, 'pub-1', 'user-1', { printingId: 'p-2', quantity: 1, category: 'inventory' });
    expect(await response.json()).toEqual({
      success: true,
      data: {
        added: 2,
        failed: 0,
        results: [
          { printing_id: 'p-1', added: true, name: 'Snatch', zone: 'maindeck', quantity: 3 },
          { printing_id: 'p-2', added: true, name: 'Sink Below', zone: 'inventory', quantity: 1 },
        ],
      },
    });
  });

  it('never asks the service to skip the banned-card check', async () => {
    mockAdd.mockResolvedValue({ success: true, data: { printingId: 'p-1', success: true } } as never);

    await call({ cards: [{ printing_id: 'p-1' }] });

    expect(mockAdd.mock.calls[0]).toHaveLength(3);
  });

  it('reports a card the deck rules reject, and an unknown zone, per card', async () => {
    mockAdd.mockResolvedValueOnce({
      success: true,
      data: { printingId: 'p-1', success: false, error: 'Snatch is banned in Classic Constructed' },
    });

    const body = await (await call({ cards: [{ printing_id: 'p-1' }, { printing_id: 'p-2', zone: 'graveyard' }] })).json();

    expect(body.data.added).toBe(0);
    expect(body.data.failed).toBe(2);
    expect(body.data.results[0]).toEqual({
      printing_id: 'p-1',
      added: false,
      reason: 'rejected',
      message: 'Snatch is banned in Classic Constructed',
    });
    expect(body.data.results[1]).toMatchObject({ printing_id: 'p-2', added: false, reason: 'invalid_zone' });
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });

  it("answers 404 for a deck that is not the caller's, adding nothing", async () => {
    mockFind.mockResolvedValue({ success: true, data: null } as never);

    expect((await call({ cards: [{ printing_id: 'p-1' }] })).status).toBe(404);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('answers 400 for a bad body', async () => {
    for (const body of [
      '{oops',
      {},
      { cards: [] },
      { cards: [{ quantity: 1 }] },
      { cards: [{ printing_id: 'p-1', quantity: 0 }] },
      { cards: Array.from({ length: 201 }, () => ({ printing_id: 'p-1' })) },
    ]) {
      expect((await call(body)).status, JSON.stringify(body).slice(0, 40)).toBe(400);
    }
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('refuses a token without decks:write', async () => {
    mockAuth.mockResolvedValue(DENIED);

    expect((await call({ cards: [{ printing_id: 'p-1' }] })).status).toBe(403);
  });
});
