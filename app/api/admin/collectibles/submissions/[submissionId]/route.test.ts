/**
 * Unit tests for PATCH /api/admin/collectibles/submissions/[submissionId]
 * (superadmin approve/reject of a crowdsourced submission).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  collectibleService: {
    approveSubmission: vi.fn(),
    rejectSubmission: vi.fn(),
  },
  userService: {
    hasRole: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

import { PATCH } from './route';
import { collectibleService, userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockApprove = vi.mocked(collectibleService.approveSubmission);
const mockReject = vi.mocked(collectibleService.rejectSubmission);
const mockHasRole = vi.mocked(userService.hasRole);
const mockAuth = vi.mocked(authenticateRequest);

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/admin/collectibles/submissions/s-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const params = { params: Promise.resolve({ submissionId: 's-1' }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'admin-1' } as any);
  mockHasRole.mockResolvedValue({ success: true, data: true } as any);
});

describe('PATCH /api/admin/collectibles/submissions/[submissionId]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);

    const res = await PATCH(makeRequest({ action: 'approve' }), params);

    expect(res.status).toBe(401);
  });

  it('returns 403 for non-superadmins', async () => {
    mockHasRole.mockResolvedValue({ success: true, data: false } as any);

    const res = await PATCH(makeRequest({ action: 'approve' }), params);

    expect(res.status).toBe(403);
    expect(mockApprove).not.toHaveBeenCalled();
    expect(mockReject).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid action', async () => {
    const res = await PATCH(makeRequest({ action: 'maybe' }), params);

    expect(res.status).toBe(400);
  });

  it('approve applies the submission with the reviewer id', async () => {
    mockApprove.mockResolvedValue({
      success: true,
      data: { collectible: { id: 'c-1', name: 'Approved Mat' } },
    } as any);

    const res = await PATCH(makeRequest({ action: 'approve' }), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.collectible.id).toBe('c-1');
    expect(mockApprove).toHaveBeenCalledWith('s-1', 'admin-1');
  });

  it('reject closes the submission with the reviewer id', async () => {
    mockReject.mockResolvedValue({ success: true, data: { rejected: true } } as any);

    const res = await PATCH(makeRequest({ action: 'reject' }), params);

    expect(res.status).toBe(200);
    expect(mockReject).toHaveBeenCalledWith('s-1', 'admin-1');
  });

  it('maps not-found to 404', async () => {
    mockApprove.mockResolvedValue({ success: false, error: 'Submission not found' } as any);

    const res = await PATCH(makeRequest({ action: 'approve' }), params);

    expect(res.status).toBe(404);
  });

  it('maps already-reviewed to 409', async () => {
    mockApprove.mockResolvedValue({ success: false, error: 'Submission already reviewed' } as any);

    const res = await PATCH(makeRequest({ action: 'approve' }), params);

    expect(res.status).toBe(409);
  });

  it('returns 500 on other service failures', async () => {
    mockReject.mockResolvedValue({ success: false, error: 'db down' } as any);

    const res = await PATCH(makeRequest({ action: 'reject' }), params);

    expect(res.status).toBe(500);
  });
});
