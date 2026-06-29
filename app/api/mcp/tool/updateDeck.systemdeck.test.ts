/**
 * Unit tests for update_deck's isSystemDeck (Decks to Beat) support and the
 * visibility-update path. isSystemDeck must be routed through the superadmin-only
 * /featured endpoint (the generic PATCH /api/decks/[deckId] ignores it), while
 * other fields (name, isPublic, etc.) go to the generic update route.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/mcp-fetch', () => ({
  getMcpApiBaseUrl: () => 'http://localhost:3000',
  mcpFetch: vi.fn(),
}));

import { updateDeckTool } from './updateDeck';
import { mcpFetch } from '@/lib/mcp-fetch';

const mockFetch = vi.mocked(mcpFetch);

function jsonResponse(body: any, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

function listResponse() {
  return jsonResponse({ success: true, decks: [{ name: 'Zyggy CC', publicId: 'pub1' }] });
}

describe('updateDeckTool.handler — isSystemDeck + visibility', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('makes the deck public AND flags it as a system deck in one call', async () => {
    mockFetch
      .mockResolvedValueOnce(listResponse()) // GET /api/decks
      .mockResolvedValueOnce(jsonResponse({ success: true, deck: {} })) // PATCH /api/decks/pub1 (visibility)
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { isSystemDeck: true } })); // PATCH /featured

    const result = await updateDeckTool.handler(
      { deckName: 'Zyggy CC', updates: { isPublic: true, isSystemDeck: true } },
      undefined,
      'fake-token',
    );

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Metadata PATCH carries isPublic but NOT isSystemDeck
    const [metaUrl, metaOpts] = mockFetch.mock.calls[1];
    expect(String(metaUrl)).toMatch(/\/api\/decks\/pub1$/);
    expect(metaOpts?.method).toBe('PATCH');
    const metaBody = JSON.parse(metaOpts!.body as string);
    expect(metaBody.isPublic).toBe(true);
    expect(metaBody.isSystemDeck).toBeUndefined();

    // /featured PATCH carries isSystemDeck only
    const [featUrl, featOpts] = mockFetch.mock.calls[2];
    expect(String(featUrl)).toMatch(/\/api\/decks\/pub1\/featured$/);
    expect(JSON.parse(featOpts!.body as string)).toEqual({ isSystemDeck: true });
  });

  it('skips the generic metadata PATCH when only isSystemDeck is provided', async () => {
    mockFetch
      .mockResolvedValueOnce(listResponse()) // GET /api/decks
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { isSystemDeck: true } })); // PATCH /featured

    const result = await updateDeckTool.handler(
      { deckName: 'Zyggy CC', updates: { isSystemDeck: true } },
      undefined,
      'fake-token',
    );

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    // No call to the bare /api/decks/pub1 metadata route
    const urls = mockFetch.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => /\/api\/decks\/pub1$/.test(u))).toBe(false);
    expect(urls[1]).toMatch(/\/api\/decks\/pub1\/featured$/);
  });

  it('does not call /featured for a plain metadata update', async () => {
    mockFetch
      .mockResolvedValueOnce(listResponse())
      .mockResolvedValueOnce(jsonResponse({ success: true, deck: {} }));

    const result = await updateDeckTool.handler(
      { deckName: 'Zyggy CC', updates: { isPublic: true } },
      undefined,
      'fake-token',
    );

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const urls = mockFetch.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => /\/featured$/.test(u))).toBe(false);
  });

  it('reports failure (and does not flag) when the visibility update fails', async () => {
    mockFetch
      .mockResolvedValueOnce(listResponse())
      .mockResolvedValueOnce(jsonResponse({ success: false, error: 'Only the deck owner can change visibility and settings' }, false, 403));

    const result = await updateDeckTool.handler(
      { deckName: 'Zyggy CC', updates: { isPublic: true, isSystemDeck: true } },
      undefined,
      'fake-token',
    );

    expect(result.success).toBe(false);
    // Should not have proceeded to the /featured call after the metadata failure
    const urls = mockFetch.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => /\/featured$/.test(u))).toBe(false);
  });
});
