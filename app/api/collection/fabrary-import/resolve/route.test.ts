/**
 * Unit tests: resolvePrinting() — Fabrary CSV rows must resolve to the
 * ENGLISH printing even though collector numbers now carry foreign-language
 * sibling rows (identical foiling/edition/art — the 2026-07 fr/ja backfill
 * made every affected import row "ambiguous").
 *
 * Fabrary exports have no language column, so English is the only correct
 * target — EXCEPT foreign-exclusive sets (2HP/RAP) where no English printing
 * exists and the foreign row is the right answer.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/services', () => ({ printingsService: { searchPrintings: vi.fn() } }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

// Import AFTER mocks (vi.mock is hoisted)
import { resolvePrinting } from './route';
import type { FabraryParsedRow } from '@/lib/utils/fabrary-csv';
import type { PrintingDTO } from '@/lib/services/contracts/IPrintingsService';

const row = (over: Partial<FabraryParsedRow> = {}): FabraryParsedRow => ({
  collectorNumber: 'OMN243',
  name: 'A Bit off the Side',
  foiling: 's',
  edition: 'n',
  treatments: [],
  inventoryQty: 1,
  forTrade: false,
  wantsQty: 0,
  hasInventory: true,
  hasWants: false,
  ...over,
});

const p = (over: Partial<PrintingDTO> = {}): PrintingDTO =>
  ({
    printing_id: 'en-id',
    name: 'A Bit off the Side',
    collector_number: 'OMN243',
    language: 'en',
    foiling: 's',
    edition: 'n',
    art_variations: [],
    is_front_face: true,
    ...over,
  }) as PrintingDTO;

describe('resolvePrinting', () => {
  it('prefers the English printing over identical foreign-language siblings', () => {
    const candidates = [
      p({ printing_id: 'fr-id', language: 'fr' }),
      p({ printing_id: 'en-id', language: 'en' }),
      p({ printing_id: 'ja-id', language: 'ja' }),
    ];
    expect(resolvePrinting(row(), candidates)?.printing_id).toBe('en-id');
  });

  it('still resolves foreign-exclusive sets where no English printing exists', () => {
    const candidates = [
      p({ printing_id: 'de-2hp', language: 'de', collector_number: '2HP042' }),
    ];
    expect(resolvePrinting(row({ collectorNumber: '2HP042' }), candidates)?.printing_id).toBe('de-2hp');
  });

  it('matches foiling and edition', () => {
    const candidates = [
      p({ printing_id: 'rf-id', foiling: 'r' }),
      p({ printing_id: 's-id', foiling: 's' }),
    ];
    expect(resolvePrinting(row(), candidates)?.printing_id).toBe('s-id');
  });

  it('treatments narrow to the art variant', () => {
    const candidates = [
      p({ printing_id: 'plain-id' }),
      p({ printing_id: 'ea-id', art_variations: ['EA'] }),
    ];
    expect(resolvePrinting(row({ treatments: ['EA'] }), candidates)?.printing_id).toBe('ea-id');
    expect(resolvePrinting(row(), candidates)?.printing_id).toBe('plain-id');
  });

  it('remains null for a genuine same-language ambiguity', () => {
    const candidates = [
      p({ printing_id: 'a', art_variations: ['AA'] }),
      p({ printing_id: 'b', art_variations: ['AA'] }),
    ];
    expect(resolvePrinting(row({ treatments: ['AA'] }), candidates)).toBeNull();
  });

  it('DFC collector collisions tiebreak by card name', () => {
    const candidates = [
      p({ printing_id: 'kassai', name: 'Kassai of the Golden Sand' }),
      p({ printing_id: 'tuffnut', name: 'Tuffnut, Bumbling Hulkster' }),
    ];
    expect(
      resolvePrinting(row({ name: 'Tuffnut, Bumbling Hulkster' }), candidates)?.printing_id,
    ).toBe('tuffnut');
  });
});
