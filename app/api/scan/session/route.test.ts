/** POST /api/scan/session — desktop creates a phone-pairing session. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { MemoryScanSessionStore } from '@/lib/scan/session-store';

const store = new MemoryScanSessionStore();
vi.mock('@/lib/scan/session-store', async (orig) => ({ ...(await orig<any>()), getScanSessionStore: () => store }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));
vi.mock('@/lib/services', () => ({ userService: { getRoles: vi.fn(async () => ({ success: true, data: { isSuperAdmin: true } })) } }));
vi.mock('@/lib/scan/pair-url', async (orig) => ({ ...(await orig<any>()), detectLanIp: () => '10.0.0.92' }));

import { POST } from './route';
import { authenticateRequest } from '@/lib/auth/multi-auth';
const mockAuth = vi.mocked(authenticateRequest);
const req = () => new NextRequest('http://localhost/api/scan/session', { method: 'POST' });

beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any); });

describe('POST /api/scan/session', () => {
  it('401s when signed out', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'no' } as any);
    expect((await POST(req())).status).toBe(401);
  });
  it('creates a session owned by the caller and returns the code + pair URL', async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.code).toMatch(/^[A-Z2-9]{8}$/);
    // the QR must be reachable from a PHONE: localhost is swapped for the LAN ip in dev
    expect(body.data.pairUrl).toBe(`http://10.0.0.92/scan?pair=${body.data.code}`);
    expect(body.data.expiresInSec).toBe(1800);
    expect((await store.get(body.data.code))?.userId).toBe('u1');
  });

  it('403s a signed-in non-superadmin while the scanner is superadmin-only', async () => {
    const { userService } = await import('@/lib/services');
    vi.mocked(userService.getRoles).mockResolvedValueOnce({ success: true, data: { isSuperAdmin: false } } as any);
    const res = await POST(req());
    expect(res.status).toBe(403);
  });
});
