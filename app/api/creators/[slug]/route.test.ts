/**
 * Unit tests for GET /api/creators/[slug].
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  customTokenCardService: {
    getCreatorBySlug: vi.fn(),
    getPublishedTokenCardsByCreator: vi.fn(),
  },
}));

import { GET } from './route';
import { customTokenCardService } from '@/lib/services';

const mockGetBySlug = vi.mocked(customTokenCardService.getCreatorBySlug);
const mockGetTokens = vi.mocked(customTokenCardService.getPublishedTokenCardsByCreator);

const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });

beforeEach(() => vi.clearAllMocks());

describe('GET /api/creators/[slug]', () => {
  it('returns 404 when the creator does not exist', async () => {
    mockGetBySlug.mockResolvedValue({ success: true, data: null } as any);

    const res = await GET({} as any, ctx('unknown'));
    expect(res.status).toBe(404);
  });

  it('returns 500 when the creator lookup errors', async () => {
    mockGetBySlug.mockResolvedValue({ success: false, error: 'DB down' } as any);

    const res = await GET({} as any, ctx('x'));
    expect(res.status).toBe(500);
  });

  it('returns 500 when the token card lookup errors', async () => {
    mockGetBySlug.mockResolvedValue({ success: true, data: { id: 'c1' } } as any);
    mockGetTokens.mockResolvedValue({ success: false, error: 'fail' } as any);

    const res = await GET({} as any, ctx('x'));
    expect(res.status).toBe(500);
  });

  it('returns 200 with both creator + token cards when found', async () => {
    mockGetBySlug.mockResolvedValue({ success: true, data: { id: 'c1', slug: 'x' } } as any);
    mockGetTokens.mockResolvedValue({ success: true, data: [{ id: 't1' }] } as any);

    const res = await GET({} as any, ctx('x'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.creator.id).toBe('c1');
    expect(body.data.tokenCards).toEqual([{ id: 't1' }]);
    expect(mockGetTokens).toHaveBeenCalledWith('c1');
  });
});
