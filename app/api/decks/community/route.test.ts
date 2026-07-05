/**
 * Unit tests for GET /api/decks/community
 *
 * Uses a mocked deckService — tests HTTP concerns: the dateFrom/dateTo
 * rolling-window params (used by the fabby-chat decks-to-beat picker)
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
