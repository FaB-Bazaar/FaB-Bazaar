/** POST /api/scan/session/[code]/pair — the phone announces itself. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { MemoryScanSessionStore } from '@/lib/scan/session-store';

const store = new MemoryScanSessionStore();
vi.mock('@/lib/scan/session-store', async (orig) => ({ ...(await orig<any>()), getScanSessionStore: () => store }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));
vi.mock('@/lib/services', () => ({ userService: { getRoles: vi.fn(async () => ({ success: true, data: { isSuperAdmin: true } })) } }));

import { POST } from './route';
import { authenticateRequest } from '@/lib/auth/multi-auth';
const mockAuth = vi.mocked(authenticateRequest);
const post = (code: string) => POST(new NextRequest(`http://localhost/api/scan/session/${code}/pair`, { method: 'POST' }), { params: Promise.resolve({ code }) });

beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any); });

describe('POST /api/scan/session/[code]/pair', () => {
  it('403s a different user (the QR is not a credential)', async () => {
    const s = await store.create('someone-else');
    expect((await post(s.code)).status).toBe(403);
  });
  it('marks the owner\'s session paired', async () => {
    const s = await store.create('u1');
    const res = await post(s.code);
    expect(res.status).toBe(200);
    expect((await res.json()).data.paired).toBe(true);
    expect((await store.get(s.code))?.pairedAt).toEqual(expect.any(Number));
  });

  it('403s a signed-in non-superadmin while the scanner is superadmin-only', async () => {
    const { userService } = await import('@/lib/services');
    vi.mocked(userService.getRoles).mockResolvedValueOnce({ success: true, data: { isSuperAdmin: false } } as any);
    const res = await post((await store.create('u1')).code);
    expect(res.status).toBe(403);
  });
});
