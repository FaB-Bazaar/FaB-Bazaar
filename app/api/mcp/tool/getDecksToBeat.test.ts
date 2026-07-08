import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/mcp-fetch', () => ({
  mcpFetch: vi.fn(),
  getMcpApiBaseUrl: () => 'http://test',
}));

import { getDecksToBeatTool } from './getDecksToBeat';
import { mcpFetch } from '@/lib/mcp-fetch';

const mockFetch = vi.mocked(mcpFetch);
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => '' }) as never;

beforeEach(() => vi.clearAllMocks());

describe('get_decks_to_beat month defaulting', () => {
  it('defaults to the LATEST month with featured decks, not the (possibly empty) current month', async () => {
    mockFetch.mockImplementation((url: any) => {
      const u = String(url);
      if (u.includes('/featured-latest-month')) {
        return Promise.resolve(ok({ success: true, data: { year: 2026, month: 3 } }));
      }
      if (u.includes('/api/decks/community')) {
        return Promise.resolve(ok({ success: true, data: { decks: [{ publicId: 'd1', name: 'Deck', heroName: 'arakni', format: 'Classic Constructed' }], total: 1 } }));
      }
      return Promise.resolve(ok({ success: false, error: 'unexpected ' + u }));
    });

    const res: any = await getDecksToBeatTool.handler({});
    expect(res.success).toBe(true);
    const communityCall = mockFetch.mock.calls.map((c) => String(c[0])).find((u) => u.includes('/api/decks/community'))!;
    expect(communityCall).toContain('month=3');
    expect(communityCall).toContain('year=2026');
  });

  it('respects an explicit month/year without consulting the latest-month endpoint', async () => {
    mockFetch.mockImplementation((url: any) => {
      const u = String(url);
      if (u.includes('/api/decks/community')) {
        return Promise.resolve(ok({ success: true, data: { decks: [], total: 0 } }));
      }
      return Promise.resolve(ok({ success: false, error: 'unexpected ' + u }));
    });

    await getDecksToBeatTool.handler({ month: 5, year: 2026 });
    const urls = mockFetch.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/featured-latest-month'))).toBe(false);
    expect(urls.find((u) => u.includes('/api/decks/community'))).toContain('month=5');
  });
});
