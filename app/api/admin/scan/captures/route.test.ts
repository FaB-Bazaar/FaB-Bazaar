/** GET /api/admin/scan/captures — list recent scan photos kept for rollout diagnostics (superadmin). */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { MemoryScanCaptureStore } from '@/lib/scan/capture-store';

const store = new MemoryScanCaptureStore();
vi.mock('@/lib/scan/capture-store', async (orig) => ({ ...(await orig<any>()), getScanCaptureStore: () => store }));
vi.mock('@/lib/services', () => ({ userService: { hasRole: vi.fn() } }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { GET } from './route';
import { GET as GET_ONE } from './[id]/route';
import { userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';
const mockAuth = vi.mocked(authenticateRequest);
const mockHasRole = vi.mocked(userService.hasRole);
const PNG = Buffer.from('89504e470d0a1a0a0000', 'hex');

beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ success: true, userId: 'admin' } as any); mockHasRole.mockResolvedValue({ success: true, data: true }); });

describe('scan captures', () => {
  it('403s non-superadmins', async () => {
    mockHasRole.mockResolvedValue({ success: true, data: false });
    expect((await GET(new NextRequest('http://localhost/api/admin/scan/captures'))).status).toBe(403);
  });
  it('lists the caller\'s captures with outcome metadata and a download path', async () => {
    const c = await store.save('admin', PNG, 'image/png', { cardsFound: 0, topName: 'Wrong', bestDistance: 88 });
    const body = await (await GET(new NextRequest('http://localhost/api/admin/scan/captures'))).json();
    expect(body.success).toBe(true);
    expect(body.data.captures[0]).toMatchObject({ id: c.id, bytes: PNG.length, outcome: { cardsFound: 0, topName: 'Wrong', bestDistance: 88 }, url: `/api/admin/scan/captures/${c.id}` });
  });
  it('serves the original bytes with the right content type', async () => {
    const c = await store.save('admin', PNG, 'image/png', { cardsFound: 0, topName: null, bestDistance: null });
    const res = await GET_ONE(new NextRequest(`http://localhost/api/admin/scan/captures/${c.id}`), { params: Promise.resolve({ id: c.id }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);
    expect((await GET_ONE(new NextRequest('http://localhost/x'), { params: Promise.resolve({ id: 'nope' }) })).status).toBe(404);
  });
});
