/** Unit tests for the PUBLIC /api/card-facets/suggest route (any signed-in user
 *  proposes a new vocabulary term). Service + auth + rate-limit mocked. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  facetService: { createSuggestion: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn() }));

import { POST } from './route';
import { facetService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { rateLimit } from '@/lib/rate-limit';

const mockCreate = vi.mocked(facetService.createSuggestion);
const mockAuth = vi.mocked(authenticateRequest);
const mockRate = vi.mocked(rateLimit);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'user-1' } as any);
  mockRate.mockResolvedValue({ success: true, remaining: 9 } as any);
  mockCreate.mockResolvedValue({ success: true, data: { id: 's1', status: 'pending' } } as any);
});

const req = (body: any) =>
  new NextRequest('http://localhost/api/card-facets/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/card-facets/suggest', () => {
  it('creates a suggestion attributed to the authenticated user', async () => {
    const res = await POST(req({ dim: 'mechanical', label: 'Combo enabler', def: 'x', rationale: 'y' }));
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ dim: 'mechanical', label: 'Combo enabler', proposedBy: 'user-1' }),
    );
  });

  it('401 when not signed in', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'no' } as any);
    expect((await POST(req({ dim: 'mechanical', label: 'X' }))).status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('400 when label or dim is missing', async () => {
    expect((await POST(req({ dim: 'mechanical' }))).status).toBe(400);
    expect((await POST(req({ label: 'X' }))).status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('429 when rate limited', async () => {
    mockRate.mockResolvedValue({ success: false, remaining: 0 } as any);
    expect((await POST(req({ dim: 'mechanical', label: 'X' }))).status).toBe(429);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('400 when the service rejects', async () => {
    mockCreate.mockResolvedValue({ success: false, error: 'bad dim' } as any);
    expect((await POST(req({ dim: 'bogus', label: 'X' }))).status).toBe(400);
  });
});
