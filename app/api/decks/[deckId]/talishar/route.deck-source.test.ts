/**
 * The Talishar export (GET) serves the list the deck's owner picked for
 * Talishar — a saved version or the live deck — which the deck service
 * resolves in findTalisharDeck. Pins that the export reads THAT, not the live
 * deck directly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  deckService: { findTalisharDeck: vi.fn(), findByPublicId: vi.fn() },
  gameResultsService: {},
  printingsService: { searchPrintings: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));
vi.mock('@/lib/middleware/talishar-auth', () => ({
  validateTalisharRequest: vi.fn(async () => ({ valid: true })),
  validateTalisharHmac: vi.fn(() => ({ valid: true })),
}));

import { GET } from './route';
import { deckService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const findTalisharDeck = vi.mocked(deckService.findTalisharDeck);
const findByPublicId = vi.mocked(deckService.findByPublicId);
const auth = vi.mocked(authenticateRequest);
const call = () => GET(new NextRequest('http://localhost/api/decks/deck123/talishar'), { params: Promise.resolve({ deckId: 'deck123' }) } as any);

const card = (name: string, quantity: number, pitch?: number) => ({ printingId: `p-${name}`, quantity, printingDetails: { name, display_name: name, pitch } });
const PINNED = {
  publicId: 'deck123', name: 'My deck', format: 'Classic Constructed', heroName: 'x',
  hero: [], equipment: [], maindeck: [card('sink below', 3, 1)], inventory: [card('pummel', 2, 1)], metadata: {},
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ success: false } as any);
  findTalisharDeck.mockResolvedValue({ success: true, data: PINNED });
});

describe('GET /api/decks/[deckId]/talishar — which list is exported', () => {
  it('exports the deck the service resolved for Talishar, not the live deck', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(findTalisharDeck).toHaveBeenCalledWith('deck123', undefined);
    expect(findByPublicId).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.name).toBe('My deck');
    expect(JSON.stringify(body)).toContain('sink_below_red');
    expect(JSON.stringify(body)).toContain('pummel_red');
  });

  it('passes the signed-in caller through, like before', async () => {
    auth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    await call();
    expect(findTalisharDeck).toHaveBeenCalledWith('deck123', 'u1');
  });

  it('404s when the deck is not found', async () => {
    findTalisharDeck.mockResolvedValue({ success: true, data: null });
    expect((await call()).status).toBe(404);
  });
});
