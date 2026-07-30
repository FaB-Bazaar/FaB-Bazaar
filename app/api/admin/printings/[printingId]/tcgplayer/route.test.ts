/**
 * Unit tests for PATCH /api/admin/printings/[printingId]/tcgplayer.
 *
 * A manual TCGplayer fix on a printing row is only durable if it also lands in
 * feed_overrides — the nightly pipeline re-upserts printings from the feed
 * (step 005) and computes prices from the feed's product id (step 002), so a
 * row-only edit is clobbered and never reprices. The route therefore
 * auto-records an override (keyed by the row's collector/edition/foiling/
 * art_variations) BEFORE touching the row: if the override write fails,
 * nothing is changed and the caller sees the error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  userService: { getRoles: vi.fn() },
  printingsService: { getPrintingsByIds: vi.fn() },
  feedOverridesService: { upsertByMatchKey: vi.fn() },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateSession: vi.fn(),
}));

const dbWhere = vi.fn(async () => undefined);
const dbSet = vi.fn(() => ({ where: dbWhere }));
const dbUpdate = vi.fn(() => ({ set: dbSet }));
vi.mock('@/lib/postgres/db', () => ({
  db: { update: (...args: unknown[]) => dbUpdate(...args) },
}));

import { PATCH } from './route';
import { userService, printingsService, feedOverridesService } from '@/lib/services';
import { authenticateSession } from '@/lib/auth/multi-auth';

const mockRoles = vi.mocked(userService.getRoles);
const mockGetPrintings = vi.mocked(printingsService.getPrintingsByIds);
const mockUpsert = vi.mocked(feedOverridesService.upsertByMatchKey);
const mockAuth = vi.mocked(authenticateSession);

const PRINTING = {
  printing_id: 'FRWzJzfBKFRqmjLQCttnt',
  collector_number: 'ELE146',
  edition: 'f',
  foiling: 'r',
  language: 'en',
  art_variations: ['AA'],
};

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/admin/printings/FRWzJzfBKFRqmjLQCttnt/tcgplayer', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const params = Promise.resolve({ printingId: 'FRWzJzfBKFRqmjLQCttnt' });

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'admin-1' } as any);
  mockRoles.mockResolvedValue({ success: true, data: { isSuperAdmin: true } } as any);
  mockGetPrintings.mockResolvedValue({ success: true, data: { printings: [PRINTING] } } as any);
  mockUpsert.mockResolvedValue({ success: true, data: { id: 'ov-1' } } as any);
});

describe('PATCH /api/admin/printings/[printingId]/tcgplayer', () => {
  it('404s when the printing does not exist', async () => {
    mockGetPrintings.mockResolvedValue({ success: true, data: { printings: [] } } as any);

    const res = await PATCH(
      makeRequest({ tcgplayerProductId: '248564' }),
      { params }
    );

    expect(res.status).toBe(404);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(dbUpdate).not.toHaveBeenCalled();
  });

  it('auto-records a feed override keyed by the row identity, then updates the row', async () => {
    const res = await PATCH(
      makeRequest({
        tcgplayerProductId: '248564',
        tcgplayerUrl: 'https://www.tcgplayer.com/product/248564',
      }),
      { params }
    );

    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        collectorNumber: 'ELE146',
        edition: 'f',
        foiling: 'r',
        artVariations: ['AA'],
        setFields: {
          tcgplayer_product_id: '248564',
          tcgplayer_url: 'https://www.tcgplayer.com/product/248564',
        },
        createdBy: 'admin-1',
      })
    );
    expect(dbUpdate).toHaveBeenCalled();

    const body = await res.json();
    expect(body.data.overrideId).toBe('ov-1');
  });

  it('records a no-variant printing with an exact empty art match, not a wildcard', async () => {
    mockGetPrintings.mockResolvedValue({
      success: true,
      data: { printings: [{ ...PRINTING, art_variations: [] }] },
    } as any);

    await PATCH(makeRequest({ tcgplayerProductId: '247879' }), { params });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ artVariations: [] })
    );
  });

  it('leaves the row untouched when the override write fails', async () => {
    mockUpsert.mockResolvedValue({ success: false, error: 'db down' } as any);

    const res = await PATCH(makeRequest({ tcgplayerProductId: '248564' }), { params });

    expect(res.status).toBe(500);
    expect(dbUpdate).not.toHaveBeenCalled();
  });

  it('records a subtype-only patch', async () => {
    await PATCH(makeRequest({ tcgplayerSubtypeName: 'Rainbow Foil' }), { params });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        setFields: { tcgplayer_subtype_name: 'Rainbow Foil' },
      })
    );
  });

  it('still rejects a non-numeric product id', async () => {
    const res = await PATCH(makeRequest({ tcgplayerProductId: 'abc' }), { params });

    expect(res.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
