/**
 * Unit tests for GET /api/search/core — languages filter param.
 *
 * Mocked printingsService: verifies the query param is parsed into
 * filters.languages (the set page's flag buttons rely on this).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  printingsService: { searchPrintings: vi.fn() },
}));

import { GET } from './route';
import { printingsService } from '@/lib/services';

const mockSearch = vi.mocked(printingsService.searchPrintings);

const makeRequest = (qs: string) =>
  new NextRequest(`http://localhost/api/search/core?${qs}`);

beforeEach(() => {
  vi.clearAllMocks();
  mockSearch.mockResolvedValue({
    success: true,
    data: { printings: [], totalCount: 0 },
  } as any);
});

describe('GET /api/search/core — languages param', () => {
  it('passes languages through as a filter array', async () => {
    await GET(makeRequest('sets=HVY&languages=en,fr'));

    expect(mockSearch).toHaveBeenCalledTimes(1);
    const [filters] = mockSearch.mock.calls[0];
    expect(filters.languages).toEqual(['en', 'fr']);
  });

  it('omits the languages filter when the param is absent', async () => {
    await GET(makeRequest('sets=HVY'));

    const [filters] = mockSearch.mock.calls[0];
    expect(filters.languages).toBeUndefined();
  });
});
