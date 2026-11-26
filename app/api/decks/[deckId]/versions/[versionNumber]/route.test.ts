import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({ deckService: { getDeckVersion: vi.fn() } }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { GET } from './route';
import { deckService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { DECK_VERSION_NOT_EDITABLE } from '@/lib/deck/deck-versions';

const getDeckVersion = vi.mocked(deckService.getDeckVersion);
const auth = vi.mocked(authenticateRequest);
const call = (versionNumber: string) =>
  GET(new NextRequest(`http://localhost/api/decks/deck123/versions/${versionNumber}`), { params: Promise.resolve({ deckId: 'deck123', versionNumber }) });

const VERSION = {
  versionNumber: 2, label: null, createdAt: '2026-11-26T12:00:00.000Z',
  counts: { hero: 0, equipment: 0, maindeck: 3, inventory: 0, benched: 0, tokens: 0 },
  snapshot: { name: 'Deck', format: 'Blitz', heroName: null, cards: [{ printingId: 'p', cardUniqueId: 'c', name: 'Sink Below', pitch: 1, quantity: 3, category: 'maindeck' as const }] },
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ success: true, userId: 'u1' } as any);
});

describe('GET /api/decks/[deckId]/versions/[versionNumber]', () => {
  it('401s when not signed in', async () => {
    auth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);
    expect((await call('2')).status).toBe(401);
    expect(getDeckVersion).not.toHaveBeenCalled();
  });

  it('returns the version with its cards', async () => {
    getDeckVersion.mockResolvedValue({ success: true, data: VERSION });
    const res = await call('2');
    expect(res.status).toBe(200);
    expect(getDeckVersion).toHaveBeenCalledWith('deck123', 'u1', 2);
    expect(await res.json()).toEqual({ success: true, data: { version: VERSION } });
  });

  it.each(['0', '-1', 'abc', '1.5', '99999999999'])('400s for the version number "%s"', async (bad) => {
    expect((await call(bad)).status).toBe(400);
    expect(getDeckVersion).not.toHaveBeenCalled();
  });

  it('404s when the deck has no such version', async () => {
    getDeckVersion.mockResolvedValue({ success: true, data: null });
    expect((await call('9')).status).toBe(404);
  });

  it('403s when the caller cannot edit the deck', async () => {
    getDeckVersion.mockResolvedValue({ success: false, error: DECK_VERSION_NOT_EDITABLE });
    expect((await call('2')).status).toBe(403);
  });

  it('accepts OAuth / MCP callers (allowOAuth)', async () => {
    getDeckVersion.mockResolvedValue({ success: true, data: VERSION });
    await call('2');
    expect(auth).toHaveBeenCalledWith(expect.anything(), expect.anything(), { allowOAuth: true });
  });
});
