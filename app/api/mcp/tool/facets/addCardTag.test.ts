/**
 * Unit tests for the add_card_tag / remove_card_tag MCP handlers
 * (curator/superadmin).
 *
 * Thin orchestrators over /api/admin/card-facets/assign (POST / DELETE), which
 * enforces the role. These ASSIGN an existing vocabulary tag to a card — the
 * curator-authoritative layer, distinct from create_tag (vocabulary) and from
 * the community voting on /tags. The id contract (card_unique_id, never
 * printing_id) is pinned here via the descriptions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/mcp-fetch', () => ({
  getMcpApiBaseUrl: () => 'http://localhost:3000',
  mcpFetch: vi.fn(),
}));
vi.mock('../../resource/facetTags', () => ({
  invalidateFacetTagsCache: vi.fn(),
}));

import { addCardTagTool } from './addCardTag';
import { removeCardTagTool } from './removeCardTag';
import { mcpFetch } from '@/lib/mcp-fetch';
import { invalidateFacetTagsCache } from '../../resource/facetTags';

const mockFetch = vi.mocked(mcpFetch);
const mockInvalidate = vi.mocked(invalidateFacetTagsCache);

const ok = (data: any) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });

const auth = { mcpToken: 'tok' };

const params = { cardUniqueId: 'cLHGKMCjPb89zwNPmMFBp', tag: 'fatigue-answer' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('addCardTagTool contract', () => {
  it('is named add_card_tag and requires cardUniqueId and tag', () => {
    expect(addCardTagTool.name).toBe('add_card_tag');
    expect(addCardTagTool.parameters.required).toEqual(['cardUniqueId', 'tag']);
  });

  it('description pins the id contract: card_unique_id, explicitly NOT printing_id', () => {
    expect(addCardTagTool.description).toContain('card_unique_id');
    expect(addCardTagTool.description).toMatch(/NOT (a )?printing_id/i);
  });

  it('description disambiguates assignment from vocabulary creation (names create_tag)', () => {
    expect(addCardTagTool.description).toContain('create_tag');
  });
});

describe('addCardTagTool.handler', () => {
  it('POSTs to the admin assign route with the caller bearer', async () => {
    mockFetch.mockResolvedValue(ok({ applied: 3 }) as any);

    const res = await addCardTagTool.handler(params, auth, 'tok');

    expect(res.success).toBe(true);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('/api/admin/card-facets/assign');
    expect(opts!.method).toBe('POST');
    expect((opts!.headers as any).Authorization).toBe('Bearer tok');
    expect(JSON.parse(String(opts!.body))).toEqual(params);
  });

  it('reports how many variants the tag fanned out to and invalidates the vocabulary cache', async () => {
    mockFetch.mockResolvedValue(ok({ applied: 3 }) as any);

    const res = await addCardTagTool.handler(params, auth, 'tok');

    expect(res.message).toContain('3');
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });

  it("passes scope 'card' through for per-pitch assignments", async () => {
    mockFetch.mockResolvedValue(ok({ applied: 1 }) as any);

    await addCardTagTool.handler({ ...params, scope: 'card' }, auth, 'tok');

    expect(JSON.parse(String(mockFetch.mock.calls[0][1]!.body))).toEqual({ ...params, scope: 'card' });
  });

  it('errors without fetching on an invalid scope', async () => {
    const res = await addCardTagTool.handler({ ...params, scope: 'everything' }, auth, 'tok');

    expect(res.success).toBe(false);
    expect(res.error).toContain('name');
    expect(res.error).toContain('card');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('errors without fetching when cardUniqueId or tag is missing', async () => {
    const res = await addCardTagTool.handler({ tag: 'fatigue-answer' }, auth, 'tok');

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/cardUniqueId/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('surfaces a role error on 403 and does not invalidate', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403, text: async () => 'Forbidden' } as any);

    const res = await addCardTagTool.handler(params, auth, 'tok');

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/curator|admin/i);
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it('propagates API errors (e.g. unknown tag) so the client knows to create_tag first', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: 'unknown tag: fatigue-answer' }),
    } as any);

    const res = await addCardTagTool.handler(params, auth, 'tok');

    expect(res.success).toBe(false);
    expect(res.error).toContain('unknown tag');
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});

describe('removeCardTagTool.handler', () => {
  it('is named remove_card_tag and DELETEs against the same assign route', async () => {
    mockFetch.mockResolvedValue(ok({ applied: 3 }) as any);

    const res = await removeCardTagTool.handler(params, auth, 'tok');

    expect(removeCardTagTool.name).toBe('remove_card_tag');
    expect(res.success).toBe(true);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('/api/admin/card-facets/assign');
    expect(opts!.method).toBe('DELETE');
    expect(JSON.parse(String(opts!.body))).toEqual(params);
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });

  it('errors without fetching when tag is missing', async () => {
    const res = await removeCardTagTool.handler({ cardUniqueId: params.cardUniqueId }, auth, 'tok');

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/tag/);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
