import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({ deckService: { listPartnerDecks: vi.fn() } }));
vi.mock('@/lib/partner-api/auth', () => ({ authenticatePartner: vi.fn() }));

import { GET } from './route';
import { deckService } from '@/lib/services';
import { authenticatePartner } from '@/lib/partner-api/auth';
import { CALLER, DENIED, ctx, get } from '../../_test/helpers';

const mockAuth = vi.mocked(authenticatePartner);
const mockList = vi.mocked(deckService.listPartnerDecks);

describe('GET /api/partner/v1/play/decks', () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockList.mockReset();
    mockAuth.mockResolvedValue(CALLER);
  });

  it('lists the decks the player sent to this app, with a link to each playable list', async () => {
    mockList.mockResolvedValue({
      success: true,
      data: {
        total: 51,
        decks: [{
          publicId: 'pub-1', name: 'Aether Kano', format: 'Classic Constructed', heroName: 'Kano, Dracai of Aether',
          heroCardId: 'ARC113', totalCards: 72, updatedAt: new Date('2026-11-20T10:00:00Z'),
        }],
      },
    });

    const response = await GET(get('/play/decks?format=Classic%20Constructed&page=2&limit=25'), ctx({}));

    expect(mockAuth).toHaveBeenCalledWith(expect.anything(), 'decks:read');
    // Scoped to the caller AND the calling app.
    expect(mockList).toHaveBeenCalledWith('user-1', 'client-1', { format: 'Classic Constructed', limit: 25, offset: 25 });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: [{
        id: 'pub-1', name: 'Aether Kano', format: 'Classic Constructed', hero: 'Kano, Dracai of Aether',
        hero_card_id: 'ARC113', total_cards: 72, updated_at: '2026-11-20T10:00:00.000Z',
        play_url: '/api/partner/v1/play/decks/pub-1',
      }],
      pagination: { page: 2, limit: 25, total: 51, total_pages: 3 },
    });
  });

  it('defaults to the first 50 with no format filter', async () => {
    mockList.mockResolvedValue({ success: true, data: { total: 0, decks: [] } });
    await GET(get('/play/decks'), ctx({}));
    expect(mockList).toHaveBeenCalledWith('user-1', 'client-1', { format: undefined, limit: 50, offset: 0 });
  });

  it('refuses a token without decks:read', async () => {
    mockAuth.mockResolvedValue(DENIED);
    expect((await GET(get('/play/decks'), ctx({}))).status).toBe(403);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('answers 500 without the database error text', async () => {
    mockList.mockResolvedValue({ success: false, error: 'relation "x" does not exist' });
    const response = await GET(get('/play/decks'), ctx({}));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('relation');
  });
});
