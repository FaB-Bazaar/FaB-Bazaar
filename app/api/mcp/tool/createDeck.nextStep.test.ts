/**
 * create_deck's success message points the agent at get_deckbuilding_guide,
 * pre-filled with this deck's format and hero — third-party hosts (Meta Muse)
 * never read MCP resources, so the next step has to ride on the tool result.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  printingsService: { searchPrintings: vi.fn().mockResolvedValue({ success: true, data: [] }) },
  bannedCardsService: { listExcludedHeroes: vi.fn().mockResolvedValue({ success: true, data: [] }) },
}));

vi.mock('@/lib/mcp-fetch', () => ({
  getMcpApiBaseUrl: () => 'http://localhost:3000',
  mcpFetch: vi.fn(),
}));

import { createDeckTool } from './createDeck';
import { mcpFetch } from '@/lib/mcp-fetch';

const mockFetch = vi.mocked(mcpFetch);

function created(format: string): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: { publicId: 'abc123', name: 'D', format, visibility: 'unlisted' } }),
  } as unknown as Response;
}

describe('create_deck success message', () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it('ends with a NEXT step to get_deckbuilding_guide for this format and hero', async () => {
    mockFetch.mockResolvedValueOnce(created('Classic Constructed'));
    const result = await createDeckTool.handler(
      { name: 'D', format: 'Classic Constructed', heroName: 'dorinthea ironsong', heroPrintingId: 'p1' },
      undefined,
      'fake-token',
    );
    expect(result.success).toBe(true);
    expect((result as any).message).toContain(
      '🎯 NEXT: get_deckbuilding_guide({"format":"Classic Constructed","heroName":"dorinthea ironsong"})',
    );
  });

  it('omits heroName from the NEXT step when the deck was created from a printing id', async () => {
    mockFetch.mockResolvedValueOnce(created('Blitz'));
    const result = await createDeckTool.handler(
      { name: 'D', format: 'Blitz', heroPrintingId: 'p1' },
      undefined,
      'fake-token',
    );
    expect((result as any).message).toContain('🎯 NEXT: get_deckbuilding_guide({"format":"Blitz"})');
  });

  it('lists the guide as step 0 of the workflow in the description', () => {
    expect(createDeckTool.description).toMatch(/Step 0: get_deckbuilding_guide/);
  });
});
