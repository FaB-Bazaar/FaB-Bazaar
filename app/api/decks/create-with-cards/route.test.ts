/**
 * Route unit test for POST /api/decks/create-with-cards.
 *
 * The route used to stamp every card `category: 'maindeck'` with a comment
 * claiming the service would re-allocate by card type — it never did, so
 * equipment landed in the library. Passing no category lets the service infer
 * the zone from the card's types.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));
vi.mock('@/lib/services', () => ({ deckService: { createDeckWithCards: vi.fn() } }));

import { POST } from './route';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { deckService } from '@/lib/services';

const mockAuth = vi.mocked(authenticateRequest);
const mockCreate = vi.mocked(deckService.createDeckWithCards);

function postRequest(body: any) {
  return new Request('http://localhost/api/decks/create-with-cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any;
}

describe('POST /api/decks/create-with-cards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockCreate.mockResolvedValue({ success: true, data: { deck: { publicId: 'pub1' }, importResult: { summary: {} } } } as any);
  });

  it('passes cards to the service without a category so the zone is inferred from card type', async () => {
    await POST(postRequest({ name: 'Maxx', format: 'Classic Constructed', cards: [{ printingId: 'p1', quantity: 1 }] }));
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const printings = mockCreate.mock.calls[0][2] as any[];
    expect(printings[0]).toMatchObject({ printingId: 'p1', quantity: 1 });
    expect(printings[0].category).toBeUndefined();
  });
});
