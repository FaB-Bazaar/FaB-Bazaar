/**
 * Unit tests for the search-client additions used by deck surfaces:
 *
 * - searchCoreByCard: GET /api/search/core?cardUniqueId=… (the printing
 *   comparison dialogs' all-printings-of-one-card lookup)
 * - searchPrintingsAdvanced: POST /api/printings/search with { filters,
 *   options } as the body (CardCatalogPanel's structured search)
 * - searchPrintings signal passthrough: QuickAddCardDialog aborts in-flight
 *   searches on keystroke; the wrapper must forward the AbortSignal.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  searchCoreByCard,
  searchPrintingsAdvanced,
  searchPrintings,
} from './search-client';

function mockJsonResponse(body: any, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('searchClient.searchCoreByCard', () => {
  it('GETs /api/search/core with the encoded cardUniqueId and limit', async () => {
    const payload = { printings: [{ printing_id: 'p1' }] };
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, data: payload }));

    const result = await searchCoreByCard('card/1', 100);

    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/search/core?cardUniqueId=card%2F1&limit=100',
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(payload);
  });
});

describe('searchClient.searchPrintingsAdvanced', () => {
  it('POSTs { filters, options } as the JSON body', async () => {
    const payload = { printings: [], total: 0 };
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, data: payload }));

    const filters = { name: 'snatch', show: 'unique' };
    const options = { page: 2, limit: 24, sortBy: 'name' as const, sortOrder: 'asc' as const };
    const result = await searchPrintingsAdvanced(filters, options);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/printings/search');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ filters, options });
    expect(result.success).toBe(true);
  });
});

describe('searchClient.searchPrintings signal passthrough', () => {
  it('forwards an AbortSignal to fetch', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: true, data: { printings: [] } }),
    );
    const controller = new AbortController();

    await searchPrintings({ name: 'x' }, { limit: 50, signal: controller.signal });

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.signal).toBe(controller.signal);
  });

  it('still fetches with no init when no signal is given', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: true, data: { printings: [] } }),
    );

    await searchPrintings({ name: 'x' });

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.signal ?? undefined).toBeUndefined();
  });
});
