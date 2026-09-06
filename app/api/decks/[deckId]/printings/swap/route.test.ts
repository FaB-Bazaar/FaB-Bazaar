/**
 * Unit tests for POST /api/decks/[deckId]/printings/swap — the copy count.
 *
 * The deck lightbox lets a user move 1, 2 or all N copies of a card to another
 * printing. `quantity` must reach the service; an omitted quantity keeps the
 * historical one-copy behaviour; a non-positive or non-integer quantity is a
 * 400, not a silent "swap one".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({ deckService: { swapPrinting: vi.fn() } }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn(), authenticateSession: vi.fn() }));
vi.mock('@/auth', () => ({ auth: vi.fn() }));

import { POST } from './route';
import { deckService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockSwap = vi.mocked(deckService.swapPrinting);
const mockAuth = vi.mocked(authenticateRequest);

function post(body: unknown) {
  const req = new NextRequest('http://localhost/api/decks/pub-1/printings/swap', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  });
  return POST(req, { params: Promise.resolve({ deckId: 'pub-1' }) } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'user-1', authMethod: 'session' } as any);
  mockSwap.mockResolvedValue({ success: true, data: { _id: 'd1', name: 'Deck', maindeck: [], hero: [], equipment: [], inventory: [] } } as any);
});

describe('POST /api/decks/[deckId]/printings/swap — quantity', () => {
  it('forwards quantity to the service', async () => {
    const res = await post({ oldPrintingId: 'old', newPrintingId: 'new', category: 'maindeck', quantity: 2 });
    expect(res.status).toBe(200);
    expect(mockSwap).toHaveBeenCalledWith('pub-1', 'user-1', 'old', 'new', 'maindeck', 2);
  });

  it('omitted quantity swaps one copy (legacy behaviour)', async () => {
    const res = await post({ oldPrintingId: 'old', newPrintingId: 'new', category: 'maindeck' });
    expect(res.status).toBe(200);
    expect(mockSwap).toHaveBeenCalledWith('pub-1', 'user-1', 'old', 'new', 'maindeck', 1);
  });

  it.each([0, -1, 1.5, 'two'])('rejects quantity %p with 400 and never calls the service', async (q) => {
    const res = await post({ oldPrintingId: 'old', newPrintingId: 'new', category: 'maindeck', quantity: q });
    expect(res.status).toBe(400);
    expect(mockSwap).not.toHaveBeenCalled();
  });
});
