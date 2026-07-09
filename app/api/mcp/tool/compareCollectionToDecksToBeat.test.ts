import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/mcp-fetch', () => ({
  mcpFetch: vi.fn(),
  getMcpApiBaseUrl: () => 'http://test',
}));

import { compareCollectionToDecksToBeatTool } from './compareCollectionToDecksToBeat';
import { mcpFetch } from '@/lib/mcp-fetch';

const mockFetch = vi.mocked(mcpFetch);
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => '' }) as never;

const FEATURED = [
  { publicId: 'd1', name: 'Bravo Control', heroName: 'Bravo', format: 'Classic Constructed', eventName: 'The Calling', placing: 1 },
  { publicId: 'd2', name: 'Kano Combo', heroName: 'Kano', format: 'Classic Constructed', eventName: 'The Calling', placing: 2 },
];

const COVERAGE = [
  { publicId: 'd2', deckName: 'Kano Combo', heroName: 'Kano', format: 'Classic Constructed', totalNeeded: 80, totalOwned: 72, coveragePct: 90, missingCards: 3, missingCost: 12.5, topMissing: [{ printingId: 'p1', cardName: 'Crucible of Aetherweave', shortage: 1, tcgLow: 8 }] },
  { publicId: 'd1', deckName: 'Bravo Control', heroName: 'Bravo', format: 'Classic Constructed', totalNeeded: 80, totalOwned: 20, coveragePct: 25, missingCards: 40, missingCost: 310, topMissing: [] },
];

function wire({ coverageBody }: { coverageBody?: unknown } = {}) {
  mockFetch.mockImplementation(((url: string) => {
    if (url.includes('/api/decks/featured-latest-month')) {
      return Promise.resolve(ok({ success: true, data: { year: 2026, month: 6 } }));
    }
    if (url.includes('/api/decks/community')) {
      return Promise.resolve(ok({ success: true, data: { decks: FEATURED, total: FEATURED.length } }));
    }
    if (url.includes('/api/decks/coverage')) {
      return Promise.resolve(ok(coverageBody ?? { success: true, data: COVERAGE }));
    }
    return Promise.resolve(ok({ success: false, error: 'unexpected url ' + url }));
  }) as never);
}

beforeEach(() => vi.clearAllMocks());

describe('compare_collection_to_decks_to_beat', () => {
  it('requires an auth token', async () => {
    const res = await compareCollectionToDecksToBeatTool.handler({}, undefined, undefined);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/auth/i);
  });

  it('resolves the featured month, batches coverage, and returns ranked rows', async () => {
    wire();
    const res = await compareCollectionToDecksToBeatTool.handler({}, { id: 'u1' }, 'tok-123');
    expect(res.success).toBe(true);

    // coverage endpoint got the featured deck ids and the caller's bearer
    const covCall = mockFetch.mock.calls.find(([url]) => (url as string).includes('/api/decks/coverage'))!;
    expect(covCall).toBeTruthy();
    const covOpts = covCall[1] as any;
    expect(covOpts.method).toBe('POST');
    expect(covOpts.headers.Authorization).toBe('Bearer tok-123');
    expect(JSON.parse(covOpts.body).deckIds).toEqual(['d1', 'd2']);

    // rows come back ranked as the API returned them, with event context merged in
    expect(res.decks).toHaveLength(2);
    expect(res.decks![0]).toMatchObject({ publicId: 'd2', coveragePct: 90, eventName: 'The Calling', placing: 2 });
    expect(res.decks![1]).toMatchObject({ publicId: 'd1', coveragePct: 25 });

    // message is human-readable and leads with the most buildable deck
    expect(res.message).toMatch(/Kano Combo/);
    expect(res.message).toMatch(/90%/);
    expect(res.message).toMatch(/June 2026/);
  });

  it('handles months with no featured decks', async () => {
    mockFetch.mockImplementation(((url: string) => {
      if (url.includes('featured-latest-month')) return Promise.resolve(ok({ success: true, data: { year: 2026, month: 6 } }));
      if (url.includes('/api/decks/community')) return Promise.resolve(ok({ success: true, data: { decks: [], total: 0 } }));
      return Promise.resolve(ok({ success: false, error: 'unexpected' }));
    }) as never);
    const res = await compareCollectionToDecksToBeatTool.handler({}, { id: 'u1' }, 'tok');
    expect(res.success).toBe(true);
    expect(res.decks).toEqual([]);
    expect(res.message).toMatch(/no decks to beat/i);
  });

  it('surfaces coverage API failures', async () => {
    wire({ coverageBody: { success: false, error: 'boom' } });
    const res = await compareCollectionToDecksToBeatTool.handler({}, { id: 'u1' }, 'tok');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/boom/);
  });
});
