import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({ deckService: { findStreamingDeckByUsername: vi.fn() } }));

// Import AFTER mocks (vi.mock is hoisted)
import { GET } from './route';
import { deckService } from '@/lib/services';

const mockFind = vi.mocked(deckService.findStreamingDeckByUsername);

function deck(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'internal',
    publicId: 'deck123',
    userId: 'u1',
    name: 'Midrange Maxx',
    format: 'Classic Constructed',
    heroName: "Maxx 'The Hype' Nitro",
    visibility: 'unlisted',
    isPublic: true,
    metafyGuideId: null,
    updatedAt: new Date('2026-09-26T00:00:00.000Z'),
    hero: [],
    equipment: [],
    maindeck: [{ printingId: 'm', quantity: 3, printingDetails: { display_name: 'Crankshaft', pitch: 1, image_url: 'https://imagedelivery.net/x/c/public' } }],
    inventory: [],
    ...overrides,
  } as any;
}

function get(query = '', username = 'm1stercakes') {
  const req = new NextRequest(`https://fabbazaar.app/overlay/u/${encodeURIComponent(username)}/deck${query}`);
  return GET(req, { params: Promise.resolve({ username }) });
}

beforeEach(() => vi.clearAllMocks());

describe('GET /overlay/u/[username]/deck', () => {
  it("renders the user's streaming deck as HTML", async () => {
    mockFind.mockResolvedValue({ success: true, data: deck() });
    const res = await get('?layout=list');
    expect(mockFind).toHaveBeenCalledWith('m1stercakes');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('Midrange Maxx');
    expect(html).toContain('data-pitch="1"');
  });

  it('polls its own check URL with the deck version so switching decks reloads OBS', async () => {
    mockFind.mockResolvedValue({ success: true, data: deck() });
    const html = await (await get()).text();
    expect(html).toContain('data-poll-url="/overlay/u/m1stercakes/deck?check=1"');
    expect(html).toContain('data-version="deck123:2026-09-26T00:00:00.000Z"');
  });

  it('URL-encodes the username in the poll URL', async () => {
    mockFind.mockResolvedValue({ success: true, data: deck() });
    const html = await (await get('', 'dc_some one')).text();
    expect(html).toContain('data-poll-url="/overlay/u/dc_some%20one/deck?check=1"');
  });

  it('shows the idle placeholder (200, still polling) when no deck is set', async () => {
    mockFind.mockResolvedValue({ success: true, data: null });
    const res = await get();
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('No deck selected');
    expect(html).toContain('data-version=""');
  });

  it('shows the placeholder, not the deck, when the chosen deck became private', async () => {
    mockFind.mockResolvedValue({ success: true, data: deck({ visibility: 'private' }) });
    const html = await (await get()).text();
    expect(html).toContain('No deck selected');
    expect(html).not.toContain('Midrange Maxx');
  });

  it('is cached only briefly and kept out of search indexes', async () => {
    mockFind.mockResolvedValue({ success: true, data: deck() });
    const res = await get();
    expect(res.headers.get('cache-control')).toMatch(/max-age=15\b/);
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
  });

  describe('?check=1', () => {
    it('returns the current version as uncached JSON', async () => {
      mockFind.mockResolvedValue({ success: true, data: deck() });
      const res = await get('?check=1');
      expect(res.headers.get('content-type')).toContain('application/json');
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(await res.json()).toEqual({ version: 'deck123:2026-09-26T00:00:00.000Z' });
    });

    it('returns an empty version when nothing is showable', async () => {
      mockFind.mockResolvedValue({ success: true, data: null });
      expect(await (await get('?check=1')).json()).toEqual({ version: '' });
      mockFind.mockResolvedValue({ success: true, data: deck({ metafyGuideId: 'g' }) });
      expect(await (await get('?check=1')).json()).toEqual({ version: '' });
    });
  });
});
