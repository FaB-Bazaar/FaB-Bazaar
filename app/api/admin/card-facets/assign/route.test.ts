/** Unit tests for /api/admin/card-facets/assign (superadmin OR curator). */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  facetService: { addCardFacetTag: vi.fn(), removeCardFacetTag: vi.fn() },
  userService: { hasRole: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { POST, DELETE } from './route';
import { facetService, userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockAdd = vi.mocked(facetService.addCardFacetTag);
const mockRemove = vi.mocked(facetService.removeCardFacetTag);
const mockHasRole = vi.mocked(userService.hasRole);
const mockAuth = vi.mocked(authenticateRequest);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'admin-1' } as any);
  mockHasRole.mockResolvedValue({ success: true, data: true } as any);
  mockAdd.mockResolvedValue({ success: true, data: { applied: 3 } } as any);
  mockRemove.mockResolvedValue({ success: true, data: { applied: 3 } } as any);
});

const req = (method: string, body: any) =>
  new NextRequest('http://localhost/api/admin/card-facets/assign', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('POST /assign (add)', () => {
  it('adds a tag to a card', async () => {
    const res = await POST(req('POST', { cardUniqueId: 'c1', tag: 'tutor' }));
    expect(res.status).toBe(200);
    expect(mockAdd).toHaveBeenCalledWith('c1', 'tutor');
  });
  it('400 on missing fields', async () => {
    expect((await POST(req('POST', { cardUniqueId: 'c1' }))).status).toBe(400);
    expect(mockAdd).not.toHaveBeenCalled();
  });
  it('400 when the service rejects (unknown tag)', async () => {
    mockAdd.mockResolvedValue({ success: false, error: 'Unknown facet tag: x' } as any);
    expect((await POST(req('POST', { cardUniqueId: 'c1', tag: 'x' }))).status).toBe(400);
  });
  it('403 when not superadmin or curator', async () => {
    mockHasRole.mockResolvedValue({ success: true, data: false } as any);
    expect((await POST(req('POST', { cardUniqueId: 'c1', tag: 'tutor' }))).status).toBe(403);
  });
});

describe('DELETE /assign (remove)', () => {
  it('removes a tag from a card', async () => {
    const res = await DELETE(req('DELETE', { cardUniqueId: 'c1', tag: 'tutor' }));
    expect(res.status).toBe(200);
    expect(mockRemove).toHaveBeenCalledWith('c1', 'tutor');
  });
  it('400 on missing fields', async () => {
    expect((await DELETE(req('DELETE', { tag: 'tutor' }))).status).toBe(400);
    expect(mockRemove).not.toHaveBeenCalled();
  });
});
