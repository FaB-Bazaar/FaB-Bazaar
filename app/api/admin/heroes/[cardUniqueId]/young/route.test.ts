/**
 * Route unit tests for PATCH /api/admin/heroes/[cardUniqueId]/young.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/services', () => ({
  printingsService: { setHeroYoung: vi.fn() },
  userService: { getRoles: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateSession: vi.fn() }));

import { PATCH } from './route';
import { printingsService, userService } from '@/lib/services';
import { authenticateSession } from '@/lib/auth/multi-auth';

const setHeroYoung = vi.mocked(printingsService.setHeroYoung);
const getRoles = vi.mocked(userService.getRoles);
const mockAuth = vi.mocked(authenticateSession);

function makePatch(body: unknown) {
  return new Request('http://test/api/admin/heroes/xxx/young', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any;
}

describe('PATCH /api/admin/heroes/[cardUniqueId]/young', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ success: true, userId: 'admin-id' } as any);
    getRoles.mockResolvedValue({ success: true, data: { isSuperAdmin: true } } as any);
    setHeroYoung.mockResolvedValue({ success: true, data: undefined } as any);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'no session' } as any);
    const res = await PATCH(makePatch({ value: true }), {
      params: Promise.resolve({ cardUniqueId: 'abc' }),
    } as any);
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not a superadmin', async () => {
    getRoles.mockResolvedValue({ success: true, data: { isSuperAdmin: false } } as any);
    const res = await PATCH(makePatch({ value: true }), {
      params: Promise.resolve({ cardUniqueId: 'abc' }),
    } as any);
    expect(res.status).toBe(403);
  });

  it('returns 400 when value is not a boolean', async () => {
    const res = await PATCH(makePatch({ value: 'yes' }), {
      params: Promise.resolve({ cardUniqueId: 'abc' }),
    } as any);
    expect(res.status).toBe(400);
  });

  it('returns 200 and forwards value to the service on success', async () => {
    const res = await PATCH(makePatch({ value: true }), {
      params: Promise.resolve({ cardUniqueId: 'hero-1' }),
    } as any);
    expect(res.status).toBe(200);
    expect(setHeroYoung).toHaveBeenCalledWith('hero-1', true);
  });

  it('returns 500 when the service fails', async () => {
    setHeroYoung.mockResolvedValue({ success: false, error: 'boom' } as any);
    const res = await PATCH(makePatch({ value: false }), {
      params: Promise.resolve({ cardUniqueId: 'hero-1' }),
    } as any);
    expect(res.status).toBe(500);
  });
});
