/**
 * add_cards_to_deck steers the agent to read card text instead of guessing
 * effects from names — in the description and in the success message.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/mcp-fetch', () => ({
  getMcpApiBaseUrl: () => 'http://localhost:3000',
  mcpFetch: vi.fn(),
}));
vi.mock('./helpers', () => ({
  resolveDeckByName: vi.fn().mockResolvedValue({ ok: true, deck: { publicId: 'pub1', name: 'slab maxx' } }),
}));
vi.mock('@/lib/services', () => ({
  printingsService: { bulkResolveByName: vi.fn() },
}));

import { addCardsToDeckTool } from './addCardsToDeck';
import { mcpFetch } from '@/lib/mcp-fetch';

const mockFetch = vi.mocked(mcpFetch);

describe('add_cards_to_deck — read-the-text reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        summary: { added: 1, failed: 0, totalCardsAdded: 2 },
        results: [{ printingId: 'p1', success: true, quantity: 2, category: 'maindeck', cardName: 'Sink Below' }],
      }),
    } as any);
  });

  it('warns in the description never to infer an effect from a card name', () => {
    expect(addCardsToDeckTool.description).toMatch(/never infer a card's effect from its name/i);
  });

  it('points to get_deck with includeText on success, keyed by publicId', async () => {
    const result = await addCardsToDeckTool.handler(
      { deckName: 'slab maxx', printings: [{ printingId: 'p1', quantity: 2 }] },
      undefined,
      'tok',
    );
    expect(result.success).toBe(true);
    expect((result as any).message).toContain('get_deck({"publicId":"pub1","includeText":true})');
  });
});
