/**
 * Unit tests for POST /api/scan/identify — the card scanner endpoint.
 * Mocks the scan service and the sharp hashing; tests HTTP concerns:
 * auth, input validation (multipart image / base64 JSON), size cap, shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  scanService: { identify: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));
vi.mock('@/lib/scan/image-hash', () => ({
  hashImage: vi.fn(),
  pitchHint: vi.fn(),
  thumbnailDataUrl: vi.fn(async () => 'data:image/jpeg;base64,AAAA'),
}));
import { MemoryScanSessionStore } from '@/lib/scan/session-store';
const sessionStore = new MemoryScanSessionStore();
vi.mock('@/lib/scan/session-store', async (orig) => ({ ...(await orig<any>()), getScanSessionStore: () => sessionStore }));

import { POST } from './route';
import { scanService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { hashImage, pitchHint } from '@/lib/scan/image-hash';

const mockIdentify = vi.mocked(scanService.identify);
const mockAuth = vi.mocked(authenticateRequest);
const mockHash = vi.mocked(hashImage);
const mockPitch = vi.mocked(pitchHint);

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
  mockHash.mockResolvedValue({ phash: '0'.repeat(16), dhash: '0'.repeat(16) });
  mockPitch.mockResolvedValue('red');
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
    expect(body).toEqual({ success: true, data: { ...RESULT, pitchHint: 'red' } });
    expect(mockHash).toHaveBeenCalledTimes(1);
    expect(Buffer.from(mockHash.mock.calls[0][0]).equals(PNG_BYTES)).toBe(true);
    expect(mockIdentify).toHaveBeenCalledWith({ phash: '0'.repeat(16), dhash: '0'.repeat(16) }, { limit: 5, pitchHint: 'red' });
  });

  it('accepts a JSON body with a base64 image (data-URL prefix tolerated)', async () => {
    const res = await POST(json({ image: 'data:image/png;base64,' + PNG_BYTES.toString('base64'), limit: 3 }));
    expect(res.status).toBe(200);
    expect(Buffer.from(mockHash.mock.calls[0][0]).equals(PNG_BYTES)).toBe(true);
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
    mockHash.mockRejectedValue(new Error('Input buffer contains unsupported image format'));
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
});
