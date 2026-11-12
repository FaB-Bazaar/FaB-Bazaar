import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({ binderService: { getUserBindersWithStats: vi.fn() } }));
vi.mock('@/lib/partner-api/auth', () => ({ authenticatePartner: vi.fn() }));

import { GET } from './route';
import { binderService } from '@/lib/services';
import { authenticatePartner } from '@/lib/partner-api/auth';
import { CALLER, DENIED, ctx, get } from '../_test/helpers';

const mockAuth = vi.mocked(authenticatePartner);
const mockList = vi.mocked(binderService.getUserBindersWithStats);

describe('GET /api/partner/v1/binders', () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockList.mockReset();
  });

  it("lists the caller's binders in the partner shape", async () => {
    mockAuth.mockResolvedValue(CALLER);
    mockList.mockResolvedValue({
      success: true,
      data: [
        {
          _id: 'b-1',
          userId: 'user-1',
          name: 'Trades',
          isPublic: false,
          stats: { totalQuantity: 4, totalValue: { tcg_low: 20 } },
        },
      ],
    } as never);

    const response = await GET(get('/binders'), ctx({}));

    expect(mockAuth).toHaveBeenCalledWith(expect.anything(), 'collection:read');
    expect(mockList).toHaveBeenCalledWith('user-1');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: [
        {
          id: 'b-1',
          name: 'Trades',
          slug: null,
          visibility: 'private',
          total_quantity: 4,
          total_value_usd: 20,
          updated_at: null,
        },
      ],
    });
  });

  it('refuses a token without the scope before touching the service', async () => {
    mockAuth.mockResolvedValue(DENIED);

    const response = await GET(get('/binders'), ctx({}));

    expect(response.status).toBe(403);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('answers 500 without the service error text when the lookup fails', async () => {
    mockAuth.mockResolvedValue(CALLER);
    mockList.mockResolvedValue({ success: false, error: 'relation "binders" exploded' } as never);

    const response = await GET(get('/binders'), ctx({}));

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('exploded');
  });
});
