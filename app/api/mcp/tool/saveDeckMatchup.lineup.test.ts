/**
 * save_deck_matchup — declarative `lineup` mode.
 *
 * Instead of hand-computing sideboardIn/sideboardOut, the caller passes the
 * complete ACTIVE list for the matchup (what the tile editor shows un-greyed).
 * The tool fetches the deck, builds the pool, computes in/out, and saves via
 * the existing matchup upsert. `dryRun: true` computes without saving.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/mcp-fetch', () => ({
  getMcpApiBaseUrl: () => 'http://localhost:3000',
  mcpFetch: vi.fn(),
}));

import { saveDeckMatchupTool } from './saveDeckMatchup';
import { mcpFetch } from '@/lib/mcp-fetch';

const mockFetch = vi.mocked(mcpFetch);

const p = (name: string, pitch: number, quantity: number, types: string[] = ['action']) => ({
  printingId: 'p_' + name.replace(/\W/g, '') + pitch,
  quantity,
  printingDetails: { name, display_name: name, pitch, types },
});

const deckDto = {
  publicId: 'pub1',
  name: 'slab maxx',
  hero: [p("Maxx 'The Hype' Nitro", 0, 1, ['hero'])],
  equipment: [p('Adaptive Alpha Mold', 0, 1, ['equipment', 'head'])],
  maindeck: [
    p('Command and Conquer', 1, 3, ['attack action']),
    p('Sink Below', 3, 3, ['defense reaction']),
  ],
  inventory: [p('Unmovable', 1, 2, ['defense reaction'])],
  metadata: { matchups: [] },
};

function respond(url: string, init?: any) {
  const method = init?.method ?? 'GET';
  if (url.endsWith('/api/decks?limit=100')) {
    return { ok: true, status: 200, json: async () => ({ success: true, decks: [{ publicId: 'pub1', name: 'slab maxx' }] }) };
  }
  if (url.endsWith('/api/decks/pub1') && method === 'GET') {
    return { ok: true, status: 200, json: async () => ({ success: true, data: deckDto }) };
  }
  if (url.includes('/matchups/') && method === 'PUT') {
    return { ok: true, status: 200, json: async () => ({ success: true, data: { matchup: JSON.parse(init.body).matchup } }) };
  }
  throw new Error(`unexpected fetch ${method} ${url}`);
}

function savedMatchup(): any {
  const call = mockFetch.mock.calls.find(([, init]) => (init as any)?.method === 'PUT');
  return call ? JSON.parse((call[1] as any).body).matchup : null;
}

describe('save_deck_matchup — lineup mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation(async (url: any, init?: any) => respond(String(url), init) as any);
  });

  it('computes in/out from a full active lineup and saves them', async () => {
    const result = await saveDeckMatchupTool.handler(
      {
        deckName: 'slab maxx',
        heroId: 'arakni_marionette',
        lineup: [
          { cardName: 'Adaptive Alpha Mold', quantity: 1 },
          { cardName: 'Command and Conquer', pitch: 1, quantity: 1 },   // 3 → 1: out ×2
          { cardName: 'Sink Below', pitch: 3, quantity: 3 },
          { cardName: 'Unmovable', pitch: 1, quantity: 2 },             // 0 → 2: in ×2
        ],
      },
      undefined,
      'tok',
    );
    expect(result.success).toBe(true);
    const m = savedMatchup();
    expect(m.heroId).toBe('arakni_marionette');
    expect(m.sideboard.out).toEqual(['command_and_conquer_red', 'command_and_conquer_red']);
    expect(m.sideboard.in).toEqual(['unmovable_red', 'unmovable_red']);
    // response echoes the diff + stats
    expect((result as any).message).toMatch(/Command and Conquer/);
    expect((result as any).message).toMatch(/Unmovable/);
    expect((result as any).stats.library).toEqual({ before: 6, after: 6, out: 2, in: 2 });
  });

  it('refuses to save and lists the problems when the lineup references cards outside the pool', async () => {
    const result = await saveDeckMatchupTool.handler(
      {
        deckName: 'slab maxx',
        heroId: 'arakni_marionette',
        lineup: [
          { cardName: 'Command and Conquer', pitch: 1, quantity: 3 },
          { cardName: 'Sink Below', pitch: 3, quantity: 3 },
          { cardName: 'Fyendal Spring Tunic', quantity: 1 },
          { cardName: 'Unmovable', pitch: 1, quantity: 5 },
        ],
      },
      undefined,
      'tok',
    );
    expect(result.success).toBe(false);
    expect((result as any).error).toMatch(/Fyendal Spring Tunic/);
    expect((result as any).error).toMatch(/Unmovable/);
    expect(savedMatchup()).toBeNull();
  });

  it('dryRun computes the swaps and stats without saving', async () => {
    const result = await saveDeckMatchupTool.handler(
      {
        deckName: 'slab maxx',
        heroId: 'arakni_marionette',
        dryRun: true,
        lineup: [
          { cardName: 'Adaptive Alpha Mold', quantity: 1 },
          { cardName: 'Sink Below', pitch: 3, quantity: 3 },
        ],
      },
      undefined,
      'tok',
    );
    expect(result.success).toBe(true);
    expect((result as any).dryRun).toBe(true);
    expect((result as any).sideboard.out).toEqual(['command_and_conquer_red', 'command_and_conquer_red', 'command_and_conquer_red']);
    expect(savedMatchup()).toBeNull();
  });

  it('rejects mixing lineup with sideboardIn/sideboardOut', async () => {
    const result = await saveDeckMatchupTool.handler(
      { deckName: 'slab maxx', heroId: 'core', lineup: [{ cardName: 'Sink Below', pitch: 3, quantity: 3 }], sideboardOut: ['x'] },
      undefined,
      'tok',
    );
    expect(result.success).toBe(false);
    expect((result as any).error).toMatch(/lineup/);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
