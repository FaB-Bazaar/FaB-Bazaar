/**
 * Route unit tests for POST /api/decks/[deckId]/printings/add.
 *
 * Regression guard for the superadmin banned-card bypass: a superadmin caller
 * should be able to add a printing that's currently banned (e.g. to preserve a
 * historical Decks to Beat decklist that was legal when played), while a
 * non-superadmin caller must still be subject to the normal banlist check.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));
vi.mock('@/lib/services', () => ({
  deckService: {
    addPrinting: vi.fn(),
    findByPublicId: vi.fn(),
  },
  userService: { hasRole: vi.fn() },
}));

import { POST } from './route';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService, userService } from '@/lib/services';

const mockAuth = vi.mocked(authenticateRequest);
const mockHasRole = vi.mocked(userService.hasRole);
const mockAddPrinting = vi.mocked(deckService.addPrinting);
const mockFindByPublicId = vi.mocked(deckService.findByPublicId);

function postRequest(body: any) {
  return new Request('http://localhost/api/decks/pub1/printings/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer eyJ.fake.jwt' },
    body: JSON.stringify(body),
  }) as any;
}

describe('POST /api/decks/[deckId]/printings/add — superadmin banned-card bypass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByPublicId.mockResolvedValue({ success: true, data: { totalCards: 1 } } as any);
  });

  it('passes bypassBanned: true to deckService.addPrinting for a superadmin caller', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'admin1' } as any);
    mockHasRole.mockResolvedValue({ success: true, data: true } as any);
    mockAddPrinting.mockResolvedValue({
      success: true,
      data: { printingId: 'p1', success: true, cardName: 'Volzar, the Lightning Rod', quantity: 1, category: 'equipment' },
    } as any);

    await POST(postRequest({ category: 'equipment', printingId: 'p1', quantity: 1 }), { params: { deckId: 'pub1' } });

    expect(mockAddPrinting).toHaveBeenCalledWith(
      'pub1',
      'admin1',
      expect.objectContaining({ printingId: 'p1' }),
      expect.objectContaining({ bypassBanned: true }),
    );
  });

  it('does not set bypassBanned for a non-superadmin caller', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'user1' } as any);
    mockHasRole.mockResolvedValue({ success: true, data: false } as any);
    mockAddPrinting.mockResolvedValue({
      success: true,
      data: { printingId: 'p1', success: false, error: 'banned in this format' },
    } as any);

    await POST(postRequest({ category: 'maindeck', printingId: 'p1', quantity: 1 }), { params: { deckId: 'pub1' } });

    expect(mockAddPrinting).toHaveBeenCalledWith(
      'pub1',
      'user1',
      expect.objectContaining({ printingId: 'p1' }),
      expect.objectContaining({ bypassBanned: false }),
    );
  });
});

describe('POST /api/decks/[deckId]/printings/add — category normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByPublicId.mockResolvedValue({ success: true, data: { totalCards: 1 } } as any);
    mockAuth.mockResolvedValue({ success: true, userId: 'user1' } as any);
    mockHasRole.mockResolvedValue({ success: true, data: false } as any);
    mockAddPrinting.mockResolvedValue({
      success: true,
      data: { printingId: 'p1', success: true, cardName: 'Sink Below', quantity: 1, category: 'inventory' },
    } as any);
  });

  it('maps category "sideboard" to "inventory" before calling the service', async () => {
    await POST(postRequest({ printings: [{ printingId: 'p1', quantity: 1, category: 'sideboard' }] }), { params: { deckId: 'pub1' } });

    expect(mockAddPrinting).toHaveBeenCalledWith(
      'pub1',
      'user1',
      expect.objectContaining({ printingId: 'p1', category: 'inventory' }),
      expect.anything(),
    );
  });

  it('rejects an unknown category per-item without calling the service', async () => {
    const res = await POST(postRequest({ printings: [{ printingId: 'p1', quantity: 1, category: 'graveyard' }] }), { params: { deckId: 'pub1' } });
    const body = await res.json();

    expect(mockAddPrinting).not.toHaveBeenCalled();
    expect(body.results[0].success).toBe(false);
    expect(body.results[0].error).toMatch(/graveyard/);
    expect(body.results[0].error).toMatch(/inventory/);
  });
});
