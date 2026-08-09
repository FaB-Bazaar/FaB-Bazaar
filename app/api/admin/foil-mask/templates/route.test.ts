/**
 * Unit tests for GET/POST /api/admin/foil-mask/templates — the named inset
 * presets shown in the mask editor's template rail.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  foilMaskService: { listTemplates: vi.fn(), createTemplate: vi.fn() },
  userService: { getRoles: vi.fn() },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateSession: vi.fn(),
}));

import { GET, POST } from './route';
import { foilMaskService, userService } from '@/lib/services';
import { authenticateSession } from '@/lib/auth/multi-auth';

const mockList = vi.mocked(foilMaskService.listTemplates);
const mockCreate = vi.mocked(foilMaskService.createTemplate);
const mockRoles = vi.mocked(userService.getRoles);
const mockAuth = vi.mocked(authenticateSession);

const MASK = { top: 12.5, right: 9.5, bottom: 41.5, left: 9.5, round: '1.5%' };

function getReq() {
  return new Request('http://localhost/api/admin/foil-mask/templates') as any;
}

function postReq(body: unknown) {
  return new Request('http://localhost/api/admin/foil-mask/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any;
}

function asSuperAdmin() {
  mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
  mockRoles.mockResolvedValue({ success: true, data: { isSuperAdmin: true } } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/admin/foil-mask/templates', () => {
  it('returns 403 for a non-superadmin', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockRoles.mockResolvedValue({ success: true, data: { isSuperAdmin: false } } as any);
    expect((await GET(getReq())).status).toBe(403);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('returns the template rail', async () => {
    asSuperAdmin();
    mockList.mockResolvedValue({
      success: true,
      data: [{ id: 't1', name: 'Standard frame — WTR', ...MASK, notes: null, sortOrder: 10 }],
    } as any);

    const res = await GET(getReq());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data[0].name).toBe('Standard frame — WTR');
  });
});

describe('POST /api/admin/foil-mask/templates', () => {
  it('creates a template attributed to the caller', async () => {
    asSuperAdmin();
    mockCreate.mockResolvedValue({ success: true, data: { id: 't2', name: 'Borderless', ...MASK, notes: null, sortOrder: 1000 } } as any);

    const res = await POST(postReq({ name: 'Borderless', ...MASK }));

    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Borderless', userId: 'u1' }));
  });

  it('surfaces a duplicate name as a 400', async () => {
    asSuperAdmin();
    mockCreate.mockResolvedValue({ success: false, error: 'A template with that name already exists' } as any);

    const res = await POST(postReq({ name: 'Borderless', ...MASK }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('A template with that name already exists');
  });
});
