/** POST /api/scan/session — desktop creates a phone-pairing session. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { MemoryScanSessionStore } from '@/lib/scan/session-store';

const store = new MemoryScanSessionStore();
vi.mock('@/lib/scan/session-store', async (orig) => ({ ...(await orig<any>()), getScanSessionStore: () => store }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

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
    expect(body.data.pairUrl).toBe(`http://localhost/scan?pair=${body.data.code}`);
    expect(body.data.expiresInSec).toBe(1800);
    expect((await store.get(body.data.code))?.userId).toBe('u1');
  });
});
