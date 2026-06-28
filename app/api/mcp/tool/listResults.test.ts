import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/mcp-fetch', () => ({
  mcpFetch: vi.fn(),
  getMcpApiBaseUrl: () => 'http://test',
}));

import { listResultsTool } from './listResults';
import { mcpFetch } from '@/lib/mcp-fetch';

const mockFetch = vi.mocked(mcpFetch);
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => '' }) as never;

// Wire mcpFetch to respond by URL: recent-across-decks, deck list, then results list.
function wire({ decks, results, total, recent }: { decks: any[]; results: any[]; total?: number; recent?: any[] }) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/api/results/recent')) return Promise.resolve(ok({ success: true, data: recent ?? [] }));
    if (url.includes('/api/decks?')) return Promise.resolve(ok({ success: true, decks }));
    if (url.includes('/results')) return Promise.resolve(ok({ success: true, data: results, total: total ?? results.length }));
    return Promise.resolve(ok({ success: false, error: 'unexpected url ' + url }));
  });
}

beforeEach(() => vi.clearAllMocks());

describe('list_results MCP tool', () => {
  it('requires authentication', async () => {
    const res = await listResultsTool.handler({ deckName: 'Dash' }, undefined, undefined);
    expect(res.success).toBe(false);
  });

  it('returns a numbered list of recent games with resultIds', async () => {
    wire({
      decks: [{ name: 'Dash Nitro Mechanoid', publicId: 'pub1' }],
      results: [
        { id: 'r1', result: 'loss', opponentHero: 'kassai_of_the_golden_sand', format: '1', totalTurns: 16, playedAt: '2026-06-26T00:00:00Z' },
        { id: 'r2', result: 'win', opponentHero: 'zyggy_starlight', format: '1', totalTurns: 4, playedAt: '2026-06-24T00:00:00Z' },
      ],
      total: 31,
    });

    const res = await listResultsTool.handler({ deckName: 'dash nitro mechanoid' }, undefined, 'tok');
    expect(res.success).toBe(true);
    expect(res.results).toHaveLength(2);
    expect(res.results[0]).toMatchObject({ gameNumber: 1, resultId: 'r1', result: 'loss' });
    expect(res.results[1]).toMatchObject({ gameNumber: 2, resultId: 'r2' });
    expect(res.message).toMatch(/Kassai/i); // opponent hero prettified in the menu
  });

  it('errors clearly when the deck is not found among your decks', async () => {
    wire({ decks: [{ name: 'Other Deck', publicId: 'pubX' }], results: [] });
    const res = await listResultsTool.handler({ deckName: 'Nonexistent' }, undefined, 'tok');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/nonexistent|not found|no deck/i);
  });

  it('handles a deck with no recorded games', async () => {
    wire({ decks: [{ name: 'Dash', publicId: 'pub1' }], results: [] });
    const res = await listResultsTool.handler({ deckName: 'Dash' }, undefined, 'tok');
    expect(res.success).toBe(true);
    expect(res.results).toEqual([]);
  });

  it('lists recent games across ALL decks when no deckName is given', async () => {
    wire({
      decks: [],
      results: [],
      recent: [
        { id: 'g1', deckName: 'Teklosaucen', deckPublicId: 'p1', result: 'loss', opponentHero: 'kassai_of_the_golden_sand', totalTurns: 16, playedAt: '2026-06-26' },
        { id: 'g2', deckName: 'Dash Nitro Mechanoid', deckPublicId: 'p2', result: 'win', opponentHero: 'oscilio_forked_continuum', totalTurns: 7, playedAt: '2026-06-25' },
      ],
    });
    const res = await listResultsTool.handler({}, undefined, 'tok');
    expect(res.success).toBe(true);
    expect(res.message).toMatch(/all decks/i);
    expect(res.message).toContain('Teklosaucen');
    expect(res.message).toContain('Dash Nitro Mechanoid');
    // each row carries the resultId + its deck so get_results can be called next
    const rows = (res.results ?? []) as any[];
    expect(rows.map((r) => r.resultId)).toEqual(['g1', 'g2']);
    expect(rows[0].deckName).toBe('Teklosaucen');
  });

  it('filters to a single matchup with opponentHero (loose name match)', async () => {
    wire({
      decks: [{ name: 'Dash', publicId: 'pub1' }],
      results: [
        { id: 'r1', result: 'loss', opponentHero: 'kassai_of_the_golden_sand', totalTurns: 16 },
        { id: 'r2', result: 'win', opponentHero: 'zyggy_starlight', totalTurns: 4 },
        { id: 'r3', result: 'win', opponentHero: 'kassai_of_the_golden_sand', totalTurns: 8 },
      ],
    });
    const res = await listResultsTool.handler({ deckName: 'Dash', opponentHero: 'Kassai' }, undefined, 'tok');
    expect(res.success).toBe(true);
    expect(res.results.map((r: any) => r.resultId)).toEqual(['r1', 'r3']); // only Kassai games
    expect(res.message).toMatch(/vs Kassai/i);
    expect(res.message).toMatch(/2 games \(1W–1L\)/);
  });
});
