/**
 * add_cards_to_deck / remove_cards_from_deck — zone normalization.
 *
 * The tools advertise "sideboard" but the DB enum only has "inventory"
 * (FaB sideboard = inventory). The tools must send the canonical zone to the
 * API and reject unknown zones up front with a helpful message.
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
import { removeCardsFromDeckTool } from './removeCardsFromDeck';
import { mcpFetch } from '@/lib/mcp-fetch';

const mockFetch = vi.mocked(mcpFetch);

function okResponse(json: any) {
  return { ok: true, status: 200, json: async () => json } as any;
}

function sentBody(): any {
  const call = mockFetch.mock.calls[0];
  return JSON.parse((call[1] as any).body);
}

describe('add_cards_to_deck — zone normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(okResponse({
      success: true,
      summary: { added: 1, failed: 0, totalCardsAdded: 2 },
      results: [{ printingId: 'p1', success: true, quantity: 2, category: 'inventory', cardName: 'Sink Below' }],
    }));
  });

  it('sends "inventory" to the API when the caller says "sideboard"', async () => {
    await addCardsToDeckTool.handler(
      { deckName: 'slab maxx', printings: [{ printingId: 'p1', quantity: 2, category: 'sideboard' }] },
      undefined,
      'tok',
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(sentBody().printings[0].category).toBe('inventory');
  });

  it('accepts "inventory" and "benched" as canonical zones', async () => {
    await addCardsToDeckTool.handler(
      { deckName: 'slab maxx', printings: [
        { printingId: 'p1', quantity: 1, category: 'inventory' },
        { printingId: 'p2', quantity: 1, category: 'benched' },
      ] },
      undefined,
      'tok',
    );
    const cats = sentBody().printings.map((p: any) => p.category);
    expect(cats).toEqual(['inventory', 'benched']);
  });

  it('rejects an unknown zone before calling the API', async () => {
    const result = await addCardsToDeckTool.handler(
      { deckName: 'slab maxx', printings: [{ printingId: 'p1', quantity: 1, category: 'graveyard' }] },
      undefined,
      'tok',
    );
    expect(result.success).toBe(false);
    expect((result as any).error).toMatch(/graveyard/);
    expect((result as any).error).toMatch(/inventory/);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('remove_cards_from_deck — zone normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(okResponse({
      success: true,
      summary: { removed: 1, failed: 0, totalCardsRemoved: 1 },
      results: [{ printingId: 'p1', success: true, quantity: 1, category: 'inventory' }],
    }));
  });

  it('sends "inventory" to the API when the caller says "sideboard"', async () => {
    await removeCardsFromDeckTool.handler(
      { deckName: 'slab maxx', printings: [{ printingId: 'p1', quantity: 1, category: 'sideboard' }] },
      undefined,
      'tok',
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(sentBody().printings[0].category).toBe('inventory');
  });

  it('rejects an unknown zone before calling the API', async () => {
    const result = await removeCardsFromDeckTool.handler(
      { deckName: 'slab maxx', printings: [{ printingId: 'p1', quantity: 1, category: 'graveyard' }] },
      undefined,
      'tok',
    );
    expect(result.success).toBe(false);
    expect((result as any).error).toMatch(/graveyard/);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
