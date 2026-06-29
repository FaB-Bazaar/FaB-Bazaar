/**
 * Unit tests for create_deck's "Decks to Beat" (isSystemDeck) one-shot support.
 *
 * A superadmin creating a Deck to Beat should be able to do it in a single MCP
 * call: the deck is created public, then flagged as a system deck via the
 * superadmin-only /featured endpoint. Previously isSystemDeck wasn't exposed at
 * all, forcing a manual UI step per deck.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  printingsService: {
    searchPrintings: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  bannedCardsService: {
    listExcludedHeroes: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
}));

vi.mock('@/lib/mcp-fetch', () => ({
  getMcpApiBaseUrl: () => 'http://localhost:3000',
  mcpFetch: vi.fn(),
}));

import { createDeckTool } from './createDeck';
import { mcpFetch } from '@/lib/mcp-fetch';

const mockFetch = vi.mocked(mcpFetch);

function jsonResponse(body: any, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe('createDeckTool.handler — isSystemDeck (Decks to Beat)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('creates the deck public and flags it as a system deck via /featured', async () => {
    mockFetch
      // POST /api/decks
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: { publicId: 'abc123', name: 'DTB', format: 'Classic Constructed', visibility: 'public' } })
      )
      // PATCH /api/decks/abc123/featured
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { isSystemDeck: true } }));

    const result = await createDeckTool.handler(
      { name: 'DTB', format: 'Classic Constructed', heroPrintingId: 'heroPrint1', isSystemDeck: true },
      undefined,
      'fake-token',
    );

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // First call: POST creates the deck with public visibility (system decks must be public)
    const [createUrl, createOpts] = mockFetch.mock.calls[0];
    expect(String(createUrl)).toMatch(/\/api\/decks$/);
    expect(createOpts?.method).toBe('POST');
    expect(JSON.parse(createOpts!.body as string).visibility).toBe('public');

    // Second call: PATCH /featured with isSystemDeck: true
    const [featUrl, featOpts] = mockFetch.mock.calls[1];
    expect(String(featUrl)).toMatch(/\/api\/decks\/abc123\/featured$/);
    expect(featOpts?.method).toBe('PATCH');
    expect(JSON.parse(featOpts!.body as string)).toEqual({ isSystemDeck: true });
  });

  it('does not call /featured when isSystemDeck is not set (normal deck)', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { publicId: 'abc123', name: 'Normal', format: 'Blitz', visibility: 'unlisted' } })
    );

    const result = await createDeckTool.handler(
      { name: 'Normal', format: 'Blitz', heroPrintingId: 'heroPrint1' },
      undefined,
      'fake-token',
    );

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0][0])).toMatch(/\/api\/decks$/);
  });

  it('surfaces a clear error (with publicId) when the /featured flag step is forbidden', async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: { publicId: 'abc123', name: 'DTB', format: 'Classic Constructed', visibility: 'public' } })
      )
      // Non-superadmin → 403 from the /featured endpoint
      .mockResolvedValueOnce(
        jsonResponse({ success: false, error: 'Super Admin role required to toggle system deck' }, false, 403)
      );

    const result = await createDeckTool.handler(
      { name: 'DTB', format: 'Classic Constructed', heroPrintingId: 'heroPrint1', isSystemDeck: true },
      undefined,
      'fake-token',
    );

    expect(result.success).toBe(false);
    const err = (result as any).error ?? '';
    expect(err).toMatch(/super admin/i);
    // The deck was created — surface its id so the caller can clean up / retry
    expect((result as any).publicId).toBe('abc123');
  });
});
