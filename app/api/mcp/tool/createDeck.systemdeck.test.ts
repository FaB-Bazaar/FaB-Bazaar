/**
 * Unit tests for create_deck's "Decks to Beat" (isSystemDeck / featured) support
 * and the explicit `isPublic` visibility opt-in.
 *
 * A superadmin creating a Deck to Beat can do it in a single MCP call: the deck
 * is created, then flagged via the superadmin-only /featured endpoint.
 *
 * Visibility is orthogonal to the flags: the base default is always `unlisted`.
 * The flags (isSystemDeck / featured) do NOT force public visibility — a caller
 * that wants a publicly-listed Deck to Beat passes `isPublic: true` (or an
 * explicit `visibility`). Precedence: explicit `visibility` > `isPublic` >
 * default `unlisted`.
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

describe('createDeckTool.handler — isSystemDeck / featured (Decks to Beat)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('does NOT force public: isSystemDeck alone creates an unlisted deck and flags it', async () => {
    mockFetch
      // POST /api/decks
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: { publicId: 'abc123', name: 'DTB', format: 'Classic Constructed', visibility: 'unlisted' } })
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

    // POST creates the deck with the DEFAULT unlisted visibility (flags don't force public)
    const [createUrl, createOpts] = mockFetch.mock.calls[0];
    expect(String(createUrl)).toMatch(/\/api\/decks$/);
    expect(createOpts?.method).toBe('POST');
    expect(JSON.parse(createOpts!.body as string).visibility).toBe('unlisted');

    // PATCH /featured with isSystemDeck: true
    const [featUrl, featOpts] = mockFetch.mock.calls[1];
    expect(String(featUrl)).toMatch(/\/api\/decks\/abc123\/featured$/);
    expect(featOpts?.method).toBe('PATCH');
    expect(JSON.parse(featOpts!.body as string)).toEqual({ isSystemDeck: true });
  });

  it('isPublic: true creates the deck public, then flags it (normal Decks to Beat entry)', async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: { publicId: 'abc123', name: 'DTB', format: 'Classic Constructed', visibility: 'public' } })
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { isSystemDeck: true, featured: true } }));

    const result = await createDeckTool.handler(
      { name: 'DTB', format: 'Classic Constructed', heroPrintingId: 'heroPrint1', isSystemDeck: true, featured: true, isPublic: true },
      undefined,
      'fake-token',
    );

    expect(result.success).toBe(true);

    const [createUrl, createOpts] = mockFetch.mock.calls[0];
    expect(String(createUrl)).toMatch(/\/api\/decks$/);
    expect(JSON.parse(createOpts!.body as string).visibility).toBe('public');

    const [featUrl, featOpts] = mockFetch.mock.calls[1];
    expect(String(featUrl)).toMatch(/\/api\/decks\/abc123\/featured$/);
    expect(JSON.parse(featOpts!.body as string)).toEqual({ isSystemDeck: true, featured: true });
  });

  it('isPublic: true works without any superadmin flag (no /featured call)', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { publicId: 'abc123', name: 'Pub', format: 'Blitz', visibility: 'public' } })
    );

    const result = await createDeckTool.handler(
      { name: 'Pub', format: 'Blitz', heroPrintingId: 'heroPrint1', isPublic: true },
      undefined,
      'fake-token',
    );

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, createOpts] = mockFetch.mock.calls[0];
    expect(JSON.parse(createOpts!.body as string).visibility).toBe('public');
  });

  it('explicit visibility wins over isPublic', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { publicId: 'abc123', name: 'Hidden', format: 'Blitz', visibility: 'unlisted' } })
    );

    const result = await createDeckTool.handler(
      { name: 'Hidden', format: 'Blitz', heroPrintingId: 'heroPrint1', isPublic: true, visibility: 'unlisted' },
      undefined,
      'fake-token',
    );

    expect(result.success).toBe(true);
    const [, createOpts] = mockFetch.mock.calls[0];
    expect(JSON.parse(createOpts!.body as string).visibility).toBe('unlisted');
  });

  it('does not call /featured when no flags are set (normal deck) and defaults to unlisted', async () => {
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
    expect(JSON.parse(mockFetch.mock.calls[0][1]!.body as string).visibility).toBe('unlisted');
  });

  it('supports featured without isSystemDeck (flag applied, visibility still defaults unlisted)', async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: { publicId: 'abc123', name: 'Feat Only', format: 'Classic Constructed', visibility: 'unlisted' } })
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { featured: true } }));

    const result = await createDeckTool.handler(
      { name: 'Feat Only', format: 'Classic Constructed', heroPrintingId: 'heroPrint1', featured: true },
      undefined,
      'fake-token',
    );

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const [, createOpts] = mockFetch.mock.calls[0];
    expect(JSON.parse(createOpts!.body as string).visibility).toBe('unlisted');

    const [featUrl, featOpts] = mockFetch.mock.calls[1];
    expect(String(featUrl)).toMatch(/\/api\/decks\/abc123\/featured$/);
    expect(JSON.parse(featOpts!.body as string)).toEqual({ featured: true });
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
      { name: 'DTB', format: 'Classic Constructed', heroPrintingId: 'heroPrint1', isSystemDeck: true, isPublic: true },
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
