import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({ deckService: { findByPublicId: vi.fn() } }));
vi.mock('@/lib/partner-api/auth', () => ({ authenticatePartner: vi.fn() }));

import { GET } from './route';
import { deckService } from '@/lib/services';
import { authenticatePartner } from '@/lib/partner-api/auth';
import { CALLER, ctx, get } from '../../_test/helpers';

const mockAuth = vi.mocked(authenticatePartner);
const mockFind = vi.mocked(deckService.findByPublicId);

describe('GET /api/partner/v1/decks/{deckId}', () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockFind.mockReset();
    mockAuth.mockResolvedValue(CALLER);
  });

  it("returns the caller's deck with its zones", async () => {
    mockFind.mockResolvedValue({
      success: true,
      data: {
        _id: 'internal',
        publicId: 'pub-1',
        userId: 'user-1',
        name: 'Kano',
        format: 'Blitz',
        visibility: 'private',
        isPublic: false,
        hero: [],
        equipment: [],
        maindeck: [{ printingId: 'p-1', quantity: 3, printingDetails: { name: 'Blazing Aether', tcg_low: 9 } }],
        inventory: [],
      },
    } as never);

    const response = await GET(get('/decks/pub-1'), ctx({ deckId: 'pub-1' }));

    expect(mockAuth).toHaveBeenCalledWith(expect.anything(), 'decks:read');
    // Scoped to the caller: the lookup itself only matches decks they own or co-own.
    expect(mockFind).toHaveBeenCalledWith('pub-1', 'user-1');
    const body = await response.json();
    expect(body.data.id).toBe('pub-1');
    expect(body.data.zones.maindeck).toEqual([
      { printing_id: 'p-1', quantity: 3, card: expect.objectContaining({ name: 'Blazing Aether', price_usd: 9 }) },
    ]);
    expect(JSON.stringify(body)).not.toContain('internal');
  });

  it('answers 404 when the caller has no such deck', async () => {
    mockFind.mockResolvedValue({ success: true, data: null } as never);

    expect((await GET(get('/decks/nope'), ctx({ deckId: 'nope' }))).status).toBe(404);
  });
});
