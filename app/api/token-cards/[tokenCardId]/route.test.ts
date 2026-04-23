/**
 * Unit tests for GET /api/token-cards/[tokenCardId].
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  customTokenCardService: { getTokenCardById: vi.fn() },
}));

import { GET } from './route';
import { customTokenCardService } from '@/lib/services';

const mockGet = vi.mocked(customTokenCardService.getTokenCardById);

const ctx = (tokenCardId: string) => ({ params: Promise.resolve({ tokenCardId }) });

beforeEach(() => vi.clearAllMocks());

describe('GET /api/token-cards/[tokenCardId]', () => {
  it('returns 404 when not found', async () => {
    mockGet.mockResolvedValue({ success: true, data: null } as any);

    const res = await GET({} as any, ctx('nope'));
    expect(res.status).toBe(404);
  });

  it('returns 500 when the service errors', async () => {
    mockGet.mockResolvedValue({ success: false, error: 'fail' } as any);

    const res = await GET({} as any, ctx('x'));
    expect(res.status).toBe(500);
  });

  it('returns 200 with the token card when found', async () => {
    mockGet.mockResolvedValue({ success: true, data: { id: 't1' } } as any);

    const res = await GET({} as any, ctx('t1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, data: { id: 't1' } });
  });
});
