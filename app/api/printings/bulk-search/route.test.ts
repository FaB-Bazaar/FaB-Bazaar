/**
 * Unit tests for POST /api/printings/bulk-search
 *
 * Mocked printingsService — tests the request-splitting logic: cards with a
 * collectorNumber resolve through bulkResolveByCollectorNumber, the rest
 * through bulkResolveByName, and results land at their original indices.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  printingsService: {
    bulkResolveByName: vi.fn(),
    bulkResolveByCollectorNumber: vi.fn(),
    searchPrintings: vi.fn(),
  },
}));

import { POST } from './route';
import { printingsService } from '@/lib/services';

const mockByName = vi.mocked(printingsService.bulkResolveByName);
const mockByCollector = vi.mocked(printingsService.bulkResolveByCollectorNumber);

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/printings/bulk-search', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const printing = (overrides: Record<string, unknown>) => ({
  printing_id: 'p1', card_unique_id: 'c1', name: 'x', collector_number: 'WTR001',
  set: 'wtr', edition: 'u', foiling: 's', ...overrides,
});

describe('POST /api/printings/bulk-search — collector numbers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockByName.mockResolvedValue({ success: true, data: [] } as any);
    mockByCollector.mockResolvedValue({ success: true, data: [] } as any);
  });

  it('routes collectorNumber cards to bulkResolveByCollectorNumber and name cards to bulkResolveByName', async () => {
    mockByName.mockResolvedValue({
      success: true,
      data: [{ name: 'snatch', pitch: 1, printings: [printing({ printing_id: 'snatch-1', collector_number: 'WTR170' })] }],
    } as any);
    mockByCollector.mockResolvedValue({
      success: true,
      data: [{ collectorNumber: 'WTR001', printings: [printing({ printing_id: 'wtr001-u' })] }],
    } as any);

    const res = await POST(makeRequest({
      cards: [
        { name: 'wtr001', collectorNumber: 'WTR001' },
        { name: 'snatch', color: 'red' },
      ],
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockByCollector).toHaveBeenCalledWith(['WTR001'], undefined);
    expect(mockByName).toHaveBeenCalledWith([{ name: 'snatch', pitch: 1 }], undefined);
    expect(json.data.results[0].printings.map((p: any) => p.printing_id)).toEqual(['wtr001-u']);
    expect(json.data.results[1].printings.map((p: any) => p.printing_id)).toEqual(['snatch-1']);
  });

  it('applies the per-card foiling/edition post-filter to collector results', async () => {
    mockByCollector.mockResolvedValue({
      success: true,
      data: [{
        collectorNumber: 'WTR001',
        printings: [
          printing({ printing_id: 'u-s', edition: 'u', foiling: 's' }),
          printing({ printing_id: 'u-r', edition: 'u', foiling: 'r' }),
          printing({ printing_id: 'a-r', edition: 'a', foiling: 'r' }),
        ],
      }],
    } as any);

    const res = await POST(makeRequest({
      cards: [{ name: 'wtr001', collectorNumber: 'WTR001', foiling: 'r', edition: 'u' }],
    }));
    const json = await res.json();

    expect(json.data.results[0].printings.map((p: any) => p.printing_id)).toEqual(['u-r']);
    expect(mockByName).not.toHaveBeenCalled();
  });

  it('forwards shared hero/format filters to the collector resolver', async () => {
    await POST(makeRequest({
      cards: [{ name: 'wtr001', collectorNumber: 'WTR001' }],
      format: 'cc',
    }));

    expect(mockByCollector).toHaveBeenCalledWith(['WTR001'], expect.objectContaining({ format: 'cc' }));
  });
});
