import { describe, it, expect, vi, beforeEach } from 'vitest';

// URLs mcpFetch was called with, so we can assert the resolution path taken.
const fetchCalls: string[] = [];

vi.mock('@/lib/mcp-fetch', () => ({
  getMcpApiBaseUrl: () => 'http://test',
  mcpFetch: vi.fn(async (url: string) => {
    fetchCalls.push(url);
    if (url.includes('/api/decks/community')) {
      return {
        ok: true,
        json: async () => ({
          data: { decks: [{ name: 'Victor Goldmane - Calling: Rotterdam 1st', publicId: 'pub_rotterdam' }] },
        }),
      };
    }
    if (url.includes('/api/decks?')) {
      return { ok: true, json: async () => ({ success: true, decks: [{ name: 'My Katsu', publicId: 'pub_mine' }] }) };
    }
    // detail: /api/decks/<publicId>
    const publicId = url.match(/\/api\/decks\/([^?]+)$/)?.[1];
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: { name: 'Loaded Deck', publicId, heroName: 'Hero', format: 'CC', hero: [], equipment: [], maindeck: [] },
      }),
    };
  }),
}));

import { getDeckTool, normalizeDeckName } from './getDeck';

beforeEach(() => { fetchCalls.length = 0; });

describe('normalizeDeckName', () => {
  it('collapses dashes, flag emoji, case, and whitespace so decorated names compare equal', () => {
    expect(normalizeDeckName('🇳🇱 Victor Goldmane – Calling: Rotterdam 1st'))
      .toBe(normalizeDeckName('Victor Goldmane - Calling: Rotterdam 1st'));
  });
});

describe('get_deck handler resolution', () => {
  it('fetches directly by publicId with no name lookup (deterministic decks-to-beat chain)', async () => {
    const res: any = await getDeckTool.handler({ publicId: 'pub_dtb' }, undefined, 'tok');
    expect(res.success).not.toBe(false);
    expect(fetchCalls.some((u) => u.endsWith('/api/decks/pub_dtb'))).toBe(true);
    expect(fetchCalls.some((u) => u.includes('/api/decks?'))).toBe(false);
    expect(fetchCalls.some((u) => u.includes('community'))).toBe(false);
  });

  it('matches a decks-to-beat name despite en-dash / flag-emoji decoration', async () => {
    const res: any = await getDeckTool.handler(
      { deckName: '🇳🇱 Victor Goldmane – Calling: Rotterdam 1st' }, undefined, 'tok');
    expect(res.success).not.toBe(false);
    expect(fetchCalls.some((u) => u.endsWith('/api/decks/pub_rotterdam'))).toBe(true);
  });

  it('still resolves a personal deck by name', async () => {
    const res: any = await getDeckTool.handler({ deckName: 'my katsu' }, undefined, 'tok');
    expect(res.success).not.toBe(false);
    expect(fetchCalls.some((u) => u.endsWith('/api/decks/pub_mine'))).toBe(true);
  });

  it('errors clearly when neither deckName nor publicId is provided', async () => {
    const res: any = await getDeckTool.handler({}, undefined, 'tok');
    expect(res.success).toBe(false);
    expect(String(res.error)).toMatch(/deckName|publicId/i);
  });

  it('lists community candidates in the not-found error so the model can retry', async () => {
    const res: any = await getDeckTool.handler({ deckName: 'Totally Unknown Deck' }, undefined, 'tok');
    expect(res.success).toBe(false);
    expect(String(res.error)).toContain('Rotterdam');
  });
});
