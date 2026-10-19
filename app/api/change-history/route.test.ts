import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({ binderService: { listChangeHistory: vi.fn() } }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { GET } from './route';
import { binderService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockList = vi.mocked(binderService.listChangeHistory);
const mockAuth = vi.mocked(authenticateRequest);

const req = () => new NextRequest('http://localhost/api/change-history');

beforeEach(() => {
  mockList.mockReset();
  mockAuth.mockReset();
});

describe('GET /api/change-history', () => {
  it('401s when signed out', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("returns the caller's own history", async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockList.mockResolvedValue({ success: true, data: [] });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: [] });
    expect(mockList).toHaveBeenCalledWith('u1');
  });

  it('accepts OAuth bearers (MCP / Volzar clients)', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockList.mockResolvedValue({ success: true, data: [] });
    await GET(req());
    expect(mockAuth).toHaveBeenCalledWith(expect.anything(), {}, { allowOAuth: true });
  });

  it('500s when the service fails', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockList.mockResolvedValue({ success: false, error: 'boom' });
    const res = await GET(req());
    expect(res.status).toBe(500);
  });
});
