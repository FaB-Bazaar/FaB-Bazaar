/**
 * Unit tests for GET /api/decks/community
 *
 * Uses a mocked deckService — tests HTTP concerns: the dateFrom/dateTo
 * rolling-window params (used by the volzar decks-to-beat picker)
 * pass through to listPublicDecks only when well-formed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mocks must be declared before importing the module under test.
vi.mock('@/lib/services', () => ({
  deckService: {
    listPublicDecks: vi.fn(),
  },
}));

// Import after mocks are declared so we can use vi.mocked()
import { GET } from './route';
import { deckService } from '@/lib/services';

const mockList = vi.mocked(deckService.listPublicDecks);

const makeRequest = (query: string) =>
  new NextRequest(`http://localhost/api/decks/community${query}`);

beforeEach(() => {
  mockList.mockReset();
  mockList.mockResolvedValue({ success: true, data: { decks: [], total: 0 } } as any);
});

describe('GET /api/decks/community date window', () => {
  it('passes well-formed dateFrom/dateTo through to the service', async () => {
    const res = await GET(makeRequest('?featured=true&dateFrom=2026-04-05&dateTo=2026-07-05'));
    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ featured: true, dateFrom: '2026-04-05', dateTo: '2026-07-05' }),
      expect.anything(),
    );
  });

  it('omits malformed date params instead of forwarding them', async () => {
    await GET(makeRequest('?dateFrom=yesterday&dateTo=2026-13-99x'));
    const filters = mockList.mock.calls[0][0];
    expect(filters).not.toHaveProperty('dateFrom');
    expect(filters).not.toHaveProperty('dateTo');
  });

  it('still works without date params (no filter keys added)', async () => {
    await GET(makeRequest('?featured=true'));
    const filters = mockList.mock.calls[0][0];
    expect(filters).not.toHaveProperty('dateFrom');
    expect(filters).not.toHaveProperty('dateTo');
  });
});

describe('GET /api/decks/community deck payload', () => {
  it('passes heroImageUrl from the service through to the response body', async () => {
    // Tiles render the stored image_url; constructed printing_id CDN URLs 404
    // (old images deleted 2026-07), so this field must survive the route.
    mockList.mockResolvedValue({
      success: true,
      data: {
        decks: [
          {
            _id: 'deck-1',
            publicId: 'pub-1',
            name: 'Featured deck',
            format: 'Silver Age',
            heroName: 'Fai',
            heroPrintingId: 'printing-1',
            heroImageUrl: 'https://imagedelivery.net/hash/UPR045/public',
          },
        ],
        total: 1,
      },
    } as any);

    const res = await GET(makeRequest('?featured=true'));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.decks[0].heroImageUrl).toBe(
      'https://imagedelivery.net/hash/UPR045/public',
    );
    expect(body.data.decks[0].heroPrintingId).toBe('printing-1');
  });
});

describe('GET /api/decks/community sortBy', () => {
  it("forwards sortBy=placing to the service (Decks to Beat 1st → last order)", async () => {
    await GET(makeRequest('?featured=true&sortBy=placing'));
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ featured: true, sortBy: 'placing' }),
      expect.anything(),
    );
  });

  it('drops an unknown sortBy value instead of forwarding it', async () => {
    await GET(makeRequest('?featured=true&sortBy=DROP%20TABLE'));
    expect(mockList.mock.calls[0][0]).not.toHaveProperty('sortBy');
  });

  it('adds no sortBy key when the param is absent', async () => {
    await GET(makeRequest('?featured=true'));
    expect(mockList.mock.calls[0][0]).not.toHaveProperty('sortBy');
  });
});
