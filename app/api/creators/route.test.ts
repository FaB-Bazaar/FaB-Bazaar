/**
 * Unit tests for GET /api/creators — public list endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  customTokenCardService: { listCreators: vi.fn() },
}));

import { GET } from './route';
import { customTokenCardService } from '@/lib/services';

const mockList = vi.mocked(customTokenCardService.listCreators);

beforeEach(() => vi.clearAllMocks());

describe('GET /api/creators', () => {
  it('returns 200 with the creator list on success', async () => {
    mockList.mockResolvedValue({ success: true, data: [{ id: 'c1' }] } as any);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, data: [{ id: 'c1' }] });
  });

  it('returns 500 when the service errors', async () => {
    mockList.mockResolvedValue({ success: false, error: 'DB down' } as any);

    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('DB down');
  });
});
