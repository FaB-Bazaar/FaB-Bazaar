/** GET /api/scan/session/[code] — status for either device. */
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
const get = (code: string) => GET(new NextRequest(`http://localhost/api/scan/session/${code}`), { params: Promise.resolve({ code }) });

beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any); });

describe('GET /api/scan/session/[code]', () => {
  it('404s an unknown or malformed code', async () => {
    expect((await get('ZZZZZZZZ')).status).toBe(404);
    expect((await get('bad')).status).toBe(404);
  });
  it('403s when the session belongs to another user', async () => {
    const s = await store.create('someone-else');
    expect((await get(s.code)).status).toBe(403);
  });
  it('reports paired state and item count to the owner', async () => {
    const s = await store.create('u1');
    await store.appendItem(s.code, { id: 'i1', createdAt: 1, thumb: null, candidates: [], bestDistance: null, pitchHint: null });
    const body = await (await get(s.code)).json();
    expect(body).toEqual({ success: true, data: { code: s.code, paired: false, itemCount: 1 } });
  });

  it('403s a signed-in non-superadmin while the scanner is superadmin-only', async () => {
    const { userService } = await import('@/lib/services');
    vi.mocked(userService.getRoles).mockResolvedValueOnce({ success: true, data: { isSuperAdmin: false } } as any);
    const res = await get((await store.create('u1')).code);
    expect(res.status).toBe(403);
  });
});
