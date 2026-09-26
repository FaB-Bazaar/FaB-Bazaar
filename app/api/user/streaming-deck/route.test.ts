import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  deckService: { getStreamingDeckPublicId: vi.fn(), setStreamingDeck: vi.fn() },
  userService: { findById: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

// Import AFTER mocks (vi.mock is hoisted)
import { GET, PUT } from './route';
import { deckService, userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockAuth = vi.mocked(authenticateRequest);
const mockGet = vi.mocked(deckService.getStreamingDeckPublicId);
const mockSet = vi.mocked(deckService.setStreamingDeck);
const mockFindUser = vi.mocked(userService.findById);

const url = 'https://fabbazaar.app/api/user/streaming-deck';
const put = (body: unknown) =>
  PUT(new NextRequest(url, { method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
  mockFindUser.mockResolvedValue({ success: true, data: { username: 'm1stercakes' } } as any);
});

describe('GET /api/user/streaming-deck', () => {
  it('401s when signed out', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'nope' } as any);
    expect((await GET(new NextRequest(url))).status).toBe(401);
  });

  it("returns the user's streaming deck and the overlay path", async () => {
    mockGet.mockResolvedValue({ success: true, data: 'deck123' });
    const res = await GET(new NextRequest(url));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: { deckPublicId: 'deck123', overlayPath: '/overlay/u/m1stercakes/deck' },
    });
    expect(mockGet).toHaveBeenCalledWith('u1');
  });

  it('URL-encodes the username in the overlay path', async () => {
    mockGet.mockResolvedValue({ success: true, data: null });
    mockFindUser.mockResolvedValue({ success: true, data: { username: 'dc_some one' } } as any);
    const body = await (await GET(new NextRequest(url))).json();
    expect(body.data.overlayPath).toBe('/overlay/u/dc_some%20one/deck');
  });
});

describe('PUT /api/user/streaming-deck', () => {
  it('401s when signed out', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'nope' } as any);
    expect((await put({ deckPublicId: 'deck123' })).status).toBe(401);
  });

  it('sets the streaming deck for the authenticated user', async () => {
    mockSet.mockResolvedValue({ success: true, data: { deckPublicId: 'deck123' } });
    const res = await put({ deckPublicId: 'deck123' });
    expect(res.status).toBe(200);
    expect(mockSet).toHaveBeenCalledWith('u1', 'deck123');
    expect((await res.json()).data.deckPublicId).toBe('deck123');
  });

  it('clears it with null', async () => {
    mockSet.mockResolvedValue({ success: true, data: { deckPublicId: null } });
    expect((await put({ deckPublicId: null })).status).toBe(200);
    expect(mockSet).toHaveBeenCalledWith('u1', null);
  });

  it('400s on a missing or non-string deckPublicId', async () => {
    expect((await put({})).status).toBe(400);
    expect((await put({ deckPublicId: 42 })).status).toBe(400);
    expect((await put('not json')).status).toBe(400);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('404s when the deck is not the user\'s', async () => {
    mockSet.mockResolvedValue({ success: false, error: 'Deck not found', code: 'NOT_FOUND' });
    expect((await put({ deckPublicId: 'x' })).status).toBe(404);
  });

  it('422s with the reason when the deck cannot be shown on stream', async () => {
    mockSet.mockResolvedValue({ success: false, error: 'Only public or unlisted…', code: 'NOT_STREAMABLE' });
    const res = await put({ deckPublicId: 'x' });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toContain('public or unlisted');
  });

  it('500s on an unexpected service failure', async () => {
    mockSet.mockResolvedValue({ success: false, error: 'db down' });
    expect((await put({ deckPublicId: 'x' })).status).toBe(500);
  });
});
