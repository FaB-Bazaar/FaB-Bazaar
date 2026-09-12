/**
 * Integration tests for PostgresPrintingsService.bulkResolveByCollectorNumber.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 *
 * Purpose: the /browse bulk import lets users key "2 WTR001" instead of a
 * card name. One query resolves every requested collector number to ALL of
 * its printings (every edition/foiling of that set printing) so the page can
 * default to NF Unlimited and let the user switch.
 */

import { describe, it, expect } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

describe('PostgresPrintingsService.bulkResolveByCollectorNumber', () => {
  it('returns one entry per input, in input order, each holding only that collector number', async () => {
    const result = await service.bulkResolveByCollectorNumber(['WTR001', 'ARC057']);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.map(r => r.collectorNumber)).toEqual(['WTR001', 'ARC057']);
    for (const entry of result.data) {
      expect(entry.printings.length).toBeGreaterThan(0);
      for (const p of entry.printings) {
        expect(p.collector_number).toBe(entry.collectorNumber);
      }
    }
  });

  it('returns every edition/foiling of the printing so the caller can pick a default', async () => {
    const result = await service.bulkResolveByCollectorNumber(['WTR001']);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const editions = new Set(result.data[0].printings.map(p => p.edition));
    // WTR001 exists at least in Alpha and Unlimited.
    expect(editions.has('u')).toBe(true);
    expect(editions.size).toBeGreaterThan(1);
  });

  it('is case-insensitive on input and reports the canonical uppercase number', async () => {
    const result = await service.bulkResolveByCollectorNumber(['arc057']);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data[0].collectorNumber).toBe('ARC057');
    expect(result.data[0].printings.length).toBeGreaterThan(0);
  });

  it('returns an empty printings array for an unknown collector number', async () => {
    const result = await service.bulkResolveByCollectorNumber(['ZZZ999']);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toEqual([{ collectorNumber: 'ZZZ999', printings: [] }]);
  });

  it('returns an empty array for empty input without hitting the DB', async () => {
    const result = await service.bulkResolveByCollectorNumber([]);
    expect(result).toEqual({ success: true, data: [] });
  });
});
