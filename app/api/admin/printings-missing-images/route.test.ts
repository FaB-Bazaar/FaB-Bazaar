/**
 * GET /api/admin/printings-missing-images — the admin image-uploads grid.
 *
 * Regression under test: the route must return each printing's REAL image_url.
 * Historically it didn't, so the client reconstructed `<CF_BASE>/<printing_id>/
 * public` — which 404s for every deterministic-id row (~788 of 811 MPW rows)
 * and made the grid report healthy images as broken.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const chainables: any[] = [];
function makeChainable(result: unknown) {
  const c: any = {};
  for (const m of ['from', 'innerJoin', 'where', 'orderBy', 'limit', 'offset']) {
    c[m] = vi.fn(() => c);
  }
  c.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject);
  chainables.push(c);
  return c;
}

const selectProjections: any[] = [];
vi.mock('@/lib/postgres/db', () => ({
  db: {
    select: vi.fn((projection: any) => {
      selectProjections.push(projection);
      // first select = rows, second = count
      return makeChainable(
        selectProjections.length === 1
          ? [{ printingId: 'p1', imageUrl: 'https://imagedelivery.net/x/MPW029/public' }]
          : [{ count: 1 }],
      );
    }),
  },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateSession: vi.fn() }));
vi.mock('@/lib/services', () => ({ userService: { getRoles: vi.fn() } }));

import { GET } from './route';
import { printings } from '@/lib/postgres/schema';
import { authenticateSession } from '@/lib/auth/multi-auth';
import { userService } from '@/lib/services';

beforeEach(() => {
  selectProjections.length = 0;
  chainables.length = 0;
  vi.mocked(authenticateSession).mockResolvedValue({ success: true, userId: 'admin-1' } as any);
  vi.mocked(userService.getRoles).mockResolvedValue({ success: true, data: { isSuperAdmin: true } } as any);
});

describe('GET /api/admin/printings-missing-images', () => {
  it('selects the real image_url column for each row', async () => {
    const res = await GET(new Request('http://localhost/api/admin/printings-missing-images') as any);
    const body = await res.json();

    expect(body.success).toBe(true);
    // The projection must ask the DB for image_url — the client renders
    // previews from it instead of reconstructing printing_id URLs.
    expect(selectProjections[0].imageUrl).toBe(printings.imageUrl);
    expect(body.data.printings[0].imageUrl).toBe('https://imagedelivery.net/x/MPW029/public');
  });
});
