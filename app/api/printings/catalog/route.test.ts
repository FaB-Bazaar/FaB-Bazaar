/**
 * Route unit tests: GET /api/printings/catalog — the public print-code catalog
 * (every printing + the code the CSV import accepts for it).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({ printingsService: { listPrintCodeCatalog: vi.fn() } }));

// Import AFTER mocks (vi.mock is hoisted)
import { GET } from './route';
import { resetCatalogCsvCache } from '@/lib/import/print-code-catalog';
import { printingsService } from '@/lib/services';

const mockList = vi.mocked(printingsService.listPrintCodeCatalog);

const row = {
  print_code: 'ARC159-RF-1E', printing_id: 'p1', name: 'Command and Conquer', pitch: 1, set: 'arc',
  collector_number: 'ARC159', language: 'en', foiling: 'r', edition: 'f', art_variations: [], rarity: 'm',
};

beforeEach(() => {
  mockList.mockReset();
  resetCatalogCsvCache();
});

describe('GET /api/printings/catalog', () => {
  it('returns the catalog as a downloadable CSV', async () => {
    mockList.mockResolvedValue({ success: true, data: [row] });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/csv/);
    expect(res.headers.get('content-disposition')).toMatch(/attachment; filename="fabbazaar-print-codes\.csv"/);
    const text = await res.text();
    expect(text.split('\n')[0]).toBe('print_code,name,pitch,set,collector_number,language,foiling,edition,art_variations,rarity,printing_id');
    expect(text.split('\n')[1]).toMatch(/^ARC159-RF-1E,Command and Conquer/);
  });

  it('serves repeat requests from memory', async () => {
    mockList.mockResolvedValue({ success: true, data: [row] });
    await GET();
    await GET();
    expect(mockList).toHaveBeenCalledTimes(1);
  });

  it('500s when the lookup fails, and does not cache the failure', async () => {
    mockList.mockResolvedValueOnce({ success: false, error: 'db down' });
    expect((await GET()).status).toBe(500);
    mockList.mockResolvedValueOnce({ success: true, data: [row] });
    expect((await GET()).status).toBe(200);
  });
});
