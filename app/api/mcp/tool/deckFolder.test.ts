/**
 * Unit tests for the deck `folder` string across the MCP deck tools:
 *  - update_deck declares `folder` in its schema and forwards it on the generic PATCH
 *  - list_decks surfaces each deck's folder in the structured output + message
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/mcp-fetch', () => ({
  getMcpApiBaseUrl: () => 'http://localhost:3000',
  mcpFetch: vi.fn(),
}));

import { updateDeckTool } from './updateDeck';
import { listDecksTool } from './listDecks';
import { mcpFetch } from '@/lib/mcp-fetch';

const mockFetch = vi.mocked(mcpFetch);

function jsonResponse(body: any, ok = true, status = 200): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response;
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('update_deck — folder', () => {
  it('declares folder in the updates schema', () => {
    const props = (updateDeckTool.parameters.properties.updates as any).properties;
    expect(props.folder?.type).toBe('string');
  });

  it('forwards folder on the metadata PATCH', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ success: true, decks: [{ name: 'Zyggy CC', publicId: 'pub1' }] }))
      .mockResolvedValueOnce(jsonResponse({ success: true, deck: {} }));

    const result = await updateDeckTool.handler(
      { deckName: 'Zyggy CC', updates: { folder: 'Physical decks' } },
      undefined,
      'fake-token',
    );
    expect(result.success).toBe(true);
    const [, opts] = mockFetch.mock.calls[1];
    expect(JSON.parse(opts!.body as string)).toEqual({ folder: 'Physical decks' });
  });
});

describe('list_decks — folder', () => {
  it('surfaces folder in the structured decks output and the message', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      success: true,
      decks: [
        { name: 'Zyggy CC', publicId: 'pub1', format: 'CC', folder: 'Physical decks', updatedAt: new Date().toISOString() },
        { name: 'Brew', publicId: 'pub2', format: 'Blitz', folder: null, updatedAt: new Date().toISOString() },
      ],
    }));

    const result = await listDecksTool.handler({}, undefined, 'fake-token');
    expect(result.success).toBe(true);
    expect(result.decks?.[0]?.folder).toBe('Physical decks');
    expect(result.decks?.[1]?.folder).toBeNull();
    expect(result.message).toContain('Physical decks');
  });
});
