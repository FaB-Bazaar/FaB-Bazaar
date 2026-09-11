/** POST /api/scan/captures/label — the user tells us what a scanned photo really was. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { MemoryScanCaptureStore } from '@/lib/scan/capture-store';

const store = new MemoryScanCaptureStore();
vi.mock('@/lib/scan/capture-store', async (orig) => ({ ...(await orig<any>()), getScanCaptureStore: () => store }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));
vi.mock('@/lib/services', () => ({
  userService: { getRoles: vi.fn(async () => ({ success: true, data: { isSuperAdmin: true } })) },
  printingsService: { getPrintingById: vi.fn(async (id: string) => id === 'p-true' ? { success: true, data: { printing_id: 'p-true', name: 'True Card' } } : { success: true, data: null }) },
}));

import { POST } from './route';
import { authenticateRequest } from '@/lib/auth/multi-auth';
const mockAuth = vi.mocked(authenticateRequest);
const post = (body: unknown) => POST(new NextRequest('http://localhost/api/scan/captures/label', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }));
const PNG = Buffer.from('89504e470d0a1a0a0000', 'hex');

beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any); });

describe('POST /api/scan/captures/label', () => {
  it('401s signed out', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'no' } as any);
    expect((await post({ captureId: 'x', printingId: 'p-true', source: 'corrected' })).status).toBe(401);
  });
  it('400s a bad body', async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ captureId: 'x', printingId: 'p-true', source: 'weird' })).status).toBe(400);
  });
  it('404s an unknown printing or an unknown/expired capture', async () => {
    const c = await store.save('u1', PNG, 'image/png', { cardsFound: 1, topName: 'Wrong', bestDistance: 40 });
    expect((await post({ captureId: c.id, printingId: 'ghost', source: 'corrected' })).status).toBe(404);
    expect((await post({ captureId: 'nope', printingId: 'p-true', source: 'corrected' })).status).toBe(404);
  });
  it('records the label with the card name on the caller\'s capture', async () => {
    const c = await store.save('u1', PNG, 'image/png', { cardsFound: 1, topName: 'Wrong', bestDistance: 40 });
    const res = await post({ captureId: c.id, printingId: 'p-true', source: 'corrected' });
    expect(res.status).toBe(200);
    const meta = (await store.list('u1')).find(x => x.id === c.id)!;
    expect(meta.label).toMatchObject({ printingId: 'p-true', cardName: 'True Card', source: 'corrected' });
  });
});
