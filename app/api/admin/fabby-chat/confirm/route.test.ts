/**
 * Route unit tests for the destructive-tool confirm endpoint: auth gates,
 * body validation, and resolution against the real in-memory registry.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/services', () => ({
  userService: { hasRole: vi.fn() },
}));

// Import AFTER mocks (vi.mock is hoisted)
import { POST } from './route';
import { auth } from '@/auth';
import { userService } from '@/lib/services';
import { waitForConfirmation } from '@/lib/ai/confirmations';

const mockAuth = vi.mocked(auth as unknown as () => Promise<any>);
const mockHasRole = vi.mocked(userService.hasRole);

function request(body: unknown): Request {
  return new Request('http://localhost:3000/api/admin/fabby-chat/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'user-1', name: 'mistercakes' } });
  mockHasRole.mockResolvedValue({ success: true, data: true } as any);
});

describe('POST /api/admin/fabby-chat/confirm', () => {
  it('401s without a session', async () => {
    mockAuth.mockResolvedValue(null);
    expect((await POST(request({ id: 'c1', decision: 'confirm' }))).status).toBe(401);
  });

  it('403s for non-superadmins', async () => {
    mockHasRole.mockResolvedValue({ success: true, data: false } as any);
    expect((await POST(request({ id: 'c1', decision: 'confirm' }))).status).toBe(403);
  });

  it('400s on malformed bodies', async () => {
    expect((await POST(request({}))).status).toBe(400);
    expect((await POST(request({ id: 'c1' }))).status).toBe(400);
    expect((await POST(request({ id: 'c1', decision: 'maybe' }))).status).toBe(400);
    expect((await POST(request({ id: 42, decision: 'confirm' }))).status).toBe(400);
  });

  it('404s when nothing is pending under that id', async () => {
    const res = await POST(request({ id: 'ghost', decision: 'confirm' }));
    expect(res.status).toBe(404);
  });

  it('resolves a pending confirmation for the session user', async () => {
    const pendingDecision = waitForConfirmation({ userId: 'user-1', id: 'c1' });
    const res = await POST(request({ id: 'c1', decision: 'confirm' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { resolved: true } });
    await expect(pendingDecision).resolves.toBe('confirm');
  });

  it('cannot resolve another user\'s pending confirmation', async () => {
    const otherUsers = waitForConfirmation({ userId: 'someone-else', id: 'c9' });
    const res = await POST(request({ id: 'c9', decision: 'confirm' }));
    expect(res.status).toBe(404);
    // still pending for its owner — deny it to clean up
    const { resolveConfirmation } = await import('@/lib/ai/confirmations');
    expect(resolveConfirmation('someone-else', 'c9', 'deny')).toBe(true);
    await expect(otherUsers).resolves.toBe('deny');
  });

  it('passes deny through', async () => {
    const pendingDecision = waitForConfirmation({ userId: 'user-1', id: 'c2' });
    const res = await POST(request({ id: 'c2', decision: 'deny' }));
    expect(res.status).toBe(200);
    await expect(pendingDecision).resolves.toBe('deny');
  });
});
