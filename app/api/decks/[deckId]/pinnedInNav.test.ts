/**
 * Unit test for PATCH /api/decks/[deckId] — confirms pinnedInNav is forwarded
 * to the service layer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  deckService: {
    updateDeck: vi.fn(),
    findByPublicId: vi.fn(),
  },
}));
vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
  authenticateSession: vi.fn(),
}));
vi.mock('@/auth', () => ({ auth: vi.fn() }));

import { PATCH } from './route';
import { deckService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockUpdate = vi.mocked(deckService.updateDeck);
const mockFindByPublicId = vi.mocked(deckService.findByPublicId);
const mockAuth = vi.mocked(authenticateRequest);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'user-123' } as any);
  mockFindByPublicId.mockResolvedValue({
    success: true,
    data: { userId: 'user-123', coOwners: [], publicId: 'pub-1' },
  } as any);
  mockUpdate.mockResolvedValue({ success: true, data: { publicId: 'pub-1' } } as any);
});

describe('PATCH /api/decks/[deckId] — pinnedInNav', () => {
  it('forwards pinnedInNav to deckService.updateDeck', async () => {
    const req = new NextRequest('http://localhost/api/decks/pub-1', {
      method: 'PATCH',
      body: JSON.stringify({ pinnedInNav: true }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await PATCH(req, { params: Promise.resolve({ deckId: 'pub-1' }) } as any);
    expect(res.status).toBe(200);

    expect(mockUpdate).toHaveBeenCalledWith(
      'pub-1',
      'user-123',
      expect.objectContaining({ pinnedInNav: true }),
    );
  });
});
