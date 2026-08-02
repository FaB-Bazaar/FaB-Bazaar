/**
 * Unit tests for bindersClient.createSetBinder().
 *
 * Wraps POST /api/sets/[setCode]/binder. The route's 409 conflict body is
 * nonstandard: the existing binder rides under `data` BESIDE `error`, which
 * the generic handleResponse drops — so the client parses the body manually
 * and this test pins the repackaged shape.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSetBinder } from './binders-client';

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

describe('bindersClient.createSetBinder', () => {
  it('POSTs foilings + edition and unwraps the result on success', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({
        success: true,
        data: {
          binderId: 'b-1',
          binderName: 'mistercakes - SEA',
          slug: 'mistercakes-sea',
          summary: { total: 250, added: 250, failed: 0 },
        },
      })
    );

    const result = await createSetBinder('sea', { foilings: ['s', 'r'], edition: 'n' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/sets/sea/binder');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ foilings: ['s', 'r'], edition: 'n' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.binderId).toBe('b-1');
      expect(result.data.summary.added).toBe(250);
    }
  });

  it('surfaces the existing binder on a 409 conflict', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse(
        {
          error: 'A binder for this set already exists: "mistercakes - SEA".',
          data: { binderId: 'b-9', binderName: 'mistercakes - SEA', slug: 'mistercakes-sea' },
        },
        false,
        409
      )
    );

    const result = await createSetBinder('sea', { foilings: ['s'] });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('HTTP_409');
      expect(result.existing).toEqual({
        binderId: 'b-9',
        binderName: 'mistercakes - SEA',
        slug: 'mistercakes-sea',
      });
    }
  });

  it('returns the API error on a non-conflict failure', async () => {
    fetchMock.mockResolvedValue(
      mockJsonResponse({ error: 'Select at least one foiling (s, r, or c).' }, false, 400)
    );

    const result = await createSetBinder('sea', { foilings: [] });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/foiling/i);
      expect(result.existing).toBeUndefined();
    }
  });
});
