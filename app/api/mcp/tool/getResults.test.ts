import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/mcp-fetch', () => ({
  mcpFetch: vi.fn(),
  getMcpApiBaseUrl: () => 'http://test',
}));

import { getResultsTool } from './getResults';
import { mcpFetch } from '@/lib/mcp-fetch';

const mockFetch = vi.mocked(mcpFetch);
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => '' }) as never;

const RAW = {
  self: {
    playerHero: 'dash_io',
    result: 0,
    turns: 1,
    cardResults: [{ cardId: 'boom_grenade_red', cardName: 'Boom Grenade', played: 1 }],
    turnLog: [[0, 'boom_grenade_red', 'M']],
    turnResults: { turn_0: { damageDealt: 3 } },
  },
  opponent: null,
  format: '1',
};

// Order matters: the raw URL also contains "/results", so match "/raw" first.
function wire({ decks, results, raw, meta }: { decks: any[]; results: any[]; raw: unknown; meta?: Record<string, any> }) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/api/decks?')) return Promise.resolve(ok({ success: true, decks }));
    if (url.includes('/cards/by-talishar-id')) return Promise.resolve(ok({ success: true, data: meta ?? {} }));
    if (url.includes('/raw')) return Promise.resolve(ok({ success: true, data: raw }));
    if (url.includes('/results')) return Promise.resolve(ok({ success: true, data: results, total: results.length }));
    return Promise.resolve(ok({ success: false, error: 'unexpected url ' + url }));
  });
}

beforeEach(() => vi.clearAllMocks());

describe('get_results MCP tool', () => {
  it('requires authentication', async () => {
    const res = await getResultsTool.handler({ deckName: 'Dash' }, undefined, undefined);
    expect(res.success).toBe(false);
  });

  it('defaults to the most recent game and returns the raw blob (shape=raw)', async () => {
    wire({
      decks: [{ name: 'Dash', publicId: 'pub1' }],
      results: [{ id: 'r1' }],
      raw: RAW,
      meta: {
        boom_grenade_red: { displayName: 'Boom Grenade', pitch: 1, typeText: 'Action - Attack', cost: 0, power: 3, keywords: ['Go again'], text: 'Deal damage.' },
      },
    });
    const res = await getResultsTool.handler({ deckName: 'Dash' }, undefined, 'tok');
    expect(res.success).toBe(true);
    expect(res.data.self.playerHero).toBe('dash_io');
    // message is the readable rendering — card names + a turn line, not raw slugs
    expect(res.message).toContain('Boom Grenade');
    expect(res.message).toMatch(/T0 YOU:/);
    expect(res.message).not.toContain('boom_grenade_red');
    // server-side card glossary is appended (what each card does)
    expect(res.message).toContain('Card glossary');
    expect(res.message).toContain('Action - Attack');
    // fetched the raw shape for the most-recent result id
    const rawCall = mockFetch.mock.calls.find((c) => String(c[0]).includes('/raw'));
    expect(String(rawCall?.[0])).toContain('/results/r1/raw');
    expect(String(rawCall?.[0])).toContain('shape=raw');
  });

  it('honours an explicit resultId without needing the list', async () => {
    wire({ decks: [{ name: 'Dash', publicId: 'pub1' }], results: [], raw: RAW });
    const res = await getResultsTool.handler({ deckName: 'Dash', resultId: 'rX' }, undefined, 'tok');
    expect(res.success).toBe(true);
    const rawCall = mockFetch.mock.calls.find((c) => String(c[0]).includes('/raw'));
    expect(String(rawCall?.[0])).toContain('/results/rX/raw');
  });

  it('errors when gameNumber is out of range', async () => {
    wire({ decks: [{ name: 'Dash', publicId: 'pub1' }], results: [{ id: 'r1' }], raw: RAW });
    const res = await getResultsTool.handler({ deckName: 'Dash', gameNumber: 5 }, undefined, 'tok');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/range|only .* games|list_results/i);
  });

  it('returns data:null with a friendly message when the game has no archive', async () => {
    wire({ decks: [{ name: 'Dash', publicId: 'pub1' }], results: [{ id: 'r1' }], raw: null });
    const res = await getResultsTool.handler({ deckName: 'Dash' }, undefined, 'tok');
    expect(res.success).toBe(true);
    expect(res.data).toBeNull();
    expect(res.message).toMatch(/no .*archive|not .*archived|no detailed/i);
  });
});
