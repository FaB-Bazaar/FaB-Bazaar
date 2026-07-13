/** Unit tests for the PUBLIC read of the facet vocabulary. No auth required. */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  facetService: { getTagUsageCounts: vi.fn() },
}));

import { GET } from './route';
import { facetService } from '@/lib/services';

const mockCounts = vi.mocked(facetService.getTagUsageCounts);

beforeEach(() => {
  vi.clearAllMocks();
  mockCounts.mockResolvedValue({
    success: true,
    data: [{ id: 'tutor', dim: 'mechanical', label: 'Tutor', def: '', draft: false, cardCount: 3 }],
  } as any);
});

describe('GET /api/card-facets/tags (public vocabulary)', () => {
  it('returns the vocabulary without requiring auth', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data[0].id).toBe('tutor');
  });

  it('500 when the service fails', async () => {
    mockCounts.mockResolvedValue({ success: false, error: 'db down' } as any);
    expect((await GET()).status).toBe(500);
  });
});
