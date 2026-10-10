/**
 * search_printings only searches front faces (Bank Breaker is the back of
 * Construct Bank Breaker) — but id lookups still reach a back face. Same
 * harness as searchPrintings.health.test.ts: real tool handler, mocked service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  printingsService: {
    searchPrintings: vi.fn(),
    bulkResolveByName: vi.fn(),
    getCardIdsByTranslatedName: vi.fn(),
    getCardTranslations: vi.fn(),
  },
}));

// Import AFTER mocks (vi.mock is hoisted)
import { searchPrintingsTool } from './searchPrintings';
import { printingsService } from '@/lib/services';

const mockSearch = vi.mocked(printingsService.searchPrintings);

beforeEach(() => {
  vi.clearAllMocks();
  mockSearch.mockResolvedValue({ success: true, data: { printings: [], total: 0, page: 1, pages: 0 } } as any);
  vi.mocked(printingsService.getCardIdsByTranslatedName).mockResolvedValue({ success: true, data: [] } as any);
});

async function filtersSeenByService(card: Record<string, unknown>) {
  const result = await searchPrintingsTool.handler({ cards: [card] });
  expect(result.success).toBe(true);
  return mockSearch.mock.calls[0][0];
}

describe('search_printings — front faces only', () => {
  it('a filter search skips back faces', async () => {
    expect((await filtersSeenByService({ filters: { name: 'bank breaker', exact: false } })).frontFaceOnly).toBe(true);
  });

  it('a shorthand search skips back faces', async () => {
    expect((await filtersSeenByService({ query: 'c:mechanologist t:weapon' })).frontFaceOnly).toBe(true);
  });

  it('a printingIds lookup still returns a back face', async () => {
    expect((await filtersSeenByService({ filters: { printingIds: ['D8FdbJrGjnMgqCGCpFfCN'] } }))).not.toHaveProperty('frontFaceOnly');
  });

  it('a cardUniqueId lookup still returns a back card', async () => {
    expect((await filtersSeenByService({ filters: { cardUniqueId: 'hHTFWRhbq9F7CwwbQqNQ8' } }))).not.toHaveProperty('frontFaceOnly');
  });
});

describe('search_printings — exact-name (bulk) path', () => {
  it('a plain name lookup skips back faces too', async () => {
    vi.mocked(printingsService.bulkResolveByName).mockResolvedValue({ success: true, data: [{ name: 'bank breaker', printings: [] }] } as any);
    await searchPrintingsTool.handler({ cards: [{ query: 'bank breaker' }] });
    expect(vi.mocked(printingsService.bulkResolveByName).mock.calls[0][1]).toEqual({ frontFaceOnly: true });
  });
});

describe('search_printings — a back-face name finds its front', () => {
  const back = { printing_id: 'D8FdbJrGjnMgqCGCpFfCN', card_unique_id: 'hHTFWRhbq9F7CwwbQqNQ8', name: 'Bank Breaker', is_front_face: false, other_face_name: 'Construct Bank Breaker', set: 'amx', collector_number: 'AMX022', edition: 'n', foiling: 's', rarity: 'p', types: ['weapon'] };
  const front = { ...back, printing_id: 'dtNHDgMjBfGqQNMdKGgbH', card_unique_id: 'RNCWjkhhdhrHCNRncqznq', name: 'Construct Bank Breaker', is_front_face: true, other_face_name: 'Bank Breaker', pitch: 2, types: ['action'] };
  const page = (printings: any[]) => ({ success: true, data: { printings, total: printings.length, page: 1, pages: 1 } }) as any;

  beforeEach(() => {
    mockSearch.mockImplementation(async (f: any) => {
      if (f.name === 'Construct Bank Breaker' && f.exact && f.frontFaceOnly) return page([front]);
      if (f.name === 'bank breaker' && !f.frontFaceOnly) return page([back]);
      return page([]);
    });
  });

  it('returns the front and says the name is its back face', async () => {
    const result: any = await searchPrintingsTool.handler({ cards: [{ filters: { name: 'bank breaker', types: ['weapon'] } }] });
    expect(result.results[0].printings.map((p: any) => p.name)).toEqual(['Construct Bank Breaker']);
    expect(result.message).toMatch(/back face of Construct Bank Breaker/i);
  });

  it('keeps a real zero result when no back face matches', async () => {
    const result: any = await searchPrintingsTool.handler({ cards: [{ filters: { name: 'zzz nothing', types: ['weapon'] } }] });
    expect(result.results[0].total).toBe(0);
  });
});

describe('search_printings — a back shared by several fronts', () => {
  // Viserai, Usurper is the back of the adult AND the young Viserai.
  const back = (front: string) => ({ printing_id: 'b' + front, card_unique_id: 'usurper', name: 'Viserai, Usurper', is_front_face: false, other_face_name: front, set: 'iar', collector_number: 'IAR106', edition: 'n', foiling: 's', rarity: 'm', types: ['hero'] });
  const front = (name: string, id: string) => ({ ...back(name), printing_id: id, card_unique_id: id, name, is_front_face: true, other_face_name: 'Viserai, Usurper' });
  const page = (printings: any[]) => ({ success: true, data: { printings, total: printings.length, page: 1, pages: 1 } }) as any;

  it('returns every front', async () => {
    mockSearch.mockImplementation(async (f: any) => {
      if (f.frontFaceOnly && f.exact && f.name === 'Viserai, the Forsaken') return page([front(f.name, 'adult')]);
      if (f.frontFaceOnly && f.exact && f.name === 'Viserai, Between Worlds') return page([front(f.name, 'young')]);
      if (!f.frontFaceOnly) return page([back('Viserai, the Forsaken'), back('Viserai, Between Worlds')]);
      return page([]);
    });
    const result: any = await searchPrintingsTool.handler({ cards: [{ filters: { name: 'viserai, usurper', types: ['hero'] } }] });
    expect(result.results[0].printings.map((p: any) => p.name).sort()).toEqual(['Viserai, Between Worlds', 'Viserai, the Forsaken']);
    expect(result.message).toMatch(/back face of Viserai, the Forsaken \/ Viserai, Between Worlds/);
  });
});
