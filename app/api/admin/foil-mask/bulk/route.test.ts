/**
 * Unit tests for POST /api/admin/foil-mask/bulk
 *
 * Mocked foilMaskService — tests HTTP concerns: superadmin gating, which
 * service mode a body dispatches to, and that a dry run never reaches an
 * apply method.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  foilMaskService: {
    applyToSelection: vi.fn(),
    applyToMatch: vi.fn(),
    previewMatch: vi.fn(),
  },
  userService: { getRoles: vi.fn() },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateSession: vi.fn(),
}));

import { POST } from './route';
import { foilMaskService, userService } from '@/lib/services';
import { authenticateSession } from '@/lib/auth/multi-auth';

const mockSelection = vi.mocked(foilMaskService.applyToSelection);
const mockMatch = vi.mocked(foilMaskService.applyToMatch);
const mockPreview = vi.mocked(foilMaskService.previewMatch);
const mockRoles = vi.mocked(userService.getRoles);
const mockAuth = vi.mocked(authenticateSession);

const MASK = { top: 12.5, right: 9.5, bottom: 41.5, left: 9.5, round: '1.5%' };

function req(body: unknown) {
  return new Request('http://localhost/api/admin/foil-mask/bulk', {
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

describe('POST /api/admin/foil-mask/bulk — access', () => {
  it('returns 401 without a session', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);
    const res = await POST(req({ printingIds: ['p1'], ...MASK }));
    expect(res.status).toBe(401);
    expect(mockSelection).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-superadmin', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockRoles.mockResolvedValue({ success: true, data: { isSuperAdmin: false } } as any);
    const res = await POST(req({ printingIds: ['p1'], ...MASK }));
    expect(res.status).toBe(403);
    expect(mockSelection).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/foil-mask/bulk — dry run', () => {
  it('previews a match without applying anything', async () => {
    asSuperAdmin();
    mockPreview.mockResolvedValue({
      success: true,
      data: { wouldUpdate: 11383, skippedLocked: 9, skippedAlreadySet: 1810, setCount: 74, sample: [] },
    } as any);

    const res = await POST(req({ dryRun: true, foiling: 'r', artVariations: [], ...MASK }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.wouldUpdate).toBe(11383);
    expect(mockPreview).toHaveBeenCalled();
    expect(mockMatch).not.toHaveBeenCalled();
    expect(mockSelection).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/foil-mask/bulk — dispatch', () => {
  it('routes a printingIds body to the selection apply', async () => {
    asSuperAdmin();
    mockSelection.mockResolvedValue({ success: true, data: { opId: 'op1', updated: 2, skippedLocked: 0 } } as any);

    const res = await POST(req({ printingIds: ['p1', 'p2'], ...MASK }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.updated).toBe(2);
    expect(mockSelection).toHaveBeenCalledWith(['p1', 'p2'], MASK, expect.objectContaining({ userId: 'u1' }));
    expect(mockMatch).not.toHaveBeenCalled();
  });

  it('routes a criteria body to the match apply', async () => {
    asSuperAdmin();
    mockMatch.mockResolvedValue({ success: true, data: { opId: 'op2', updated: 300, skippedLocked: 1 } } as any);

    const res = await POST(req({ set: '1hp', foiling: 'r', isExtendedArt: false, artVariations: [], ...MASK }));

    expect(res.status).toBe(200);
    expect(mockMatch).toHaveBeenCalledWith(
      expect.objectContaining({ set: '1hp', foiling: 'r', isExtendedArt: false, artVariations: [] }),
      MASK,
      expect.objectContaining({ userId: 'u1' })
    );
    expect(mockSelection).not.toHaveBeenCalled();
  });

  it('rejects a body that names neither a selection nor a foiling', async () => {
    asSuperAdmin();
    const res = await POST(req({ ...MASK }));
    expect(res.status).toBe(400);
    expect(mockMatch).not.toHaveBeenCalled();
    expect(mockSelection).not.toHaveBeenCalled();
  });

  it('surfaces a service failure as a 400 rather than a silent success', async () => {
    asSuperAdmin();
    mockSelection.mockResolvedValue({ success: false, error: 'Select at least one printing' } as any);

    const res = await POST(req({ printingIds: [], foiling: 'r', ...MASK }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Select at least one printing');
  });
});
