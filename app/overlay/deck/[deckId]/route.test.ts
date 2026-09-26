import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({ deckService: { findByPublicId: vi.fn() } }));

// Import AFTER mocks (vi.mock is hoisted)
import { GET } from './route';
import { deckService } from '@/lib/services';

const mockFind = vi.mocked(deckService.findByPublicId);

function deck(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'internal-id',
    publicId: 'TofxuKKxD0ESwVR93b5AC',
    userId: 'owner',
    name: 'Midrange Maxx',
    format: 'Classic Constructed',
    heroName: "Maxx 'The Hype' Nitro",
    visibility: 'unlisted',
    isPublic: true,
    metafyGuideId: null,
    hero: [{ printingId: 'h', quantity: 1, printingDetails: { name: "Maxx 'The Hype' Nitro", image_url: 'https://imagedelivery.net/x/hero/public' } }],
    equipment: [],
    maindeck: [{ printingId: 'm', quantity: 3, printingDetails: { name: 'Crankshaft', pitch: 1, image_url: 'https://imagedelivery.net/x/crank/public' } }],
    inventory: [],
    ...overrides,
  } as any;
}

function get(query = '') {
  const req = new NextRequest(`https://fabbazaar.app/overlay/deck/TofxuKKxD0ESwVR93b5AC${query}`);
  return GET(req, { params: Promise.resolve({ deckId: 'TofxuKKxD0ESwVR93b5AC' }) });
}

describe('GET /overlay/deck/[deckId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('looks the deck up by public id without a user (OBS has no session)', async () => {
    mockFind.mockResolvedValue({ success: true, data: deck() } as any);
    await get();
    expect(mockFind).toHaveBeenCalledWith('TofxuKKxD0ESwVR93b5AC');
  });

  it('returns the overlay as HTML for an unlisted deck', async () => {
    mockFind.mockResolvedValue({ success: true, data: deck() } as any);
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('Midrange Maxx');
    expect(html).toContain('https://imagedelivery.net/x/crank/public');
  });

  it('uses the list layout when asked', async () => {
    mockFind.mockResolvedValue({ success: true, data: deck() } as any);
    const html = await (await get('?layout=list')).text();
    expect(html).toContain('data-pitch="1"');
  });

  it('is cached briefly so deck edits show up on stream within a minute', async () => {
    mockFind.mockResolvedValue({ success: true, data: deck() } as any);
    const res = await get();
    expect(res.headers.get('cache-control')).toMatch(/max-age=60\b/);
  });

  it('is kept out of search indexes', async () => {
    mockFind.mockResolvedValue({ success: true, data: deck() } as any);
    const res = await get();
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
  });

  it('404s for a missing deck', async () => {
    mockFind.mockResolvedValue({ success: true, data: null } as any);
    expect((await get()).status).toBe(404);
  });

  it('404s for a private deck without revealing it exists', async () => {
    mockFind.mockResolvedValue({ success: true, data: deck({ visibility: 'private', isPublic: false }) } as any);
    const res = await get();
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain('Midrange Maxx');
  });

  it('404s for a Metafy-gated deck', async () => {
    mockFind.mockResolvedValue({ success: true, data: deck({ visibility: 'public', metafyGuideId: 'guide-1' }) } as any);
    expect((await get()).status).toBe(404);
  });

  it('404s when the lookup fails', async () => {
    mockFind.mockResolvedValue({ success: false, error: 'boom' } as any);
    expect((await get()).status).toBe(404);
  });
});
