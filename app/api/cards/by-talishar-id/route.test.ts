import { describe, it, expect, vi, beforeEach } from 'vitest';

// pool is the only dependency the route uses. Mock it before importing the route.
vi.mock('@/lib/postgres/db', () => ({
  pool: { query: vi.fn() },
}));

import { GET, POST } from './route';
import { pool } from '@/lib/postgres/db';
const mockQuery = vi.mocked(pool.query);

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    card_unique_id: 'card-1',
    display_name: 'Crown of Providence',
    pitch: null,
    image_url: 'https://cdn.example/crown.webp',
    talishar_card_id: 'crown_of_providence',
    ...overrides,
  };
}

beforeEach(() => {
  mockQuery.mockReset();
});

describe('GET /api/cards/by-talishar-id', () => {
  it('returns 400 when the id query parameter is missing', async () => {
    const res = await GET(new Request('http://localhost/api/cards/by-talishar-id') as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: expect.any(String) });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('looks up a single card by Talishar id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeRow()] } as any);
    const res = await GET(new Request('http://localhost/api/cards/by-talishar-id?id=crown_of_providence') as any);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.talisharCardId).toBe('crown_of_providence');
    expect(body.data.imageUrl).toBe('https://cdn.example/crown.webp');
  });

  it('strips state suffixes before the lookup', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeRow()] } as any);
    await GET(new Request('http://localhost/api/cards/by-talishar-id?id=crown_of_providence_equip') as any);
    // Query must have been called with the normalized id (suffix stripped).
    const args = mockQuery.mock.calls[0]![1] as unknown[];
    expect(args[0]).toEqual(['crown_of_providence']);
  });

  it('strips the alt-art set prefix', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    await GET(new Request('http://localhost/api/cards/by-talishar-id?id=MST053_inner_chi_blue') as any);
    const args = mockQuery.mock.calls[0]![1] as unknown[];
    expect(args[0]).toEqual(['inner_chi_blue']);
  });

  it('returns null data when no card matches', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    const res = await GET(new Request('http://localhost/api/cards/by-talishar-id?id=nonexistent_card') as any);
    expect(await res.json()).toEqual({ success: true, data: null });
  });
});

describe('POST /api/cards/by-talishar-id', () => {
  function postReq(body: unknown) {
    return new Request('http://localhost/api/cards/by-talishar-id', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as any;
  }

  it('returns 400 when body.ids is not an array', async () => {
    const res = await POST(postReq({ ids: 'not-an-array' }));
    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns a map keyed by the original (un-normalized) input id', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [makeRow({ talishar_card_id: 'crown_of_providence' })],
    } as any);

    // Caller passes the suffixed form; response should use the same key back.
    const res = await POST(postReq({ ids: ['crown_of_providence_equip'] }));
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('crown_of_providence_equip');
    expect(body.data['crown_of_providence_equip'].talisharCardId).toBe('crown_of_providence');
  });

  it('deduplicates normalized ids before querying', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [makeRow({ talishar_card_id: 'crown_of_providence' })],
    } as any);

    // Two inputs that normalize to the same id should only produce one DB query arg.
    await POST(postReq({ ids: ['crown_of_providence', 'crown_of_providence_equip'] }));
    const args = mockQuery.mock.calls[0]![1] as unknown[];
    expect(args[0]).toEqual(['crown_of_providence']);
  });

  it('omits missing ids from the response', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [makeRow({ talishar_card_id: 'crown_of_providence' })],
    } as any);

    const res = await POST(postReq({ ids: ['crown_of_providence', 'nope'] }));
    const body = await res.json();
    expect(Object.keys(body.data)).toEqual(['crown_of_providence']);
  });

  it('rejects non-string entries silently', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    await POST(postReq({ ids: ['crown_of_providence', 123, null, ''] }));
    const args = mockQuery.mock.calls[0]![1] as unknown[];
    expect(args[0]).toEqual(['crown_of_providence']);
  });
});
