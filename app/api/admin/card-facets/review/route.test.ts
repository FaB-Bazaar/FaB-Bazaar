/**
 * Unit tests for /api/admin/card-facets/review (curator/superadmin) — approve or
 * reject a pending public facet-vote request. Service + auth mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  facetService: { approveFacetVote: vi.fn(), rejectFacetVote: vi.fn() },
  userService: { hasRole: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { POST } from './route';
import { facetService, userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockApprove = vi.mocked(facetService.approveFacetVote);
const mockReject = vi.mocked(facetService.rejectFacetVote);
const mockHasRole = vi.mocked(userService.hasRole);
const mockAuth = vi.mocked(authenticateRequest);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'curator-1' } as any);
  mockHasRole.mockResolvedValue({ success: true, data: true } as any);
  mockApprove.mockResolvedValue({ success: true, data: {} } as any);
  mockReject.mockResolvedValue({ success: true, data: {} } as any);
});

const req = (body: any) =>
  new NextRequest('http://localhost/api/admin/card-facets/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const base = { cardUniqueId: 'c1', tag: 'tutor', userId: 'voter-1' };

describe('POST /api/admin/card-facets/review', () => {
  it('approves a pending vote, passing the reviewer id', async () => {
    const res = await POST(req({ ...base, action: 'approve' }));
    expect(res.status).toBe(200);
    expect(mockApprove).toHaveBeenCalledWith('c1', 'tutor', 'voter-1', 'curator-1');
    expect(mockReject).not.toHaveBeenCalled();
  });

  it('rejects a pending vote, passing the reviewer id', async () => {
    const res = await POST(req({ ...base, action: 'reject' }));
    expect(res.status).toBe(200);
    expect(mockReject).toHaveBeenCalledWith('c1', 'tutor', 'voter-1', 'curator-1');
    expect(mockApprove).not.toHaveBeenCalled();
  });

  it('403 for a non-curator, non-superadmin', async () => {
    mockHasRole.mockResolvedValue({ success: true, data: false } as any);
    expect((await POST(req({ ...base, action: 'approve' }))).status).toBe(403);
    expect(mockApprove).not.toHaveBeenCalled();
  });

  it('401 when not signed in', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'no' } as any);
    expect((await POST(req({ ...base, action: 'approve' }))).status).toBe(401);
  });

  it('400 on an invalid action', async () => {
    expect((await POST(req({ ...base, action: 'nuke' }))).status).toBe(400);
    expect(mockApprove).not.toHaveBeenCalled();
  });

  it('400 on missing fields', async () => {
    expect((await POST(req({ action: 'approve' }))).status).toBe(400);
  });
});
