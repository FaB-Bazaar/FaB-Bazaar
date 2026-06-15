import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/mcp-fetch', () => ({
  mcpFetch: vi.fn(),
  getMcpApiBaseUrl: () => 'http://test.local',
}));

import { updateBinderTool } from './updateBinder';
import { mcpFetch } from '@/lib/mcp-fetch';

const mockFetch = vi.mocked(mcpFetch);

// Minimal fetch.Response stand-in for the two calls the handler makes.
function res(body: any, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as any;
}

// First call: GET /api/binders?summary=true. Second: POST .../cards.
function wireBinderThenAdd() {
  mockFetch
    .mockResolvedValueOnce(res({ success: true, binders: [{ slug: 'ahhhh', _id: 'b1', name: 'ahhhh' }] }))
    .mockResolvedValueOnce(res({ success: true, summary: { total: 1, added: 1, updated: 0 }, results: [] }));
}

function lastPostBody() {
  const postCall = mockFetch.mock.calls.find(c => (c[1] as any)?.method === 'POST');
  return JSON.parse((postCall![1] as any).body);
}

describe('add_to_binder — forTrade default', () => {
  beforeEach(() => mockFetch.mockReset());

  it('defaults forTrade to FALSE when omitted (adding to a collection ≠ listing for trade)', async () => {
    wireBinderThenAdd();

    await updateBinderTool.handler(
      { binderSlug: 'ahhhh', printings: [{ printingId: 'p1', quantity: 3 }] },
      undefined,
      'tok',
    );

    expect(lastPostBody().printings[0].forTrade).toBe(false);
  });

  it('honors an explicit forTrade: true', async () => {
    wireBinderThenAdd();

    await updateBinderTool.handler(
      { binderSlug: 'ahhhh', printings: [{ printingId: 'p1', quantity: 1, forTrade: true }] },
      undefined,
      'tok',
    );

    expect(lastPostBody().printings[0].forTrade).toBe(true);
  });

  it('honors an explicit forTrade: false', async () => {
    wireBinderThenAdd();

    await updateBinderTool.handler(
      { binderSlug: 'ahhhh', printings: [{ printingId: 'p1', forTrade: false }] },
      undefined,
      'tok',
    );

    expect(lastPostBody().printings[0].forTrade).toBe(false);
  });
});
