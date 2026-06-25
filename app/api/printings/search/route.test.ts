/**
 * Unit tests for GET /api/printings/search option forwarding.
 *
 * Focused on groupByCard: the deck editor's card search relies on card-level
 * grouping so its result limit counts CARDS, not printings (otherwise a single
 * heavily-reprinted card — e.g. "Gustwave" — eats the whole page).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  printingsService: { searchPrintings: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
  hasAuthParams: vi.fn(() => false),
}));

import { GET } from './route';
import { printingsService } from '@/lib/services';
import { NextRequest } from 'next/server';

const mockSearch = vi.mocked(printingsService.searchPrintings);

beforeEach(() => {
  vi.clearAllMocks();
  mockSearch.mockResolvedValue({
    success: true,
    data: { printings: [], total: 0, page: 1, pages: 0, queryInfo: { executionTime: 1, filters: {} } },
  } as any);
});

const call = (qs: string) => GET(new NextRequest(`http://localhost/api/printings/search?${qs}`));

describe('GET /api/printings/search — groupByCard forwarding', () => {
  it('forwards groupByCard=true into the service options', async () => {
    await call('name=gustwave&groupByCard=true');
    expect(mockSearch).toHaveBeenCalledTimes(1);
    const options = mockSearch.mock.calls[0][1];
    expect(options?.groupByCard).toBe(true);
  });

  it('leaves groupByCard unset when the param is absent (flat default preserved)', async () => {
    await call('name=gustwave');
    const options = mockSearch.mock.calls[0][1];
    expect(options?.groupByCard).toBeUndefined();
  });
});

describe('GET /api/printings/search — tcgGroup (pack) filter forwarding', () => {
  it('parses a single tcgGroup id into filters.tcgGroupIds', async () => {
    await call('sets=gem&tcgGroup=24720');
    const filters = mockSearch.mock.calls[0][0];
    expect(filters.tcgGroupIds).toEqual([24720]);
  });

  it('parses a comma-separated list of pack ids', async () => {
    await call('sets=gem&tcgGroup=24176,24720');
    const filters = mockSearch.mock.calls[0][0];
    expect(filters.tcgGroupIds).toEqual([24176, 24720]);
  });

  it('leaves tcgGroupIds unset when the param is absent', async () => {
    await call('sets=gem');
    const filters = mockSearch.mock.calls[0][0];
    expect(filters.tcgGroupIds).toBeUndefined();
  });

  it('ignores non-numeric junk rather than passing NaN', async () => {
    await call('sets=gem&tcgGroup=abc');
    const filters = mockSearch.mock.calls[0][0];
    expect(filters.tcgGroupIds).toBeUndefined();
  });
});
