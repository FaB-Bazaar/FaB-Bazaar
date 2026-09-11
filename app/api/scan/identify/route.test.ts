/**
 * Unit tests for POST /api/scan/identify — the card scanner endpoint.
 * Mocks the scan service and the sharp hashing; tests HTTP concerns:
 * auth, input validation (multipart image / base64 JSON), size cap, shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  userService: { getRoles: vi.fn(async () => ({ success: true, data: { isSuperAdmin: true } })) },
  scanService: { identify: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn(async () => ({ success: true, remaining: 59 })) }));
vi.mock('@/lib/scan/image-hash', () => ({
  analyzeImageMulti: vi.fn(),
  thumbnailDataUrl: vi.fn(async () => 'data:image/jpeg;base64,AAAA'),
}));
import { MemoryScanSessionStore } from '@/lib/scan/session-store';
const sessionStore = new MemoryScanSessionStore();
import { MemoryScanCaptureStore } from '@/lib/scan/capture-store';
const captureStore = new MemoryScanCaptureStore();
vi.mock('@/lib/scan/capture-store', async (orig) => ({ ...(await orig<any>()), getScanCaptureStore: () => captureStore }));
vi.mock('@/lib/scan/session-store', async (orig) => ({ ...(await orig<any>()), getScanSessionStore: () => sessionStore }));

import { POST } from './route';
import { scanService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { analyzeImageMulti } from '@/lib/scan/image-hash';

const mockIdentify = vi.mocked(scanService.identify);
const mockAuth = vi.mocked(authenticateRequest);
const mockAnalyze = vi.mocked(analyzeImageMulti);
const HASHES = { phash: '0'.repeat(16), dhash: '0'.repeat(16), artHash: '1'.repeat(16) };

const PNG_BYTES = Buffer.from('89504e470d0a1a0a', 'hex'); // just a header; hashing is mocked

function multipart(bytes: Buffer, extra: Record<string, string> = {}) {
  const fd = new FormData();
  fd.append('image', new Blob([bytes], { type: 'image/png' }), 'card.png');
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return new NextRequest('http://localhost/api/scan/identify', { method: 'POST', body: fd });
}
function json(body: unknown) {
  return new NextRequest('http://localhost/api/scan/identify', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  });
}

const RESULT = { candidates: [{ name: 'Sink Below', distance: 4, cards: [] }], bestDistance: 4, indexSize: 100 };

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
  mockAnalyze.mockResolvedValue([{ hashes: HASHES, pitchHint: 'red', deskewed: true, thumb: null }]);
  mockIdentify.mockResolvedValue({ success: true, data: RESULT });
});

describe('POST /api/scan/identify', () => {
  it('401s when not authenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'nope' } as any);
    const res = await POST(multipart(PNG_BYTES));
    expect(res.status).toBe(401);
  });

  it('hashes a multipart image, passes the pitch hint, returns candidates', async () => {
    const res = await POST(multipart(PNG_BYTES));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({ ...RESULT, pitchHint: 'red', deskewed: true });
    expect(body.data.cards).toHaveLength(1);
    expect(mockAnalyze).toHaveBeenCalledTimes(1);
    expect(Buffer.from(mockAnalyze.mock.calls[0][0]).equals(PNG_BYTES)).toBe(true);
    expect(mockIdentify).toHaveBeenCalledWith(HASHES, { limit: 5, pitchHint: 'red' });
  });

  it('when a deskew was applied, also tries the flat frame and keeps the closer match', async () => {
    const FLAT = { phash: 'f'.repeat(16), dhash: 'f'.repeat(16), artHash: 'f'.repeat(16) };
    mockAnalyze.mockResolvedValue([{ hashes: HASHES, flatHashes: FLAT, pitchHint: 'red', flatPitchHint: 'blue', deskewed: true, thumb: null }]);
    mockIdentify.mockImplementation(async (h: any) => ({ success: true, data: h === FLAT
      ? { candidates: [{ name: 'Flat Wins', distance: 12, cards: [] }], bestDistance: 12, indexSize: 100 }
      : { candidates: [{ name: 'Bad Deskew', distance: 90, cards: [] }], bestDistance: 90, indexSize: 100 } }));
    const res = await POST(multipart(PNG_BYTES));
    const body = await res.json();
    expect(mockIdentify).toHaveBeenCalledTimes(2);
    expect(body.data.candidates[0].name).toBe('Flat Wins');
    expect(body.data.deskewed).toBe(false);
    expect(body.data.pitchHint).toBe('blue');
  });

  it('accepts a JSON body with a base64 image (data-URL prefix tolerated)', async () => {
    const res = await POST(json({ image: 'data:image/png;base64,' + PNG_BYTES.toString('base64'), limit: 3 }));
    expect(res.status).toBe(200);
    expect(Buffer.from(mockAnalyze.mock.calls[0][0]).equals(PNG_BYTES)).toBe(true);
    expect(mockIdentify).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ limit: 3 }));
  });

  it('400s when no image is provided', async () => {
    const res = await POST(json({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/image/i);
  });

  it('413s when the image exceeds the size cap', async () => {
    const big = Buffer.alloc(6 * 1024 * 1024);
    const res = await POST(multipart(big));
    expect(res.status).toBe(413);
  });

  it('400s when the bytes are not decodable as an image', async () => {
    mockAnalyze.mockRejectedValue(new Error('Input buffer contains unsupported image format'));
    const res = await POST(multipart(Buffer.from('nope')));
    expect(res.status).toBe(400);
  });

  it('500s when the service fails', async () => {
    mockIdentify.mockResolvedValue({ success: false, error: 'db down' });
    const res = await POST(multipart(PNG_BYTES));
    expect(res.status).toBe(500);
  });

  describe('with a paired phone session', () => {
    it('appends the result (with a thumbnail) to the caller\'s session and returns it too', async () => {
      const s = await sessionStore.create('u1');
      const res = await POST(multipart(PNG_BYTES, { session: s.code }));
      expect(res.status).toBe(200);
      const items = await sessionStore.listItems(s.code);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ candidates: RESULT.candidates, bestDistance: 4, pitchHint: 'red', thumb: 'data:image/jpeg;base64,AAAA' });
      expect((await res.json()).data.sessionItemId).toBe(items[0].id);
    });
    it('403s when the session belongs to someone else', async () => {
      const s = await sessionStore.create('other');
      expect((await POST(multipart(PNG_BYTES, { session: s.code }))).status).toBe(403);
    });
    it('404s an unknown session code', async () => {
      expect((await POST(multipart(PNG_BYTES, { session: 'ZZZZZZZZ' }))).status).toBe(404);
    });
  });

  it('403s a signed-in non-superadmin while the scanner is superadmin-only', async () => {
    const { userService } = await import('@/lib/services');
    vi.mocked(userService.getRoles).mockResolvedValueOnce({ success: true, data: { isSuperAdmin: false } } as any);
    const res = await POST(multipart(PNG_BYTES));
    expect(res.status).toBe(403);
  });

  it('429s when the per-user identify rate limit is exhausted', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    vi.mocked(rateLimit).mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 1000 } as any);
    const res = await POST(multipart(PNG_BYTES));
    expect(res.status).toBe(429);
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  describe('several cards in one photo', () => {
    const H2 = { phash: '2'.repeat(16), dhash: '2'.repeat(16), artHash: '2'.repeat(16) };
    it('identifies each card and returns them in order under data.cards (data = first card for compatibility)', async () => {
      mockAnalyze.mockResolvedValue([
        { hashes: HASHES, pitchHint: 'red', deskewed: true, thumb: 'data:image/jpeg;base64,ONE' },
        { hashes: H2, pitchHint: null, deskewed: true, thumb: 'data:image/jpeg;base64,TWO' },
      ]);
      mockIdentify.mockImplementation(async (h: any) => ({ success: true, data: h === H2
        ? { candidates: [{ name: 'Second', distance: 9, cards: [] }], bestDistance: 9, indexSize: 100 }
        : { candidates: [{ name: 'First', distance: 4, cards: [] }], bestDistance: 4, indexSize: 100 } }));
      const res = await POST(multipart(PNG_BYTES));
      const body = await res.json();
      expect(mockIdentify).toHaveBeenCalledTimes(2);
      expect(body.data.cards.map((c: any) => c.candidates[0].name)).toEqual(['First', 'Second']);
      expect(body.data.cards.map((c: any) => c.thumb)).toEqual(['data:image/jpeg;base64,ONE', 'data:image/jpeg;base64,TWO']);
      expect(body.data.candidates[0].name).toBe('First');
    });
    it('appends one session item per card, each with its own thumbnail', async () => {
      mockAnalyze.mockResolvedValue([
        { hashes: HASHES, pitchHint: 'red', deskewed: true, thumb: 'data:image/jpeg;base64,ONE' },
        { hashes: H2, pitchHint: null, deskewed: true, thumb: 'data:image/jpeg;base64,TWO' },
      ]);
      const s = await sessionStore.create('u1');
      const res = await POST(multipart(PNG_BYTES, { session: s.code }));
      const body = await res.json();
      const items = await sessionStore.listItems(s.code);
      expect(items).toHaveLength(2);
      expect(items.map(i => i.thumb)).toEqual(['data:image/jpeg;base64,ONE', 'data:image/jpeg;base64,TWO']);
      expect(body.data.cards.map((c: any) => c.sessionItemId)).toEqual(items.map(i => i.id));
    });
  });

  it('keeps the uploaded photo for rollout diagnostics, tagged with the outcome', async () => {
    const before = (await captureStore.list('u1')).length;
    await POST(multipart(PNG_BYTES));
    const list = await captureStore.list('u1');
    expect(list.length).toBe(before + 1);
    expect(list[0]).toMatchObject({ contentType: 'image/png', bytes: PNG_BYTES.length, outcome: { cardsFound: 1, topName: 'Sink Below', bestDistance: 4 } });
  });
});
