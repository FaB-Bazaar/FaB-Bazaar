import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({ deckService: { setDeckRatios: vi.fn() } }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { PUT } from './route';
import { deckService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const setDeckRatios = vi.mocked(deckService.setDeckRatios);
const auth = vi.mocked(authenticateRequest);
const params = Promise.resolve({ deckId: 'deck123' });
const req = (body: unknown) => new NextRequest('http://localhost/api/decks/deck123/ratios', { method: 'PUT', body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ success: true, userId: 'u1' } as any);
});

describe('PUT /api/decks/[deckId]/ratios', () => {
  it('401s when not signed in', async () => {
    auth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);
    const res = await PUT(req({ ratios: [] }), { params });
    expect(res.status).toBe(401);
    expect(setDeckRatios).not.toHaveBeenCalled();
  });

  it('400s when ratios is not a list', async () => {
    const res = await PUT(req({ ratios: 'nope' }), { params });
    expect(res.status).toBe(400);
    expect(setDeckRatios).not.toHaveBeenCalled();
  });

  it('saves the sanitized list (junk entries dropped)', async () => {
    setDeckRatios.mockImplementation(async (_d, _u, ratios) => ({ success: true, data: { ratios } }));
    const good = { id: 'r1', a: { kind: 'text', value: 'discard' }, b: { kind: 'pitch', value: '3' } };
    const res = await PUT(req({ ratios: [good, { id: 'bad', a: { kind: 'evil', value: 'x' } }] }), { params });
    expect(res.status).toBe(200);
    expect(setDeckRatios).toHaveBeenCalledWith('deck123', 'u1', [good]);
    expect(await res.json()).toEqual({ success: true, data: { ratios: [good] } });
  });

  it('403s when the deck is not editable by the caller', async () => {
    setDeckRatios.mockResolvedValue({ success: false, error: 'Deck not found or not editable' });
    const res = await PUT(req({ ratios: [] }), { params });
    expect(res.status).toBe(403);
  });

  it('accepts OAuth / MCP callers (allowOAuth)', async () => {
    setDeckRatios.mockResolvedValue({ success: true, data: { ratios: [] } });
    await PUT(req({ ratios: [] }), { params });
    expect(auth).toHaveBeenCalledWith(expect.anything(), expect.anything(), { allowOAuth: true });
  });
});
