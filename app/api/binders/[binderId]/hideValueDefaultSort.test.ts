/**
 * Unit tests for PUT/GET /api/binders/[binderId] — hideValue + defaultSort
 * privacy settings are forwarded to the service layer and exposed on reads.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  binderService: { updateBinder: vi.fn(), getBinder: vi.fn() },
  userService: { getBasicInfo: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

import { PUT, GET } from './route';
import { binderService, userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockUpdate = vi.mocked(binderService.updateBinder);
const mockGetBinder = vi.mocked(binderService.getBinder);
const mockGetBasicInfo = vi.mocked(userService.getBasicInfo);
const mockAuth = vi.mocked(authenticateRequest);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'user-123' } as any);
  mockUpdate.mockResolvedValue({ success: true, data: { _id: 'b1' } } as any);
  mockGetBasicInfo.mockResolvedValue({ success: true, data: { username: 'owner' } } as any);
});

describe('PUT /api/binders/[binderId] — hideValue / defaultSort', () => {
  const put = async (body: Record<string, unknown>) => {
    const req = new NextRequest('http://localhost/api/binders/b1', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
    return PUT(req, { params: Promise.resolve({ binderId: 'b1' }) });
  };

  it('forwards hideValue to binderService.updateBinder', async () => {
    const res = await put({ hideValue: true });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      'b1',
      'user-123',
      expect.objectContaining({ hideValue: true }),
    );
  });

  it('forwards defaultSort to binderService.updateBinder', async () => {
    const res = await put({ defaultSort: 'name' });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      'b1',
      'user-123',
      expect.objectContaining({ defaultSort: 'name' }),
    );
  });

  it('forwards hideValue: false (falsy values must not be dropped)', async () => {
    await put({ hideValue: false });
    expect(mockUpdate).toHaveBeenCalledWith(
      'b1',
      'user-123',
      expect.objectContaining({ hideValue: false }),
    );
  });
});

describe('GET /api/binders/[binderId] — hideValue / defaultSort exposure', () => {
  it('returns hideValue and defaultSort on the binder object', async () => {
    mockGetBinder.mockResolvedValue({
      success: true,
      data: { _id: 'b1', userId: 'user-123', hideValue: true, defaultSort: 'name' },
    } as any);

    const req = new NextRequest('http://localhost/api/binders/b1');
    const res = await GET(req, { params: Promise.resolve({ binderId: 'b1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.binder.hideValue).toBe(true);
    expect(data.binder.defaultSort).toBe('name');
  });
});
