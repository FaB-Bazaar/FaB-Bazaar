/** Unit tests for /api/admin/card-facets/tags (superadmin OR curator). */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  facetService: { getTagUsageCounts: vi.fn(), createTagDefinition: vi.fn(), deleteTagDefinition: vi.fn() },
  userService: { hasRole: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { GET, POST, DELETE } from './route';
import { facetService, userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockCounts = vi.mocked(facetService.getTagUsageCounts);
const mockCreate = vi.mocked(facetService.createTagDefinition);
const mockDelete = vi.mocked(facetService.deleteTagDefinition);
const mockHasRole = vi.mocked(userService.hasRole);
const mockAuth = vi.mocked(authenticateRequest);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'admin-1' } as any);
  mockHasRole.mockResolvedValue({ success: true, data: true } as any);
  mockCounts.mockResolvedValue({ success: true, data: [{ id: 'tutor', dim: 'mechanical', label: 'Tutor', def: '', draft: false, cardCount: 3 }] } as any);
  mockCreate.mockResolvedValue({ success: true, data: { id: 'x', dim: 'mechanical', label: 'X', def: '', draft: false } } as any);
  mockDelete.mockResolvedValue({ success: true, data: { deleted: true } } as any);
});

const getReq = () => new NextRequest('http://localhost/api/admin/card-facets/tags');
const postReq = (body: any) => new NextRequest('http://localhost/api/admin/card-facets/tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const delReq = (qs: string) => new NextRequest('http://localhost/api/admin/card-facets/tags' + qs, { method: 'DELETE' });

describe('GET /tags', () => {
  it('returns tag definitions with counts', async () => {
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    expect((await res.json()).data[0].id).toBe('tutor');
  });
  it('403 when not superadmin or curator', async () => {
    mockHasRole.mockResolvedValue({ success: true, data: false } as any);
    expect((await GET(getReq())).status).toBe(403);
  });
  it('401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'no' } as any);
    expect((await GET(getReq())).status).toBe(401);
  });
});

describe('POST /tags', () => {
  it('creates a tag', async () => {
    const res = await POST(postReq({ id: 'my-tag', dim: 'mechanical', label: 'My Tag' }));
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith({ id: 'my-tag', dim: 'mechanical', label: 'My Tag', def: undefined, draft: undefined });
  });
  it('400 when the service rejects the input', async () => {
    mockCreate.mockResolvedValue({ success: false, error: 'bad slug' } as any);
    expect((await POST(postReq({ id: 'Bad!', dim: 'mechanical', label: 'x' }))).status).toBe(400);
  });
  it('400 when required fields are missing', async () => {
    expect((await POST(postReq({ dim: 'mechanical' }))).status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('DELETE /tags', () => {
  it('deletes an unassigned tag', async () => {
    const res = await DELETE(delReq('?id=my-tag'));
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith('my-tag');
  });
  it('409 when the tag is assigned', async () => {
    mockDelete.mockResolvedValue({ success: false, error: 'Tag is assigned to one or more cards; unassign it first.' } as any);
    expect((await DELETE(delReq('?id=tutor'))).status).toBe(409);
  });
  it('400 when id is missing', async () => {
    expect((await DELETE(delReq(''))).status).toBe(400);
  });
});
