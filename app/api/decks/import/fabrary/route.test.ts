/**
 * Unit tests for POST /api/decks/import/fabrary
 *
 * Mocks the orchestration helper + auth — tests HTTP concerns only:
 * auth gating, body validation, and response shape/status passthrough.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/decks/import-fabrary', () => ({ importFabraryDeck: vi.fn() }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));
vi.mock('@/lib/services', () => ({
  deckService: { createDeck: vi.fn(), addPrintings: vi.fn() },
  printingsService: { searchPrintings: vi.fn(), bulkResolveByName: vi.fn() },
  bannedCardsService: { listExcludedHeroes: vi.fn() },
}));

import { POST } from './route';
import { importFabraryDeck } from '@/lib/decks/import-fabrary';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockImport = vi.mocked(importFabraryDeck);
const mockAuth = vi.mocked(authenticateRequest);

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/decks/import/fabrary', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'u1', username: 'bob', authMethod: 'session' } as any);
});

describe('POST /api/decks/import/fabrary', () => {
  it('returns 401 when authentication fails', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'nope' } as any);
    const res = await POST(makeRequest({ text: 'Name: X' }));
    expect(res.status).toBe(401);
    expect(mockImport).not.toHaveBeenCalled();
  });

  it('returns 400 when text is missing or empty', async () => {
    const res = await POST(makeRequest({ text: '   ' }));
    expect(res.status).toBe(400);
    expect(mockImport).not.toHaveBeenCalled();
  });

  it('returns 200 with the deck data on success', async () => {
    mockImport.mockResolvedValue({
      success: true,
      data: {
        publicId: 'deck-123',
        deckName: 'Test Deck',
        format: 'Classic Constructed',
        hero: { name: 'Puffin, Hightail', printingId: 'hero_cc' },
        summary: { cardsRequested: 3, cardsResolved: 3, cardsAdded: 6, failed: 0 },
        unresolved: [],
      },
    } as any);

    const res = await POST(makeRequest({ text: 'Name: Test Deck\nHero: Puffin, Hightail\nFormat: Classic Constructed\n1x Spitfire' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.publicId).toBe('deck-123');
    expect(mockImport).toHaveBeenCalledWith({ userId: 'u1', text: expect.stringContaining('Test Deck') }, expect.anything());
  });

  it('returns 400 when the orchestration reports a failure', async () => {
    mockImport.mockResolvedValue({ success: false, error: 'Hero "Nobody" was not found.' } as any);
    const res = await POST(makeRequest({ text: 'Name: X\nHero: Nobody\nFormat: Classic Constructed\n1x Y' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain('Nobody');
  });
});
