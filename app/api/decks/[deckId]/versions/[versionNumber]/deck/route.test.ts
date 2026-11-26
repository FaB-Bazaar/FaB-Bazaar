import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({ deckService: { getDeckVersionAsDeck: vi.fn() } }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { GET } from './route';
import { deckService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { DECK_VERSION_NOT_EDITABLE } from '@/lib/deck/deck-versions';

const getDeckVersionAsDeck = vi.mocked(deckService.getDeckVersionAsDeck);
const auth = vi.mocked(authenticateRequest);
const call = (versionNumber: string) =>
  GET(new NextRequest(`http://localhost/api/decks/deck123/versions/${versionNumber}/deck`), { params: Promise.resolve({ deckId: 'deck123', versionNumber }) });

const DECK = { publicId: 'deck123', name: 'Deck', format: 'Blitz', hero: [], equipment: [], maindeck: [{ printingId: 'p', quantity: 3 }], inventory: [] } as any;

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ success: true, userId: 'u1' } as any);
});

describe('GET /api/decks/[deckId]/versions/[versionNumber]/deck', () => {
  it('401s when not signed in', async () => {
    auth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);
    expect((await call('2')).status).toBe(401);
    expect(getDeckVersionAsDeck).not.toHaveBeenCalled();
  });

  it('returns the version as a deck', async () => {
    getDeckVersionAsDeck.mockResolvedValue({ success: true, data: DECK });
    const res = await call('2');
    expect(res.status).toBe(200);
    expect(getDeckVersionAsDeck).toHaveBeenCalledWith('deck123', 'u1', 2);
    expect(await res.json()).toEqual({ success: true, data: { deck: DECK } });
  });

  it.each(['0', '-1', 'abc', '1.5'])('400s for the version number "%s"', async (bad) => {
    expect((await call(bad)).status).toBe(400);
    expect(getDeckVersionAsDeck).not.toHaveBeenCalled();
  });

  it('404s when the deck has no such version', async () => {
    getDeckVersionAsDeck.mockResolvedValue({ success: true, data: null });
    expect((await call('9')).status).toBe(404);
  });

  it('403s when the caller cannot edit the deck', async () => {
    getDeckVersionAsDeck.mockResolvedValue({ success: false, error: DECK_VERSION_NOT_EDITABLE });
    expect((await call('2')).status).toBe(403);
  });

  it('500s without passing a database error through', async () => {
    getDeckVersionAsDeck.mockResolvedValue({ success: false, error: 'Failed query: select … params: abc' });
    const res = await call('2');
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/query|select|params/i);
  });

  it('accepts OAuth / MCP callers (allowOAuth)', async () => {
    getDeckVersionAsDeck.mockResolvedValue({ success: true, data: DECK });
    await call('2');
    expect(auth).toHaveBeenCalledWith(expect.anything(), expect.anything(), { allowOAuth: true });
  });
});
