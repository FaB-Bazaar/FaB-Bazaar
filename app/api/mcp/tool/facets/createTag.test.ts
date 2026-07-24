/**
 * Unit tests for the create_tag MCP handler (curator/superadmin).
 *
 * Thin orchestrator over POST /api/admin/card-facets/tags (which enforces the
 * role). Creates a facet VOCABULARY DEFINITION only — it never tags a card;
 * that split (create_tag vs add_card_tag) is load-bearing for MCP clients and
 * pinned here via the descriptions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/mcp-fetch', () => ({
  getMcpApiBaseUrl: () => 'http://localhost:3000',
  mcpFetch: vi.fn(),
}));
vi.mock('../../resource/facetTags', () => ({
  invalidateFacetTagsCache: vi.fn(),
}));

import { createTagTool } from './createTag';
import { mcpFetch } from '@/lib/mcp-fetch';
import { invalidateFacetTagsCache } from '../../resource/facetTags';

const mockFetch = vi.mocked(mcpFetch);
const mockInvalidate = vi.mocked(invalidateFacetTagsCache);

const ok = (data: any) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });

const auth = { mcpToken: 'tok' };

const params = {
  id: 'fatigue-answer',
  dim: 'strategic',
  label: 'Fatigue answer',
  def: 'Breaks a fatigue lock by generating value from an empty hand.',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createTagTool contract', () => {
  it('is named create_tag and requires id, dim and label', () => {
    expect(createTagTool.name).toBe('create_tag');
    expect(createTagTool.parameters.required).toEqual(['id', 'dim', 'label']);
  });

  it('description disambiguates definition-creation from card-tagging (names add_card_tag)', () => {
    expect(createTagTool.description).toContain('add_card_tag');
    expect(createTagTool.description).toMatch(/does not tag any card/i);
  });
});

describe('createTagTool.handler', () => {
  it('POSTs the definition to the admin tags route with the caller bearer', async () => {
    mockFetch.mockResolvedValue(ok({ ...params, draft: false }) as any);

    const res = await createTagTool.handler(params, auth, 'tok');

    expect(res.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('/api/admin/card-facets/tags');
    expect(opts!.method).toBe('POST');
    expect((opts!.headers as any).Authorization).toBe('Bearer tok');
    expect(JSON.parse(String(opts!.body))).toMatchObject(params);
  });

  it('invalidates the fab://facet-tags cache on success so the new tag surfaces immediately', async () => {
    mockFetch.mockResolvedValue(ok({ ...params, draft: false }) as any);

    const res = await createTagTool.handler(params, auth, 'tok');

    expect(res.success).toBe(true);
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });

  it('mentions the created tag id and the add_card_tag next step in the message', async () => {
    mockFetch.mockResolvedValue(ok({ ...params, draft: false }) as any);

    const res = await createTagTool.handler(params, auth, 'tok');

    expect(res.message).toContain('fatigue-answer');
    expect(res.message).toContain('add_card_tag');
  });

  it('errors without fetching when id is not a kebab-case slug', async () => {
    const res = await createTagTool.handler({ ...params, id: 'Not A Slug!' }, auth, 'tok');

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/kebab-case|lowercase/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('errors without fetching on an unknown dimension, naming the valid ones', async () => {
    const res = await createTagTool.handler({ ...params, dim: 'vibes' }, auth, 'tok');

    expect(res.success).toBe(false);
    expect(res.error).toContain('mechanical');
    expect(res.error).toContain('strategic');
    expect(res.error).toContain('synergy');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('errors without fetching when label is missing', async () => {
    const res = await createTagTool.handler({ id: 'x-tag', dim: 'mechanical' }, auth, 'tok');

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/label/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('errors when no token is available', async () => {
    const res = await createTagTool.handler(params, undefined, undefined);

    expect(res.success).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('surfaces a role error on 403 and does NOT invalidate the cache', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403, text: async () => 'Forbidden' } as any);

    const res = await createTagTool.handler(params, auth, 'tok');

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/curator|admin/i);
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it('propagates the API error body (e.g. duplicate id) without invalidating', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: 'tag already exists' }),
    } as any);

    const res = await createTagTool.handler(params, auth, 'tok');

    expect(res.success).toBe(false);
    expect(res.error).toContain('tag already exists');
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it('passes draft through when set', async () => {
    mockFetch.mockResolvedValue(ok({ ...params, draft: true }) as any);

    await createTagTool.handler({ ...params, draft: true }, auth, 'tok');

    expect(JSON.parse(String(mockFetch.mock.calls[0][1]!.body))).toMatchObject({ draft: true });
  });
});
