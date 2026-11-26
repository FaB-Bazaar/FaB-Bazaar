import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({ deckService: { setTalisharVersion: vi.fn() } }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { PUT } from './route';
import { deckService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { DECK_VERSION_NOT_EDITABLE, DECK_VERSION_NOT_FOUND } from '@/lib/deck/deck-versions';

const setTalisharVersion = vi.mocked(deckService.setTalisharVersion);
const auth = vi.mocked(authenticateRequest);
const params = Promise.resolve({ deckId: 'deck123' });
const put = (body: unknown) => new NextRequest('http://localhost/api/decks/deck123/talishar-version', { method: 'PUT', body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ success: true, userId: 'u1' } as any);
  setTalisharVersion.mockImplementation(async (_d, _u, n) => ({ success: true, data: { talisharVersion: n } }));
});

describe('PUT /api/decks/[deckId]/talishar-version', () => {
  it('401s when not signed in', async () => {
    auth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);
    expect((await PUT(put({ versionNumber: 1 }), { params })).status).toBe(401);
    expect(setTalisharVersion).not.toHaveBeenCalled();
  });

  it('picks a saved version', async () => {
    const res = await PUT(put({ versionNumber: 2 }), { params });
    expect(res.status).toBe(200);
    expect(setTalisharVersion).toHaveBeenCalledWith('deck123', 'u1', 2);
    expect(await res.json()).toEqual({ success: true, data: { talisharVersion: 2 } });
  });

  it('goes back to the current deck with null', async () => {
    const res = await PUT(put({ versionNumber: null }), { params });
    expect(res.status).toBe(200);
    expect(setTalisharVersion).toHaveBeenCalledWith('deck123', 'u1', null);
  });

  it.each([[{}], [{ versionNumber: 0 }], [{ versionNumber: -1 }], [{ versionNumber: 1.5 }], [{ versionNumber: '2' }], [{ versionNumber: 1e12 }], ['nope']])(
    '400s for the body %j', async (body) => {
      expect((await PUT(put(body), { params })).status).toBe(400);
      expect(setTalisharVersion).not.toHaveBeenCalled();
    });

  it('404s for a version the deck does not have', async () => {
    setTalisharVersion.mockResolvedValue({ success: false, error: DECK_VERSION_NOT_FOUND });
    expect((await PUT(put({ versionNumber: 9 }), { params })).status).toBe(404);
  });

  it('403s when the caller cannot edit the deck', async () => {
    setTalisharVersion.mockResolvedValue({ success: false, error: DECK_VERSION_NOT_EDITABLE });
    expect((await PUT(put({ versionNumber: 1 }), { params })).status).toBe(403);
  });

  it('500s without passing a database error through', async () => {
    setTalisharVersion.mockResolvedValue({ success: false, error: 'Failed query: update "decks" … params: abc' });
    const res = await PUT(put({ versionNumber: 1 }), { params });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/query|update|params/i);
  });

  it('accepts OAuth / MCP callers (allowOAuth)', async () => {
    await PUT(put({ versionNumber: 1 }), { params });
    expect(auth).toHaveBeenCalledWith(expect.anything(), expect.anything(), { allowOAuth: true });
  });
});
