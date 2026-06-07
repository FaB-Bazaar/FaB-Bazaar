/**
 * Unit tests for the searchClient.searchPrintings() client service.
 *
 * Regression guard: this method historically targeted `/api/search/printings`,
 * a route that does not exist (the real route is `/api/printings/search`).
 * These tests pin the correct endpoint + param shape and the {success,data} unwrap.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchPrintings } from './search-client';

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

describe('searchClient.searchPrintings', () => {
  it('calls the real /api/printings/search endpoint (not /api/search/printings)', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: true, data: { printings: [], total: 0, pages: 0 } }),
    );

    await searchPrintings({ name: 'command' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl: string = fetchMock.mock.calls[0][0];
    expect(calledUrl.startsWith('/api/printings/search?')).toBe(true);
    expect(calledUrl).not.toContain('/api/search/printings');
  });

  it('forwards filters + pagination/sort options as query params', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: true, data: { printings: [], total: 0, pages: 0 } }),
    );

    await searchPrintings({ name: 'command' }, { page: 2, limit: 24, sortBy: 'price', sortOrder: 'desc' });

    const calledUrl: string = fetchMock.mock.calls[0][0];
    const qs = new URLSearchParams(calledUrl.split('?')[1]);
    expect(qs.get('name')).toBe('command');
    expect(qs.get('page')).toBe('2');
    expect(qs.get('limit')).toBe('24');
    expect(qs.get('sortBy')).toBe('price');
    expect(qs.get('sortOrder')).toBe('desc');
  });

  it('applies default page/limit/sort when options are omitted', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({ success: true, data: { printings: [], total: 0, pages: 0 } }),
    );

    await searchPrintings({ name: 'x' });

    const qs = new URLSearchParams((fetchMock.mock.calls[0][0] as string).split('?')[1]);
    expect(qs.get('page')).toBe('1');
    expect(qs.get('limit')).toBe('48');
    expect(qs.get('sortBy')).toBe('name');
    expect(qs.get('sortOrder')).toBe('asc');
  });

  it('unwraps the { success, data } envelope into ApiResponse', async () => {
    const payload = { printings: [{ printing_id: 'p1' }], total: 1, pages: 1 };
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, data: payload }));

    const result = await searchPrintings({ name: 'command' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(payload);
  });
});
