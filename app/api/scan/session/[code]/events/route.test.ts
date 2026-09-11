/** GET /api/scan/session/[code]/events — SSE: snapshot of existing items, then live ones. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { MemoryScanSessionStore } from '@/lib/scan/session-store';

const store = new MemoryScanSessionStore();
vi.mock('@/lib/scan/session-store', async (orig) => ({ ...(await orig<any>()), getScanSessionStore: () => store }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));
vi.mock('@/lib/services', () => ({ userService: { getRoles: vi.fn(async () => ({ success: true, data: { isSuperAdmin: true } })) } }));

import { GET } from './route';
import { authenticateRequest } from '@/lib/auth/multi-auth';
const mockAuth = vi.mocked(authenticateRequest);
const item = (id: string) => ({ id, createdAt: 1, thumb: null, candidates: [], bestDistance: null, pitchHint: null });

async function readEvents(res: Response, count: number, signal?: AbortController): Promise<any[]> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const events: any[] = [];
  while (events.length < count) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value);
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
      const line = chunk.split('\n').find(l => l.startsWith('data: '));
      if (line) events.push(JSON.parse(line.slice(6)));
    }
  }
  signal?.abort();
  return events;
}

beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any); });

describe('GET /api/scan/session/[code]/events', () => {
  it('403s another user\'s session', async () => {
    const s = await store.create('other');
    const res = await GET(new NextRequest(`http://localhost/x`), { params: Promise.resolve({ code: s.code }) });
    expect(res.status).toBe(403);
  });

  it('streams existing items first, then live items and pairing', async () => {
    const s = await store.create('u1');
    await store.appendItem(s.code, item('old'));
    const ac = new AbortController();
    const res = await GET(new NextRequest(`http://localhost/x`, { signal: ac.signal }), { params: Promise.resolve({ code: s.code }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const pending = readEvents(res, 4, ac);
    await new Promise(r => setTimeout(r, 20));
    await store.markPaired(s.code);
    await store.appendItem(s.code, item('new'));
    const events = await pending;
    expect(events.map(e => e.type)).toEqual(['status', 'item', 'paired', 'item']);
    expect(events[0]).toMatchObject({ type: 'status', paired: false });
    expect(events[1].item.id).toBe('old');
    expect(events[3].item.id).toBe('new');
  });

  it('403s a signed-in non-superadmin while the scanner is superadmin-only', async () => {
    const { userService } = await import('@/lib/services');
    vi.mocked(userService.getRoles).mockResolvedValueOnce({ success: true, data: { isSuperAdmin: false } } as any);
    const res = await GET(new NextRequest('http://localhost/x'), { params: Promise.resolve({ code: (await store.create('u1')).code }) });
    expect(res.status).toBe(403);
  });
});
