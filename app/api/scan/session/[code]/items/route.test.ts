/** POST /api/scan/session/[code]/items — the paired phone sends the cards it read (on the phone) to the desktop. */
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
const item = { name: 'Massacre', status: 'ok', pitch: 1, pitchOptions: [1], crop: null };
const post = (code: string, body: unknown) => POST(
  new NextRequest(`http://localhost/api/scan/session/${code}/items`, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
  { params: Promise.resolve({ code }) });

beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any); });

describe('POST /api/scan/session/[code]/items', () => {
  it('appends the cards to the owner\'s session (the desktop streams them from there)', async () => {
    const s = await store.create('u1');
    const res = await post(s.code, { items: [item, { ...item, name: 'Sink Below' }] });
    expect(res.status).toBe(200);
    expect((await res.json()).data.added).toBe(2);
    expect((await store.listItems(s.code)).map(i => i.name)).toEqual(['Massacre', 'Sink Below']);
  });

  it('403s a different user (the QR code is not a credential)', async () => {
    const s = await store.create('someone-else');
    expect((await post(s.code, { items: [item] })).status).toBe(403);
    expect(await store.listItems(s.code)).toEqual([]);
  });

  it('401s when signed out', async () => {
    mockAuth.mockResolvedValueOnce({ success: false, error: 'no' } as any);
    expect((await post((await store.create('u1')).code, { items: [item] })).status).toBe(401);
  });

  it('400s anything that is not a short list of card results', async () => {
    const s = await store.create('u1');
    expect((await post(s.code, { items: [{ ...item, crop: 'https://evil.example/x.png' }] })).status).toBe(400);
    expect(await store.listItems(s.code)).toEqual([]);
  });

  it('lets a signed-in non-superadmin in (the scanner is open to every signed-in user)', async () => {
    const { userService } = await import('@/lib/services');
    vi.mocked(userService.getRoles).mockResolvedValueOnce({ success: true, data: { isSuperAdmin: false } } as any);
    expect((await post((await store.create('u1')).code, { items: [item] })).status).toBeLessThan(300);
  });
});
