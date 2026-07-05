/**
 * Unit tests for the MCP bridge: the hosted chat's localhost client to our own
 * MCP endpoint. Fetch is stubbed; assertions cover the lite URL, auth headers,
 * the User-Agent that drives mcp_usage_daily attribution, OpenAI tool mapping,
 * the three MCP response shapes, and the unknown-tool short-circuit.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchLiteTools, fetchToolsByName, executeTool } from './mcp-bridge';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchLiteTools', () => {
  it('calls the lite endpoint with auth + attribution UA and maps tools to OpenAI format', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      jsonrpc: '2.0',
      id: 1,
      result: {
        tools: [
          { name: 'list_binders', description: 'List binders', inputSchema: { type: 'object', properties: { includeStats: { type: 'boolean' } } } },
          { name: 'search_printings', description: 'Search', inputSchema: { type: 'object' } },
        ],
      },
    }));

    const { tools, validNames } = await fetchLiteTools('jwt-token');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/mcp/server?toolset=lite');
    expect(init.headers['Authorization']).toBe('Bearer jwt-token');
    expect(init.headers['User-Agent']).toBe('fabbazaar-hosted (chat)');
    expect(JSON.parse(init.body).method).toBe('tools/list');

    expect(tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'list_binders',
          description: 'List binders',
          parameters: { type: 'object', properties: { includeStats: { type: 'boolean' } } },
        },
      },
      { type: 'function', function: { name: 'search_printings', description: 'Search', parameters: { type: 'object' } } },
    ]);
    expect(validNames).toEqual(new Set(['list_binders', 'search_printings']));
  });

  it('throws on a non-200 response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'nope' }, 401));
    await expect(fetchLiteTools('bad')).rejects.toThrow(/401/);
  });
});

describe('fetchToolsByName', () => {
  it('fetches the FULL catalog (not lite) and keeps only the requested tools', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      jsonrpc: '2.0',
      id: 1,
      result: {
        tools: [
          { name: 'add_cards_to_deck', description: 'Add cards', inputSchema: { type: 'object', properties: { deckId: { type: 'string' } } } },
          { name: 'get_deck', description: 'Get', inputSchema: { type: 'object' } },
          { name: 'search_printings', description: 'Search', inputSchema: { type: 'object' } },
        ],
      },
    }));

    const { tools, validNames } = await fetchToolsByName(
      'jwt-token',
      new Set(['add_cards_to_deck', 'remove_cards_from_deck']),
    );

    const [url, init] = fetchMock.mock.calls[0];
    // Deck-write tools aren't in the lite advertisement — must hit the full list.
    expect(String(url)).toContain('/api/mcp/server');
    expect(String(url)).not.toContain('toolset=lite');
    expect(init.headers['Authorization']).toBe('Bearer jwt-token');
    expect(init.headers['User-Agent']).toBe('fabbazaar-hosted (chat)');

    // Only requested-AND-present tools survive (get_deck/search filtered out;
    // remove_cards_from_deck requested but absent → not in validNames).
    expect(tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'add_cards_to_deck',
          description: 'Add cards',
          parameters: { type: 'object', properties: { deckId: { type: 'string' } } },
        },
      },
    ]);
    expect(validNames).toEqual(new Set(['add_cards_to_deck']));
  });

  it('throws on a non-200 response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'nope' }, 500));
    await expect(fetchToolsByName('bad', new Set(['update_deck']))).rejects.toThrow(/500/);
  });
});

describe('executeTool', () => {
  const validNames = new Set(['list_binders']);

  it('short-circuits unknown tool names without any HTTP call', async () => {
    const result = await executeTool({ name: 'add_cards_to_deck', args: {}, bearer: 't', validNames });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.content).toContain('add_cards_to_deck');
    expect(result.content).toContain('list_binders'); // lists what IS available
  });

  it('extracts text content from a successful result', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      jsonrpc: '2.0',
      id: 2,
      result: { content: [{ type: 'text', text: 'Your Binders (9 total)' }], isError: false },
    }));

    const result = await executeTool({ name: 'list_binders', args: { includeStats: true }, bearer: 't', validNames });

    expect(result).toEqual({ ok: true, content: 'Your Binders (9 total)' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.method).toBe('tools/call');
    expect(body.params).toEqual({ name: 'list_binders', arguments: { includeStats: true } });
  });

  it('surfaces structuredContent alongside the text (token-bypass channel)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      jsonrpc: '2.0',
      id: 2,
      result: {
        content: [{ type: 'text', text: 'Deck: CC Gravy' }],
        structuredContent: { title: 'CC Gravy', url: '/decks/abc' },
        isError: false,
      },
    }));

    const result = await executeTool({ name: 'list_binders', args: {}, bearer: 't', validNames });
    expect(result.ok).toBe(true);
    expect(result.content).toBe('Deck: CC Gravy');
    expect(result.structured).toEqual({ title: 'CC Gravy', url: '/decks/abc' });
  });

  it('maps result.isError to a failed result', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      jsonrpc: '2.0',
      id: 2,
      result: { content: [{ type: 'text', text: '❌ Error: binder not found' }], isError: true },
    }));

    const result = await executeTool({ name: 'list_binders', args: {}, bearer: 't', validNames });
    expect(result.ok).toBe(false);
    expect(result.content).toContain('binder not found');
  });

  it('maps a top-level JSON-RPC error to a failed result', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      jsonrpc: '2.0',
      id: 2,
      error: { code: -32601, message: '❌ Unknown tool: whatever' },
    }));

    const result = await executeTool({ name: 'list_binders', args: {}, bearer: 't', validNames });
    expect(result.ok).toBe(false);
    expect(result.content).toContain('Unknown tool');
  });

  it('maps HTTP failures (e.g. internal 429) to a failed result', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'rate limited' }, 429));

    const result = await executeTool({ name: 'list_binders', args: {}, bearer: 't', validNames });
    expect(result.ok).toBe(false);
    expect(result.content).toContain('429');
  });
});
