/**
 * Route unit tests for POST /api/decks/[deckId]/printings/remove — category
 * normalization. "sideboard" is the FaB name for the inventory zone; the DB
 * enum has no such value, so the route must map it (and reject unknowns
 * per-item) before touching the service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));
vi.mock('@/lib/services', () => ({
  deckService: {
    removePrinting: vi.fn(),
    findByPublicId: vi.fn(),
    updateDeck: vi.fn(),
  },
}));

import { POST } from './route';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';

const mockAuth = vi.mocked(authenticateRequest);
const mockRemovePrinting = vi.mocked(deckService.removePrinting);
const mockFindByPublicId = vi.mocked(deckService.findByPublicId);

function postRequest(body: any) {
  return new Request('http://localhost/api/decks/pub1/printings/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer eyJ.fake.jwt' },
    body: JSON.stringify(body),
  }) as any;
}

describe('POST /api/decks/[deckId]/printings/remove — category normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ success: true, userId: 'user1' } as any);
    mockFindByPublicId.mockResolvedValue({ success: true, data: { totalCards: 1, metadata: {} } } as any);
    mockRemovePrinting.mockResolvedValue({ success: true, data: {} } as any);
  });

  it('maps category "sideboard" to "inventory" before calling the service', async () => {
    await POST(postRequest({ printings: [{ printingId: 'p1', quantity: 1, category: 'sideboard' }] }), { params: { deckId: 'pub1' } });

    expect(mockRemovePrinting).toHaveBeenCalledWith('pub1', 'user1', 'p1', 'inventory', 1);
  });

  it('rejects an unknown category per-item without calling the service', async () => {
    const res = await POST(postRequest({ printings: [{ printingId: 'p1', quantity: 1, category: 'graveyard' }] }), { params: { deckId: 'pub1' } });
    const body = await res.json();

    expect(mockRemovePrinting).not.toHaveBeenCalled();
    expect(body.results[0].success).toBe(false);
    expect(body.results[0].error).toMatch(/graveyard/);
  });
});
