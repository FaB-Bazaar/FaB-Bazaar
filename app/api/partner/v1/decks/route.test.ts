import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({ deckService: { listUserDecksBasic: vi.fn() } }));
vi.mock('@/lib/partner-api/auth', () => ({ authenticatePartner: vi.fn() }));

import { GET } from './route';
import { deckService } from '@/lib/services';
import { authenticatePartner } from '@/lib/partner-api/auth';
import { CALLER, DENIED, ctx, get } from '../_test/helpers';

const mockAuth = vi.mocked(authenticatePartner);
const mockList = vi.mocked(deckService.listUserDecksBasic);

describe('GET /api/partner/v1/decks', () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockList.mockReset();
  });

  it("lists the caller's decks by public id", async () => {
    mockAuth.mockResolvedValue(CALLER);
    mockList.mockResolvedValue({
      success: true,
      data: [
        {
          _id: 'internal',
          publicId: 'pub-1',
          userId: 'user-1',
          name: 'Kano',
          format: 'Blitz',
          heroName: 'kano',
          visibility: 'private',
          isPublic: false,
          totalCards: 52,
        },
      ],
    } as never);

    const response = await GET(get('/decks'), ctx({}));

    expect(mockAuth).toHaveBeenCalledWith(expect.anything(), 'decks:read');
    expect(mockList).toHaveBeenCalledWith('user-1');
    expect(await response.json()).toEqual({
      success: true,
      data: [
        {
          id: 'pub-1',
          name: 'Kano',
          format: 'Blitz',
          hero: 'kano',
          visibility: 'private',
          total_cards: 52,
          estimated_value_usd: 0,
          updated_at: null,
        },
      ],
    });
  });

  it('refuses a token without the scope', async () => {
    mockAuth.mockResolvedValue(DENIED);

    expect((await GET(get('/decks'), ctx({}))).status).toBe(403);
    expect(mockList).not.toHaveBeenCalled();
  });
});
