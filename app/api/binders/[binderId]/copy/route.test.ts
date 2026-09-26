import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  binderService: {
    getBinder: vi.fn(),
    findBinderByIdOrSlug: vi.fn(),
    copyBinder: vi.fn(),
  },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { POST } from './route';
import { binderService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockAuth = vi.mocked(authenticateRequest);
const mockGetBinder = vi.mocked(binderService.getBinder);
const mockFind = vi.mocked(binderService.findBinderByIdOrSlug);
const mockCopy = vi.mocked(binderService.copyBinder);

function call(binderId = 'src-binder') {
  const req = new NextRequest(`http://localhost/api/binders/${binderId}/copy`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return POST(req, { params: Promise.resolve({ binderId }) });
}

describe('POST /api/binders/[binderId]/copy', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuth.mockResolvedValue({ success: true, userId: 'copier' } as any);
    mockGetBinder.mockResolvedValue({
      success: true,
      data: { _id: 'src-binder', name: 'Trade Stock', slug: 'trade-stock' },
    } as any);
    mockFind.mockResolvedValue({ success: true, data: null } as any);
    mockCopy.mockResolvedValue({
      success: true,
      data: { _id: 'new-binder-id', name: 'Copy of Trade Stock', slug: 'copy-trade-stock' },
    } as any);
  });

  // The client (bindersClient.copyBinder → handleResponse) reads `data` and
  // ExportModal navigates to /binder/${data._id} — without `data` it went to
  // /binder/undefined even though the copy succeeded.
  it('returns the new binder under data so the client can navigate to it', async () => {
    const res = await call();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data._id).toBe('new-binder-id');
    expect(body.data.slug).toBe('copy-trade-stock');
  });

  it('401s when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'nope' } as any);
    const res = await call();
    expect(res.status).toBe(401);
    expect(mockCopy).not.toHaveBeenCalled();
  });
});
