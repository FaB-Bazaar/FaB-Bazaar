/** Unit tests for /api/admin/card-facets/suggestions (curator/superadmin).
 *  GET lists the queue; PATCH approves/rejects. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  facetService: { listSuggestions: vi.fn(), approveSuggestion: vi.fn(), rejectSuggestion: vi.fn() },
  userService: { hasRole: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { GET, PATCH } from './route';
import { facetService, userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockList = vi.mocked(facetService.listSuggestions);
const mockApprove = vi.mocked(facetService.approveSuggestion);
const mockReject = vi.mocked(facetService.rejectSuggestion);
const mockHasRole = vi.mocked(userService.hasRole);
const mockAuth = vi.mocked(authenticateRequest);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'admin-1' } as any);
  mockHasRole.mockResolvedValue({ success: true, data: true } as any);
  mockList.mockResolvedValue({ success: true, data: [{ id: 's1', status: 'pending' }] } as any);
  mockApprove.mockResolvedValue({ success: true, data: { id: 'combo-enabler' } } as any);
  mockReject.mockResolvedValue({ success: true, data: { rejected: true } } as any);
});

const get = (qs = '') => new NextRequest(`http://localhost/api/admin/card-facets/suggestions${qs}`);
const patch = (body: any) =>
  new NextRequest('http://localhost/api/admin/card-facets/suggestions', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('GET /suggestions', () => {
  it('lists pending suggestions by default', async () => {
    const res = await GET(get());
    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith('pending');
  });

  it('403 for a non-curator', async () => {
    mockHasRole.mockResolvedValue({ success: true, data: false } as any);
    expect((await GET(get())).status).toBe(403);
  });
});

describe('PATCH /suggestions', () => {
  it('approves a suggestion with the reviewer id', async () => {
    const res = await PATCH(patch({ id: 's1', action: 'approve' }));
    expect(res.status).toBe(200);
    expect(mockApprove).toHaveBeenCalledWith('s1', 'admin-1', undefined);
  });

  it('passes curator slug overrides through on approve', async () => {
    await PATCH(patch({ id: 's1', action: 'approve', overrides: { id: 'clean-slug' } }));
    expect(mockApprove).toHaveBeenCalledWith('s1', 'admin-1', { id: 'clean-slug' });
  });

  it('rejects a suggestion with the reviewer id', async () => {
    const res = await PATCH(patch({ id: 's1', action: 'reject' }));
    expect(res.status).toBe(200);
    expect(mockReject).toHaveBeenCalledWith('s1', 'admin-1');
  });

  it('400 on an unknown action', async () => {
    expect((await PATCH(patch({ id: 's1', action: 'nope' }))).status).toBe(400);
  });

  it('400 when id is missing', async () => {
    expect((await PATCH(patch({ action: 'approve' }))).status).toBe(400);
  });

  it('400 when the service rejects (slug taken)', async () => {
    mockApprove.mockResolvedValue({ success: false, error: 'exists' } as any);
    expect((await PATCH(patch({ id: 's1', action: 'approve' }))).status).toBe(400);
  });
});
