/**
 * Unit tests for POST /api/buylist/rollup
 *
 * Mocked services + auth — tests HTTP concerns: validation, price/ownership
 * assembly, anonymous vs authenticated behaviour, and error handling.
 *
 * Auth here is OPTIONAL by design: the endpoint powers a public article
 * component, so a signed-out reader gets prices with no ownership overlay
 * rather than a 401.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  printingsService: { getPrintingsByIds: vi.fn() },
  inventoryService: { getOwnedCountsByCardUniqueId: vi.fn() },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

import { POST } from './route';
import { printingsService, inventoryService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockGetPrintings = vi.mocked(printingsService.getPrintingsByIds);
const mockOwnedCounts = vi.mocked(inventoryService.getOwnedCountsByCardUniqueId);
const mockAuth = vi.mocked(authenticateRequest);

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/buylist/rollup', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const TIERS = [
  {
    label: 'The Core',
    groups: [
      {
        label: 'Steel Soul Set',
        cards: [
          { printingId: 'p-memory', qty: 3 },
          { printingId: 'p-processor', qty: 3 },
        ],
      },
    ],
  },
];

const PRINTINGS = [
  {
    printing_id: 'p-memory',
    card_unique_id: 'c-memory',
    name: 'Evo Steel Soul Memory',
    collector_number: 'EVO026',
    set: 'evo',
    foiling: 's',
    image_url: 'https://img/EVO026',
    tcgplayer_url: 'https://www.tcgplayer.com/product/517741',
    tcg_low: 7.99,
    tcg_market: 9.5,
  },
  {
    printing_id: 'p-processor',
    card_unique_id: 'c-processor',
    name: 'Evo Steel Soul Processor',
    collector_number: 'EVO027',
    set: 'evo',
    foiling: 's',
    image_url: 'https://img/EVO027',
    tcg_low: 8.18,
    tcg_market: 9.0,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: false, error: 'no auth' } as any);
  mockGetPrintings.mockResolvedValue({ success: true, data: { printings: PRINTINGS } } as any);
  mockOwnedCounts.mockResolvedValue({ success: true, data: {} } as any);
});

describe('POST /api/buylist/rollup — validation', () => {
  it('rejects a body with no tiers array', async () => {
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/tiers/i);
  });

  it('rejects a tiers value that is not an array', async () => {
    const res = await POST(makeRequest({ tiers: 'the core' }));

    expect(res.status).toBe(400);
  });

  it('rejects a list larger than the lookup cap rather than hammering the DB', async () => {
    const cards = Array.from({ length: 501 }, (_, i) => ({ printingId: `p-${i}`, qty: 1 }));
    const res = await POST(makeRequest({ tiers: [{ label: 'Huge', groups: [{ label: 'g', cards }] }] }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/too many/i);
  });

  it('rejects an unparseable quantity with a 400, not a 500', async () => {
    const res = await POST(
      makeRequest({
        tiers: [{ label: 'T', groups: [{ label: 'g', cards: [{ printingId: 'p-memory', qty: 'lots' }] }] }],
      })
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/quantity/i);
  });
});

describe('POST /api/buylist/rollup — pricing', () => {
  it('returns a priced rollup with grand totals', async () => {
    const res = await POST(makeRequest({ tiers: TIERS }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // (7.99 + 8.18) * 3
    expect(body.data.rollup.totals.cost).toEqual({ min: 48.51, max: 48.51 });
  });

  it('returns display metadata per printing so the component need not refetch', async () => {
    const res = await POST(makeRequest({ tiers: TIERS }));
    const body = await res.json();

    expect(body.data.cards['p-memory']).toMatchObject({
      name: 'Evo Steel Soul Memory',
      collector_number: 'EVO026',
      image_url: 'https://img/EVO026',
    });
  });

  it('returns the tcgplayer url so the component can render buy links', async () => {
    const res = await POST(makeRequest({ tiers: TIERS }));
    const body = await res.json();

    expect(body.data.cards['p-memory'].tcgplayer_url).toBe(
      'https://www.tcgplayer.com/product/517741'
    );
    // Absent on the row → absent in the response, not undefined-stringified.
    expect(body.data.cards['p-processor'].tcgplayer_url).toBeNull();
  });

  it('looks up each printing once even when it appears in several groups', async () => {
    await POST(
      makeRequest({
        tiers: [
          { label: 'A', groups: [{ label: 'g', cards: [{ printingId: 'p-memory', qty: 1 }] }] },
          { label: 'B', groups: [{ label: 'h', cards: [{ printingId: 'p-memory', qty: 2 }] }] },
        ],
      })
    );

    expect(mockGetPrintings).toHaveBeenCalledWith(['p-memory']);
  });

  it('surfaces a printings lookup failure as a 500', async () => {
    mockGetPrintings.mockResolvedValue({ success: false, error: 'db down' } as any);

    const res = await POST(makeRequest({ tiers: TIERS }));

    expect(res.status).toBe(500);
  });
});

describe('POST /api/buylist/rollup — ownership', () => {
  it('omits ownership for a signed-out reader and never calls the inventory service', async () => {
    const res = await POST(makeRequest({ tiers: TIERS }));
    const body = await res.json();

    expect(body.data.authenticated).toBe(false);
    expect(mockOwnedCounts).not.toHaveBeenCalled();
    expect(body.data.rollup.totals.needCost).toEqual(body.data.rollup.totals.cost);
  });

  it('applies owned counts for a signed-in reader', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u-1' } as any);
    mockOwnedCounts.mockResolvedValue({ success: true, data: { 'c-memory': 2 } } as any);

    const res = await POST(makeRequest({ tiers: TIERS }));
    const body = await res.json();

    expect(body.data.authenticated).toBe(true);
    // memory: 1 of 3 still needed (7.99), processor: all 3 (24.54)
    expect(body.data.rollup.totals.needCost).toEqual({ min: 32.53, max: 32.53 });
  });

  it('counts ownership per card so a different printing of the same card still counts', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u-1' } as any);
    mockOwnedCounts.mockResolvedValue({ success: true, data: { 'c-memory': 3 } } as any);

    const res = await POST(makeRequest({ tiers: TIERS }));
    const body = await res.json();

    // Queried by card_unique_id, not printing_id — a foil copy satisfies the want.
    expect(mockOwnedCounts).toHaveBeenCalledWith('u-1', expect.arrayContaining(['c-memory', 'c-processor']));
    expect(body.data.rollup.tiers[0].groups[0].cards[0].needed).toEqual({ min: 0, max: 0 });
  });

  it('degrades to no ownership when the inventory lookup fails', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u-1' } as any);
    mockOwnedCounts.mockResolvedValue({ success: false, error: 'boom' } as any);

    const res = await POST(makeRequest({ tiers: TIERS }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.rollup.totals.needCost).toEqual(body.data.rollup.totals.cost);
  });
});
